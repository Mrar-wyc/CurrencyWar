import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { ALL_EQUIPS } from '../data/equipment';
import { CHARACTERS, POOL_COPIES } from '../data/characters';
import { STRATEGIES } from '../data/strategies';
import { ENVIRONMENTS } from '../data/environments';
import { rollShop } from '../logic/shop';
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

/** 旧档迁移（导出供测试）：字段补齐、id 白名单过滤、数值钳位、越界回退 */
export function migrateMatch(cur: MatchState): void {
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  /** 计数器 map：只保留有限数值，字符串/NaN 会顺着算式污染 flags 与金币 */
  const numMap = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
      }
    }
    return out;
  };
  /** 取出形如 u12 的 uid 序号（用于续发新 uid，避免与旧档重复） */
  const uidSeq = (uid: string): number => {
    if (!uid.startsWith('u')) return 0;
    const n = Number(uid.slice(1));
    return Number.isInteger(n) && n > 0 ? n : 0;
  };

  // ---- 数值标量：NaN/Infinity/越界一律钳回安全值（脏档会把顶栏、面板与战斗渲染打崩） ----
  // 载入时必为进行中的对局（0 血/终局已由 loadSave 弃档），故生命下限钳到 1 而不是 0
  cur.hp = num(cur.hp, CFG.startHp, 1, CFG.startHp);
  cur.gold = num(cur.gold, 0, 0, 9999);
  cur.level = num(cur.level, CFG.startLevel, CFG.startLevel, CFG.maxLevel);
  cur.exp = num(cur.exp, 0, 0, 999);
  // 经验必须小于「升到下一级所需」，否则一次买经验会连跳多级（甚至直冲 10 级）
  if (cur.level < CFG.maxLevel) {
    const need = CFG.expToNext[cur.level] ?? Number.POSITIVE_INFINITY;
    if (cur.exp >= need) cur.exp = Math.max(0, need - 1);
  } else {
    cur.exp = 0;
  }
  cur.winStreak = num(cur.winStreak, 0, 0, 99);
  cur.lossStreak = num(cur.lossStreak, 0, 0, 99);
  cur.battlesWon = num(cur.battlesWon, 0, 0, 999);
  cur.battlesLost = num(cur.battlesLost, 0, 0, 999);
  cur.bestWinStreak = num(cur.bestWinStreak, 0, 0, 99);
  cur.threeStarsMade = num(cur.threeStarsMade, 0, 0, 999);
  cur.freeRerolls = num(cur.freeRerolls, 0, 0, 99);
  cur.freeBuys = num(cur.freeBuys, 0, 0, 99);
  cur.gemGoldTick = num(cur.gemGoldTick, 0, 0, 999);
  // ---- 布尔字段：字符串 "false" 是真值，会让超频/锁定/宝钻提示静默反转 ----
  cur.wealthGem = cur.wealthGem === true;
  cur.shopLocked = cur.shopLocked === true;
  cur.overclock = cur.overclock === true;
  cur.gemNew = cur.gemNew === true;

  // ---- 投资策略 / 投资环境：id 白名单 + 计数器数值化 ----
  const known = new Set(STRATEGIES.map(s => s.id));
  const validIds = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [];
  cur.strategies = validIds(cur.strategies);
  cur.strategyOffers = validIds(cur.strategyOffers);
  cur.strategyData = numMap(cur.strategyData);
  const envOk = new Set(ENVIRONMENTS.map(e => e.id));
  const filterEnv = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && envOk.has(x)))] : [];
  cur.environments = filterEnv(cur.environments);
  cur.environmentOffers = filterEnv(cur.environmentOffers);
  cur.environmentData = numMap(cur.environmentData);

  // ---- 装备 / 角色 id 白名单：失效 id 会让 equipById/charById 抛异常崩坏界面 ----
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
        if (o.kind === 'gold') return typeof o.gold === 'number' && Number.isFinite(o.gold);
        return o.kind === 'equip' && typeof o.equipId === 'string' && equipOk.has(o.equipId);
      })
    : [];
  cur.board = filterUnits(cur.board);
  cur.bench = filterUnits(cur.bench);

  /**
   * 单位规范化。slot 此前完全不校验，而棋盘是按 slot 反查渲染的：
   * 非法 slot ⇒ 单位不渲染、点不到、卖不掉，却仍占上阵数与羁绊计数，出战按钮永久失效。
   */
  const validSlot = (s: unknown): { row: 'front' | 'back'; index: number } | null => {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    const row = o.row;
    const idx = o.index;
    if ((row !== 'front' && row !== 'back') || typeof idx !== 'number' || !Number.isInteger(idx)) return null;
    // 后台上限留出财富宝钻的第 5 格，超出物理棋盘的一律视为非法
    const max = row === 'front' ? CFG.frontSlots : CFG.backSlots + 1;
    return idx < 0 || idx >= max ? null : { row, index: idx };
  };
  for (const u of [...cur.board, ...cur.bench]) {
    u.equips = filterIds(u.equips);
    u.slot = validSlot(u.slot);
  }
  // 上阵数组里 slot 非法的单位退回备战席；同一格被两个单位占用时只保留先出现的
  const usedSlots = new Set<string>();
  cur.board = cur.board.filter(u => {
    if (!u.slot || usedSlots.has(`${u.slot.row}:${u.slot.index}`)) {
      u.slot = null;
      cur.bench.push(u);
      return false;
    }
    usedSlots.add(`${u.slot.row}:${u.slot.index}`);
    return true;
  });
  // 规模不变量与等级脱钩时，溢出单位退回备战席（而不是直接丢弃，尽量保住玩家的棋子）
  while (cur.board.length > cur.level) {
    const u = cur.board.pop();
    if (!u) break;
    u.slot = null;
    cur.bench.push(u);
  }
  if (cur.bench.length > CFG.benchSlots) cur.bench = cur.bench.slice(0, CFG.benchSlots);

  // ---- uid 唯一性：重复 uid 会让「卖一个删两个」「站位互换删两个」，并污染引擎的 uid 索引 ----
  let seq = 1;
  for (const u of [...cur.board, ...cur.bench]) seq = Math.max(seq, uidSeq(u.uid) + 1);
  if (typeof cur.seq === 'number' && Number.isFinite(cur.seq)) seq = Math.max(seq, Math.ceil(cur.seq));
  const seenUid = new Set<string>();
  for (const u of [...cur.board, ...cur.bench]) {
    if (seenUid.has(u.uid)) u.uid = `u${seq++}`;
    seenUid.add(u.uid);
  }
  cur.seq = seq;

  // ---- 共享牌池：缺键按费用补满、越界钳回、非数值丢弃；坏池会让商店永久空或直接崩 ----
  const rawPool = (cur.pool && typeof cur.pool === 'object' && !Array.isArray(cur.pool))
    ? cur.pool as Record<string, unknown>
    : {};
  const pool: Record<string, number> = {};
  for (const c of CHARACTERS) {
    const max = POOL_COPIES[c.cost];
    pool[c.id] = num(rawPool[c.id], max, 0, max);
  }
  cur.pool = pool;

  // ---- 商店：缺失/长度不符/含非法 charId 时重摇（重摇会从牌池扣除，与正常商品口径一致） ----
  const shopOk = Array.isArray(cur.shop) && cur.shop.length === CFG.shopSize && cur.shop.every(o => {
    if (!o || typeof o !== 'object') return false;
    const id = (o as unknown as { charId?: unknown }).charId;
    return id === null || (typeof id === 'string' && charOk.has(id));
  });
  cur.shop = shopOk ? cur.shop : rollShop(cur.level, cur.pool);

  // ---- 节点坐标越界回起点 ----
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

/** 弃掉续档、保留终身统计（渲染异常或脏档无法修复时的兜底出口） */
export function discardCurrent(save: SaveData): void {
  save.current = null;
  writeSave(save);
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
