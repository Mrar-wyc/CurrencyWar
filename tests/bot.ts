import { charById } from '../src/data/characters';
import { equipById } from '../src/data/equipment';
import { MATCH_CONFIG as CFG } from '../src/data/stages';
import { simulateBattle } from '../src/battle/engine';
import {
  ackSupply, buyExp, buyShop, combineEquips, equipItemTo, newMatch, pickReward,
  pickStrategy, placeUnit, recallUnit, reroll, startBattle, resolveBattle,
  pickEnvironment } from '../src/game/match';
import type { MatchState } from '../src/logic/types';

/** 稳健策略偏好（bot 与 diag 共用，防两处漂移） */
export const BOT_STRATEGY_PREFER: readonly string[] = ['lucky_dog', 'simple_mode', 'promo4', 'hyperinflation', 'middle_class'];

/**
 * 自动对局机器人（平衡性验证用）：
 * 策略偏保守 —— 优先买经验到 7 级、买光能买得起的棋子、
 * 最贵的上前台、装备平均分配、简易装备直接合成。
 */
export function botPrep(st: MatchState): void {
  // 1. 升级（保留 6 金买棋子）
  while (st.level < 7 && st.gold >= CFG.expCost + 6) {
    if (buyExp(st)) break;
  }
  // 2. 买棋子（贵者优先）
  const tryBuyAll = () => {
    const order = st.shop
      .map((o, i) => ({ o, i }))
      .filter(x => x.o.charId)
      .sort((a, b) => charById(b.o.charId!).cost - charById(a.o.charId!).cost);
    for (const { o, i } of order) {
      if (!o.charId) continue;
      const c = charById(o.charId);
      if (st.gold >= c.cost && st.bench.length < CFG.benchSlots) buyShop(st, i);
    }
  };
  tryBuyAll();
  // 3. 全部撤回再按强度重排
  for (const u of [...st.board]) recallUnit(st, u.uid);
  const owned = [...st.bench].sort(
    (a, b) => charById(b.charId).cost - charById(a.charId).cost || b.star - a.star
  );
  let front = 0;
  let back = 0;
  for (const u of owned) {
    if (front < Math.min(CFG.frontSlots, st.level)) placeUnit(st, u.uid, 'front', front++);
    else if (back < CFG.backSlots) placeUnit(st, u.uid, 'back', back++);
  }
  // 4. 装备轮着穿
  const frontUnits = st.board.filter(u => u.slot?.row === 'front');
  if (frontUnits.length) {
    let fi = 0;
    for (const eqId of [...st.inventory]) {
      const u = frontUnits[fi % frontUnits.length];
      if (u.equips.length >= 3) {
        fi++;
        continue;
      }
      equipItemTo(st, eqId, u.uid);
      fi++;
    }
  }
  // 5. 合成简易装备
  let basics = st.inventory.filter(id => equipById(id).tier === 'basic');
  while (basics.length >= 2) {
    if (combineEquips(st, basics[0], basics[1])) break;
    basics = st.inventory.filter(id => equipById(id).tier === 'basic');
  }
  // 6. 富余就刷新再买一轮
  if (st.gold >= 12) {
    if (!reroll(st)) tryBuyAll();
  }
}

export interface BotResult {
  win: boolean;
  hp: number;
  plane: number;
  battles: number;
  level: number;
  threeStars: number;
}

export function playMatch(maxSteps = 400, onStep?: (st: MatchState) => void): BotResult {
  const st = newMatch();
  for (let i = 0; i < maxSteps; i++) {
    onStep?.(st);
    switch (st.phase) {
      case 'prep': {
        botPrep(st);
        if (!st.board.some(u => u.slot?.row === 'front')) {
          return { win: false, hp: st.hp, plane: st.plane, battles: st.battlesWon + st.battlesLost, level: st.level, threeStars: st.threeStarsMade };
        }
        const input = startBattle(st)!;
        const snapshot = structuredClone(input);
        const res = simulateBattle(snapshot);
        resolveBattle(st, res.win, res.ticks, input.enemyActionLimit, snapshot.enemies.filter(e => e.alive).length);
        break;
      }
      case 'reward': {
        let idx = st.rewards.findIndex(r => r.kind === 'equip' && equipById(r.equipId!).tier === 'advanced');
        if (idx < 0) idx = st.rewards.findIndex(r => r.kind === 'equip');
        pickReward(st, idx >= 0 ? idx : 0);
        break;
      }
      case 'environment': {
        // 环境三选一：取第一个（bot 不挑品质）
        pickEnvironment(st, 0);
        break;
      }
      case 'strategy': {
        // 稳健偏好：经济/减难/晋升优先，否则取第一个
        const idx = st.strategyOffers.findIndex(id => BOT_STRATEGY_PREFER.includes(id));
        pickStrategy(st, idx >= 0 ? idx : 0);
        break;
      }
      case 'supplyResult':
        ackSupply(st);
        break;
      case 'victory':
        return { win: true, hp: st.hp, plane: 3, battles: st.battlesWon + st.battlesLost, level: st.level, threeStars: st.threeStarsMade };
      case 'gameOver':
        return { win: false, hp: 0, plane: st.plane, battles: st.battlesWon + st.battlesLost, level: st.level, threeStars: st.threeStarsMade };
      default:
        return { win: false, hp: st.hp, plane: st.plane, battles: st.battlesWon + st.battlesLost, level: st.level, threeStars: st.threeStarsMade };
    }
  }
  return { win: false, hp: st.hp, plane: st.plane, battles: st.battlesWon + st.battlesLost, level: st.level, threeStars: st.threeStarsMade };
}
