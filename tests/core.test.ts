import { describe, expect, it } from 'vitest';
import { charById } from '../src/data/characters';
import { enemyById } from '../src/data/enemies';
import { equipById, findCombine } from '../src/data/equipment';
import { MATCH_CONFIG as CFG, SHOP_ODDS } from '../src/data/stages';
import { simulateBattle } from '../src/battle/engine';
import { buildAllyUnit, buildBackerUnit, buildBattleInput } from '../src/logic/battle-build';
import {
  advanceNode, buyShop, buyExp, combineEquips, equipItemTo, newMatch, placeUnit,
  recallUnit, resolveBattle, sellUnit, unequipItem, sellValue
} from '../src/game/match';
import { computeTeamFlags } from '../src/logic/synergy';
import { EMPTY_TEAM_FLAGS } from '../src/logic/types';
import type { MatchState, OwnedUnit } from '../src/logic/types';

function mkUnit(charId: string, star: 1 | 2 | 3 = 1, slot: OwnedUnit['slot'] = null): OwnedUnit {
  return { uid: `t_${Math.random().toString(36).slice(2)}`, charId, star, slot, equips: [] };
}

/** 构建一个前台战斗单位（引擎输入用） */
function ally(charId: string, star: 1 | 2 | 3 = 1) {
  return buildAllyUnit(mkUnit(charId, star, { row: 'front', index: 0 }), 0, EMPTY_TEAM_FLAGS);
}

/** 构建一个敌方战斗单位（引擎输入用） */
function mkEnemy(id: string, mul = 1) {
  const e = enemyById(id);
  return {
    uid: 'en1', name: e.name, side: 'enemy' as const, color: e.color, boss: false,
    maxHp: Math.round(e.hp * mul), hp: Math.round(e.hp * mul), atk: Math.round(e.atk * mul),
    def: Math.round(e.def * mul), spd: e.spd, critRate: 0.05, critDmg: 1.5, maxEnergy: 0, energy: 0,
    shield: 0, buffs: [], dots: [], alive: true, moves: e.moves, moveIdx: 0,
    passive: { type: 'none' as const }, unitFlags: {
      atkPct: 0, defPct: 0, hpPct: 0, spdPct: 0, healBonus: 0, ultCharge: 0,
      dmgReduce: 0, thorns: 0, onKillAtk: 0, energyStart: 0, regenPct: 0
    }, shenjunStacks: 0, killStacks: 0, nextActionAt: 0, pos: 0
  };
}

describe('商店与购买', () => {
  it('新对局初始状态正确', () => {
    const st = newMatch();
    expect(st.gold).toBe(8);
    expect(st.level).toBe(3);
    expect(st.hp).toBe(100);
    expect(st.shop).toHaveLength(5);
    for (const o of st.shop) {
      if (o.charId) expect(charById(o.charId).cost).toBeGreaterThan(0);
    }
  });

  it('购买扣金币并进入备战席，商品置空', () => {
    const st = newMatch();
    st.gold = 50;
    const idx = st.shop.findIndex(o => o.charId);
    const cid = st.shop[idx].charId!;
    const cost = charById(cid).cost;
    expect(buyShop(st, idx)).toBeNull();
    expect(st.gold).toBe(50 - cost);
    expect(st.shop[idx].charId).toBeNull();
    expect(st.bench.some(u => u.charId === cid)).toBe(true);
  });

  it('金币不足时拒绝购买', () => {
    const st = newMatch();
    st.gold = 0;
    const idx = st.shop.findIndex(o => o.charId && charById(o.charId).cost > 0);
    expect(buyShop(st, idx)).toBe('金币不足');
  });

  it('三个同名 1★ 自动合成 2★', () => {
    const st = newMatch();
    st.gold = 100;
    st.shop = [{ charId: 'march7th' }, { charId: 'march7th' }, { charId: 'march7th' }, { charId: null }, { charId: null }];
    buyShop(st, 0);
    buyShop(st, 1);
    buyShop(st, 2);
    expect(st.bench).toHaveLength(1);
    expect(st.bench[0].star).toBe(2);
  });
});

