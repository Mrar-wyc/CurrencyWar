import { charById } from '../data/characters';
import { ADVANCED_EQUIPS, equipById, findCombine, randomBasicEquip } from '../data/equipment';
import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { createPool, returnOffers, rollShop } from '../logic/shop';
import { buildBattleInput } from '../logic/battle-build';
import type { BattleInput } from '../logic/battle-build';
import type { MatchState, OwnedUnit, PendingReward } from '../logic/types';

export function newMatch(): MatchState {
  const st: MatchState = {
    phase: 'prep',
    plane: 0,
    node: 0,
    hp: CFG.startHp,
    gold: CFG.startGold,
    level: CFG.startLevel,
    exp: 0,
    winStreak: 0,
    lossStreak: 0,
    battlesWon: 0,
    battlesLost: 0,
    bestWinStreak: 0,
    threeStarsMade: 0,
    shop: [],
    shopLocked: false,
    pool: createPool(),
    bench: [],
    board: [],
    inventory: [],
    rewards: [],
    seq: 1
  };
  st.shop = rollShop(st.level, st.pool);
  return st;
}

export function findUnit(st: MatchState, uid: string): OwnedUnit | undefined {
  return st.bench.find(u => u.uid === uid) ?? st.board.find(u => u.uid === uid);
}

function countOwnedSame(st: MatchState, charId: string, star: number): number {
  return [...st.bench, ...st.board].filter(u => u.charId === charId && u.star === star).length;
}

/** 自动三合一升星（级联），被合并单位的装备退回背包 */
function tryMerge(st: MatchState): void {
  for (;;) {
    const all = [...st.bench, ...st.board];
    const byKey = new Map<string, OwnedUnit[]>();
    for (const u of all) {
      if (u.star >= 3) continue;
      const key = `${u.charId}:${u.star}`;
      const list = byKey.get(key) ?? [];
      list.push(u);
      byKey.set(key, list);
    }
    let merged = false;
    for (const [, list] of byKey) {
      if (list.length < 3) continue;
      const kept = list.find(u => u.slot) ?? list[0];
      const removed = list.filter(u => u !== kept).slice(0, 2);
      st.bench = st.bench.filter(u => !removed.includes(u));
      st.board = st.board.filter(u => !removed.includes(u));
      kept.star = (kept.star + 1) as OwnedUnit['star'];
      for (const r of removed) st.inventory.push(...r.equips);
      if (kept.star === 3) st.threeStarsMade++;
      merged = true;
      break;
    }
    if (!merged) return;
  }
}

export function buyShop(st: MatchState, idx: number): string | null {
  if (st.phase !== 'prep') return '当前不能购买';
  const offer = st.shop[idx];
  if (!offer?.charId) return '该商品已售出';
  const c = charById(offer.charId);
  if (st.gold < c.cost) return '金币不足';
  const willMerge = countOwnedSame(st, c.id, 1) >= 2;
  if (st.bench.length >= CFG.benchSlots && !willMerge) return '备战席已满';
  st.gold -= c.cost;
  offer.charId = null;
  st.bench.push({ uid: `u${st.seq++}`, charId: c.id, star: 1, slot: null, equips: [] });
  tryMerge(st);
  return null;
}

export function reroll(st: MatchState): string | null {
  if (st.phase !== 'prep') return '当前不能刷新';
  if (st.gold < CFG.rerollCost) return '金币不足';
  st.gold -= CFG.rerollCost;
  returnOffers(st.pool, st.shop);
  st.shop = rollShop(st.level, st.pool);
  return null;
}

export function toggleLock(st: MatchState): void {
  st.shopLocked = !st.shopLocked;
}

export function gainExp(st: MatchState, n: number): void {
  if (st.level >= CFG.maxLevel) return;
  st.exp += n;
  while (st.level < CFG.maxLevel && st.exp >= (CFG.expToNext[st.level] ?? Infinity)) {
    st.exp -= CFG.expToNext[st.level];
    st.level++;
  }
  if (st.level >= CFG.maxLevel) st.exp = 0;
}

