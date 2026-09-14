import { CHARACTERS } from '../data/characters';
import { MATCH_CONFIG as CFG } from '../data/stages';
import { GRADE_POINTS, STRATEGIES, strategyById } from '../data/strategies';
import { countTraits, traitById } from './synergy';
import { EMPTY_TEAM_FLAGS } from './types';
import type { MatchState, OwnedUnit, TeamFlags, UnitFlags } from './types';
import type { StrategyDef, StrategyGrade } from '../data/strategies';

/** 是否已采纳某策略 */
export function hasStrategy(st: MatchState, id: string): boolean {
  return st.strategies.includes(id);
}

/** 棱彩档从位面二起才进入候选（官方有出现位面限制，此处近似为"位面二起"） */
export const PRISM_FROM_PLANE = 1;

/**
 * 投资策略三选一：银 62% / 金 30% / 棱彩 8%，同屏不重复。
 * `plane` 用于棱彩的位面门禁（位面一不出现棱彩）；池子不足时逐级回退到非棱彩、再到任意未用。
 */
export function rollStrategyOffers(plane = 0): string[] {
  const offers: string[] = [];
  const used = new Set<string>();
  const unused = (g?: StrategyGrade): StrategyDef[] =>
    STRATEGIES.filter(s => (g === undefined || s.grade === g) && !used.has(s.id));
  while (offers.length < 3) {
    const r = Math.random();
    const grade: StrategyGrade = r < 0.62 ? 'silver' : r < 0.92 ? 'gold' : 'prism';
    const prismAllowed = grade !== 'prism' || plane >= PRISM_FROM_PLANE;
    let list = prismAllowed ? unused(grade) : [];
    if (!list.length) list = unused().filter(s => s.grade !== 'prism');
    if (!list.length) list = unused();
    if (!list.length) break;
    const picked = list[Math.floor(Math.random() * list.length)];
    used.add(picked.id);
    offers.push(picked.id);
  }
  return offers;
}

/**
 * 条件型策略的全队加成（战斗编译时合并进 TeamFlags）：
 * 中产阶级 / 三三三(基础部分已移至按角色) / 人海战术 / OOTD
 * 独狼与三三三为按角色判定，见 strategyUnitMods。
 */
export function strategyTeamFlags(st: MatchState): Partial<TeamFlags> {
  const flags: Partial<TeamFlags> = {};
  const add = (k: keyof TeamFlags, v: number) => {
    (flags as Record<string, number>)[k] = ((flags as Record<string, number>)[k] ?? 0) + v;
  };
  // 中产阶级：每名 2★
  if (hasStrategy(st, 'middle_class')) {
    const twoStar = [...st.board, ...st.bench].filter(u => u.star === 2).length;
    if (twoStar > 0) {
      add('atkPct', 0.15 * twoStar);
      add('hpPct', 0.15 * twoStar);
      add('dmgReduce', 0.05 * twoStar);
    }
  }
  // 人海战术（官方）：基础 +10%，在场 ≥8 再 +20%
  if (hasStrategy(st, 'horde')) {
    add('atkPct', 0.10);
    add('hpPct', 0.10);
    if (st.board.length >= 8) {
      add('atkPct', 0.20);
      add('hpPct', 0.20);
    }
  }
  // OOTD（官方金色）：每件不同装备 → 生命+3%、前后台强度+6%
  if (hasStrategy(st, 'ootd')) {
    const kinds = new Set<string>();
    for (const u of [...st.board, ...st.bench]) for (const e of u.equips) kinds.add(e);
    if (kinds.size > 0) {
      add('atkPct', 0.06 * kinds.size);
      add('hpPct', 0.03 * kinds.size);
    }
  }
  return flags;
}

/**
 * 按角色判定的策略加成（编译时逐前台单位合并进该单位的 unitFlags）：
 * 独狼（官方：无激活非独立羁绊的角色 +120% 前后台、36% 减伤）
 * 三三三（官方：3星/3费/3件装，每满足一项 +10% 速度、+20% 前后台，可叠加）
 */
