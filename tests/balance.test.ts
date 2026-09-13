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
    expect(rate).toBeGreaterThan(0.15); // 不能完全打不过
    expect(rate).toBeLessThan(0.98); // 也不能毫无挑战
  });
});
