import { FACTION_TRAITS, SCHOOL_TRAITS, traitById } from '../data/traits';
import { CHARACTERS, charById } from '../data/characters';
import { equipById } from '../data/equipment';
import { EMPTY_TEAM_FLAGS } from './types';
import type { MatchState, OwnedUnit, TeamFlags, TraitDef, TraitTier } from './types';

export interface ActiveTrait {
  trait: TraitDef;
  count: number;
  /** 当前激活档（未激活为 null） */
  tier: TraitTier | null;
  nextAt: number | null;
}

/** 统计棋盘（前台+后台）羁绊人数；穿戴中的星徽为其羁绊 +1（官方"装备者加入该羁绊"） */
export function countTraits(units: OwnedUnit[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const u of units) {
    const c = charById(u.charId);
    counts.set(c.faction, (counts.get(c.faction) ?? 0) + 1);
    for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const eqId of u.equips) {
      const eq = equipById(eqId);
      if (eq.tier === 'emblem' && eq.emblemTrait) {
        counts.set(eq.emblemTrait, (counts.get(eq.emblemTrait) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function activeTraits(units: OwnedUnit[]): ActiveTrait[] {
  const counts = countTraits(units);
  const result: ActiveTrait[] = [];
  const all = [...FACTION_TRAITS, ...SCHOOL_TRAITS];
  for (const trait of all) {
    const count = counts.get(trait.id) ?? 0;
    if (count === 0) continue;
    let tier: TraitTier | null = null;
    for (const t of trait.tiers) if (count >= t.count) tier = t;
    const next = trait.tiers.find(t => count < t.count);
    result.push({ trait, count, tier, nextAt: next ? next.count : null });
  }
  result.sort((a, b) => {
    const at = a.tier ? 1 : 0, bt = b.tier ? 1 : 0;
    if (at !== bt) return bt - at;
    return b.count - a.count;
  });
  return result;
}

/** 全队全局加成：羁绊档位（后台角色计入羁绊人数；参战贡献见后台赋能机制） */
export function computeTeamFlags(board: OwnedUnit[]): TeamFlags {
  const flags: TeamFlags = { ...EMPTY_TEAM_FLAGS };
  for (const at of activeTraits(board)) {
    if (!at.tier) continue;
    for (const [k, v] of Object.entries(at.tier.flags)) {
      (flags as unknown as Record<string, number>)[k] += v as number;
    }
  }
  return flags;
}

/** 阵营内所有角色 id（图鉴用） */
export function charsOfFaction(factionId: string): string[] {
  return CHARACTERS.filter(c => c.faction === factionId).map(c => c.id);
}

export { traitById };
