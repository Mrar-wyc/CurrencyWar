import { describe, expect, it } from 'vitest';
import { charById, CHARACTERS, POOL_COPIES } from '../src/data/characters';
import { enemyById } from '../src/data/enemies';
import { equipById, findCombine } from '../src/data/equipment';
import { MATCH_CONFIG as CFG, SHOP_ODDS } from '../src/data/stages';
import { FACTION_TRAITS, SCHOOL_TRAITS } from '../src/data/traits';
import { createPool } from '../src/logic/shop';
import { simulateBattle } from '../src/battle/engine';
import { buildAllyUnit, buildBackerUnit, buildBattleInput } from '../src/logic/battle-build';
import {
  advanceNode, buyShop, buyExp, combineEquips, equipItemTo, newMatch, pickStrategy,
  placeUnit, recallUnit, reroll, resolveBattle, sellUnit, unequipItem, sellValue
} from '../src/game/match';
import { computeTeamFlags } from '../src/logic/synergy';
import { rerollCostOf, rollStrategyOffers, strategyEnemyMult, strategyTeamFlags, strategyUnitMods } from '../src/logic/strategy';
import { strategyById } from '../src/data/strategies';
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
  it('战斗胜利获得基础收入+利息+胜利金+连胜奖励', () => {
    const st = newMatch();
    st.gold = 25; // 利息 2
    st.winStreak = 1;
    resolveBattle(st, true, 5, 14, 0);
    // 基础 5 + 利息 2 + 胜利金 1 + 2连胜奖励 1 = 9
    expect(st.gold).toBe(34);
    expect(st.winStreak).toBe(2);
  });

  it('连胜奖励封顶 +3（官方）', () => {
    const st = newMatch();
    st.gold = 0;
    st.winStreak = 5;
    resolveBattle(st, true, 5, 14, 0);
    // 基础 5 + 胜利金 1 + 6连胜奖励 3 = 9
    expect(st.gold).toBe(9);
    st.winStreak = 9;
    st.gold = 0;
    resolveBattle(st, true, 5, 14, 0);
    // 10 连胜仍为 +3：基础 5 + 胜利金 1 + 3 = 9
    expect(st.gold).toBe(9);
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

  it('买经验可升级（官方经验表 3→4 需 4 exp）', () => {
    const st = newMatch();
    st.gold = 20;
    expect(buyExp(st)).toBeNull(); // +4 exp：3级需4升4，剩0
    expect(st.level).toBe(4);
    expect(st.exp).toBe(0);
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

  it('当头一棒：开战对最高血敌人造成策略伤害', () => {
    const res = simulateBattle({
      allies: [ally('march7th', 1)],
      backers: [],
      enemies: [mkEnemy('automaton_bear', 1)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 6,
      teamFlags: { ...EMPTY_TEAM_FLAGS },
      strategyMods: { nuke: { mult: 10, defPct: -0.3, turns: 2 } }
    });
    const nuke = res.events.find(e => e.t === 'act' && e.kind === 'nuke');
    expect(nuke).toBeDefined();
    if (nuke?.t === 'act') expect(nuke.hits[0].dmg).toBeGreaterThan(0);
  });

  it('风暴骑士：开战时 1 号位受 70% 上限固定伤害一次', () => {
    const front = ally('march7th', 1);
    const res = simulateBattle({
      allies: [front],
      backers: [],
      enemies: [mkEnemy('boss_p3', 0.2)],
      spStart: 3, spMax: 5, shieldPct: 0, enemyActionLimit: 4,
      teamFlags: { ...EMPTY_TEAM_FLAGS },
      strategyMods: { firstSelfHarmPct: 0.7 }
    });
    const harms = res.events.filter(e => e.t === 'act' && e.kind === 'selfharm');
    expect(harms).toHaveLength(1); // 开战一次，不随行动重复
    if (harms[0].t === 'act') {
      expect(harms[0].hits[0].uid).toBe(front.uid);
      expect(harms[0].hits[0].dmg).toBe(Math.round(front.maxHp * 0.7));
    }
  });
});

describe('节点推进', () => {
  it('胜利后推进到策略节点，采纳后进入奖励节点', () => {
    const st: MatchState = newMatch();
    advanceNode(st);
    expect(st.node).toBe(1);
    expect(st.phase).toBe('strategy');
    expect(st.strategyOffers).toHaveLength(3);
    pickStrategy(st, 0);
    expect(st.strategies).toHaveLength(1);
    expect(st.node).toBe(2);
    expect(st.phase).toBe('reward');
    expect(st.rewards).toHaveLength(3);
  });

  it('通关三位面进入胜利', () => {
    const st = newMatch();
    st.plane = 2;
    st.node = 7; // 最后一个节点（首领）
    advanceNode(st);
    expect(st.phase).toBe('victory');
  });
});

describe('投资策略', () => {
  /** 构造一个处于策略选择阶段的对局 */
  function strategyPhase(offers: string[]): MatchState {
    const st = newMatch();
    st.phase = 'strategy';
    st.strategyOffers = offers;
    return st;
  }

  it('三选一生成合法且不重复', () => {
    for (let i = 0; i < 20; i++) {
      const offers = rollStrategyOffers();
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      for (const id of offers) expect(strategyById(id)).toBeDefined();
    }
  });

  it('全员晋升：上阵角色费用+1、防重名、保留星级', () => {
    const st = strategyPhase(['promo_all']);
    st.board = [
      mkUnit('march7th', 2, { row: 'front', index: 0 }),
      mkUnit('danheng', 2, { row: 'front', index: 1 })
    ];
    pickStrategy(st, 0);
    expect(st.board).toHaveLength(2);
    for (const u of st.board) expect(charById(u.charId).cost).toBe(2);
    expect(new Set(st.board.map(u => u.charId)).size).toBe(2);
    expect(st.board.every(u => u.star === 2)).toBe(true);
  });

  it('大裁员：出售全部角色双倍售价 + 6 次免费刷新', () => {
    const st = strategyPhase(['layoff_front']);
    const u = mkUnit('seele', 1, { row: 'front', index: 0 }); // 3费 1★ 售价 3
    u.equips = ['b_atk'];
    const b = mkUnit('danheng', 1); // 备战席也出售（1费售价 1）
    st.board = [u];
    st.bench = [b];
    st.gold = 0;
    pickStrategy(st, 0);
    expect(st.board).toHaveLength(0);
    expect(st.bench).toHaveLength(0);
    expect(st.gold).toBe(8); // (3+1)×2
    expect(st.freeRerolls).toBe(6);
    expect(st.inventory).toContain('b_atk');
  });

  it('人力重组：出售全部角色换 2★ 角色包', () => {
    const st = strategyPhase(['layoff_all']);
    st.board = [mkUnit('seele', 1, { row: 'front', index: 0 })];
    st.bench = [mkUnit('march7th', 1)];
    const goldBefore = st.gold;
    pickStrategy(st, 0);
    expect(st.board).toHaveLength(0);
    expect(st.gold).toBe(goldBefore); // 不给金币
    // 1×2★3费 + 2×2★2费 + 2×2★1费（tryMerge 可能合并，至少 3 名且全为 2★ 以上）
    expect(st.bench.length).toBeGreaterThanOrEqual(3);
    expect(st.bench.every(u => u.star >= 2)).toBe(true);
    expect(st.bench.some(u => charById(u.charId).cost === 3)).toBe(true);
  });

  it('降本增效：出售全部双倍售价 + 6 次免费购买', () => {
    const st = strategyPhase(['cheap_reroll']);
    const u = mkUnit('seele', 1, { row: 'front', index: 0 }); // 3费 1★ 售价 3
    st.board = [u];
    st.gold = 0;
    pickStrategy(st, 0);
    expect(st.board).toHaveLength(0);
    expect(st.gold).toBe(6);
    expect(st.freeBuys).toBe(6);
    // 免费购买：金币不足也能买，且不消耗金币
    st.phase = 'prep';
    st.shop = [{ charId: 'seele' }, { charId: null }, { charId: null }, { charId: null }, { charId: null }];
    expect(buyShop(st, 0)).toBeNull();
    expect(st.gold).toBe(6);
    expect(st.freeBuys).toBe(5);
  });

  it('超发货币：清空金币，5 节点后返还失去数额+70', () => {
    const st = strategyPhase(['hyperinflation']);
    st.gold = 30;
    pickStrategy(st, 0);
    expect(st.gold).toBe(0);
    // 采纳后推进 1 节点；再推 3 次共 4 节点（未到 5，无返还）；第 5 次推进一次性返还 30+70
    for (let i = 0; i < 3; i++) advanceNode(st);
    expect(st.gold).toBe(0);
    advanceNode(st);
    expect(st.gold).toBe(100);
    advanceNode(st);
    expect(st.gold).toBe(100);
  });

  it('四费晋升：下一个 4 费直接 2★，买其他费用不消耗', () => {
    const st = strategyPhase(['promo4']);
    pickStrategy(st, 0);
    expect(st.strategyData.promo4).toBe(1);
    st.phase = 'prep';
    st.gold = 50;
    st.shop = [{ charId: 'march7th' }, { charId: 'gepard' }, { charId: null }, { charId: null }, { charId: null }];
    buyShop(st, 0);
    expect(st.bench[0].star).toBe(1);
    expect(st.strategyData.promo4).toBe(1);
    buyShop(st, 1);
    const gepard = st.bench.find(u => u.charId === 'gepard')!;
    expect(gepard.star).toBe(2);
    expect(st.strategyData.promo4).toBe(0);
  });

  it('招财狗：每胜 +2 金', () => {
    const st = newMatch();
    st.strategies = ['lucky_dog'];
    st.gold = 0;
    st.winStreak = 1;
    resolveBattle(st, true, 5, 14, 0);
    // 基础 5 + 胜利金 1 + 2连胜奖励 1 + 招财狗 2 = 9
    expect(st.gold).toBe(9);
  });

  it('无伤通关：胜利且无人倒下 +1 金（常驻）', () => {
    const st = newMatch();
    st.strategies = ['no_damage'];
    st.gold = 0;
    resolveBattle(st, true, 5, 14, 0, 1); // 有人倒下：不触发
    // 基础 5 + 胜利金 1 = 6
    expect(st.gold).toBe(6);
    st.gold = 0;
    resolveBattle(st, true, 5, 14, 0, 0);
    // 基础 5 + 胜利金 1 + 2连胜 1 + 无伤 1 = 8
    expect(st.gold).toBe(8);
  });

  it('现金为王：清空上阵换 3 场 25% 护盾', () => {
    const st = strategyPhase(['cash_is_king']);
    const u = mkUnit('seele', 1, { row: 'front', index: 0 });
    u.equips = ['b_atk'];
    st.board = [u];
    const goldBefore = st.gold;
    pickStrategy(st, 0);
    expect(st.board).toHaveLength(0);
    expect(st.gold).toBe(goldBefore);
    expect(st.strategyData.cash_is_king).toBe(3);
    expect(st.inventory).toContain('b_atk');
    resolveBattle(st, true, 5, 14, 0, 0);
    expect(st.strategyData.cash_is_king).toBe(2);
  });

  it('条件加成：中产阶级(全队) / 人海(基础+满员) / 独狼与三三三(按角色)', () => {
    const st = newMatch();
    // 中产阶级：2 名 2★
    st.strategies = ['middle_class'];
    st.bench = [mkUnit('march7th', 2), mkUnit('danheng', 2)];
    let f = strategyTeamFlags(st);
    expect(f.atkPct).toBeCloseTo(0.30);
    expect(f.dmgReduce).toBeCloseTo(0.10);
    // 人海战术：基础 +10%；上阵 8 人再 +20%
    st.strategies = ['horde'];
    st.bench = [];
    st.board = [];
    for (let i = 0; i < 8; i++) {
      const u = mkUnit('march7th', 1, i < 6 ? { row: 'front', index: i } : { row: 'back', index: i - 6 });
      st.board.push(u);
    }
    f = strategyTeamFlags(st);
    expect(f.atkPct).toBeCloseTo(0.30);
    st.board = st.board.slice(0, 3);
    f = strategyTeamFlags(st);
    expect(f.atkPct).toBeCloseTo(0.10);
    // 独狼（按角色）：丹恒的列车/爆发均未激活 → 获得 120%/36%
    st.strategies = ['lone_wolf'];
    const lone = mkUnit('danheng', 1, { row: 'front', index: 0 });
    st.board = [lone];
    let m = strategyUnitMods(st, lone);
    expect(m.atkPct).toBeCloseTo(1.2);
    expect(m.dmgReduce).toBeCloseTo(0.36);
    // 三月七的护盾羁绊 1 人即激活 → 不享受独狼
    const shield = mkUnit('march7th', 1, { row: 'front', index: 0 });
    st.board = [shield];
    m = strategyUnitMods(st, shield);
    expect(m.atkPct ?? 0).toBeCloseTo(0);
    // 三三三（按角色）：3★（+1）；3 件装备（+1）；4 费不计 → 2 项叠加
    st.strategies = ['three_three_three'];
    const s3 = mkUnit('seele', 3, { row: 'front', index: 0 }); // 希儿已校准为 3 费：3★+3费+3件装三项全满足
    s3.equips = ['b_atk', 'b_def', 'b_hp'];
    m = strategyUnitMods(st, s3);
    expect(m.atkPct).toBeCloseTo(0.6);
    expect(m.spdPct).toBeCloseTo(0.3);
  });

  it('免费刷新/免费购买资源：reroll 与 buyShop 优先消耗', () => {
    const st = newMatch();
    st.freeRerolls = 2;
    st.freeBuys = 1;
    st.gold = 0;
    expect(reroll(st)).toBeNull();
    expect(st.freeRerolls).toBe(1);
    expect(st.gold).toBe(0);
    const idx = st.shop.findIndex(o => o.charId);
    expect(buyShop(st, idx)).toBeNull();
    expect(st.freeBuys).toBe(0);
    expect(st.gold).toBe(0);
    st.freeBuys = 0;
    expect(buyShop(st, st.shop.findIndex(o => o.charId))).toBe('金币不足');
  });

  it('敌人数值系数：难度削减/伟大征服/策略难度加成', () => {
    const st = newMatch();
    expect(strategyEnemyMult(st)).toBeCloseTo(1);
    st.strategies = ['simple_mode', 'difficulty_modifier'];
    expect(strategyEnemyMult(st)).toBeCloseTo(0.75);
    st.strategies = ['great_conquest'];
    st.winStreak = 2;
    // 伟大征服 +8%，自身为金色策略 +4%
    expect(strategyEnemyMult(st)).toBeCloseTo(1.12);
    st.strategies = ['lucky_dog', 'promo4'];
    st.winStreak = 0;
    // 招财狗为银 +0，promo4 为金 +4%
    expect(strategyEnemyMult(st)).toBeCloseTo(1.04);
  });
});

describe('角色数据完整性（路线④）', () => {
  it('共 24 名，字段齐全且阵营/流派合法', () => {
    expect(CHARACTERS.length).toBe(24);
    const factionIds = new Set(FACTION_TRAITS.map(t => t.id));
    const schoolIds = new Set(SCHOOL_TRAITS.map(t => t.id));
    for (const c of CHARACTERS) {
      expect(factionIds.has(c.faction), `${c.name} 阵营非法`).toBe(true);
      for (const t of c.tags) expect(schoolIds.has(t), `${c.name} 流派非法`).toBe(true);
      expect(c.backPower).toBeGreaterThan(0);
      expect(c.backSkill).toBeTruthy();
      expect(() => charById(c.id)).not.toThrow();
    }
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(CHARACTERS.length);
  });

  it('攻击力符合费用档位区间', () => {
    const bands: Record<number, [number, number]> = {
      1: [340, 420], 2: [400, 480], 3: [440, 540], 4: [460, 600], 5: [560, 660]
    };
    for (const c of CHARACTERS) {
      const [lo, hi] = bands[c.cost];
      expect(c.base.atk >= lo && c.base.atk <= hi, `${c.name} atk ${c.base.atk} 不在 ${c.cost} 费区间`).toBe(true);
    }
  });

  it('牌池覆盖全部角色且复制数按费用', () => {
    const pool = createPool();
    expect(Object.keys(pool).length).toBe(CHARACTERS.length);
    for (const c of CHARACTERS) expect(pool[c.id]).toBe(POOL_COPIES[c.cost]);
  });
});
