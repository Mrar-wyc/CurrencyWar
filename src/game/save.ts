import { MATCH_CONFIG as CFG } from '../data/stages';
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
      if (merged.current.phase === 'battle' || merged.current.phase === 'gameOver' || merged.current.phase === 'victory') {
        merged.current.phase = 'prep';
      }
    }
    return merged;
  } catch {
    return defaultSave();
  }
}

/** 旧档迁移与脏数据防御：补齐投资策略字段、过滤非法策略 id、空三选一回退备战 */
function migrateMatch(cur: MatchState): void {
  const known = new Set(STRATEGIES.map(s => s.id));
  const validIds = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [];
  cur.strategies = validIds(cur.strategies);
  cur.strategyOffers = validIds(cur.strategyOffers);
  cur.strategyData = cur.strategyData && typeof cur.strategyData === 'object' && !Array.isArray(cur.strategyData)
    ? cur.strategyData
    : {};
  if (cur.phase === 'strategy' && cur.strategyOffers.length === 0) cur.phase = 'prep';
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
