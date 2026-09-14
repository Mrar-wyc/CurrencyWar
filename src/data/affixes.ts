/**
 * 敌人词缀（晋升难度体系，官方 §31 全表 ~45 条的前 10 条）。
 * 每条 = 玩家可见的机制效果（engine.ts 按 id 判定）+ 难度点数（§23 难度公式的展示层）。
 * 节点通过 stages.ts BattleNode.affixes 引用；强度避免"必须重开"级（NGA 分级参照）。
 */
export interface AffixDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  /** 难度点数（展示用，计入节点难度值） */
  points: number;
}

export const AFFIXES: AffixDef[] = [
  {
    id: 'heavy_steps', name: '沉重脚步', icon: '🦶', color: '#8fbc8f',
    desc: '我方单位受到攻击后，行动延后 8%', points: 15
  },
  {
    id: 'showdown', name: '决战在即', icon: '⏳', color: '#c77dff',
    desc: '首领战行动值倒计时缩短 25%，遭遇战延长 20%', points: 15
  },
  {
    id: 'undying', name: '免死金牌', icon: '🏅', color: '#ffd97d',
    desc: '敌人受到致死伤害时保留 10% 生命，每名限一次', points: 10
  },
  {
    id: 'adrenaline', name: '应激反应', icon: '⚡', color: '#f2884b',
    desc: '敌人生命首次低于 50% 时，立即获得一次行动提前', points: 10
  },
  {
    id: 'bombard', name: '灼热轰炸', icon: '🔥', color: '#e05d5d',
    desc: '敌方攻击附加灼烧（12% 受击者生命上限，3 回合，可叠加）', points: 10
  },
  {
    id: 'tough_skin', name: '皮糙肉厚', icon: '🛡️', color: '#5d8aa8',
    desc: '全体敌人受到的伤害降低 20%', points: 10
  },
  {
    id: 'weakness', name: '软弱无力', icon: '💧', color: '#9fb8e8',
    desc: '未穿满 3 件装备的我方角色伤害降低 15%', points: 10
  },
  {
    id: 'extra_strike', name: '额外打击', icon: '🗡️', color: '#d35400',
    desc: '敌方攻击按受击者每个空装备栏附加 4% 生命上限的真实伤害', points: 5
  },
  {
    id: 'vengeance', name: '复仇心切', icon: '😤', color: '#b06ee0',
    desc: '非首领敌人阵亡时，其余敌人攻击 +8%（可叠加）', points: 5
  },
  {
    id: 'energy_leak', name: '能量逃逸', icon: '🔋', color: '#7db8e8',
    desc: '敌人受到攻击时，攻击者的能量 -4', points: 5
  }
];

export function affixById(id: string): AffixDef {
  const a = AFFIXES.find(x => x.id === id);
  if (!a) throw new Error(`未知词缀: ${id}`);
  return a;
}