export function strategyUnitMods(st: MatchState, u: OwnedUnit): Partial<UnitFlags> {
  const mods: Partial<UnitFlags> = {};
  const add = (k: keyof UnitFlags, v: number) => {
    (mods as Record<string, number>)[k] = ((mods as Record<string, number>)[k] ?? 0) + v;
  };
  // 独狼：该角色自身的阵营与流派羁绊均未激活任何档
  if (hasStrategy(st, 'lone_wolf')) {
    const c = CHARACTERS.find(x => x.id === u.charId);
    const counts = countTraits(st.board);
    const myTraits = c ? [c.faction, ...c.tags] : [];
    const activated = myTraits.some(t => {
      const trait = traitById(t);
      const n = counts.get(t) ?? 0;
      return trait.tiers.some(tier => n >= tier.count);
    });
    if (!activated && c) {
      add('atkPct', 1.2);
      add('hpPct', 1.2);
      add('dmgReduce', 0.36);
    }
  }
  // 三三三：3星 / 3费 / 穿满3件，每满足一项叠加
  if (hasStrategy(st, 'three_three_three')) {
    const c = CHARACTERS.find(x => x.id === u.charId);
    let items = 0;
    if (u.star === 3) items++;
    if (c?.cost === 3) items++;
    if (u.equips.length >= 3) items++;
    if (items > 0) {
      add('atkPct', 0.2 * items);
      add('hpPct', 0.2 * items);
      add('spdPct', 0.1 * items);
    }
  }
  return mods;
}

/**
 * 敌人属性系数（生命/攻击共用）：
 * 难度削减 × 伟大征服增量 × 策略难度加成（官方 docs §32：银 +0 / 金 +3 / 棱彩 +6 难度点数）。
 * 点数按"1 点 ≈ 1.33% 敌人属性"近似 → 每条金 +4%、每条棱彩 +8%；
 * 换算基准直接取自 GRADE_POINTS，避免档位点数在两处各写一套。
 */
export function strategyEnemyMult(st: MatchState): number {
  let mult = 1;
  if (hasStrategy(st, 'simple_mode')) mult -= 0.10;
  if (hasStrategy(st, 'difficulty_modifier')) mult -= 0.15;
  if (hasStrategy(st, 'great_conquest')) mult += 0.04 * st.winStreak;
  const pts = st.strategies.reduce((sum, id) => sum + GRADE_POINTS[strategyById(id).grade], 0);
  mult += (0.04 / GRADE_POINTS.gold) * pts;
  return Math.max(0.1, mult);
}

/** 进入战斗输入的策略修改器 */
export interface StrategyBattleMods {
  /** 当头一棒：开战对最高血敌人造成 mult×最高攻击伤害，并施加 defPct 减防 */
  nuke?: { mult: number; defPct: number; turns: number };
  /** 风暴骑士：开战时前台 1 号位受 maxHp 比例的固定伤害（一次） */
  firstSelfHarmPct?: number;
  /** 完美开局（棱彩）：行动值消耗不足该比例期间，我方伤害增益 */
  earlyStrike?: { untilPct: number; dmgPct: number };
  /** 爆仓（棱彩）：敌方生命低于该比例时被我方攻击直接斩杀 */
  executeBelowPct?: number;
  /** 藏一手（棱彩）：我方每场战斗首次致死免疫（保留 1 点生命） */
  allyCheatDeath?: boolean;
}

export function strategyBattleMods(st: MatchState): StrategyBattleMods {
  const mods: StrategyBattleMods = {};
  if (hasStrategy(st, 'head_bash')) mods.nuke = { mult: 10, defPct: -0.30, turns: 2 };
  if (hasStrategy(st, 'storm_knight')) mods.firstSelfHarmPct = 0.70;
  if (hasStrategy(st, 'perfect_start')) mods.earlyStrike = { untilPct: 0.4, dmgPct: 0.40 };
  if (hasStrategy(st, 'blowout')) mods.executeBelowPct = 0.16;
  if (hasStrategy(st, 'ace_in_hole')) mods.allyCheatDeath = true;
  return mods;
}

/** 现金为王的护盾（战斗编译用；剩余场数由结算扣减） */
export function cashShieldPct(st: MatchState): number {
  return hasStrategy(st, 'cash_is_king') && (st.strategyData.cash_is_king ?? 0) > 0 ? 0.25 : 0;
}

/** 刷新商店费用（免费刷新资源优先在 match.ts 消耗；此处仅基础价） */
export function rerollCostOf(st: MatchState): number {
  return CFG.rerollCost;
}

export { strategyById };
