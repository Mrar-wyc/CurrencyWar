import type { PlaneDef } from '../logic/types';

/**
 * 3 个位面的节点序列（近似还原原版结构：战斗/奖励/补给/首领）。
 * mul = 敌人属性倍率；enemyActionLimit = 敌方行动次数上限（超时判负）。
 */
export const PLANES: PlaneDef[] = [
  {
    name: '位面一 · 空间站残响',
    nodes: [
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚁群', enemyActionLimit: 14,
          enemies: [{ id: 'swarm_wing', mul: 0.9, count: 2 }, { id: 'swarm_node', mul: 0.9 }]
        }
      },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚁群巢穴', enemyActionLimit: 14,
          enemies: [{ id: 'swarm_node', mul: 1.0, count: 2 }, { id: 'mara_soldier', mul: 1.0 }]
        }
      },
      { kind: 'supply' },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 蚕食者·不完全体', enemyActionLimit: 18,
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
          name: '遭遇战 · 魔阴身巡逻队', enemyActionLimit: 14,
          enemies: [{ id: 'mara_soldier', mul: 1.75, count: 2 }, { id: 'mara_archer', mul: 1.75, count: 2 }]
        }
      },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 机兵哨站', enemyActionLimit: 14,
          enemies: [{ id: 'automaton_bear', mul: 1.75 }, { id: 'automaton_drill', mul: 1.75, count: 2 }]
        }
      },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 虚卒先锋', enemyActionLimit: 14,
          enemies: [{ id: 'voidranger', mul: 1.75, count: 2 }, { id: 'mara_archer', mul: 1.75, count: 2 }]
        }
      },
      { kind: 'supply' },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 可可利亚，虚妄之母', enemyActionLimit: 18,
          enemies: [{ id: 'automaton_drill', mul: 1.75, count: 2 }, { id: 'boss_p2', mul: 1.0 }]
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
          name: '遭遇战 · 虚卒军团', enemyActionLimit: 14,
          enemies: [{ id: 'voidranger', mul: 2.7, count: 2 }, { id: 'automaton_bear', mul: 2.7 }]
        }
      },
      { kind: 'reward' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 蚕食者之群', enemyActionLimit: 14,
          enemies: [{ id: 'spawn', mul: 2.7, count: 2 }, { id: 'mara_soldier', mul: 2.7, count: 2 }]
        }
      },
      { kind: 'supply' },
      {
        kind: 'battle',
        battle: {
          name: '遭遇战 · 精锐突击', enemyActionLimit: 14,
          enemies: [{ id: 'spawn', mul: 2.85 }, { id: 'voidranger', mul: 2.85, count: 2 }, { id: 'automaton_bear', mul: 2.85 }]
        }
      },
      {
        kind: 'boss',
        battle: {
          name: '首领 · 末日兽', enemyActionLimit: 20,
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
  maxLevel: 9,
  frontSlots: 6,
  backSlots: 3,
  benchSlots: 9,
  shopSize: 5,
  rerollCost: 2,
  expCost: 4,       // 买一次经验花费
  expGain: 4,       // 买一次经验获得
  freeExpPerRound: 2,
  baseIncome: 5,
  interestPer10: 1,
  interestCap: 5,
  /** 连胜奖励档位 */
  winStreakBonus(streak: number): number {
    if (streak >= 8) return 4;
    if (streak >= 6) return 3;
    if (streak >= 4) return 2;
    if (streak >= 2) return 1;
    return 0;
  },
  lossCompensation: 2,
  /** 升到下一级所需经验（索引 = 当前等级，从 3 级开始） */
  expToNext: { 3: 2, 4: 6, 5: 10, 6: 20, 7: 36, 8: 48 } as Record<number, number>,
  /** 后台角色给全队的赋能 */
  backUnitAtkPct: 0.04,
  backUnitHpPct: 0.04,
  /** 失败扣血 */
  loseHpNormal: 15,
  loseHpBoss: 30,
  /** 职级评价 */
  rankGain(hpLeft: number): number {
    if (hpLeft >= 70) return 3;
    if (hpLeft >= 40) return 2;
    return 1;
  }
};

/** 各等级商店各费用出现概率（还原原版公开概率表） */
export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [80, 20, 0, 0, 0],
  3: [60, 35, 5, 0, 0],
  4: [45, 35, 18, 2, 0],
  5: [35, 35, 25, 5, 0],
  6: [25, 35, 30, 9, 1],
  7: [19, 30, 40, 10, 1],
  8: [15, 25, 35, 20, 5],
  9: [10, 20, 30, 30, 10]
};

export const RANKS = ['黑铁', '青铜', '翠钢', '钴银', '冰肽', '紫金', '投资大师', '资本帝王', '财富造物主'];

export function planeNodes(plane: number) {
  return PLANES[plane].nodes;
}

export function currentNodesLeft(plane: number, node: number): number {
  return PLANES[plane].nodes.length - node;
}