export function buyExp(st: MatchState): string | null {
  if (st.phase !== 'prep') return '当前不能购买经验';
  if (st.level >= CFG.maxLevel) return '已达到最高等级';
  if (st.gold < CFG.expCost) return '金币不足';
  st.gold -= CFG.expCost;
  gainExp(st, CFG.expGain);
  return null;
}

export function sellValue(u: OwnedUnit): number {
  const c = charById(u.charId);
  return c.cost * (u.star === 1 ? 1 : u.star === 2 ? 2 : 4);
}

export function sellUnit(st: MatchState, uid: string): string | null {
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  st.gold += sellValue(u);
  st.inventory.push(...u.equips);
  st.bench = st.bench.filter(x => x.uid !== uid);
  st.board = st.board.filter(x => x.uid !== uid);
  return null;
}

export function frontCapacity(st: MatchState): number {
  return Math.min(CFG.frontSlots, st.level);
}

export function boardFull(st: MatchState): boolean {
  return st.board.length >= st.level;
}

export function placeUnit(st: MatchState, uid: string, row: 'front' | 'back', index: number): string | null {
  if (st.phase !== 'prep') return '当前不能调整站位';
  if (row === 'front' && index >= CFG.frontSlots) return '前台位置不存在';
  if (row === 'back' && index >= CFG.backSlots) return '后台位置不存在';
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  const other = st.board.find(x => x.uid !== uid && x.slot?.row === row && x.slot?.index === index);

  if (u.slot) {
    // 已在棋盘：移动/交换
    if (other) {
      other.slot = { ...u.slot };
      u.slot = { row, index };
    } else {
      u.slot = { row, index };
    }
    return null;
  }
  // 备战席 → 棋盘
  if (other) {
    // 与棋盘单位交换：other 必须从棋盘数组移除，避免幽灵单位
    st.bench = st.bench.filter(x => x.uid !== u.uid);
    st.board = st.board.filter(x => x.uid !== other.uid);
    u.slot = { row, index };
    other.slot = null;
    st.bench.push(other);
    st.board.push(u);
    return null;
  }
  if (boardFull(st)) return '上阵位数不足，购买经验可提升';
  st.bench = st.bench.filter(x => x.uid !== u.uid);
  u.slot = { row, index };
  st.board.push(u);
  return null;
}

export function recallUnit(st: MatchState, uid: string): string | null {
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  if (!u.slot) return '该角色不在棋盘上';
  if (st.bench.length >= CFG.benchSlots) return '备战席已满';
  u.slot = null;
  st.board = st.board.filter(x => x.uid !== uid);
  st.bench.push(u);
  return null;
}

export function equipItemTo(st: MatchState, itemId: string, uid: string): string | null {
  const idx = st.inventory.indexOf(itemId);
  if (idx < 0) return '背包中没有该装备';
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  if (u.equips.length >= 3) return '该角色装备栏已满（3 件）';
  st.inventory.splice(idx, 1);
  u.equips.push(itemId);
  return null;
}

export function unequipItem(st: MatchState, uid: string, slotIdx: number): string | null {
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  if (slotIdx < 0 || slotIdx >= u.equips.length) return '装备栏为空';
  const [id] = u.equips.splice(slotIdx, 1);
  st.inventory.push(id);
  return null;
}

export function combineEquips(st: MatchState, idA: string, idB: string): string | null {
  const ia = st.inventory.indexOf(idA);
  const ib = st.inventory.indexOf(idB);
  if (ia < 0 || ib < 0) return '背包中缺少材料';
  const result = findCombine(idA, idB);
  if (!result) return '这两件装备无法合成';
  st.inventory.splice(Math.max(ia, ib), 1);
  st.inventory.splice(Math.min(ia, ib), 1);
  st.inventory.push(result.id);
  return null;
}

