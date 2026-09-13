import { simulateBattle } from '../battle/engine';
import { BattleRenderer } from '../battle/renderer';
import { PLANES } from '../data/stages';
import type { BattleInput } from '../logic/battle-build';
import { h } from './dom';
import type { AppCtx } from './ctx';

export function renderBattle(root: HTMLElement, ctx: AppCtx, input: BattleInput): void {
  const st = ctx.st;
  const node = PLANES[st.plane].nodes[st.node];
  const name = node.kind === 'reward' || node.kind === 'supply' ? '' : node.battle.name;

  const canvas = h('canvas', { class: 'battle-canvas' }) as HTMLCanvasElement;
  const overlay = h('div', { class: 'battle-overlay hidden' });
  const controls = h('div', { class: 'battle-controls' },
    h('button', {
      id: 'speed-btn',
      onclick: () => {
        speed = speed === 1 ? 2 : 1;
        renderer.setSpeed(speed);
        (controls.querySelector('#speed-btn') as HTMLElement).textContent = `⏩ ×${speed}`;
      }
    }, '⏩ ×1'),
    h('button', {
      onclick: () => {
        renderer.skip();
      }
    }, '跳过 ⏭')
  );
  let speed = 1;

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
            ? `用时：敌方行动 ${result.enemyActions} 次`
            : `残余敌人 ${snapshot.enemies.filter(e => e.alive).length} 个 · 小队生命 -${node.kind === 'boss' ? 30 : 15}`
        ),
        h('button', {
          class: 'big-btn',
          onclick: () => {
            renderer.destroy();
            ctx.onBattleDone(win, result.enemyActions, input.enemyActionLimit, snapshot.enemies.filter(e => e.alive).length);
          }
        }, '继 续')
      )
    );
  }, input.backers ?? []);
  renderer.start();
}
