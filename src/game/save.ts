import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { ALL_EQUIPS } from '../data/equipment';
import { CHARACTERS } from '../data/characters';
import { STRATEGIES } from '../data/strategies';
import { ENVIRONMENTS } from '../data/environments';
import type { MatchState } from '../logic/types';

const KEY = 'currencywars_save_v1';

export interface SaveData {
  rank: number;
  totalWins: number;
  totalRuns: number;
  bestStreak: number;
  totalThreeStars: number;
  /** 通关过任意一局即解锁超频模式 */
  overclockUnlocked: boolean;
  /** 菜单里的超频开关 */
  overclockEnabled: boolean;
  /** 超频通关次数 */
  overclockWins: number;
  current: MatchState | null;
}

export function defaultSave(): SaveData {
  return { rank: 0, totalWins: 0, totalRuns: 0, bestStreak: 0, totalThreeStars: 0, overclockUnlocked: false, overclockEnabled: false, overclockWins: 0, current: null };
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
      } else if (ph !== 'prep' && ph !== 'reward' && ph !== 'strategy' && ph !== 'environment' && ph !== 'supplyResult') {
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
  // 数值字段：NaN/Infinity/越界一律钳回安全值——脏档会直接把顶栏、备战面板与战斗渲染打崩
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  cur.freeRerolls = num(cur.freeRerolls, 0, 0, 99);
  cur.freeBuys = num(cur.freeBuys, 0, 0, 99);
  cur.wealthGem = cur.wealthGem === true;
  cur.gemGoldTick = num(cur.gemGoldTick, 0, 0, 999);
  // 载入时必为进行中的对局（0 血/终局已由 loadSave 弃档），故生命下限钳到 1 而不是 0
  cur.hp = num(cur.hp, CFG.startHp, 1, CFG.startHp);
  cur.gold = num(cur.gold, 0, 0, 9999);
  cur.level = num(cur.level, CFG.startLevel, CFG.startLevel, CFG.maxLevel);
  cur.exp = num(cur.exp, 0, 0, 999);
  cur.winStreak = num(cur.winStreak, 0, 0, 99);
  cur.lossStreak = num(cur.lossStreak, 0, 0, 99);
  cur.battlesWon = num(cur.battlesWon, 0, 0, 999);
  cur.battlesLost = num(cur.battlesLost, 0, 0, 999);
  cur.bestWinStreak = num(cur.bestWinStreak, 0, 0, 99);
  cur.threeStarsMade = num(cur.threeStarsMade, 0, 0, 999);
  if (cur.phase === 'strategy' && cur.strategyOffers.length === 0) cur.phase = 'prep';
  // 投资环境：id 白名单过滤 + 计数器数值校验 + 空三选一回退
  const envOk = new Set(ENVIRONMENTS.map(e => e.id));
  const filterEnv = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && envOk.has(x)))] : [];
  cur.environments = filterEnv(cur.environments);
  cur.environmentOffers = filterEnv(cur.environmentOffers);
  cur.environmentData = cur.environmentData && typeof cur.environmentData === 'object' && !Array.isArray(cur.environmentData)
    ? cur.environmentData
    : {};
  if (cur.phase === 'environment' && cur.environmentOffers.length === 0) cur.phase = 'prep';
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
  // 规模不变量（脏档可能让上阵数/备战席与等级脱钩）：超出上限时截断，保持面板计数与 placeUnit 校验一致
  if (cur.board.length > cur.level) cur.board = cur.board.slice(0, cur.level);
  if (cur.bench.length > CFG.benchSlots) cur.bench = cur.bench.slice(0, CFG.benchSlots);
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
  } catch (e) {
    // 不抛（隐私模式/配额满不能中断对局），但要留痕：否则「进度莫名丢失」无从排查
    console.warn('[save] 写入失败，本局进度不会保存', e);
  }
}

/** 备战/领奖/选策略阶段自动续档（深拷贝，避免存档被对局中的状态污染） */
export function persistMatch(save: SaveData, st: MatchState): void {
  if (st.phase === 'prep' || st.phase === 'reward' || st.phase === 'strategy' || st.phase === 'environment' || st.phase === 'supplyResult') {
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
    gain = CFG.rankGain(st.hp) + (st.overclock ? 1 : 0);
    save.rank = Math.min(8, save.rank + gain);
    save.totalWins++;
    save.overclockUnlocked = true;
    if (st.overclock) save.overclockWins++;
  }
  save.totalRuns++;
  save.bestStreak = Math.max(save.bestStreak, st.bestWinStreak);
  save.totalThreeStars += st.threeStarsMade;
  save.current = null;
  writeSave(save);
  return { rankGain: gain, newRank: save.rank };
}
