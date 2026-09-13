import type { EnemyDef } from '../logic/types';

/** 敌人图鉴（小怪 + 位面首领），同人自用 */
export const ENEMIES: EnemyDef[] = [
  {
    id: 'swarm_wing', name: '蚁群·炽翅', color: '#c98f5f',
    hp: 720, atk: 260, def: 180, spd: 115, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '啮咬', mult: 1.0 }]
  },
  {
    id: 'swarm_node', name: '蚁群·末梢', color: '#b5793f',
    hp: 950, atk: 300, def: 220, spd: 100, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '鞭击', mult: 1.0 }, { name: '猛刺', mult: 1.3 }]
  },
  {
    id: 'mara_soldier', name: '魔阴身·士卒', color: '#8a5fbf',
    hp: 1150, atk: 340, def: 260, spd: 95, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '挥砍', mult: 1.0 }, { name: '狂乱连斩', mult: 1.2 }]
  },
  {
    id: 'mara_archer', name: '魔阴身·箭手', color: '#a37fd0',
    hp: 880, atk: 390, def: 200, spd: 105, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '射击', mult: 1.0 }, { name: '贯穿箭', mult: 1.35 }]
  },
  {
    id: 'automaton_bear', name: '自动机兵·灰熊', color: '#7d8a9a',
    hp: 1900, atk: 360, def: 340, spd: 85, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '重拳', mult: 1.0 }, { name: '蓄能冲撞', mult: 1.4 }]
  },
  {
    id: 'automaton_drill', name: '自动机兵·钻地', color: '#94a3b8',
    hp: 1050, atk: 330, def: 280, spd: 100, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '钻头突刺', mult: 1.0 }]
  },
  {
    id: 'voidranger', name: '虚卒·践踏者', color: '#5f7fbf',
    hp: 1600, atk: 430, def: 300, spd: 95, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '践踏', mult: 1.1 }, { name: '虚数震荡', mult: 0.7, aoe: true }]
  },
  {
    id: 'spawn', name: '蚕食者之裔', color: '#6f9a5f',
    hp: 1350, atk: 390, def: 280, spd: 100, critRate: 0.05, critDmg: 1.5,
    moves: [{ name: '侵蚀', mult: 1.0 }, { name: '蔓生吞噬', mult: 0.65, aoe: true }]
  },
  // ============ 位面首领 ============
  {
    id: 'boss_p1', name: '蚕食者·不完全体', color: '#8f5fbf', boss: true,
    hp: 7500, atk: 330, def: 280, spd: 95, critRate: 0.05, critDmg: 1.5,
    moves: [
      { name: '腐化触击', mult: 1.0 },
      { name: '胞体爆裂', mult: 0.7, aoe: true },
      { name: '吞噬猛击', mult: 1.3 }
    ]
  },
  {
    id: 'boss_p2', name: '可可利亚·虚妄之母', color: '#6fa8dc', boss: true,
    hp: 15000, atk: 470, def: 330, spd: 95, critRate: 0.05, critDmg: 1.5,
    moves: [
      { name: '霜晶之刃', mult: 1.05 },
      { name: '极寒领域', mult: 0.8, aoe: true },
      { name: '凛冬将至', mult: 1.4 },
      { name: '碎星重锤', mult: 0.9, aoe: true }
    ]
  },
  {
    id: 'boss_p3', name: '末日兽', color: '#e05d5d', boss: true,
    hp: 30000, atk: 640, def: 380, spd: 90, critRate: 0.05, critDmg: 1.5,
    moves: [
      { name: '毁灭光矢', mult: 0.75, aoe: true },
      { name: '天坠冲击', mult: 1.3 },
      { name: '湮灭风暴', mult: 0.9, aoe: true },
      { name: '终焉一击', mult: 1.55 }
    ]
  }
];

export function enemyById(id: string): EnemyDef {
  const e = ENEMIES.find(x => x.id === id);
  if (!e) throw new Error(`未知敌人: ${id}`);
  return e;
}
