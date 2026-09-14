import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COST_COLORS } from '../src/ui/dom';
import { MATCH_CONFIG as CFG } from '../src/data/stages';

/**
 * 跨文件一致性守卫。
 *
 * 这些耦合在过去都真实翻过车（画布与 CSS 不等高导致纵向变形、费用色双轨不一致、
 * 舞台缩放基准与 CSS 尺寸脱钩），此前只靠「文档约定 + 人工截图验收」维持，
 * 一旦改动漏了一边就要靠肉眼发现。此处把它们变成会失败的测试。
 */
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const rendererSrc = readFileSync(new URL('../src/battle/renderer.ts', import.meta.url), 'utf8');
const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

function cssRule(selector: string): string {
  const m = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`style.css 缺少规则 ${selector}`);
  return m[1];
}

function px(block: string, prop: string): number {
  const m = block.match(new RegExp(`${prop}:\\s*(\\d+)px`));
  if (!m) throw new Error(`缺少 ${prop}`);
  return Number(m[1]);
}

describe('跨文件一致性守卫', () => {
  it('战斗画布与 CSS 1:1（改一边必须同步另一边）', () => {
    const canvasCss = cssRule('.battle-canvas');
    const w = Number(rendererSrc.match(/const W = (\d+);/)?.[1]);
    const h = Number(rendererSrc.match(/const H = (\d+);/)?.[1]);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(px(canvasCss, 'width')).toBe(w);
    expect(px(canvasCss, 'height')).toBe(h);
  });

  it('画布高 + 战斗顶条高 = 舞台高（纵向不变形的完整约束）', () => {
    const canvasCss = cssRule('.battle-canvas');
    const headCss = cssRule('.battle-head');
    const stageCss = cssRule('.stage');
    expect(px(canvasCss, 'height') + px(headCss, 'height')).toBe(px(stageCss, 'height'));
  });

  it('舞台尺寸与 fitStage 缩放基准一致', () => {
    const stageCss = cssRule('.stage');
    const base = mainSrc.match(/Math\.min\(window\.innerWidth \/ (\d+), window\.innerHeight \/ (\d+)\)/);
    expect(base).not.toBeNull();
    expect(Number(base![1])).toBe(px(stageCss, 'width'));
    expect(Number(base![2])).toBe(px(stageCss, 'height'));
  });

  it('费用色双轨一致：style.css --cost-N 与 COST_COLORS', () => {
    for (const [cost, color] of Object.entries(COST_COLORS)) {
      const m = css.match(new RegExp(`--cost-${cost}:\\s*(#[0-9a-fA-F]{3,8})`));
      expect(m, `style.css 缺少 --cost-${cost}`).not.toBeNull();
      expect(m![1].toLowerCase()).toBe(color.toLowerCase());
    }
  });

  it('血量上限与失败扣血档位一致（顶栏心形与结算共用同一口径）', () => {
    // 顶栏按 startHp 画满格；扣血档位不得超过满血，否则一次失败即直接出局
    expect(CFG.startHp).toBeGreaterThan(0);
    expect(CFG.loseHpNormal).toBeGreaterThan(0);
    expect(CFG.loseHpBoss).toBeGreaterThan(0);
    expect(CFG.loseHpNormal).toBeLessThan(CFG.startHp);
    expect(CFG.loseHpBoss).toBeLessThanOrEqual(CFG.startHp);
  });
});
