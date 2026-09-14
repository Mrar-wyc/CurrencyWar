import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { ALL_EQUIPS } from '../data/equipment';
import { CHARACTERS } from '../data/characters';
import { STRATEGIES } from '../data/strategies';
import type { MatchState } from '../logic/types';

const KEY = 'currencywars_save_v1';

export interface SaveData {
  rank: number;
  totalWins: number;
  totalRuns: number;
  bestStreak: number;
  totalThreeStars: number;
  current: MatchState | null;
}

export function defaultSave(): SaveData {
  return { rank: 0, totalWins: 0, totalRuns: 0, bestStreak: 0, totalThreeStars: 0, current: null };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as SaveData;
    const merged = { ...defaultSave(), ...data };
    if (merged.current) {
      migrateMatch(merged.current);
      const ph = merged.current.phase;
      if (ph === 'gameOver' || ph === 'victory') {
        merged.current = null; // 终局不复活（防 0 血死局续档）
      } else if (ph === 'battle') {
        merged.current.phase = 'prep';
      } else if (ph !== 'prep' && ph !== 'reward' && ph !== 'strategy' && ph !== 'supplyResult') {
        merged.current = null; // 未知 phase：弃档防软锁
      }
    }
    return merged;
  } catch {
    return defaultSave();
  }
}

/** 旧档迁移与脏数据防御：补齐投资策略字段、过滤非法策略 id、空三选一回退备战 */
/** 旧档迁移（导出供测试）：字段补齐、id 白名单过滤、越界回退 */
export function migrateMatch(cur: MatchState): void {
  const known = new Set(STRATEGIES.map(s => s.id));
  const validIds = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [];
  cur.strategies = validIds(cur.strategies);
  cur.strategyOffers = validIds(cur.strategyOffers);
  cur.strategyData = cur.strategyData && typeof cur.strategyData === 'object' && !Array.isArray(cur.strategyData)
    ? cur.strategyData
    : {};
  cur.freeRerolls = typeof cur.freeRerolls === 'number' && Number.isFinite(cur.freeRerolls) ? cur.freeRerolls : 0;
  cur.freeBuys = typeof cur.freeBuys === 'number' && Number.isFinite(cur.freeBuys) ? cur.freeBuys : 0;
  cur.wealthGem = cur.wealthGem === true;
  cur.gemGoldTick = typeof cur.gemGoldTick === 'number' && Number.isFinite(cur.gemGoldTick) ? cur.gemGoldTick : 0;
  if (cur.phase === 'strategy' && cur.strategyOffers.length === 0) cur.phase = 'prep';
  // 装备/角色 id 白名单：失效 id 会让 equipById/charById 抛异常崩坏界面
  const equipOk = new Set(ALL_EQUIPS.map(e => e.id));
  const charOk = new Set(CHARACTERS.map(c => c.id));
  const filterIds = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && equipOk.has(x)) : [];
  const filterUnits = (v: unknown): MatchState['board'] =>
    Array.isArray(v)
      ? v.filter((u): u is MatchState['board'][number] => {
          if (!u || typeof u !== 'object') return false;
          const o = u as Record<string, unknown>;
          return typeof o.uid === 'string' && typeof o.charId === 'string' && charOk.has(o.charId)
            && (o.star === 1 || o.star === 2 || o.star === 3)
            && (o.equips === undefined || Array.isArray(o.equips));
        })
      : [];
  cur.inventory = filterIds(cur.inventory);
  cur.supplyItems = filterIds(cur.supplyItems);
  cur.rewards = Array.isArray(cur.rewards)
    ? cur.rewards.filter(r => {
        if (!r || typeof r !== 'object') return false;
        const o = r as unknown as Record<string, unknown>;
        if (o.kind === 'gold') return typeof o.gold === 'number';
        return o.kind === 'equip' && typeof o.equipId === 'string' && equipOk.has(o.equipId);
      })
    : [];
  cur.board = filterUnits(cur.board);
  cur.bench = filterUnits(cur.bench);
  for (const u of [...cur.board, ...cur.bench]) u.equips = filterIds(u.equips);
  // 节点坐标越界回起点
  if (!Number.isInteger(cur.plane) || cur.plane < 0 || cur.plane >= PLANES.length
    || !Number.isInteger(cur.node) || cur.node < 0 || cur.node >= PLANES[cur.plane].nodes.length) {
    cur.plane = 0;
    cur.node = 0;
    if (cur.phase !== 'prep') cur.phase = 'prep';
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 忽略存储异常（隐私模式等） */
  }
}

/** 备战/领奖/选策略阶段自动续档（深拷贝，避免存档被对局中的状态污染） */
export function persistMatch(save: SaveData, st: MatchState): void {
  if (st.phase === 'prep' || st.phase === 'reward' || st.phase === 'strategy' || st.phase === 'supplyResult') {
    save.current = structuredClone(st);
  } else if (st.phase === 'battle') {
    // 战斗中途退出：回退到该节点备战阶段
    const clone = structuredClone(st);
    clone.phase = 'prep';
    save.current = clone;
  } else {
    // gameOver/victory：对局已结束，清空续档（防重载后 0 血复活死局）
    save.current = null;
  }
  writeSave(save);
}

/** 对局结束：结算职级并清理续档 */
export function finishMatch(save: SaveData, st: MatchState): { rankGain: number; newRank: number } {
  let gain = 0;
  if (st.phase === 'victory') {
    gain = CFG.rankGain(st.hp);
    save.rank = Math.min(8, save.rank + gain);
    save.totalWins++;
  }
  save.totalRuns++;
  save.bestStreak = Math.max(save.bestStreak, st.bestWinStreak);
  save.totalThreeStars += st.threeStarsMade;
  save.current = null;
  writeSave(save);
  return { rankGain: gain, newRank: save.rank };
}
