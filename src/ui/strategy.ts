import { GRADE_COLORS, GRADE_NAMES, strategyById } from '../data/strategies';
import { pickStrategy } from '../game/match';
import { h } from './dom';
import { gemSvg } from './icons';
import type { AppCtx } from './ctx';

/** 投资策略节点：三选一（点击采纳，持续整局）——官方品质语言：银/金 */
export function renderStrategy(root: HTMLElement, ctx: AppCtx): void {
  const st = ctx.st;
  const cards = st.strategyOffers.map((id, i) => {
    const s = strategyById(id);
    return h('div', {
      class: `reward-card strat ${s.grade}`,
      style: { borderColor: GRADE_COLORS[s.grade] },
      onclick: () => {
        pickStrategy(st, i);
        ctx.refresh();
      }
    },
      h('div', { class: 'rc-icon' }, gemSvg(s.grade, 54)),
      h('div', { class: 'strat-grade', style: { color: GRADE_COLORS[s.grade] } }, GRADE_NAMES[s.grade] + '色策略'),
      h('div', { class: 'rc-name' }, s.name),
      h('div', { class: 'rc-desc' }, s.desc),
      h('div', { class: 'rc-pick' }, '点击采纳')
    );
  });
  root.append(
    h('div', { class: 'overlay-screen' },
      h('div', { class: 'overlay-title' }, '投 资 策 略'),
      h('div', { class: 'overlay-sub' }, '三选一，采纳后持续整局'),
      h('div', { class: 'reward-row' }, ...cards)
    )
  );
}