function autoRefreshShop(st: MatchState): void {
  if (st.shopLocked) return;
  returnOffers(st.pool, st.shop);
  st.shop = rollShop(st.level, st.pool);
}

/** 进入备战：准备开战；返回战斗输入（返回 null 表示无法开战） */
export function startBattle(st: MatchState): BattleInput | null {
  if (st.phase !== 'prep') return null;
  if (!st.board.some(u => u.slot?.row === 'front')) return null;
  const input = buildBattleInput(st);
  st.phase = 'battle';
  return input;
}

function rollRewards(): PendingReward[] {
  const out: PendingReward[] = [];
  for (let i = 0; i < 3; i++) {
    const r = Math.random();
    if (r < 0.55) out.push({ kind: 'equip', equipId: randomBasicEquip() });
    else if (r < 0.8) out.push({ kind: 'gold', gold: 8 });
    else {
      const adv = ADVANCED_EQUIPS[Math.floor(Math.random() * ADVANCED_EQUIPS.length)];
      out.push({ kind: 'equip', equipId: adv.id });
    }
  }
  return out;
}

/** 战斗结束结算：收入 → 扣血 → 推进节点 */
export function resolveBattle(st: MatchState, win: boolean, enemyActions: number, limit: number, remaining: number): void {
  const interest = Math.min(CFG.interestCap, Math.floor(st.gold / 10));
  let income = CFG.baseIncome + interest;
  if (win) {
    st.winStreak++;
    st.lossStreak = 0;
    st.battlesWon++;
    st.bestWinStreak = Math.max(st.bestWinStreak, st.winStreak);
    income += CFG.winStreakBonus(st.winStreak);
  } else {
    st.lossStreak++;
    st.winStreak = 0;
    st.battlesLost++;
    income += CFG.lossCompensation;
    const node = PLANES[st.plane].nodes[st.node];
    st.hp -= node.kind === 'boss' ? CFG.loseHpBoss : CFG.loseHpNormal;
  }
  gainExp(st, CFG.freeExpPerRound);
  st.gold += income;
  st.lastBattle = { win, enemyActions, limit, remaining };
  if (st.hp <= 0) {
    st.hp = 0;
    st.phase = 'gameOver';
    return;
  }
  advanceNode(st);
}

/** 推进到下一节点并设置阶段 */
export function advanceNode(st: MatchState): void {
  st.node++;
  if (st.node >= PLANES[st.plane].nodes.length) {
    st.plane++;
    st.node = 0;
    if (st.plane >= PLANES.length) {
      st.phase = 'victory';
      return;
    }
  }
  const next = PLANES[st.plane].nodes[st.node];
  if (next.kind === 'reward') {
    st.rewards = rollRewards();
    st.phase = 'reward';
  } else if (next.kind === 'supply') {
    st.supplyItems = [randomBasicEquip(), randomBasicEquip()];
    st.phase = 'supplyResult';
  } else {
    autoRefreshShop(st);
    st.phase = 'prep';
  }
}

export function pickReward(st: MatchState, idx: number): void {
  const r = st.rewards[idx];
  if (!r) return;
  if (r.kind === 'equip' && r.equipId) st.inventory.push(r.equipId);
  if (r.kind === 'gold' && r.gold) st.gold += r.gold;
  st.rewards = [];
  advanceNode(st);
}

export function ackSupply(st: MatchState): void {
  if (st.supplyItems) st.inventory.push(...st.supplyItems);
  st.supplyItems = undefined;
  advanceNode(st);
}

/** 随机三件奖励的描述（UI 用） */
export function rewardLabel(r: PendingReward): string {
  if (r.kind === 'gold') return `金币袋 +${r.gold}`;
  const e = equipById(r.equipId!);
  return `${e.name}（${e.tier === 'basic' ? '简易' : '进阶'}）`;
}
