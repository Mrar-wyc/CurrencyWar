import type { TraitDef } from '../logic/types';

/** 阵营羁绊（前台+后台均计数） */
export const FACTION_TRAITS: TraitDef[] = [
  {
    id: 'express', name: '列车同行', kind: 'faction', color: '#e8b64c', icon: '🚂',
    desc: '星穹列车的旅伴们互相扶持。',
    tiers: [
      { count: 2, desc: '全队生命上限 +8%', flags: { hpPct: 0.08 } },
      { count: 4, desc: '全队生命上限 +8%，攻击 +10%', flags: { hpPct: 0.08, atkPct: 0.10 } },
      { count: 5, desc: '全队生命上限 +15%，攻击 +18%，暴击率 +5%', flags: { hpPct: 0.15, atkPct: 0.18, critRate: 0.05 } }
    ]
  },
  {
    id: 'xianzhou', name: '仙舟罗浮', kind: 'faction', color: '#5fd0a8', icon: '🐉',
    desc: '仙舟云骑，行动如风。',
    tiers: [
      { count: 2, desc: '全队速度 +8%', flags: { spdPct: 0.08 } },
      { count: 4, desc: '全队速度 +8%，攻击 +10%', flags: { spdPct: 0.08, atkPct: 0.10 } },
      { count: 5, desc: '全队速度 +12%，攻击 +18%', flags: { spdPct: 0.12, atkPct: 0.18 } }
    ]
  },
  {
    id: 'belobog', name: '贝洛伯格', kind: 'faction', color: '#6fa8dc', icon: '🏰',
    desc: '筑城者的意志坚如磐石。',
    tiers: [
      { count: 2, desc: '全队防御 +12%', flags: { defPct: 0.12 } },
      { count: 4, desc: '全队防御 +12%，生命上限 +12%', flags: { defPct: 0.12, hpPct: 0.12 } },
      { count: 5, desc: '全队防御 +20%，生命上限 +20%，受伤降低 5%', flags: { defPct: 0.20, hpPct: 0.20, dmgReduce: 0.05 } }
    ]
  },
  {
    id: 'stellaron', name: '星核猎手', kind: 'faction', color: '#c77dff', icon: '☄️',
    desc: '独行于星海之间的猎手。',
    tiers: [
      { count: 1, desc: '持续伤害 +25%，全队攻击 +8%', flags: { dotAmp: 0.25, atkPct: 0.08 } },
      { count: 3, desc: '持续伤害 +40%，全队攻击 +18%', flags: { dotAmp: 0.40, atkPct: 0.18 } }
    ]
  }
];

/** 流派羁绊 */
export const SCHOOL_TRAITS: TraitDef[] = [
  {
    id: 'aoe', name: '群攻', kind: 'school', color: '#f2884b', icon: '💥',
    desc: '以压倒性的范围火力清扫战场。',
    tiers: [
      { count: 2, desc: '全队攻击 +8%', flags: { atkPct: 0.08 } },
      { count: 4, desc: '全队攻击 +18%', flags: { atkPct: 0.18 } },
      { count: 6, desc: '全队攻击 +28%', flags: { atkPct: 0.28 } }
    ]
  },
  {
    id: 'single', name: '爆发', kind: 'school', color: '#e05d5d', icon: '🎯',
    desc: '精准狙杀最有价值的目标。',
    tiers: [
      { count: 2, desc: '全队暴击率 +6%', flags: { critRate: 0.06 } },
      { count: 4, desc: '全队暴击率 +14%', flags: { critRate: 0.14 } },
      { count: 6, desc: '全队暴击率 +20%，攻击 +8%', flags: { critRate: 0.20, atkPct: 0.08 } }
    ]
  },
  {
    id: 'chase', name: '追击', kind: 'school', color: '#d4a5ff', icon: '⚡',
    desc: '抓住破绽，连续追击。',
    tiers: [
      { count: 2, desc: '普攻后 25% 概率追加一次普攻', flags: { followupChance: 0.25 } },
      { count: 3, desc: '普攻后 45% 概率追加一次普攻', flags: { followupChance: 0.45 } },
      { count: 5, desc: '普攻后 60% 概率追加一次普攻', flags: { followupChance: 0.60 } }
    ]
  },
  {
    id: 'heal', name: '治疗', kind: 'school', color: '#7dd87d', icon: '💚',
    desc: '丰饶之力庇护众人。',
    tiers: [
      { count: 2, desc: '每次己方行动后全体回复 2% 生命上限', flags: { regenPct: 0.02 } },
      { count: 4, desc: '每次己方行动后全体回复 4% 生命上限', flags: { regenPct: 0.04 } }
    ]
  },
  {
    id: 'shield', name: '护盾', kind: 'school', color: '#7db8e8', icon: '🛡️',
    desc: '存护的壁垒坚不可摧。',
    tiers: [
      { count: 1, desc: '开战时全队获得 8% 生命上限的护盾', flags: { startShieldPct: 0.08 } },
      { count: 3, desc: '开战时全队获得 16% 生命上限的护盾', flags: { startShieldPct: 0.16 } }
    ]
  },
  {
    id: 'dot', name: '持续伤害', kind: 'school', color: '#b06ee0', icon: '🔥',
    desc: '灼烧与触电在敌阵中蔓延。',
    tiers: [
      { count: 2, desc: '持续伤害 +30%', flags: { dotAmp: 0.30 } },
      { count: 3, desc: '持续伤害 +60%', flags: { dotAmp: 0.60 } },
      { count: 5, desc: '持续伤害 +90%', flags: { dotAmp: 0.90 } }
    ]
  }
];

export const ALL_TRAITS: TraitDef[] = [...FACTION_TRAITS, ...SCHOOL_TRAITS];

export function traitById(id: string): TraitDef {
  const t = ALL_TRAITS.find(x => x.id === id);
  if (!t) throw new Error(`未知羁绊: ${id}`);
  return t;
}
