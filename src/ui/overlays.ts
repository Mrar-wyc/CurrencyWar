import { RANKS } from '../data/stages';
import { equipById } from '../data/equipment';
import { ackSupply, pickReward, rewardLabel } from '../game/match';
import { h } from './dom';
import { coinSvg, equipMark } from './icons';
import type { AppCtx, FinishSummary } from './ctx';

export function renderReward(root: HTMLElement, ctx: AppCtx): void {
  const st = ctx.st;
  const cards = st.rewards.map((r, i) => {
    const isEquip = r.kind === 'equip';
    const e = isEquip ? equipById(r.equipId!) : null;
    return h('div', {
      class: `reward-card ${e?.tier === 'advanced' ? 'adv' : ''} ${e?.tier === 'emblem' ? 'emblem' : ''}`,
      onclick: () => {
        pickReward(st, i);
        ctx.refresh();
      }
    },
      h('div', { class: 'rc-icon' },
        e ? equipMark(e.tier, e.color, 56) : coinSvg(56)),
      h('div', { class: 'rc-name', style: e ? { color: e.color } : {} }, rewardLabel(r)),
      h('div', { class: 'rc-desc' }, e ? e.desc : '立刻获得金币'),
      h('div', { class: 'rc-pick' }, '点击领取')
    );
  });
  root.append(
    h('div', { class: 'overlay-screen' },
      h('div', { class: 'overlay-title' }, '🎁 奖励节点'),
      h('div', { class: 'overlay-sub' }, '三选一，点击领取'),
      h('div', { class: 'reward-row' }, ...cards)
    )
  );
}

export function renderSupply(root: HTMLElement, ctx: AppCtx): void {
  const st = ctx.st;
  root.append(
    h('div', { class: 'overlay-screen' },
      h('div', { class: 'overlay-title' }, '📦 补给节点'),
      h('div', { class: 'overlay-sub' }, '获得 2 件简易装备'),
      h('div', { class: 'supply-list' },
        ...(st.supplyItems ?? []).map(id => {
          const e = equipById(id);
          return h('div', { class: 'supply-item' },
            equipMark(e.tier, e.color, 20),
            h('b', { style: { color: e.color } }, e.name),
            h('span', {}, e.desc)
          );
        })
      ),
      h('button', {
        class: 'big-btn',
        onclick: () => { ackSupply(st); ctx.refresh(); }
      }, '收下并继续')
    )
  );
}

export function renderGameOver(root: HTMLElement, ctx: AppCtx, s: FinishSummary): void {
  root.append(
    h('div', { class: 'overlay-screen end' },
      h('div', { class: 'overlay-title lose' }, '对局结束'),
      h('div', { class: 'overlay-sub' }, '小队生命耗尽，投资失败……'),
      h('div', { class: 'end-stats' },
        stat('抵达位面', `${Math.min(3, ctx.st.plane + 1)}/3`),
        stat('战斗胜/负', `${s.wins}/${s.losses}`),
        stat('最高连胜', `${s.bestStreak}`),
        stat('合成 3★', `${s.threeStars}`)
      ),
      h('div', { class: 'hint' }, '职级维持不变，再接再厉！'),
      h('button', { class: 'big-btn', onclick: () => ctx.goMenu() }, '返回主菜单')
    )
  );
}

export function renderVictory(root: HTMLElement, ctx: AppCtx, s: FinishSummary): void {
  root.append(
    h('div', { class: 'overlay-screen end' },
      h('div', { class: 'overlay-title win' }, '🎉 通关胜利'),
      h('div', { class: 'overlay-sub' }, `剩余小队生命 ${s.hp}`),
      h('div', { class: 'rank-gain' },
        s.rankGain > 0
          ? `职级晋升 +${s.rankGain}：${RANKS[Math.max(0, s.newRank - s.rankGain)]} → ${RANKS[s.newRank]}`
          : `当前职级：${RANKS[s.newRank]}`
      ),
      h('div', { class: 'end-stats' },
        stat('战斗胜/负', `${s.wins}/${s.losses}`),
        stat('最高连胜', `${s.bestStreak}`),
        stat('合成 3★', `${s.threeStars}`),
        stat('剩余生命', `${s.hp}`)
      ),
      h('button', { class: 'big-btn', onclick: () => ctx.goMenu() }, '返回主菜单')
    )
  );
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat-item' }, h('div', { class: 'si-label' }, label), h('div', { class: 'si-value' }, value));
}
