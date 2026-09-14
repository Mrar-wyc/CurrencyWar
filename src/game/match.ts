import { charById, CHARACTERS } from '../data/characters';
import { ADVANCED_EQUIPS, equipById, findCombine, randomBasicEquip, randomEmblem } from '../data/equipment';
import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { createPool, returnOffers, rollShop } from '../logic/shop';
import { buildBattleInput } from '../logic/battle-build';
import { hasStrategy, rerollCostOf, rollStrategyOffers } from '../logic/strategy';
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
    strategies: [],
    strategyOffers: [],
    strategyData: {},
    freeRerolls: 0,
    freeBuys: 0,
    wealthGem: false,
    gemGoldTick: 0,
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
  // 免费购买资源优先消耗（降本增效等策略发放）
  const free = st.freeBuys > 0;
  if (!free && st.gold < c.cost) return '金币不足';
  const promo4 = hasStrategy(st, 'promo4') && (st.strategyData.promo4 ?? 0) > 0 && c.cost === 4;
  const willMerge = countOwnedSame(st, c.id, 1) >= 2 || (promo4 && countOwnedSame(st, c.id, 2) >= 2);
  if (st.bench.length >= CFG.benchSlots && !willMerge) return '备战席已满';
  if (free) st.freeBuys--;
  else st.gold -= c.cost;
  offer.charId = null;
  const unit: OwnedUnit = { uid: `u${st.seq++}`, charId: c.id, star: 1, slot: null, equips: [] };
  // 四费晋升：下一个 4 费直接 2★
  if (promo4) {
    unit.star = 2;
    st.strategyData.promo4 = 0;
  }
  st.bench.push(unit);
  tryMerge(st);
  return null;
}

