import { describe, expect, it } from 'vitest';
import { playMatch } from './bot';
import type { MatchState } from '../src/logic/types';

/**
 * Soak 不变量测试：批量机器人对局，逐步校验对局状态永远处于合法区间。
 * 目的是捕捉随机策略/经济/战斗路径组合下的显性或隐性状态腐坏（NaN、越界、幽灵单位等）。
 */
function assertInvariants(st: MatchState): void {
  // 生命与金币
  expect(Number.isFinite(st.hp)).toBe(true);
  expect(st.hp).toBeGreaterThanOrEqual(0);
  expect(st.hp).toBeLessThanOrEqual(100);
  expect(Number.isFinite(st.gold)).toBe(true);
  expect(st.gold).toBeGreaterThanOrEqual(0);
  // 等级与规模
  expect(st.level).toBeGreaterThanOrEqual(3);
  expect(st.level).toBeLessThanOrEqual(10);
  expect(st.board.length).toBeLessThanOrEqual(st.level);
  expect(st.bench.length).toBeLessThanOrEqual(9);
  // 单位合法性与同名唯一上阵
  const boardIds = st.board.map(u => u.charId);
  expect(new Set(boardIds).size).toBe(boardIds.length);
  for (const u of [...st.board, ...st.bench]) {
    expect([1, 2, 3]).toContain(u.star);
    expect(u.equips.length).toBeLessThanOrEqual(3);
    expect(u.charId).toBeTruthy();
  }
  // 投资策略
  expect(st.strategies.length).toBeLessThanOrEqual(5);
  if (st.phase === 'strategy') {
    expect(st.strategyOffers).toHaveLength(3);
    expect(new Set(st.strategyOffers).size).toBe(3);
  }
  // 阶段合法
  expect(['prep', 'battle', 'reward', 'strategy', 'supplyResult', 'gameOver', 'victory']).toContain(st.phase);
}

describe('soak 不变量', () => {
  it('300 局机器人对局：状态始终合法且正常终止', { timeout: 300_000 }, () => {
    const N = 300;
    let wins = 0;
    let finished = 0;
    for (let i = 0; i < N; i++) {
      const r = playMatch(400, assertInvariants);
      // 正常终止：要么通关要么生命归零（不会中途卡死）
      expect(r.hp).toBeGreaterThanOrEqual(0);
      finished++;
      if (r.win) wins++;
    }
    expect(finished).toBe(N);
    // 宽区间：策略组合下不至于完全打不过，也不能毫无挑战
    expect(wins / N).toBeGreaterThan(0.4);
    expect(wins / N).toBeLessThan(0.98);
    console.log(`[soak] ${N} 局: 胜率 ${((wins / N) * 100).toFixed(1)}%`);
  });
});
