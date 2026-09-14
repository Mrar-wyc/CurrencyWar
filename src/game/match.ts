import { charById, CHARACTERS, POOL_COPIES } from '../data/characters';
import { ADVANCED_EQUIPS, equipById, findCombine, randomBasicEquip, randomEmblem } from '../data/equipment';
import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { createPool, returnOffers, rollShop } from '../logic/shop';
import { buildBattleInput } from '../logic/battle-build';
import { hasStrategy, rerollCostOf, rollStrategyOffers } from '../logic/strategy';
import { environmentTeamFlags, hasEnvironment, rollEnvironmentOffers } from '../logic/environment';
import type { BattleInput } from '../logic/battle-build';
import type { MatchState, OwnedUnit, PendingReward } from '../logic/types';

export function newMatch(overclock = false): MatchState {
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
    environments: [],
    environmentOffers: [],
    environmentData: {},
    overclock,
    freeRerolls: 0,
    freeBuys: 0,
    wealthGem: false,
    gemGoldTick: 0,
    seq: 1
  };
  st.shop = rollShop(st.level, st.pool);
  // 官方开局投资环境三选一（先于首个备战阶段）
  st.environmentOffers = rollEnvironmentOffers();
  st.phase = 'environment';
  return st;
}

/** 采纳投资环境（三选一）：应用即时效果后进入备战（不推进节点；环境只出现在开局与位面开始） */
export function pickEnvironment(st: MatchState, idx: number): void {
  if (st.phase !== 'environment') return;
  const id = st.environmentOffers[idx];
  if (!id) return;
  st.environments.push(id);
  st.environmentOffers = [];
  applyInstantEnvironment(st, id);
  st.phase = 'prep';
  autoRefreshShop(st);
}

/** 环境的一次性效果（持续效果在 environmentTeamFlags 与 resolveBattle/advanceNode/gainExp 各锚点） */
function applyInstantEnvironment(st: MatchState, id: string): void {
  const stockFaction: Record<string, string> = {
    stock_express: 'express', stock_xianzhou: 'xianzhou', stock_belobog: 'belobog', stock_stellaron: 'stellaron'
  };
  const faction = stockFaction[id];
  if (faction) {
    // 备战席满时角色折算 2 金（防超员破坏 bench 容量约束）
    if (st.bench.length >= CFG.benchSlots) {
      st.gold += 2;
    } else {
      const list = CHARACTERS.filter(c => c.cost === 1 && c.faction === faction);
      const charId = list[Math.floor(Math.random() * list.length)].id;
      takeFromPool(st, charId, 1); // 凭空赠送也要扣池
      st.bench.push({ uid: `u${st.seq++}`, charId, star: 1, slot: null, equips: [] });
      tryMerge(st);
    }
    st.inventory.push(randomBasicEquip());
    return;
  }
  switch (id) {
    case 'money_printing':
      st.gold += [6, 8, 12][st.plane] ?? 6;
      break;
    case 'fixed_fund':
      gainExp(st, 4);
      st.freeRerolls += 2;
      break;
    case 'long_term':
      st.environmentData.long_term = 4;
      break;
  }
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
  // 合成预判必须按「实际入席星级」算：四费晋升会让新单位直接以 2★ 入席，
  // 若仍按 1★ 预判，满席时会判成“能合成”却合不了 → 备战席溢出到 10 且第 10 个不渲染
  const incomingStar: 1 | 2 = promo4 ? 2 : 1;
  const willMerge = countOwnedSame(st, c.id, incomingStar) >= 2;
  if (st.bench.length >= CFG.benchSlots && !willMerge) return '备战席已满';
  if (free) st.freeBuys--;
  else st.gold -= c.cost;
  offer.charId = null;
  const unit: OwnedUnit = { uid: `u${st.seq++}`, charId: c.id, star: incomingStar, slot: null, equips: [] };
  // 四费晋升：下一个 4 费直接 2★
  if (promo4) st.strategyData.promo4 = 0;
  st.bench.push(unit);
  tryMerge(st);
  return null;
}

