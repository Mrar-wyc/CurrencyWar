import { describe, expect, it } from 'vitest';
import { charById } from '../src/data/characters';
import { equipById } from '../src/data/equipment';
import { MATCH_CONFIG as CFG, PLANES } from '../src/data/stages';
import { simulateBattle } from '../src/battle/engine';
import {
  ackSupply, buyExp, buyShop, combineEquips, equipItemTo, newMatch, pickEnvironment, pickReward,
  pickStrategy, placeUnit, recallUnit, reroll, startBattle, resolveBattle
} from '../src/game/match';
import { botPrep , BOT_STRATEGY_PREFER } from './bot';
import type { MatchState } from '../src/logic/types';

describe('单局诊断', () => {
  it('打印每场战斗数据', { timeout: 120_000 }, () => {
    const st: MatchState = newMatch();
    for (let i = 0; i < 400; i++) {
      if (st.phase === 'victory' || st.phase === 'gameOver') break;
      if (st.phase === 'prep') {
        botPrep(st);
        const stars = st.board.map(u => `${charById(u.charId).name}${u.star}`).join(',');
        if (!st.board.some(u => u.slot?.row === 'front')) break;
        const input = startBattle(st)!;
        const snapshot = structuredClone(input);
        const node = PLANES[st.plane].nodes[st.node];
        const name = node.kind === 'battle' || node.kind === 'boss' ? node.battle.name : '?';
        const eHp = snapshot.enemies.reduce((a, b) => a + b.maxHp, 0);
        const eAtk = snapshot.enemies.reduce((a, b) => a + b.atk, 0);
        const pAtk = snapshot.allies.reduce((a, b) => a + b.atk, 0);
        const pHp = snapshot.allies.reduce((a, b) => a + b.maxHp, 0);
        const res = simulateBattle(snapshot);
        const rem = snapshot.enemies.filter(e => e.alive).length;
        console.log(
          `P${st.plane + 1}.${st.node} [${name}] 金${st.gold} Lv${st.level} | 我方:${stars} atk${pAtk}/hp${pHp} ` +
          `| 敌atk${eAtk}/hp${eHp} | ${res.win ? '胜' : '败'} 行动值${res.ticks}/${input.enemyActionLimit} 残敌${rem}`
        );
        resolveBattle(st, res.win, res.ticks, input.enemyActionLimit, rem);
      } else if (st.phase === 'reward') {
        let idx = st.rewards.findIndex(r => r.kind === 'equip' && equipById(r.equipId!).tier === 'advanced');
        if (idx < 0) idx = st.rewards.findIndex(r => r.kind === 'equip');
        pickReward(st, idx >= 0 ? idx : 0);
      } else if (st.phase === 'environment') {
        // 环境三选一：与 bot 同策略（取第一个）——缺失本分支会让循环空转到步数上限
        pickEnvironment(st, 0);
      } else if (st.phase === 'strategy') {
        // 稳健偏好（与 bot 共享 BOT_STRATEGY_PREFER），保证诊断能走完整局
        const idx = st.strategyOffers.findIndex(id => BOT_STRATEGY_PREFER.includes(id));
        pickStrategy(st, idx >= 0 ? idx : 0);
      } else if (st.phase === 'supplyResult') {
        ackSupply(st);
      }
    }
    console.log(`结果: ${st.phase} HP${st.hp} Lv${st.level} 金${st.gold} 3★数:${st.threeStarsMade}`);
    // 诊断必须真的跑完整局：分支不全时循环会空转到上限并静默"通过"（历史上 environment 阶段就这样丢过）
    expect(st.battlesWon + st.battlesLost).toBeGreaterThan(0);
    expect(['victory', 'gameOver']).toContain(st.phase);
  });
});
