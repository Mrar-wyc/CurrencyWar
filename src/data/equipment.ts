import type { EquipDef } from '../logic/types';

/**
 * 装备体系（近似还原原版"简易→进阶"合成）：
 * 简易装备 4 种（攻击/防御/生命/速度），任意 2 件在备战阶段合成 1 件进阶装备。
 * recipe = 两个简易 id 排序拼接。
 */
export const BASIC_EQUIPS: EquipDef[] = [
  {
    id: 'b_atk', name: '锋锐晶石', tier: 'basic', color: '#e05d5d', scope: 'unit',
    desc: '攻击 +12%', flags: { atkPct: 0.12 }
  },
  {
    id: 'b_def', name: '磐岩晶石', tier: 'basic', color: '#6fa8dc', scope: 'unit',
    desc: '防御 +18%', flags: { defPct: 0.18 }
  },
  {
    id: 'b_hp', name: '生命晶石', tier: 'basic', color: '#7dd87d', scope: 'unit',
    desc: '生命上限 +12%', flags: { hpPct: 0.12 }
  },
  {
    id: 'b_spd', name: '疾风晶石', tier: 'basic', color: '#f2c94c', scope: 'unit',
    desc: '速度 +8%', flags: { spdPct: 0.08 }
  }
];

export const ADVANCED_EQUIPS: EquipDef[] = [
  {
    id: 'a_dawn', name: '破晓之刃', tier: 'advanced', color: '#ff7b54', scope: 'unit',
    desc: '攻击 +25%；击杀敌人后攻击再 +15%（最多叠 3 层）',
    flags: { atkPct: 0.25, onKillAtk: 0.15 }, recipe: ['b_atk', 'b_atk']
  },
  {
    id: 'a_fortress', name: '不动如山', tier: 'advanced', color: '#5d8aa8', scope: 'unit',
    desc: '防御 +30%，受伤降低 10%',
    flags: { defPct: 0.30, dmgReduce: 0.10 }, recipe: ['b_def', 'b_def']
  },
  {
    id: 'a_seed', name: '生机之种', tier: 'advanced', color: '#63c76a', scope: 'unit',
    desc: '生命上限 +25%，每次己方行动后回复 2% 生命上限',
    flags: { hpPct: 0.25, regenPct: 0.02 }, recipe: ['b_hp', 'b_hp']
  },
  {
    id: 'a_wind', name: '追风之靴', tier: 'advanced', color: '#ffd66b', scope: 'unit',
    desc: '速度 +15%，开战获得 30% 终结技能量',
    flags: { spdPct: 0.15, energyStart: 0.30 }, recipe: ['b_spd', 'b_spd']
  },
  {
    id: 'a_medal', name: '战意勋章', tier: 'advanced', color: '#c77dff', scope: 'team',
    desc: '全队开战 +1 战技点，攻击 +8%',
    flags: { spStart: 1, atkPct: 0.08 }, recipe: ['b_atk', 'b_def']
  },
  {
    id: 'a_prism', name: '汲能棱镜', tier: 'advanced', color: '#7db8e8', scope: 'unit',
    desc: '终结技能量获取 +25%，攻击 +8%',
    flags: { ultCharge: 0.25, atkPct: 0.08 }, recipe: ['b_atk', 'b_spd']
  },
  {
    id: 'a_hunter', name: '猎手印记', tier: 'advanced', color: '#e8845d', scope: 'unit',
    desc: '攻击 +15%，生命上限 +8%',
    flags: { atkPct: 0.15, hpPct: 0.08 }, recipe: ['b_atk', 'b_hp']
  },
  {
    id: 'a_thorn', name: '荆棘重铠', tier: 'advanced', color: '#8fbc8f', scope: 'unit',
    desc: '防御 +10%，受击反弹 15% 伤害',
    flags: { defPct: 0.10, thorns: 0.15 }, recipe: ['b_def', 'b_spd']
  },
  {
    id: 'a_ring', name: '复苏之环', tier: 'advanced', color: '#7dd8c0', scope: 'unit',
    desc: '治疗效果 +30%，生命上限 +10%',
    flags: { healBonus: 0.30, hpPct: 0.10 }, recipe: ['b_def', 'b_hp']
  },
  {
    id: 'a_feather', name: '疾风之羽', tier: 'advanced', color: '#c9e265', scope: 'unit',
    desc: '速度 +10%，生命上限 +8%，终结技能量获取 +15%',
    flags: { spdPct: 0.10, hpPct: 0.08, ultCharge: 0.15 }, recipe: ['b_hp', 'b_spd']
  }
];

export const ALL_EQUIPS: EquipDef[] = [...BASIC_EQUIPS, ...ADVANCED_EQUIPS];

export function equipById(id: string): EquipDef {
  const e = ALL_EQUIPS.find(x => x.id === id);
  if (!e) throw new Error(`未知装备: ${id}`);
  return e;
}

/** 两件简易装备的合成键 */
export function combineKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

const RECIPE_MAP = new Map<string, EquipDef>();
for (const adv of ADVANCED_EQUIPS) {
  if (adv.recipe) RECIPE_MAP.set(combineKey(adv.recipe[0], adv.recipe[1]), adv);
}

/** 查找合成结果；不可合成返回 null */
export function findCombine(a: string, b: string): EquipDef | null {
  if (a === b) {
    // 两件相同简易装备 → 固定对应的进阶
    const same = ADVANCED_EQUIPS.find(x => x.recipe && x.recipe[0] === a && x.recipe[1] === a);
    return same ?? null;
  }
  return RECIPE_MAP.get(combineKey(a, b)) ?? null;
}

export function randomBasicEquip(): string {
  return BASIC_EQUIPS[Math.floor(Math.random() * BASIC_EQUIPS.length)].id;
}