/** 刷新可用性：按钮禁用态与 reroll 的守卫同源，避免两处判定漂移 */
export function canReroll(st: MatchState): string | null {
  if (st.phase !== 'prep') return '当前不能刷新';
  if (st.freeRerolls > 0) return null;
  return st.gold < rerollCostOf(st) ? '金币不足' : null;
}

/**
 * 等级上限：控制规模（棱彩）把上限压到 7。
 * 取 max(当前等级, 上限) 而非直接返回 7——否则在 9 级选到它会立刻打破
 * 「上阵数 ≤ 等级」的不变量（棋盘上此时可能有 8~9 人）。
 */
export function maxLevelOf(st: MatchState): number {
  const cap = hasStrategy(st, 'scale_control') ? 7 : CFG.maxLevel;
  return Math.max(st.level, Math.min(CFG.maxLevel, cap));
}

/** 买经验可用性：按钮禁用态与 buyExp 的守卫同源 */
export function canBuyExp(st: MatchState): string | null {
  if (st.phase !== 'prep') return '当前不能购买经验';
  if (st.level >= maxLevelOf(st)) return '已达到最高等级';
  if (hasStrategy(st, 'struggle_protocol')) return st.hp <= CFG.struggleHpCost ? '生命不足' : null;
  return st.gold < CFG.expCost ? '金币不足' : null;
}

export function reroll(st: MatchState): string | null {
  const err = canReroll(st);
  if (err) return err;
  // 免费刷新资源优先消耗
  if (st.freeRerolls > 0) st.freeRerolls--;
  else st.gold -= rerollCostOf(st);
  returnOffers(st.pool, st.shop);
  st.shop = rollShop(st.level, st.pool);
  // 淘金客（棱彩）：每次刷新额外 +2 经验（免费刷新同样生效）
  if (hasStrategy(st, 'gold_digger')) gainExp(st, 2);
  return null;
}

export function toggleLock(st: MatchState): void {
  st.shopLocked = !st.shopLocked;
}

export function gainExp(st: MatchState, n: number): void {
  const cap = maxLevelOf(st);
  if (st.level >= cap) return;
  st.exp += n;
  while (st.level < cap && st.exp >= (CFG.expToNext[st.level] ?? Infinity)) {
    st.exp -= CFG.expToNext[st.level];
    st.level++;
  }
  if (st.level >= cap) st.exp = 0;
}

export function buyExp(st: MatchState): string | null {
  const err = canBuyExp(st);
  if (err) return err;
  // 奋斗协议（官方棱彩）：买经验改扣生命
  if (hasStrategy(st, 'struggle_protocol')) st.hp -= CFG.struggleHpCost;
  else st.gold -= CFG.expCost;
  gainExp(st, CFG.expGain);
  return null;
}

export function sellValue(u: OwnedUnit): number {
  const c = charById(u.charId);
  return c.cost * (u.star === 1 ? 1 : u.star === 2 ? 2 : 4);
}

/** 一个单位在牌池里占用的份数（3^(星-1)：合成不改变占用量，与主流自走棋同口径） */
function copiesOf(star: number): number {
  return star <= 1 ? 1 : star === 2 ? 3 : 9;
}

/** 牌池放回：所有「单位离场」的路径都走这里（出售/卖光策略/重组），避免只扣不还 */
function returnToPool(st: MatchState, charId: string, star: number): void {
  const max = POOL_COPIES[charById(charId).cost];
  st.pool[charId] = Math.min(max, (st.pool[charId] ?? 0) + copiesOf(star));
}

/** 牌池取出：凭空生成单位的路径（策略赠予/环境概念股）必须扣池，否则池子与实际持有脱钩 */
function takeFromPool(st: MatchState, charId: string, star: number): void {
  st.pool[charId] = Math.max(0, (st.pool[charId] ?? 0) - copiesOf(star));
}

