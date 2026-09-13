import { RANKS } from '../data/stages';
import { h } from './dom';
import type { AppCtx } from './ctx';

export function renderMenu(root: HTMLElement, ctx: AppCtx): void {
  const save = ctx.save;
  const hasCurrent = !!save.current;
  root.append(
    h('div', { class: 'menu-screen' },
      h('div', { class: 'menu-bg' }),
      h('div', { class: 'menu-inner' },
        h('div', { class: 'menu-title' },
          h('div', { class: 'mt-main' }, '货币战争'),
          h('div', { class: 'mt-sub' }, '零和博弈 · 单机自走棋'),
          h('div', { class: 'mt-rank' }, `当前职级：${RANKS[save.rank]}`)
        ),
        h('div', { class: 'menu-btns' },
          hasCurrent
            ? h('button', { class: 'big-btn primary', onclick: () => ctx.resume() }, '▶ 继续对局')
            : null,
          h('button', { class: 'big-btn', onclick: () => ctx.newGame() }, hasCurrent ? '新的一局' : '▶ 开始对局'),
          h('div', { class: 'menu-row' },
            h('button', { class: 'mid-btn', onclick: () => ctx.showCodex() }, '📖 图鉴'),
            h('button', { class: 'mid-btn', onclick: () => ctx.showHelp() }, '❓ 玩法说明')
          )
        ),
        h('div', { class: 'menu-stats' },
          `出战 ${save.totalRuns} 次 · 通关 ${save.totalWins} 次 · 最高连胜 ${save.bestStreak} · 累计 3★ ${save.totalThreeStars}`
        ),
        h('div', { class: 'menu-disclaimer' },
          '同人作品，仅供个人学习交流 · 崩坏：星穹铁道 © miHoYo / HoYoverse'
        )
      )
    )
  );
}
