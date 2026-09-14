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
  expect(st.freeRerolls).toBeGreaterThanOrEqual(0);
  expect(st.freeBuys).toBeGreaterThanOrEqual(0);
  if (st.phase === 'strategy') {
    expect(st.strategyOffers).toHaveLength(3);
    expect(new Set(st.strategyOffers).size).toBe(3);
  }
  if (st.phase === 'environment') {
    expect(st.environmentOffers).toHaveLength(3);
    expect(new Set(st.environmentOffers).size).toBe(3);
  }
  expect(st.environments.length).toBeLessThanOrEqual(3);
  // 阶段合法
  expect(['prep', 'battle', 'reward', 'strategy', 'environment', 'supplyResult', 'gameOver', 'victory']).toContain(st.phase);
}

describe('soak 不变量', () => {
  it('300 局机器人对局：状态始终合法且正常终止', { timeout: 300_000 }, () => {
    const N = 300;
    let wins = 0;
    const ends: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const r = playMatch(400, assertInvariants);
      ends[r.end] = (ends[r.end] ?? 0) + 1;
      expect(r.hp).toBeGreaterThanOrEqual(0);
      if (r.win) wins++;
    }
    // 正常终止 = 通关或生命归零；stepCap/unknownPhase 是异常路径（步数上限疑似卡死、未知阶段）
    expect(ends.stepCap ?? 0).toBe(0);
    expect(ends.unknownPhase ?? 0).toBe(0);
    // bot 有 8 起始金 + Lv1-3 全 1 费商店，结构上不可能上不了阵
    expect(ends.noFront ?? 0).toBe(0);
    // 宽区间：策略组合下不至于完全打不过，也不能毫无挑战。
    // 出带 = 平衡漂移（不是状态腐坏）：先确认上面的终止分布与不变量是否干净，
    // 再按 references/balance-and-testing.md 的出带回调顺序处理。
    // 基线参考（v0.2.2，5×300 局）：49.3%~57.0%，均值 ≈54%
    const rate = wins / N;
    expect(rate, `soak 胜率 ${(rate * 100).toFixed(1)}% 低于下沿 40%：平衡漂移，按 balance-and-testing.md 回退顺序回调（先收新数值 → BACK_CAST_SPD_FACTOR → 位面倍率）`)
      .toBeGreaterThan(0.4);
    expect(rate, `soak 胜率 ${(rate * 100).toFixed(1)}% 高于上沿 98%：难度形同虚设，检查是否加了净增益却没有配对冲难度机制`)
      .toBeLessThan(0.98);
    console.log(`[soak] ${N} 局: 胜率 ${((wins / N) * 100).toFixed(1)}% 终止分布 ${JSON.stringify(ends)}`);
  });
});