export function sellUnit(st: MatchState, uid: string): string | null {
  const u = findUnit(st, uid);
  if (!u) return '找不到该角色';
  st.gold += sellValue(u);
  st.inventory.push(...u.equips);
  returnToPool(st, u.charId, u.star);
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

/** 等级不足导致的位置提示（UI 与规则共用同一条文案，避免两处各写一句） */
export const ERR_SLOT_LOCKED = '上阵位数不足，购买经验可提升';

export function placeUnit(st: MatchState, uid: string, row: 'front' | 'back', index: number): string | null {
  if (st.phase !== 'prep') return '当前不能调整站位';
  // 物理网格 6 前台；等级未解锁但网格内的位置按"位数不足"提示
  if (row === 'front') {
    if (index >= CFG.frontSlots) return '前台位置不存在';
    if (index >= frontCapacity(st)) return ERR_SLOT_LOCKED;
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
  // 买断制（棱彩）：以利息换经验，故不再有持币利息
  const interest = hasStrategy(st, 'buyout') ? 0 : Math.min(CFG.interestCap, Math.floor(st.gold / CFG.interestPer10));
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
    // 长期主义：剩余胜场每次 +7 金
    if ((st.environmentData.long_term ?? 0) > 0) {
      income += 7;
      st.environmentData.long_term--;
    }
    // 进化算法：胜利叠一层
    if (hasEnvironment(st, 'evolution')) {
      st.environmentData.evolution = (st.environmentData.evolution ?? 0) + 1;
    }
    // 深井角斗场：首次 5 连胜 → 财富宝钻（已有则 +15 金）
    if (st.winStreak >= 5 && hasEnvironment(st, 'deep_pit') && !st.environmentData.deep_pit_done) {
      st.environmentData.deep_pit_done = 1;
      if (!st.wealthGem) {
        st.wealthGem = true;
        st.gemNew = true;
      } else {
        st.gold += 15;
      }
    }
  } else {
    st.lossStreak++;
    st.winStreak = 0;
    st.battlesLost++;
    income += CFG.lossCompensation;
    st.hp -= node.kind === 'boss' ? CFG.loseHpBoss : CFG.loseHpNormal;
  }
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
  // 成功经验：8 级后每节点 +2 经验
  if (hasEnvironment(st, 'success_exp') && st.level >= 8) gainExp(st, 2);
  st.gold += income;
  st.lastBattle = { win, ticks, limit, remaining };
  if (st.hp <= 0) {
    st.hp = 0;
    st.phase = 'gameOver';
    return;
  }
  // 打输最终首领：走完节点不等于通关。此前无论胜负都会 advanceNode 一路判 victory，
  // 于是「输了最后一战」照样发晋升、加总胜场、解锁超频
  if (!win && st.plane === PLANES.length - 1 && st.node === PLANES[st.plane].nodes.length - 1) {
    st.phase = 'gameOver';
    return;
  }
  advanceNode(st);
}

/** 推进到下一节点并设置阶段 */
export function advanceNode(st: MatchState): void {
  // 买断制（棱彩）：每个节点额外 +4 经验
  if (hasStrategy(st, 'buyout')) gainExp(st, 4);
  // 超发货币（官方）：失去全部金币，5 个节点后返还「失去数额 + 70」
  if (hasStrategy(st, 'hyperinflation') && (st.strategyData.hyperinflation_nodes ?? 0) < 5) {
    st.strategyData.hyperinflation_nodes = (st.strategyData.hyperinflation_nodes ?? 0) + 1;
    if ((st.strategyData.hyperinflation_nodes ?? 0) >= 5) {
      st.gold += (st.strategyData.hyperinflation_lost ?? 0) + 70;
    }
  }
  st.node++;
  let planeJustChanged = false;
  if (st.node >= PLANES[st.plane].nodes.length) {
    st.plane++;
    st.node = 0;
    planeJustChanged = true;
    if (st.plane >= PLANES.length) {
      st.phase = 'victory';
      return;
    }
  }
  const next = PLANES[st.plane].nodes[st.node];
  // 人身意外险：首领节点开战前自动获得 1 件简易装备
  if (next.kind === 'boss' && hasEnvironment(st, 'accident_insurance')) {
    st.inventory.push(randomBasicEquip());
  }
  // 位面开始：投资环境三选一（位面首节点恒为战斗节点，采纳后进备战）
  if (planeJustChanged && (next.kind === 'battle' || next.kind === 'boss')) {
    st.environmentOffers = rollEnvironmentOffers();
    st.phase = 'environment';
    return;
  }
  enterCurrentNode(st);
}

/** 进入「当前节点」对应的阶段（advanceNode 与载档修复共用，避免两处各写一半） */
function enterCurrentNode(st: MatchState): void {
  const node = PLANES[st.plane].nodes[st.node];
  if (node.kind === 'reward') {
    st.rewards = rollRewards();
    st.phase = 'reward';
  } else if (node.kind === 'supply') {
    st.supplyItems = [randomBasicEquip(), randomBasicEquip()];
    st.phase = 'supplyResult';
  } else if (node.kind === 'strategy') {
    st.strategyOffers = rollStrategyOffers(st.plane);
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

/**
 * 载入存档后的阶段完整性修复：保证「当前阶段一定可推进」。
 *
 * 选择/奖励类阶段一旦没有内容，玩家就既打不了（`startBattle` 只接受战斗与首领节点）
 * 也推进不了（唯一推进入口是各阶段的采纳函数）→ 永久软锁。旧档里这类状态来自两处：
 * 一是迁移把「空三选一」回退成了 prep 却停在同一节点上，二是奖励 id 失效被过滤成空。
 * 修复策略：能从池子重摇就重摇（保留玩家的选择权），实在无可选才跳过该节点。
 */
export function repairPhase(st: MatchState): void {
  if (st.phase === 'environment' && st.environmentOffers.length === 0) {
    // 环境三选一不挂在节点上（位面开始时触发），重摇即可
    st.environmentOffers = rollEnvironmentOffers();
    if (st.environmentOffers.length === 0) enterCurrentNode(st);
    return;
  }
  const node = PLANES[st.plane].nodes[st.node];
  const empty =
    (st.phase === 'prep' && node.kind !== 'battle' && node.kind !== 'boss') ||
    (st.phase === 'strategy' && st.strategyOffers.length === 0) ||
    (st.phase === 'reward' && st.rewards.length === 0) ||
    (st.phase === 'supplyResult' && (st.supplyItems ?? []).length === 0);
  if (empty) enterCurrentNode(st);
}

/** 采纳投资策略（三选一）：应用即时效果后推进节点 */
export function pickStrategy(st: MatchState, idx: number): void {
  if (st.phase !== 'strategy') return;
  const id = st.strategyOffers[idx];
  if (!id) return;
  // 策略大师：采纳第 N 条时 +2×(N-1) 金
  if (hasEnvironment(st, 'strategy_master')) st.gold += 2 * st.strategies.length;
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
        // 换人：旧角色的份数退回池子，新角色的份数从池子取出（保持池子与实际持有一致）
        returnToPool(st, u.charId, u.star);
        takeFromPool(st, next.id, u.star);
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
        returnToPool(st, u.charId, u.star);
      }
      st.board = [];
      st.bench = [];
      st.gold += gold;
      st.freeRerolls += 6;
      break;
    }
    // 人力重组（官方银色）：出售全部角色 → 获得 2星3费×1 + 2星2费×2 + 2星1费×2
    case 'layoff_all': {
      for (const u of [...st.board, ...st.bench]) {
        st.inventory.push(...u.equips);
        returnToPool(st, u.charId, u.star);
      }
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
          takeFromPool(st, c.id, g.star); // 赠予也是从池子里拿
          st.bench.push({ uid: `u${st.seq++}`, charId: c.id, star: g.star, slot: null, equips: [] });
        }
      }
      tryMerge(st);
      break;
    }
    // 现金为王（官方金色）：出售全部角色（不给金币），换取 3 场开战护盾
    case 'cash_is_king': {
      for (const u of st.board) {
        st.inventory.push(...u.equips);
        returnToPool(st, u.charId, u.star);
      }
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
        returnToPool(st, u.charId, u.star);
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
    // 控制规模（棱彩）：上限降为 7（由 maxLevelOf 生效），立即给宝钻与 40 金
    case 'scale_control':
      st.gold += 40;
      if (!st.wealthGem) {
        st.wealthGem = true;
        st.gemNew = true;
      } else {
        st.gold += 15; // 已有宝钻时折算（同深井角斗场的处理）
      }
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
  const e = equipById(r.equipId);
  const tierName = e.tier === 'basic' ? '简易' : e.tier === 'advanced' ? '进阶' : '星徽';
  return `${e.name}（${tierName}）`;
}
