import { CHARACTERS } from '../data/characters';
import { ALL_EQUIPS, BASIC_EQUIPS } from '../data/equipment';
import { ENEMIES } from '../data/enemies';
import { ALL_TRAITS } from '../data/traits';
import { AFFIXES } from '../data/affixes';
import { COST_COLORS, h } from './dom';
import { avatar, enemyMark, equipMark, hexTrait } from './icons';
import type { AppCtx } from './ctx';

type Tab = 'char' | 'trait' | 'equip' | 'enemy';

export function renderCodex(root: HTMLElement, ctx: AppCtx, tab: Tab): void {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'char', label: '角色' },
    { id: 'trait', label: '羁绊' },
    { id: 'equip', label: '装备' },
    { id: 'enemy', label: '敌人' }
  ];
  root.append(
    h('div', { class: 'codex-screen' },
      h('div', { class: 'codex-head' },
        h('button', { class: 'mid-btn', onclick: () => ctx.backToMenu() }, '← 返回'),
        h('div', { class: 'codex-title' }, '图鉴'),
        h('div', { class: 'codex-tabs' },
          ...tabs.map(t => h('button', {
            class: `mid-btn ${t.id === tab ? 'on' : ''}`,
            onclick: () => ctx.showCodexTab(t.id)
          }, t.label))
        )
      ),
      h('div', { class: 'codex-body' }, codexBody(ctx, tab))
    )
  );
}

function codexBody(ctx: AppCtx, tab: Tab): HTMLElement {
  if (tab === 'char') {
    const grid = h('div', { class: 'codex-grid' });
    for (const c of CHARACTERS) {
      grid.append(h('div', { class: `codex-card char cost-${c.cost}` },
        h('div', { class: 'cc-head' },
          avatar(c.color, c.cost, c.name.slice(0, 1), 30),
          h('span', { class: 'cc-name', style: { color: COST_COLORS[c.cost] } }, c.name),
          h('span', { class: 'cc-cost' }, `${c.cost}费`)
        ),
        h('div', { class: 'cc-sub' }, `${c.element} · ${c.path}`),
        h('div', { class: 'cc-stats' }, `HP ${c.base.hp} · 攻 ${c.base.atk} · 防 ${c.base.def} · 速 ${c.base.spd}`),
        h('div', { class: 'cc-skill' }, h('b', {}, '战技'), ` ${c.skill.desc}`),
        h('div', { class: 'cc-skill' }, h('b', {}, '终结技'), ` ${c.ultimate.desc}`),
        h('div', { class: 'cc-skill' }, h('b', {}, '后台赋能'), ` ${c.backSkill.desc}（后台强度 ${c.backPower}）`),
        c.passive.type !== 'none' ? h('div', { class: 'cc-passive' }, '被动：见流派说明') : null,
        h('div', { class: 'cc-flavor' }, c.flavor)
      ));
    }
    return grid;
  }
  if (tab === 'trait') {
    const grid = h('div', { class: 'codex-grid' });
    for (const t of ALL_TRAITS) {
      grid.append(h('div', { class: 'codex-card trait' },
        h('div', { class: 'cc-head' },
          hexTrait(t.icon, true, 30),
          h('span', { class: 'cc-name' }, t.name),
          h('span', { class: 'cc-cost' }, t.kind === 'faction' ? '阵营' : '流派')
        ),
        h('div', { class: 'cc-sub' }, t.desc),
        ...t.tiers.map(tier => h('div', { class: 'cc-tier' }, h('b', {}, `(${tier.count})`), ` ${tier.desc}`))
      ));
    }
    return grid;
  }
  if (tab === 'equip') {
    const grid = h('div', { class: 'codex-grid' });
    for (const e of [...BASIC_EQUIPS, ...ALL_EQUIPS.filter(x => x.tier === 'advanced'), ...ALL_EQUIPS.filter(x => x.tier === 'emblem')]) {
      grid.append(h('div', { class: `codex-card equip ${e.tier === 'advanced' ? 'adv' : ''} ${e.tier === 'emblem' ? 'emblem' : ''}` },
        h('div', { class: 'cc-head' },
          equipMark(e.tier, e.color, 26),
          h('span', { class: 'cc-name', style: { color: e.color } }, e.name),
          h('span', { class: 'cc-cost' }, e.tier === 'advanced' ? '进阶' : e.tier === 'emblem' ? '星徽' : '简易')
        ),
        h('div', { class: 'cc-skill' }, e.desc),
        e.recipe ? h('div', { class: 'cc-tier' }, `合成：${e.recipe.map(r => ALL_EQUIPS.find(x => x.id === r)!.name).join(' + ')}`) : null
      ));
    }
    return grid;
  }
  const grid = h('div', { class: 'codex-grid' });
  for (const e of ENEMIES) {
    grid.append(h('div', { class: `codex-card enemy ${e.boss ? 'boss' : ''}` },
      h('div', { class: 'cc-head' },
        enemyMark(!!e.boss, e.color, 24),
        h('span', { class: 'cc-name', style: { color: e.color } }, e.name),
        h('span', { class: 'cc-cost' }, e.boss ? '首领' : '小怪')
      ),
      h('div', { class: 'cc-stats' }, `HP ${e.hp} · 攻 ${e.atk} · 防 ${e.def} · 速 ${e.spd}`),
      h('div', { class: 'cc-skill' }, e.moves.map(m => `${m.name}${m.aoe ? '(群)' : ''}`).join(' / '))
    ));
  }
  // 晋升词缀说明卡（词缀挂在战斗节点上，位面二起出现）
  grid.append(h('div', { class: 'codex-card trait', style: { gridColumn: '1 / -1' } },
    h('div', { class: 'cc-head' },
      h('span', { class: 'cc-name' }, '🔥 晋升词缀'),
      h('span', { class: 'cc-cost' }, '难度值 = 位面基础 + 词缀点 + 金策略×3')
    ),
    h('div', { class: 'cc-sub' }, '位面二起部分战斗与首领节点携带词缀，备战界面「对局情报」可查看词缀与难度值。'),
    ...AFFIXES.map(a => h('div', { class: 'cc-tier' },
      h('b', { style: { color: a.color } }, `${a.icon} ${a.name} +${a.points}`), ` ${a.desc}`
    ))
  ));
  return grid;
}
