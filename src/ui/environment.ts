import { GRADE_COLORS, GRADE_NAMES } from '../data/strategies';
import { envById } from '../data/environments';
import { pickEnvironment } from '../game/match';
import { h } from './dom';
import { gemSvg } from './icons';
import type { AppCtx } from './ctx';

/** 投资环境三选一（开局与位面开始）：点击采纳，规则层全局修正 */
export function renderEnvironment(root: HTMLElement, ctx: AppCtx): void {
  const st = ctx.st;
  const cards = st.environmentOffers.map((id, i) => {
    const e = envById(id);
    return h('div', {
      class: `reward-card strat ${e.grade}`,
      style: { borderColor: GRADE_COLORS[e.grade] },
      onclick: () => {
        pickEnvironment(st, i);
        ctx.refresh();
      }
    },
      h('div', { class: 'rc-icon' }, gemSvg(e.grade, 54)),
      h('div', { class: 'strat-grade', style: { color: GRADE_COLORS[e.grade] } }, GRADE_NAMES[e.grade] + '色环境'),
      h('div', { class: 'rc-name' }, e.name),
      h('div', { class: 'rc-desc' }, e.desc),
      h('div', { class: 'rc-pick' }, '点击采纳')
    );
  });
  root.append(
    h('div', { class: 'overlay-screen' },
      h('div', { class: 'overlay-title' }, '投 资 环 境'),
      h('div', { class: 'overlay-sub' }, '三选一，影响本场对局的规则修正'),
      h('div', { class: 'reward-row' }, ...cards)
    )
  );
}