export function reroll(st: MatchState): string | null {
  if (st.phase !== 'prep') return '当前不能刷新';
  // 免费刷新资源优先消耗
  if (st.freeRerolls > 0) {
    st.freeRerolls--;
    returnOffers(st.pool, st.shop);
    st.shop = rollShop(st.level, st.pool);
    return null;
  }
  const cost = rerollCostOf(st);
  if (st.gold < cost) return '金币不足';
  st.gold -= cost;
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
  // 奋斗协议（官方棱彩，暂以金色实装）：买经验改扣生命
  if (hasStrategy(st, 'struggle_protocol')) {
    if (st.hp <= 6) return '生命不足';
    st.hp -= 6;
    gainExp(st, CFG.expGain);
    return null;
  }
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

/** 后台位容量：财富宝钻 +1（官方"团队规模 +1"的简化） */
export function backCapacity(st: MatchState): number {
  return CFG.backSlots + (st.wealthGem ? 1 : 0);
}

export function boardFull(st: MatchState): boolean {
  return st.board.length >= st.level;
}

export function placeUnit(st: MatchState, uid: string, row: 'front' | 'back', index: number): string | null {
  if (st.phase !== 'prep') return '当前不能调整站位';
  // 物理网格 6 前台；等级未解锁但网格内的位置按"位数不足"提示
  if (row === 'front') {
    if (index >= CFG.frontSlots) return '前台位置不存在';
    if (index >= frontCapacity(st)) return '上阵位数不足，购买经验可提升';
  }
  if (row === 'back' && index >= backCapacity(st)) return '后台位置不存在';
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  // 同一角色（同名）只能上阵一个：前台/后台合计
  const sameCharOnBoard = st.board.find(x => x.uid !== uid && x.charId === u.charId);
  if (sameCharOnBoard && !u.slot) return '同名角色只能上阵一个';
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
  // 同 id 两件合成：必须取到两个不同索引，否则误删中间物品
  const ib = idA === idB ? st.inventory.indexOf(idB, ia + 1) : st.inventory.indexOf(idB);
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
  // 防御：当前节点必须存在战斗定义（奖励/策略/补给节点不可出战）
  const node = PLANES[st.plane].nodes[st.node];
  if (node.kind !== 'battle' && node.kind !== 'boss') return null;
  if (!st.board.some(u => u.slot?.row === 'front')) return null;
  const input = buildBattleInput(st);
  st.phase = 'battle';
  return input;
}

function rollRewards(): PendingReward[] {
  const out: PendingReward[] = [];
  for (let i = 0; i < 3; i++) {
    const r = Math.random();
    if (r < 0.50) out.push({ kind: 'equip', equipId: randomBasicEquip() });
    else if (r < 0.72) out.push({ kind: 'gold', gold: 8 });
    else if (r < 0.86) {
      const adv = ADVANCED_EQUIPS[Math.floor(Math.random() * ADVANCED_EQUIPS.length)];
      out.push({ kind: 'equip', equipId: adv.id });
    } else if (r < 0.93) out.push({ kind: 'equip', equipId: randomEmblem() });
    else out.push({ kind: 'gold', gold: 15 });
  }
  return out;
}

/** 战斗结束结算：收入 → 扣血 → 推进节点 */
export function resolveBattle(st: MatchState, win: boolean, ticks: number, limit: number, remaining: number, allyDeaths = 0): void {
  const node = PLANES[st.plane].nodes[st.node];
  const interest = Math.min(CFG.interestCap, Math.floor(st.gold / 10));
  let income = CFG.baseIncome + interest;
  if (win) {
    st.winStreak++;
    st.lossStreak = 0;
    st.battlesWon++;
    st.bestWinStreak = Math.max(st.bestWinStreak, st.winStreak);
    // 官方：战斗胜利额外 +1 金（docs §29）
    income += 1;
    // 伟大征服：连胜奖励 ×3
    income += CFG.winStreakBonus(st.winStreak) * (hasStrategy(st, 'great_conquest') ? 3 : 1);
    // 招财狗：每胜 +2
    if (hasStrategy(st, 'lucky_dog')) income += 2;
    // 无伤通关（官方）：胜利且无人倒下 → +1 金
    if (hasStrategy(st, 'no_damage') && allyDeaths === 0) income += 1;
  } else {
    st.lossStreak++;
    st.winStreak = 0;
    st.battlesLost++;
    income += CFG.lossCompensation;
    st.hp -= node.kind === 'boss' ? CFG.loseHpBoss : CFG.loseHpNormal;
  }
  // 无伤通关的一次性 pending 机制已废除（现改为常驻，见 win 分支）
  if ((st.strategyData.no_damage ?? 0) > 0) st.strategyData.no_damage = 0;
  // 现金为王：护盾场数消耗
  if ((st.strategyData.cash_is_king ?? 0) > 0) st.strategyData.cash_is_king--;
  // 奋斗协议：首领战胜利回血 50（官方数值）
  if (win && hasStrategy(st, 'struggle_protocol') && node.kind === 'boss') {
    st.hp = Math.min(CFG.startHp, st.hp + 50);
  }
  // 财富宝钻：首个首领战胜利获得（每局 1 枚）
  if (win && node.kind === 'boss' && !st.wealthGem) {
    st.wealthGem = true;
    st.gemNew = true;
  }
  gainExp(st, CFG.freeExpPerRound);
  st.gold += income;
  st.lastBattle = { win, ticks, limit, remaining };
  if (st.hp <= 0) {
    st.hp = 0;
    st.phase = 'gameOver';
    return;
  }
  advanceNode(st);
}

/** 推进到下一节点并设置阶段 */
export function advanceNode(st: MatchState): void {
  // 超发货币（官方）：失去全部金币，5 个节点后返还「失去数额 + 70」
  if (hasStrategy(st, 'hyperinflation') && (st.strategyData.hyperinflation_nodes ?? 0) < 5) {
    st.strategyData.hyperinflation_nodes = (st.strategyData.hyperinflation_nodes ?? 0) + 1;
    if ((st.strategyData.hyperinflation_nodes ?? 0) >= 5) {
      st.gold += (st.strategyData.hyperinflation_lost ?? 0) + 70;
    }
  }
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
  } else if (next.kind === 'strategy') {
    st.strategyOffers = rollStrategyOffers();
    st.phase = 'strategy';
  } else {
    // 财富宝钻：每 3 个备战阶段 +1 金
    if (st.wealthGem) {
      st.gemGoldTick++;
      if (st.gemGoldTick % 3 === 0) st.gold += 1;
    }
    autoRefreshShop(st);
    st.phase = 'prep';
  }
}

