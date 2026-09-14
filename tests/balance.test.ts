import { describe, expect, it } from 'vitest';
import { playMatch } from './bot';

describe('自动对局平衡性', () => {
  it('机器人可以完整跑通多局且胜率在合理区间', { timeout: 300_000 }, () => {
    const N = 40;
    let wins = 0;
    let totalBattles = 0;
    const hpLeft: number[] = [];
    const planesReached: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = playMatch();
      totalBattles += r.battles;
      planesReached.push(r.plane);
      if (r.win) {
        wins++;
        hpLeft.push(r.hp);
      }
    }
    const rate = wins / N;
    const avgBattles = totalBattles / N;
    const avgHp = hpLeft.length ? hpLeft.reduce((a, b) => a + b, 0) / hpLeft.length : 0;
    const maxPlane = Math.max(...planesReached);
    // 输出供调参参考
    console.log(`[balance] ${N} 局: 胜率 ${(rate * 100).toFixed(0)}% 平均战斗 ${avgBattles.toFixed(1)} 场 胜局平均剩余HP ${avgHp.toFixed(0)} 最远位面 ${maxPlane}`);
    expect(avgBattles).toBeGreaterThan(0);
    expect(maxPlane).toBeGreaterThanOrEqual(1); // 至少能打到第二位面
    // 出带 = 平衡漂移，按 references/balance-and-testing.md 的回退顺序处理；
    // 单次 40 局噪声可达 ≈20pp，判回调必须连跑 3~5 次。
    // 基线参考（v0.2.2，5 次）：50%~70%，均值 ≈60%
    expect(rate, `balance 胜率 ${(rate * 100).toFixed(0)}% 低于下沿 15%：平衡漂移，按 balance-and-testing.md 回退顺序回调（先收新数值 → BACK_CAST_SPD_FACTOR → 位面倍率）`)
      .toBeGreaterThan(0.15); // 不能完全打不过
    expect(rate, `balance 胜率 ${(rate * 100).toFixed(0)}% 高于上沿 98%：难度形同虚设，检查是否加了净增益却没有配对冲难度机制`)
      .toBeLessThan(0.98); // 也不能毫无挑战
  });
});
