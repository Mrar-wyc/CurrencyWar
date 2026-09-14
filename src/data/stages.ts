import type { PlaneDef } from '../logic/types';

/**
 * 3 个位面的节点序列（近似还原原版结构：战斗/投资策略/奖励/补给/首领）。
 * mul = 敌人属性倍率；enemyActionLimit = 敌方行动上限（难度拨盘，超时判负——
 *      battle-build 会按编队速度权重把它换算为双方共享的「行动值倒计时」）。
 * strategy 节点 = 投资策略三选一（银/金两档，见 src/data/strategies.ts）。
 */
export const PLANES: PlaneDef[] = [
  {
    name: '位面一 · 空间站残响',
    nodes: [
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚁群', enemyActionLimit: 14, company: '虫人兵器',
          enemies: [{ id: 'swarm_wing', mul: 0.9, count: 2 }, { id: 'swarm_node', mul: 0.9 }]
        }
      },
      { kind: 'strategy' },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚁群巢穴', enemyActionLimit: 14, company: '虫人兵器',
          enemies: [{ id: 'swarm_node', mul: 1.0, count: 2 }, { id: 'mara_soldier', mul: 1.0 }]
        }
      },
      { kind: 'supply' },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 蚕食者·不完全体', enemyActionLimit: 18, company: '巨鹿生物制药',
          enemies: [{ id: 'swarm_wing', mul: 1.0, count: 2 }, { id: 'boss_p1', mul: 1.0 }]
        }
      }
    ]
  },
  {
    name: '位面二 · 雅利洛寒冬',
    nodes: [
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 魔阴身巡逻队', enemyActionLimit: 14, affixes: ['energy_leak'], company: '灰手生命科技',
          enemies: [{ id: 'mara_soldier', mul: 1.9, count: 2 }, { id: 'mara_archer', mul: 1.9, count: 2 }]
        }
      },
      { kind: 'strategy' },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 机兵哨站', enemyActionLimit: 14, affixes: ['extra_strike'], company: '深穹智械科技',
          enemies: [{ id: 'automaton_bear', mul: 1.9 }, { id: 'automaton_drill', mul: 1.9, count: 2 }]
        }
      },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 虚卒先锋', enemyActionLimit: 14, affixes: ['vengeance'], company: '凛冬经贸联合体',
          enemies: [{ id: 'voidranger', mul: 1.9, count: 2 }, { id: 'mara_archer', mul: 1.9, count: 2 }]
        }
      },
      { kind: 'supply' },
      { kind: 'strategy' },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 可可利亚，虚妄之母', enemyActionLimit: 18, affixes: ['tough_skin', 'showdown'], company: '铁盾安保集团',
          enemies: [{ id: 'automaton_drill', mul: 1.9, count: 2 }, { id: 'boss_p2', mul: 1.15 }]
        }
      }
    ]
  },
  {
    name: '位面三 · 星核核心',
    nodes: [
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 虚卒军团', enemyActionLimit: 14, affixes: ['adrenaline'], company: '纷争前线军团',
          enemies: [{ id: 'voidranger', mul: 2.9, count: 2 }, { id: 'automaton_bear', mul: 2.9 }]
        }
      },
      { kind: 'strategy' },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚕食者之群', enemyActionLimit: 14, affixes: ['bombard'], company: '增熵能源集团',
          enemies: [{ id: 'spawn', mul: 2.9, count: 2 }, { id: 'mara_soldier', mul: 2.9, count: 2 }]
        }
      },
      { kind: 'supply' },
      { kind: 'strategy' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 精锐突击', enemyActionLimit: 14, affixes: ['heavy_steps', 'weakness'], company: '猎星资本',
          enemies: [{ id: 'spawn', mul: 3.1 }, { id: 'voidranger', mul: 3.1, count: 2 }, { id: 'automaton_bear', mul: 3.1 }]
        }
      },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 末日兽', enemyActionLimit: 20, affixes: ['undying'], company: '不死者联盟',
          enemies: [{ id: 'spawn', mul: 2.0, count: 2 }, { id: 'boss_p3', mul: 1.0 }]
        }
      }
    ]
  }
];

/** 对局初始状态数值 */
export const MATCH_CONFIG = {
  startGold: 8,
  startLevel: 3,
  startHp: 100,
  maxLevel: 10,
  frontSlots: 6,
  backSlots: 4,
  benchSlots: 9,
  shopSize: 5,
  rerollCost: 2,
  expCost: 4,       // 买一次经验花费
  expGain: 4,       // 买一次经验获得
  freeExpPerRound: 2,
  baseIncome: 5,
  /** 每持有多少金币 +1 利息（官方：每 10 金 +1，上限见 interestCap） */
  interestPer10: 10,
  interestCap: 5,
  /** 连胜奖励档位（官方：封顶 +3，docs §29） */
  winStreakBonus(streak: number): number {
    if (streak >= 6) return 3;
    if (streak >= 4) return 2;
    if (streak >= 2) return 1;
    return 0;
  },
  lossCompensation: 2,
  /** 升到下一级所需经验（官方口径 docs §29：4/6/20/40/52/72/84；索引 = 当前等级） */
  expToNext: { 3: 4, 4: 6, 5: 20, 6: 40, 7: 52, 8: 72, 9: 84 } as Record<number, number>,
  /** 失败扣血 */
  loseHpNormal: 15,
  loseHpBoss: 30,
  /** 奋斗协议（金色策略）：买经验改为消耗生命，此为其代价 */
  struggleHpCost: 6,
  /** 职级评价 */
  rankGain(hpLeft: number): number {
    if (hpLeft >= 70) return 3;
    if (hpLeft >= 40) return 2;
    return 1;
  }
};

/** 各等级商店各费用出现概率（官方完整表，docs §3；Lv1-3 全部 100% 出 1 费） */
export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [100, 0, 0, 0, 0],
  4: [65, 25, 10, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [15, 20, 25, 30, 10],
  10: [5, 10, 20, 40, 25]
};

export const RANKS = ['黑铁', '青铜', '翠钢', '钴银', '冰肽', '紫金', '投资大师', '资本帝王', '财富造物主'];
