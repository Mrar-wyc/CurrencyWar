// @vitest-environment jsdom
// @vitest-environment-options {"html":"<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>","url":"http://localhost:3000/?debug"}
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * 界面冒烟：在 jsdom 里启动真实应用，用**真实点击**走完每个屏幕与浮层。
 *
 * 为什么需要它：渲染期异常、双重结算、开局盾条不显示、飘字压住名字这类缺陷
 * 全部"只有点进去才发现"，而 node 环境的单测够不着（没有 DOM 与 canvas）。
 * 每次发版前人工逐屏截图能发现，但结论不会自动复现——这里把它变成 CI 门禁。
 *
 * ⚠️ 关键：`render()` 自带兜底（捕获异常 → 重置续档 → 回主菜单 → toast
 * 「存档数据异常」），所以**渲染崩溃不会让测试抛异常**。断言必须两件一起做：
 *   ① 该屏的根类名在场；② 页面上没有出现那句兜底 toast。
 * 少了 ②，桩写坏或真的崩了都会被静默吞掉。
 *
 * ⚠️ canvas 桩按渲染器实际调用面精确实现，是有意的契约：渲染器将来调用新的
 * canvas 方法而这里没补，测试会以 TypeError 失败——提示来补桩，而不是被静默略过。
 *
 * ⚠️ 边界：jsdom 抓不到真实排版/字号/溢出/绘制内容，那些仍靠发布前的人工截图验收
 * （见 references/balance-and-testing.md 的覆盖清单）。冒烟过了 ≠ 视觉没问题。
 */

const SAVE_KEY = 'currencywars_save_v1';
/** 兜底 toast 的文案前缀（出现即说明渲染崩溃被兜底吞掉了） */
const RECOVER_TOAST = '存档数据异常';

type Ctx2D = CanvasRenderingContext2D;

/** 装 canvas 2D 桩：jsdom 未装 canvas 包时 getContext('2d') 返回 null，应用会当场抛 */
function installCanvasStub(): void {
  const proto = window.HTMLCanvasElement.prototype;
  proto.getContext = function getContext(this: HTMLCanvasElement, kind: string): Ctx2D | null {
    if (kind !== '2d') return null;
    return this.__ctx2d ?? (this.__ctx2d = makeCtx2D(this));
  } as HTMLCanvasElement['getContext'];
}

function makeCtx2D(canvas: HTMLCanvasElement): Ctx2D {
  const noop = (): void => { /* 桩：绘制不产生实际像素 */ };
  const state: Record<string, unknown> = {
    canvas,
    // 会被读取并参与运算的属性必须给数字（renderer 里有 `ctx.globalAlpha *= 0.85`）
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    shadowColor: 'transparent',
    shadowBlur: 0
  };
  return new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // 必须返回值的方法：渐变要能 addColorStop，measureText 要能读 width
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      // 其余一并按无返回方法处理（渲染器只用这些）
      return noop;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    }
  }) as unknown as Ctx2D;
}

declare global {
  interface HTMLCanvasElement {
    __ctx2d?: Ctx2D;
  }
}

/** 当前舞台里是否出现了兜底 toast（渲染崩溃的直接信号） */
function recoveredCrash(): boolean {
  return document.body.textContent?.includes(RECOVER_TOAST) ?? false;
}

function stage(): HTMLElement | null {
  return document.querySelector('.stage');
}

/** 断言"这一屏在场且没有触发渲染兜底" */
function expectScreen(selector: string): HTMLElement {
  expect(recoveredCrash(), `渲染触发兜底，应用被重置回主菜单（${RECOVER_TOAST}）`).toBe(false);
  const el = stage()?.querySelector<HTMLElement>(selector);
  expect(el, `期望屏幕/元素 ${selector} 不在场`).toBeTruthy();
  return el!;
}

/** 按可见文字点按钮（真实交互路径；UI 的点击都是 DOM 事件） */
function clickByText(text: string | RegExp, scope: ParentNode = document): void {
  const re = typeof text === 'string' ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : text;
  const nodes = [...scope.querySelectorAll<HTMLElement>('button, .shop-card, .unit-card, .inv-item, .reward-card')];
  const hit = nodes.find(n => re.test(n.textContent ?? ''));
  expect(hit, `找不到可点击元素：${text}`).toBeTruthy();
  hit!.click();
}

/** 浮层标题（UI 用字间空格排版，比较时去掉空白） */
function overlayTitle(): string {
  return (stage()?.querySelector('.overlay-title')?.textContent ?? '').replace(/\s/g, '');
}

function phase(): string {
  return (window as unknown as { __game: { st: { phase: string } } }).__game.st.phase;
}

function battles(): number {
  const st = (window as unknown as { __game: { st: { battlesWon: number; battlesLost: number } } }).__game.st;
  return st.battlesWon + st.battlesLost;
}

/** 备战：买光货架 → 刷新再买 → 逐个上前台（走详情面板按钮，等于真实点击路径） */
function setupBoard(): void {
  const buyAll = (): void => {
    for (let i = 0; i < 12; i++) {
      const card = stage()?.querySelector<HTMLElement>('.shop-card:not(.sold)');
      if (!card) break;
      card.click();
    }
  };
  buyAll();
  [...stage()!.querySelectorAll<HTMLElement>('.tb-btn')].find(b => b.textContent?.includes('刷新'))?.click();
  buyAll();
  while (stage()!.querySelectorAll('.front-row .unit-card').length < 6) {
    const bench = stage()!.querySelector<HTMLElement>('.bench-list .unit-card');
    if (!bench) break;
    bench.click();
    const front = [...stage()!.querySelectorAll<HTMLElement>('.dp-actions button')]
      .find(b => b.textContent?.includes('上前台'));
    if (!front) break;
    front.click();
  }
}