/** 采纳投资策略（三选一）：应用即时效果后推进节点 */
export function pickStrategy(st: MatchState, idx: number): void {
  if (st.phase !== 'strategy') return;
  const id = st.strategyOffers[idx];
  if (!id) return;
  st.strategies.push(id);
  st.strategyOffers = [];
  applyInstantStrategy(st, id);
  advanceNode(st);
}

/** 即时生效的策略效果（其余为条件/战斗期效果，由 strategy.ts 与 battle-build 读取） */
function applyInstantStrategy(st: MatchState, id: string): void {
  switch (id) {
    case 'promo_all': {
      // 上阵角色全部变为费用+1 的随机角色；同屏防重名
      const used = new Set(st.board.map(u => u.charId));
      for (const u of st.board) {
        const cur = charById(u.charId);
        const pool = CHARACTERS.filter(c => c.cost === cur.cost + 1 && !used.has(c.id));
        if (!pool.length) continue;
        const next = pool[Math.floor(Math.random() * pool.length)];
        used.delete(u.charId);
        used.add(next.id);
        u.charId = next.id;
      }
      tryMerge(st);
      break;
    }
    // 大裁员（官方金色）：出售全部角色，双倍售价 + 6 次免费刷新
    case 'layoff_front': {
      let gold = 0;
      for (const u of [...st.board, ...st.bench]) {
        gold += sellValue(u) * 2;
        st.inventory.push(...u.equips);
      }
      st.board = [];
      st.bench = [];
      st.gold += gold;
      st.freeRerolls += 6;
      break;
    }
    // 人力重组（官方银色）：出售全部角色 → 获得 2星3费×1 + 2星2费×2 + 2星1费×2
    case 'layoff_all': {
      for (const u of [...st.board, ...st.bench]) st.inventory.push(...u.equips);
      st.board = [];
      st.bench = [];
      const grants: { cost: number; star: 1 | 2; count: number }[] = [
        { cost: 3, star: 2, count: 1 },
        { cost: 2, star: 2, count: 2 },
        { cost: 1, star: 2, count: 2 }
      ];
      for (const g of grants) {
        for (let i = 0; i < g.count; i++) {
          const pool = CHARACTERS.filter(c => c.cost === g.cost);
          const c = pool[Math.floor(Math.random() * pool.length)];
          st.bench.push({ uid: `u${st.seq++}`, charId: c.id, star: g.star, slot: null, equips: [] });
        }
      }
      tryMerge(st);
      break;
    }
    // 现金为王（官方金色）：出售全部角色（不给金币），换取 3 场开战护盾
    case 'cash_is_king': {
      for (const u of st.board) st.inventory.push(...u.equips);
      st.board = [];
      st.strategyData.cash_is_king = 3;
      break;
    }
    // 降本增效（官方金色）：出售全部角色双倍售价 + 接下来 6 次购买角色免费
    case 'cheap_reroll': {
      let gold = 0;
      for (const u of [...st.board, ...st.bench]) {
        gold += sellValue(u) * 2;
        st.inventory.push(...u.equips);
      }
      st.board = [];
      st.bench = [];
      st.gold += gold;
      st.freeBuys += 6;
      break;
    }
    // 超发货币（官方金色）：立即清空金币，5 个节点后返还「失去数额 + 70」
    case 'hyperinflation':
      st.strategyData.hyperinflation_lost = st.gold;
      st.strategyData.hyperinflation_nodes = 0;
      st.gold = 0;
      break;
    // 四费晋升：标记待定，下一次购买 4 费时消费
    case 'promo4':
      st.strategyData.promo4 = 1;
      break;
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
  const tierName = e.tier === 'basic' ? '简易' : e.tier === 'advanced' ? '进阶' : '星徽';
  return `${e.name}（${tierName}）`;
}
