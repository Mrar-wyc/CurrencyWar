import { simulateBattle } from '../battle/engine';
import { BattleRenderer } from '../battle/renderer';
import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import type { BattleInput } from '../logic/battle-build';
import { h } from './dom';
import type { GameCtx } from './ctx';

/**
 * 当前正在回放的渲染器。render() 在对局中是可重入的（调试钩子会触发重绘），
 * 没有这层保护就会并存两个渲染器：各自 rAF 跑一遍、各自回调 onDone
 * → resolveBattle 结算两次（双扣血/双推进），且旧 rAF 对着已卸载的 canvas 永跑。
 */
let activeRenderer: BattleRenderer | null = null;

export function renderBattle(root: HTMLElement, ctx: GameCtx, input: BattleInput): void {
  activeRenderer?.destroy();
  activeRenderer = null;
  const st = ctx.st;
  const node = PLANES[st.plane].nodes[st.node];
  const name = node.kind === 'battle' || node.kind === 'boss' ? node.battle.name : '';

  const canvas = h<HTMLCanvasElement>('canvas', { class: 'battle-canvas' });
  const overlay = h('div', { class: 'battle-overlay hidden' });
  // 直接持有按钮引用：此前靠 querySelector + 断言，既掩盖了 null 也依赖声明顺序
  let speed = 1;
  const speedBtn = h('button', {
    id: 'speed-btn',
    onclick: () => {
      speed = speed === 1 ? 2 : 1;
      renderer.setSpeed(speed);
      speedBtn.textContent = `⏩ ×${speed}`;
    }
  }, '⏩ ×1');
  const controls = h('div', { class: 'battle-controls' },
    speedBtn,
    h('button', {
      onclick: () => {
        renderer.skip();
      }
    }, '跳过 ⏭')
  );

  root.append(
    h('div', { class: 'battle-head' },
      h('span', { class: 'bh-name' }, name),
      h('span', { class: 'bh-hp' }, `❤ ${st.hp}`)
    ),
    h('div', { class: 'battle-stage' }, canvas),
    controls,
    overlay
  );

  // 深拷贝模拟，事件流回放
  const snapshot = structuredClone(input);
  const result = simulateBattle(snapshot);
  const renderer = new BattleRenderer(canvas, result.events, input.allies, input.enemies, win => {
    overlay.classList.remove('hidden');
    overlay.replaceChildren(
      h('div', { class: 'result-card' },
        h('div', { class: `result-title ${win ? 'win' : 'lose'}` }, win ? '战 斗 胜 利' : '战 斗 失 败'),
        h('div', { class: 'result-sub' },
          win
            ? `用时：消耗 ${result.ticks} 行动值`
            : `残余敌人 ${snapshot.enemies.filter(e => e.alive).length} 个 · 小队生命 -${node.kind === 'boss' ? CFG.loseHpBoss : CFG.loseHpNormal}`
        ),
        h('button', {
          class: 'big-btn',
          onclick: () => {
            // 结果卡只允许结算一次（幂等：重复点击/并发回调都不得二次推进节点）
            if (activeRenderer !== renderer) return;
            activeRenderer = null;
            renderer.destroy();
            ctx.onBattleDone(win, result.ticks, input.enemyActionLimit, snapshot.enemies.filter(e => e.alive).length, snapshot.allies.filter(a => !a.alive).length);
          }
        }, '继 续')
      )
    );
  }, input.backers ?? []);
  activeRenderer = renderer;
  renderer.start();
}
