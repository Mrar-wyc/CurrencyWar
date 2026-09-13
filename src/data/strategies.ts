/**
 * 投资策略（三选一增益，银/金两档；棱彩档留待后续版本）。
 * 名称与机制方向整理自官方记录（docs §8/§16），具体数值官方未公开，
 * 按项目"近似还原"原则自拟。效果实现集中在 src/logic/strategy.ts 与 match.ts。
 */
export interface StrategyDef {
  id: string;
  name: string;
  grade: 'silver' | 'gold';
  desc: string;
}

export const STRATEGIES: StrategyDef[] = [
  // ============ 银色 ============
  {
    id: 'simple_mode', name: '简单模式', grade: 'silver',
    desc: '敌人生命与攻击降低 10%。'
  },
  {
    id: 'difficulty_modifier', name: '难度修改器', grade: 'silver',
    desc: '敌人生命与攻击降低 15%（与简单模式叠加）。'
  },
  {
    id: 'promo_all', name: '全员晋升', grade: 'silver',
    desc: '立即将所有上阵角色变为费用 +1 的随机角色（保留星级与装备）。'
  },
  {
    id: 'layoff_front', name: '大裁员', grade: 'gold',
    desc: '立即出售所有角色（上阵与备战席），获得双倍售价的金币，并获得 6 次免费刷新。'
  },
  {
    id: 'layoff_all', name: '人力重组', grade: 'silver',
    desc: '立即出售所有角色（上阵与备战席），获得 1 个 2★3费、2 个 2★2费和 2 个 2★1费角色。'
  },
  {
    id: 'lucky_dog', name: '招财狗', grade: 'silver',
    desc: '每场战斗胜利额外获得 +2 金币。'
  },
  {
    id: 'no_damage', name: '无伤通关', grade: 'silver',
    desc: '每场战斗胜利且无人倒下时，额外 +1 金币。'
  },
  {
    id: 'head_bash', name: '当头一棒', grade: 'silver',
    desc: '每场战斗开始时，对生命最高的敌人造成 1000% 最高攻击的伤害，并使其防御 -30%（2 回合）。'
  },
  {
    id: 'cheap_reroll', name: '降本增效', grade: 'gold',
    desc: '立即出售所有角色（上阵与备战席），获得双倍售价的金币，接下来 6 次购买角色免费。'
  },
  {
    id: 'ootd', name: 'OOTD', grade: 'gold',
    desc: '全队每装备 1 种不同的装备，前后台强度 +6%、生命 +3%。'
  },
  // ============ 金色 ============
  {
    id: 'promo4', name: '四费晋升', grade: 'gold',
    desc: '下一个购买的 4 费角色直接变为 2★（一次性）。'
  },
  {
    id: 'hyperinflation', name: '超发货币', grade: 'gold',
    desc: '立即失去所有金币；5 个节点后，返还失去的金币数额 +70。'
  },
  {
    id: 'lone_wolf', name: '独狼', grade: 'gold',
    desc: '自身所有羁绊均未激活的角色，获得 120% 前后台强度与 36% 受伤减免。'
  },
  {
    id: 'middle_class', name: '中产阶级', grade: 'gold',
    desc: '每有 1 名 2★ 角色：全队攻击与生命 +15%，受伤减免 5%（叠加）。'
  },
  {
    id: 'three_three_three', name: '三三三', grade: 'gold',
    desc: '3★ / 3 费 / 穿满 3 件装备的角色，各获得 10% 速度与 20% 前后台强度，满足不同条件可叠加。'
  },
  {
    id: 'horde', name: '人海战术', grade: 'gold',
    desc: '全队攻击与生命 +10%；上阵 ≥8 人时，额外 +20%。'
  },
  {
    id: 'storm_knight', name: '风暴骑士', grade: 'gold',
    desc: '前台 1 号位速度 +150%；进入战斗时，其受到等同于生命上限 70% 的固定伤害。'
  },
  {
    id: 'cash_is_king', name: '现金为王', grade: 'gold',
    desc: '立即出售所有上阵角色（不给金币），换取之后 3 场战斗全队开战 25% 生命护盾。'
  },
  {
    id: 'struggle_protocol', name: '奋斗协议', grade: 'gold',
    desc: '购买经验改扣 6 点小队生命（不耗金币）；首领战胜利后回复 50 生命。（官方为棱彩档）'
  },
  {
    id: 'great_conquest', name: '伟大征服', grade: 'gold',
    desc: '连胜奖励 ×3，但每 1 连胜使敌人生命与攻击 +4%。'
  }
];

/** 档位颜色（UI 用） */
export const GRADE_COLORS: Record<StrategyDef['grade'], string> = {
  silver: '#b8c4d4',
  gold: '#ffd166'
};

export const GRADE_NAMES: Record<StrategyDef['grade'], string> = {
  silver: '银',
  gold: '金'
};

export function strategyById(id: string): StrategyDef {
  const s = STRATEGIES.find(x => x.id === id);
  if (!s) throw new Error(`未知策略: ${id}`);
  return s;
}