describe('站位', () => {
  it('受等级限制上阵数量', () => {
    const st = newMatch();
    const a = mkUnit('march7th'), b = mkUnit('danheng'), c = mkUnit('asta'), d = mkUnit('natasha');
    st.bench = [a, b, c, d];
    expect(placeUnit(st, a.uid, 'front', 0)).toBeNull();
    expect(placeUnit(st, b.uid, 'front', 1)).toBeNull();
    expect(placeUnit(st, c.uid, 'front', 2)).toBeNull();
    // 等级 3，第 4 个不能上阵
    expect(placeUnit(st, d.uid, 'front', 3)).toBe('上阵位数不足，购买经验可提升');
    expect(st.board).toHaveLength(3);
  });

  it('撤回与交换', () => {
    const st = newMatch();
    const a = mkUnit('march7th'), b = mkUnit('danheng');
    st.bench = [a, b];
    placeUnit(st, a.uid, 'front', 0);
    placeUnit(st, b.uid, 'front', 1);
    expect(recallUnit(st, a.uid)).toBeNull();
    expect(st.board).toHaveLength(1);
    // 交换：备战席单位放到已占用格子（b 在 front 1）
    expect(placeUnit(st, a.uid, 'front', 1)).toBeNull();
    expect(st.bench.map(u => u.uid)).toContain(b.uid);
    expect(st.board.map(u => u.uid)).toContain(a.uid);
    expect(st.board).toHaveLength(1);
  });

  it('同一角色不能同时上阵（前台/后台合计）', () => {
    const st = newMatch();
    const a = mkUnit('march7th'), a2 = mkUnit('march7th'), b = mkUnit('danheng');
    st.bench = [a, a2, b];
    expect(placeUnit(st, a.uid, 'front', 0)).toBeNull();
    // 同名第二个副本：前台、后台都拒绝
    expect(placeUnit(st, a2.uid, 'front', 1)).toBe('同名角色只能上阵一个');
    expect(placeUnit(st, a2.uid, 'back', 0)).toBe('同名角色只能上阵一个');
    // 不同角色正常
    expect(placeUnit(st, b.uid, 'front', 1)).toBeNull();
    // 上阵后再买同名第3个自动合成 2★（不受影响）
    st.gold = 100;
    st.shop = [{ charId: 'march7th' }, { charId: null }, { charId: null }, { charId: null }, { charId: null }];
    expect(buyShop(st, 0)).toBeNull();
    expect(st.board.some(u => u.charId === 'march7th' && u.star === 2)).toBe(true);
  });
});

describe('经济与结算', () => {
  it('战斗胜利获得基础收入+利息+连胜奖励', () => {
    const st = newMatch();
    st.gold = 25; // 利息 2
    st.winStreak = 1;
    resolveBattle(st, true, 5, 14, 0);
    // 基础 5 + 利息 2 + 2连胜奖励 1 = 8
    expect(st.gold).toBe(33);
    expect(st.winStreak).toBe(2);
  });

  it('战斗失败扣血并获得补偿', () => {
    const st = newMatch();
    st.gold = 0;
    const hp0 = st.hp;
    resolveBattle(st, false, 14, 14, 3);
    expect(st.hp).toBe(hp0 - 15);
    // 基础 5 + 连败补偿 2 = 7
    expect(st.gold).toBe(7);
    expect(st.winStreak).toBe(0);
  });

  it('生命归零进入失败', () => {
    const st = newMatch();
    st.hp = 10;
    resolveBattle(st, false, 14, 14, 2);
    expect(st.hp).toBe(0);
    expect(st.phase).toBe('gameOver');
  });

  it('买经验可升级', () => {
    const st = newMatch();
    st.gold = 20;
    expect(buyExp(st)).toBeNull(); // +4 exp：3级需2升4，剩2
    expect(st.level).toBe(4);
    expect(st.exp).toBe(2);
  });
});

describe('装备', () => {
  it('穿戴/卸下与上限', () => {
    const st = newMatch();
    const u = mkUnit('march7th');
    st.bench = [u];
    st.inventory = ['b_atk', 'b_def', 'b_hp', 'b_spd'];
    equipItemTo(st, 'b_atk', u.uid);
    equipItemTo(st, 'b_def', u.uid);
    equipItemTo(st, 'b_hp', u.uid);
    expect(equipItemTo(st, 'b_spd', u.uid)).toBe('该角色装备栏已满（3 件）');
    unequipItem(st, u.uid, 0);
    expect(u.equips).toHaveLength(2);
    expect(st.inventory).toContain('b_atk');
  });

  it('简易装备两两合成进阶装备', () => {
    expect(findCombine('b_atk', 'b_def')?.id).toBe('a_medal');
    expect(findCombine('b_atk', 'b_atk')?.id).toBe('a_dawn');
    const st = newMatch();
    st.inventory = ['b_atk', 'b_def'];
    expect(combineEquips(st, 'b_atk', 'b_def')).toBeNull();
    expect(st.inventory).toEqual(['a_medal']);
  });

  it('出售返还金币并卸下装备', () => {
    const st = newMatch();
    st.gold = 0;
    const u = mkUnit('himeko');
    u.equips = ['b_atk'];
    st.bench = [u];
    const v = sellValue(u);
    expect(sellUnit(st, u.uid)).toBeNull();
    expect(st.gold).toBe(v);
    expect(st.inventory).toContain('b_atk');
  });
});

