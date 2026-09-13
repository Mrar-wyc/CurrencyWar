import { charById, STAR_MULT } from '../data/characters';
import { enemyById } from '../data/enemies';
import { equipById } from '../data/equipment';
import { PLANES } from '../data/stages';
import { computeTeamFlags } from './synergy';
import { EMPTY_UNIT_FLAGS } from './types';
import type { BattleNode, CombatUnit, MatchState, OwnedUnit, TeamFlags, UnitFlags } from './types';

/** 汇总一件角色的装备：单体加成 + 全队加成分开返回 */
export function mergeEquips(equipIds: string[]): { unit: UnitFlags; team: Partial<TeamFlags> } {
  const unit: UnitFlags = { ...EMPTY_UNIT_FLAGS };
  const team: Partial<TeamFlags> = {};
  for (const id of equipIds) {
    const e = equipById(id);
    if (e.scope === 'unit') {
      for (const [k, v] of Object.entries(e.flags)) {
        if (k in unit) (unit as unknown as Record<string, number>)[k] += v as number;
        else (team as Record<string, number>)[k] = ((team as Record<string, number>)[k] ?? 0) + (v as number);
      }
    } else {
      for (const [k, v] of Object.entries(e.flags)) {
        (team as Record<string, number>)[k] = ((team as Record<string, number>)[k] ?? 0) + (v as number);
      }
    }
  }
  return { unit, team };
}

/** 构建一名我方战斗单位（星级成长 + 装备 + 全队加成） */
export function buildAllyUnit(u: OwnedUnit, pos: number, tf: TeamFlags): CombatUnit {
  const c = charById(u.charId);
  const m = STAR_MULT[u.star];
  const { unit: uf } = mergeEquips(u.equips);
  const maxHp = Math.round(c.base.hp * m * (1 + tf.hpPct) * (1 + uf.hpPct));
  return {
    uid: u.uid,
    name: c.name,
    side: 'ally',
    color: c.color,
    charId: c.id,
    boss: false,
    maxHp,
    hp: maxHp,
    atk: Math.round(c.base.atk * m * (1 + tf.atkPct) * (1 + uf.atkPct)),
    def: Math.round(c.base.def * m * (1 + tf.defPct) * (1 + uf.defPct)),
    spd: Math.round(c.base.spd * (1 + tf.spdPct) * (1 + uf.spdPct)),
    critRate: c.critRate + tf.critRate,
    critDmg: c.critDmg,
    maxEnergy: c.maxEnergy,
    energy: Math.round(c.maxEnergy * uf.energyStart),
    shield: 0,
    buffs: [],
    dots: [],
    alive: true,
    moveIdx: 0,
    char: c,
    passive: c.passive,
    unitFlags: uf,
    shenjunStacks: c.passive.type === 'shenjun' ? c.passive.init : 0,
    killStacks: 0,
    nextActionAt: 0,
    pos
  };
}

/** 构建一名后台参战单位：不会被选中攻击，周期施放后台赋能 */
export function buildBackerUnit(u: OwnedUnit, pos: number, tf: TeamFlags): CombatUnit {
  const c = charById(u.charId);
  const m = STAR_MULT[u.star];
  const { unit: uf } = mergeEquips(u.equips);
  const maxHp = Math.round(c.base.hp * m);
  // 后台强度 = backPower × 星级倍率 × (1 + 团队加成 + 自身 unit 装备攻击加成)
  const power = Math.round(c.backPower * m * (1 + tf.backPowerPct + uf.atkPct));
  return {
    uid: u.uid,
    name: c.name,
    side: 'ally',
    color: c.color,
    charId: c.id,
    boss: false,
    maxHp,
    hp: maxHp,
    atk: power,
    def: 0,
    spd: c.base.spd,
    critRate: c.critRate,
    critDmg: c.critDmg,
    maxEnergy: 0,
    energy: 0,
    shield: 0,
    buffs: [],
    dots: [],
    alive: true,
    moveIdx: 0,
    char: c,
    passive: { type: 'none' },
    unitFlags: uf,
    shenjunStacks: 0,
    killStacks: 0,
    nextActionAt: 0,
    pos,
    backend: true
  };
}

/** 按关卡节点构建敌方阵容 */
export function buildEnemies(node: BattleNode): CombatUnit[] {
  const out: CombatUnit[] = [];
  let pos = 0;
  for (const entry of node.enemies) {
    const def = enemyById(entry.id);
    const count = entry.count ?? 1;
    for (let i = 0; i < count; i++) {
      const maxHp = Math.round(def.hp * entry.mul);
      out.push({
        uid: `e_${entry.id}_${i}`,
        name: def.name,
        side: 'enemy',
        color: def.color,
        charId: undefined,
        boss: !!def.boss,
        maxHp,
        hp: maxHp,
        atk: Math.round(def.atk * entry.mul),
        def: Math.round(def.def * entry.mul),
        spd: Math.round(def.spd),
        critRate: def.critRate,
        critDmg: def.critDmg,
        maxEnergy: 0,
        energy: 0,
        shield: 0,
        buffs: [],
        dots: [],
        alive: true,
        moves: def.moves,
        moveIdx: 0,
        passive: { type: 'none' },
        unitFlags: { ...EMPTY_UNIT_FLAGS },
        shenjunStacks: 0,
        killStacks: 0,
        nextActionAt: 0,
        pos: pos++
      });
    }
  }
  return out;
}

export interface BattleInput {
  allies: CombatUnit[];
  /** 后台参战单位（周期自动施放后台赋能，不可被选中） */
  backers: CombatUnit[];
  enemies: CombatUnit[];
  spStart: number;
  spMax: number;
  shieldPct: number;
  enemyActionLimit: number;
  teamFlags: TeamFlags;
}

/** 从对局状态构建一场战斗的完整输入 */
export function buildBattleInput(st: MatchState): BattleInput {
  const battle = currentBattle(st);
  const tf = computeTeamFlags(st.board);
  for (const u of st.board) {
    for (const eid of u.equips) {
      const e = equipById(eid);
      if (e.scope === 'team') {
        for (const [k, v] of Object.entries(e.flags)) {
          (tf as unknown as Record<string, number>)[k] += v as number;
        }
      }
    }
  }
  const front = st.board
    .filter(u => u.slot?.row === 'front')
    .sort((a, b) => (a.slot?.index ?? 0) - (b.slot?.index ?? 0));
  const back = st.board
    .filter(u => u.slot?.row === 'back')
    .sort((a, b) => (a.slot?.index ?? 0) - (b.slot?.index ?? 0));
  const allies = front.map((u, i) => buildAllyUnit(u, i, tf));
  const backers = back.map((u, i) => buildBackerUnit(u, i, tf));
  const enemies = buildEnemies(battle);
  const spMax = 5 + tf.spMaxBonus;
  return {
    allies,
    backers,
    enemies,
    spStart: Math.min(spMax, 3 + tf.spStart),
    spMax,
    shieldPct: tf.startShieldPct,
    enemyActionLimit: battle.enemyActionLimit,
    teamFlags: tf
  };
}

/** 取当前节点的战斗定义（当前节点必须是战斗节点） */
export function currentBattle(st: MatchState): BattleNode {
  const n = PLANES[st.plane].nodes[st.node];
  if (n.kind === 'reward' || n.kind === 'supply') throw new Error('当前节点不是战斗节点');
  return n.battle;
}