/** 打完一场：进战斗 → 跳过 → 结算 → 继续（结算回调是 60ms setTimeout，等真实时间） */
async function winBattle(): Promise<void> {
  clickByText('出战');
  expectScreen('canvas.battle-canvas');
  clickByText(/跳过/);
  await waitFor(() => stage()?.querySelector('.result-card'));
  clickByText(/继\s*续/);
  await tick();
}

async function tick(ms = 0): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

async function waitFor(cond: () => unknown, timeoutMs = 1500): Promise<void> {
  const step = 20;
  for (let waited = 0; waited < timeoutMs; waited += step) {
    if (cond()) return;
    await tick(step);
  }
}

describe('界面冒烟（jsdom 全流程）', () => {
  beforeAll(async () => {
    installCanvasStub();
    // main.ts 顶层有副作用（读档 → 渲染），动态导入以便桩先生效
    await import('../src/main');
  });

  it('主菜单与图鉴/玩法说明都能渲染', () => {
    expectScreen('.menu-screen');
    expectScreen('.menu-btns');

    clickByText(/图鉴/);
    expectScreen('.codex-screen');
    for (const tab of ['角色', '羁绊', '装备', '敌人']) {
      clickByText(tab);
      expectScreen('.codex-grid');
    }
    clickByText(/返回/);
    expectScreen('.menu-screen');

    clickByText(/玩法说明/);
    expectScreen('.help-screen');
    clickByText(/返回/);
    expectScreen('.menu-screen');
  });

  it('走完开局流程：环境三选一 → 备战 → 出战 → 结算 → 节点循环', async () => {
    clickByText(/开始对局|新的一局/);
    await tick();

    // 新局开局就是投资环境三选一
    expectScreen('.reward-row');
    expect(overlayTitle()).toContain('投资环境');
    expect(stage()!.querySelectorAll('.reward-card')).toHaveLength(3);
    clickByText('点击采纳');
    await tick();

    // 备战：结构与「持久化确实发生」
    expectScreen('.topbar');
    expectScreen('.prep-body');
    expect(stage()!.querySelectorAll('.shop-card')).toHaveLength(5);
    expect(localStorage.getItem(SAVE_KEY), '备战期应写入续档').toBeTruthy();

    (window as unknown as { __game: { cheat(): void } }).__game.cheat();
    await tick();

    // 战斗：画布位图按显示尺寸建立（jsdom 的 rect 全 0 → 回退比例 1 → 1440×674）
    const beforeBattle = battles();
    setupBoard();
    expect(
      stage()!.querySelectorAll('.front-row .unit-card').length,
      '备战没能把角色放上前台（出战会被拒绝）'
    ).toBeGreaterThan(0);
    clickByText('出战');
    await tick();
    const canvas = expectScreen('canvas.battle-canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(1440);
    expect(canvas.height).toBe(674);
    expectScreen('.battle-head');
    expectScreen('#speed-btn');

    // 战斗中触发重绘：不得并存第二个渲染器（旧实例会泄漏动画循环并多跑一次模拟）。
    // 顺带把「一次战斗只结算一次」钉成不变量——实测旧实现并不会双结算（结果卡每次重建、
    // DOM 里只有一个「继续」按钮），所以这条防的是将来引入真正的双结算路径。
    (window as unknown as { __game: { cheat(): void } }).__game.cheat();
    await tick();
    expect(document.querySelectorAll('.battle-canvas')).toHaveLength(1);

    clickByText(/跳过/);
    await waitFor(() => stage()?.querySelector('.result-card'));
    expectScreen('.result-card');
    clickByText(/继\s*续/);
    await tick();
    expect(battles() - beforeBattle, '一场战斗只能结算一次（结果卡按钮幂等）').toBe(1);

    // 节点循环：策略/奖励/补给各自点掉，遇到备战就打，直到进入终局或到步数上限
    for (let step = 0; step < 14; step++) {
      if (phase() === 'gameOver' || phase() === 'victory') break;
      const p = phase();
      if (p === 'environment' || p === 'strategy') {
        expectScreen('.reward-row');
        clickByText('点击采纳');
        await tick();
      } else if (p === 'reward') {
        expectScreen('.reward-row');
        clickByText('点击领取');
        await tick();
      } else if (p === 'supplyResult') {
        expectScreen('.supply-list');
        clickByText('收下并继续');
        await tick();
      } else if (p === 'prep') {
        setupBoard();
        await winBattle();
      } else if (p === 'battle') {
        await winBattle();
      } else {
        break;
      }
      expect(recoveredCrash(), `第 ${step} 步后应用被重置`).toBe(false);
    }
    expect(['gameOver', 'victory', 'prep', 'battle', 'strategy', 'reward', 'supplyResult', 'environment']).toContain(phase());
  });

  it('两个终局屏都能渲染（结算摘要由真跑一局产生）', async () => {
    const g = (window as unknown as { __game: { setPhase(p: string): void } }).__game;
    g.setPhase('victory');
    await tick();
    expectScreen('.overlay-screen');
    expect(stage()!.querySelector('.overlay-title')?.textContent?.replace(/\s/g, '')).toContain('通关胜利');

    g.setPhase('gameOver');
    await tick();
    expectScreen('.overlay-screen');
    expect(stage()!.querySelector('.overlay-title')?.textContent?.replace(/\s/g, '')).toContain('对局结束');

    clickByText('返回主菜单');
    await tick();
    expectScreen('.menu-screen');
  });
});