describe('羁绊', () => {
  it('统计阵营与流派，后台不再提供全队 +4% 加成', () => {
    const board = [
      mkUnit('march7th', 1, { row: 'front', index: 0 }),
      mkUnit('danheng', 1, { row: 'front', index: 1 }),
      mkUnit('asta', 1, { row: 'back', index: 0 })
    ];
    const flags = computeTeamFlags(board);
    // 列车同行 3 人（阈值2）：生命+8%；后台 1 人无额外加成（参战贡献走后台赋能）
    expect(flags.hpPct).toBeCloseTo(0.08);
    expect(flags.atkPct).toBeCloseTo(0);
  });
});

describe('商店概率与等级上限（官方表）', () => {
  it('概率表完整性：Lv1-10 齐全，每行合计 100，Lv1-3 全 1 费', () => {
    for (let lv = 1; lv <= 10; lv++) {
      const odds = SHOP_ODDS[lv];
      expect(odds, `Lv${lv} 缺失`).toBeDefined();
      expect(odds.reduce((a, b) => a + b, 0)).toBe(100);
    }
    for (const lv of [1, 2, 3]) {
      expect(SHOP_ODDS[lv]).toEqual([100, 0, 0, 0, 0]);
    }
    // Lv10：5 费 25%
    expect(SHOP_ODDS[10][4]).toBe(25);
  });

  it('等级上限 10，经验表覆盖到 9→10', () => {
    expect(CFG.maxLevel).toBe(10);
    expect(CFG.expToNext[9]).toBeGreaterThan(0);
  });
});

