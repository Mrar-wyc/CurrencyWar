import { CHARACTERS } from '../data/characters';
import { MATCH_CONFIG as CFG } from '../data/stages';
import { STRATEGIES, strategyById } from '../data/strategies';
import { activeTraits } from './synergy';
import { EMPTY_TEAM_FLAGS } from './types';
import type { MatchState, TeamFlags } from './types';

/** 是否已采纳某策略 */
export function hasStrategy(st: MatchState, id: string): boolean {
  return st.strategies.includes(id);
}

/** 投资策略三选一：每条独立按 银70%/金30% 摇档，同屏不重复 */
export function rollStrategyOffers(): string[] {
  const offers: string[] = [];
  const used = new Set<string>();
  while (offers.length < 3) {
    const grade: 'silver' | 'gold' = Math.random() < 0.7 ? 'silver' : 'gold';
    const pool = STRATEGIES.filter(s => s.grade === grade && !used.has(s.id));
    const fallback = STRATEGIES.filter(s => !used.has(s.id));
    const list = pool.length ? pool : fallback;
    if (!list.length) break;
    const picked = list[Math.floor(Math.random() * list.length)];
    used.add(picked.id);
    offers.push(picked.id);
  }
  return offers;
}

/**
 * 条件型策略的全队加成（战斗编译时合并进 TeamFlags）：
 * 独狼 / 中产阶级 / 三三三 / 人海战术 / OOTD
 */
export function strategyTeamFlags(st: MatchState): Partial<TeamFlags> {
  const flags: Partial<TeamFlags> = {};
  const add = (k: keyof TeamFlags, v: number) => {
    (flags as Record<string, number>)[k] = ((flags as Record<string, number>)[k] ?? 0) + v;
  };

  // 独狼：无激活羁绊
  if (hasStrategy(st, 'lone_wolf') && !activeTraits(st.board).some(at => at.tier)) {
    add('atkPct', 0.20);
    add('hpPct', 0.20);
    add('dmgReduce', 0.36);
  }
  // 中产阶级：每名 2★
  if (hasStrategy(st, 'middle_class')) {
    const twoStar = [...st.board, ...st.bench].filter(u => u.star === 2).length;
    if (twoStar > 0) {
      add('atkPct', 0.15 * twoStar);
      add('hpPct', 0.15 * twoStar);
      add('dmgReduce', 0.05 * twoStar);
    }
  }
  // 三三三：3★ / 3费 / 穿满3件 各计一项
  if (hasStrategy(st, 'three_three_three')) {
    const all = [...st.board, ...st.bench];
    let items = 0;
    if (all.some(u => u.star === 3)) items++;
    if (all.some(u => u.equips.length >= 3)) items++;
    if (all.some(u => {
      const c = CHARACTERS.find(x => x.id === u.charId);
      return c?.cost === 3;
    })) items++;
    if (items > 0) {
      add('atkPct', 0.08 * items);
      add('hpPct', 0.08 * items);
    }
  }
  // 人海战术：上阵 ≥8
  if (hasStrategy(st, 'horde') && st.board.length >= 8) {
    add('atkPct', 0.20);
    add('hpPct', 0.20);
  }
  // OOTD：全队装备去重种类数
  if (hasStrategy(st, 'ootd')) {
    const kinds = new Set<string>();
    for (const u of [...st.board, ...st.bench]) for (const e of u.equips) kinds.add(e);
    if (kinds.size > 0) {
      add('atkPct', 0.03 * kinds.size);
      add('hpPct', 0.03 * kinds.size);
    }
  }
  return flags;
}

/**
 * 敌人属性系数（生命/攻击共用）：
 * 难度削减 × 伟大征服增量 × 策略难度加成（官方：采纳策略抬高敌人难度，银+0/金+3，近似每条金 +4%）
 */
export function strategyEnemyMult(st: MatchState): number {
  let mult = 1;
  if (hasStrategy(st, 'simple_mode')) mult -= 0.10;
  if (hasStrategy(st, 'difficulty_modifier')) mult -= 0.15;
  if (hasStrategy(st, 'great_conquest')) mult += 0.04 * st.winStreak;
  const goldCount = st.strategies.filter(id => strategyById(id).grade === 'gold').length;
  mult += 0.04 * goldCount;
  return Math.max(0.1, mult);
}

/** 进入战斗输入的策略修改器 */
export interface StrategyBattleMods {
  /** 当头一棒：开战对最高血敌人造成 mult×最高攻击伤害，并施加 defPct 减防 */
  nuke?: { mult: number; defPct: number; turns: number };
  /** 风暴骑士：前台 1 号位每次行动后自伤 maxHp 比例 */
  firstSelfHarmPct?: number;
}

export function strategyBattleMods(st: MatchState): StrategyBattleMods {
  const mods: StrategyBattleMods = {};
  if (hasStrategy(st, 'head_bash')) mods.nuke = { mult: 10, defPct: -0.30, turns: 2 };
  if (hasStrategy(st, 'storm_knight')) mods.firstSelfHarmPct = 0.08;
  return mods;
}

/** 现金为王的护盾（战斗编译用；剩余场数由结算扣减） */
export function cashShieldPct(st: MatchState): number {
  return hasStrategy(st, 'cash_is_king') && (st.strategyData.cash_is_king ?? 0) > 0 ? 0.25 : 0;
}

/** 刷新商店费用（降本增效 -1） */
export function rerollCostOf(st: MatchState): number {
  return Math.max(1, CFG.rerollCost - (hasStrategy(st, 'cheap_reroll') ? 1 : 0));
}

export { strategyById };