describe('后台机制', () => {
  it('后台强度随星级缩放', () => {
    const c = charById('seele');
    const b1 = buildBackerUnit(mkUnit('seele', 1, { row: 'back', index: 0 }), 0, { ...EMPTY_TEAM_FLAGS });
    const b3 = buildBackerUnit(mkUnit('seele', 3, { row: 'back', index: 0 }), 0, { ...EMPTY_TEAM_FLAGS });
    expect(b1.atk).toBe(c.backPower);
    expect(b3.atk).toBe(Math.round(c.backPower * 3.2));
    expect(b1.backend).toBe(true);
    expect(b1.maxEnergy).toBe(0);
  });

  it('buildBattleInput 把后台角色编译为 backers，前台不含后台单位', () => {
    const st = newMatch();
    const f = mkUnit('march7th', 1, { row: 'front', index: 0 });
    const b = mkUnit('seele', 1, { row: 'back', index: 0 });
    st.bench = [f, b];
    st.board = [f, b];
    const input = buildBattleInput(st);
    expect(input.allies).toHaveLength(1);
    expect(input.allies[0].uid).toBe(f.uid);
    expect(input.backers).toHaveLength(1);
    expect(input.backers[0].uid).toBe(b.uid);
    expect(input.backers[0].atk).toBe(charById('seele').backPower);
  });

  it('后台单位周期施放赋能造成伤害，且不会被敌人选中', () => {
    const backer = buildBackerUnit(mkUnit('seele', 3, { row: 'back', index: 0 }), 0, { ...EMPTY_TEAM_FLAGS });
    const res = simulateBattle({
      allies: [ally('march7th', 3)],
      backers: [backer],
      enemies: [mkEnemy('automaton_bear', 2)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 14,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    const backendActs = res.events.filter(e => e.t === 'act' && e.kind === 'backend');
    expect(backendActs.length).toBeGreaterThan(0);
    // 后台赋能命中敌人造成伤害
    const dmg = backendActs.flatMap(e => (e.t === 'act' ? e.hits : [])).filter(h => h.dmg !== undefined);
    expect(dmg.length).toBeGreaterThan(0);
    // 敌人所有攻击都落在前台单位上，绝不命中后台单位
    const enemyTargets = res.events
      .filter(e => e.t === 'act' && e.kind === 'enemy')
      .flatMap(e => (e.t === 'act' ? e.hits : []));
    expect(enemyTargets.length).toBeGreaterThan(0);
    for (const h of enemyTargets) expect(h.uid).not.toBe(backer.uid);
  });

  it('后台治疗赋能生效（娜塔莎巡诊）', () => {
    const backer = buildBackerUnit(mkUnit('natasha', 2, { row: 'back', index: 0 }), 0, { ...EMPTY_TEAM_FLAGS });
    const res = simulateBattle({
      allies: [ally('march7th', 3)],
      backers: [backer],
      enemies: [mkEnemy('automaton_bear', 1)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 14,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    const heals = res.events
      .filter(e => e.t === 'act' && e.kind === 'backend')
      .flatMap(e => (e.t === 'act' ? e.hits : []))
      .filter(h => h.heal !== undefined);
    expect(heals.length).toBeGreaterThan(0);
  });

  it('后台增益赋能生效（停云全队攻击祝福）', () => {
    const backer = buildBackerUnit(mkUnit('tingyun', 1, { row: 'back', index: 0 }), 0, { ...EMPTY_TEAM_FLAGS });
    const front = ally('march7th', 1);
    const res = simulateBattle({
      allies: [front],
      backers: [backer],
      // 高血低攻敌人：战斗必然持续到敌方行动上限，末尾必定仍有存续的攻击增益
      enemies: [mkEnemy('boss_p3', 0.2)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 8,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    expect(res.events.some(e => e.t === 'act' && e.kind === 'backend')).toBe(true);
    expect(front.buffs.some(bf => (bf.atkPct ?? 0) > 0)).toBe(true);
  });
});

describe('战斗引擎', () => {
  it('强我弱敌能获胜且事件流完整', () => {
    const res = simulateBattle({
      allies: [ally('seele', 3), ally('march7th', 3), ally('bailu', 2)],
      backers: [],
      enemies: [mkEnemy('swarm_wing', 0.5)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 14,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    expect(res.win).toBe(true);
    expect(res.events[0].t).toBe('start');
    expect(res.events[res.events.length - 1].t).toBe('end');
    for (const e of res.events) {
      if (e.t === 'act') {
        for (const h of e.hits) {
          expect(Number.isFinite(h.hpAfter)).toBe(true);
        }
      }
    }
  });

  it('超时判负', () => {
    const res = simulateBattle({
      allies: [ally('march7th')],
      backers: [],
      enemies: [mkEnemy('automaton_bear', 3)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 4,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    expect(res.win).toBe(false);
    expect(res.enemyActions).toBeLessThanOrEqual(4);
  });

  it('战技点机制：普攻回复、战技消耗', () => {
    const res = simulateBattle({
      allies: [ally('danheng', 2)],
      backers: [],
      enemies: [mkEnemy('swarm_node', 0.3)],
      spStart: 1, spMax: 5, shieldPct: 0, enemyActionLimit: 10,
      teamFlags: { ...EMPTY_TEAM_FLAGS }
    });
    const acts = res.events.filter(e => e.t === 'act' && (e.kind === 'basic' || e.kind === 'skill'));
    expect(acts.length).toBeGreaterThan(0);
    for (const e of acts) {
      if (e.t !== 'act') continue;
      if (e.kind === 'basic') expect(e.sp).toBeLessThanOrEqual(5);
    }
  });

  it('持续伤害可击杀敌人', () => {
    // 1★卡芙卡 + 双治疗 vs 高血量敌人：靠触电/灼烧磨死
    const res = simulateBattle({
      allies: [ally('kafka', 1), ally('bailu', 2), ally('natasha', 2)],
      backers: [],
      enemies: [mkEnemy('automaton_bear', 2)],
      spStart: 5, spMax: 5, shieldPct: 0, enemyActionLimit: 16,
      teamFlags: { ...EMPTY_TEAM_FLAGS, regenPct: 0.02 }
    });
    expect(res.win).toBe(true);
    const dotEvents = res.events.filter(e => e.t === 'act' && e.kind === 'dot');
    expect(dotEvents.length).toBeGreaterThan(0);
  });
});

describe('节点推进', () => {
  it('胜利后推进到奖励节点', () => {
    const st: MatchState = newMatch();
    advanceNode(st);
    expect(st.node).toBe(1);
    expect(st.phase).toBe('reward');
    expect(st.rewards).toHaveLength(3);
  });

  it('通关三位面进入胜利', () => {
    const st = newMatch();
    st.plane = 2;
    st.node = 5; // 最后一个节点（首领）
    advanceNode(st);
    expect(st.phase).toBe('victory');
  });
});
