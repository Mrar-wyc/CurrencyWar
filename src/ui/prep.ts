import { charById } from '../data/characters';
import { equipById } from '../data/equipment';
import { MATCH_CONFIG as CFG, PLANES } from '../data/stages';
import { GRADE_COLORS, GRADE_NAMES, strategyById } from '../data/strategies';
import {
  buyExp, buyShop, combineEquips, equipItemTo, findUnit, frontCapacity, placeUnit,
  recallUnit, reroll, sellUnit, sellValue, startBattle, toggleLock, unequipItem
} from '../game/match';
import { hasStrategy, rerollCostOf } from '../logic/strategy';
import { activeTraits, traitById } from '../logic/synergy';
import { enemyById } from '../data/enemies';
import type { OwnedUnit } from '../logic/types';
import { COST_COLORS, h, starText, toast } from './dom';
import type { AppCtx } from './ctx';

const FACTION_SHORT: Record<string, string> = {
  express: '列车', xianzhou: '仙舟', belobog: '贝洛', stellaron: '猎手'
};

function tagNames(tags: string[]): string {
  return tags.map(t => traitById(t).name).join('/');
}

function nodeProgress(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const wrap = h('div', { class: 'node-progress' });
  PLANES.forEach((plane, pi) => {
    const row = h('div', { class: 'np-row' + (pi === st.plane ? ' cur' : '') });
    plane.nodes.forEach((n, ni) => {
      const done = pi < st.plane || (pi === st.plane && ni < st.node);
      const cur = pi === st.plane && ni === st.node;
      const kind = n.kind === 'battle' ? 'battle' : n.kind === 'boss' ? 'boss' : n.kind;
      row.append(h('div', {
        class: `np-dot ${kind} ${done ? 'done' : ''} ${cur ? 'cur' : ''}`,
        title: n.kind === 'reward' ? '奖励' : n.kind === 'supply' ? '补给' : n.kind === 'boss' ? '首领' : n.kind === 'strategy' ? '策略' : '战斗'
      }));
    });
    wrap.append(row);
  });
  return wrap;
}

function unitCard(ctx: AppCtx, u: OwnedUnit, inBoard: boolean): HTMLElement {
  const c = charById(u.charId);
  const sel = ctx.uiSel();
  const selected = sel?.kind === 'unit' && sel.id === u.uid;
  const card = h('div', {
    class: `unit-card cost-${c.cost} ${selected ? 'selected' : ''} ${inBoard ? '' : 'in-bench'}`,
    onclick: (e: Event) => {
      e.stopPropagation();
      const s = ctx.uiSel();
      if (s?.kind === 'equip') {
        const err = equipItemTo(ctx.st, s.id, u.uid);
        if (err) toast(err); else ctx.setSel(null);
        ctx.refresh();
        return;
      }
      ctx.setSel(s?.kind === 'unit' && s.id === u.uid ? null : { kind: 'unit', id: u.uid });
      ctx.refresh();
    }
  },
    h('div', { class: 'uc-top' },
      h('span', { class: 'uc-name' }, c.name),
      h('span', { class: 'uc-star', style: { color: COST_COLORS[c.cost] } }, starText(u.star))
    ),
    h('div', { class: 'uc-tags' }, c.element, '·', tagNames(c.tags)),
    u.equips.length
      ? h('div', { class: 'uc-equips' }, u.equips.map(id => h('span', { class: 'eq-dot', style: { background: equipById(id).color } })))
      : null
  );
  return card;
}

function shopRow(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const row = h('div', { class: 'shop-row' });
  st.shop.forEach((o, i) => {
    if (!o.charId) {
      row.append(h('div', { class: 'shop-card sold' }, '已售出'));
      return;
    }
    const c = charById(o.charId);
    row.append(h('div', {
      class: `shop-card cost-${c.cost}`,
      onclick: () => {
        const err = buyShop(st, i);
        if (err) toast(err);
        ctx.refresh();
      }
    },
      h('div', { class: 'sc-head' },
        h('span', { class: 'sc-name' }, c.name),
        h('span', { class: 'sc-cost', style: { color: COST_COLORS[c.cost] } }, `♦${c.cost}`)
      ),
      h('div', { class: 'sc-tags' }, FACTION_SHORT[c.faction] ?? c.faction, ' / ', tagNames(c.tags)),
      h('div', { class: 'sc-ult' }, c.ultimate.name)
    ));
  });
  return row;
}

function boardRows(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const wrap = h('div', { class: 'board-rows' });

  const backRow = h('div', { class: 'slot-row back-row' });
  backRow.append(h('div', { class: 'row-label' }, `后台×${st.board.filter(u => u.slot?.row === 'back').length}`));
  for (let i = 0; i < CFG.backSlots; i++) {
    const u = st.board.find(x => x.slot?.row === 'back' && x.slot?.index === i);
    const slot = h('div', {
      class: `slot back ${u ? 'filled' : ''}`,
      onclick: (e: Event) => {
        e.stopPropagation();
        handleSlotClick(ctx, 'back', i, u);
      }
    }, u ? unitCard(ctx, u, true) : '');
    backRow.append(slot);
  }

  const frontRow = h('div', { class: 'slot-row front-row' });
  frontRow.append(h('div', { class: 'row-label' }, `前台×${st.board.filter(u => u.slot?.row === 'front').length}/${frontCapacity(st)}`));
  for (let i = 0; i < CFG.frontSlots; i++) {
    const u = st.board.find(x => x.slot?.row === 'front' && x.slot?.index === i);
    const slot = h('div', {
      class: `slot front ${u ? 'filled' : ''} ${i >= frontCapacity(st) ? 'locked' : ''}`,
      onclick: (e: Event) => {
        e.stopPropagation();
        if (i >= frontCapacity(st)) { toast('提升等级解锁更多前台位'); return; }
        handleSlotClick(ctx, 'front', i, u);
      }
    }, u ? unitCard(ctx, u, true) : h('div', { class: 'slot-empty' }, i >= frontCapacity(st) ? '🔒' : '+'));
    frontRow.append(slot);
  }

  wrap.append(backRow, frontRow);

  const benchRow = h('div', { class: 'slot-row bench-row' });
  benchRow.append(h('div', { class: 'row-label' }, `备战席×${st.bench.length}`));
  const benchList = h('div', { class: 'bench-list' });
  for (let i = 0; i < CFG.benchSlots; i++) {
    const u = st.bench[i];
    benchList.append(h('div', { class: `slot bench ${u ? 'filled' : ''}` }, u ? unitCard(ctx, u, false) : ''));
  }
  benchRow.append(benchList);
  wrap.append(benchRow);
  return wrap;
}

function handleSlotClick(ctx: AppCtx, row: 'front' | 'back', index: number, u: OwnedUnit | undefined): void {
  const st = ctx.st;
  const s = ctx.uiSel();
  if (s?.kind === 'unit') {
    const sel2 = findUnit(st, s.id);
    if (!sel2) { ctx.setSel(null); ctx.refresh(); return; }
    if (u && u.uid === sel2.uid) { ctx.setSel(null); ctx.refresh(); return; }
    const err = placeUnit(st, sel2.uid, row, index);
    if (err) toast(err);
    ctx.refresh();
    return;
  }
  if (u) {
    ctx.setSel({ kind: 'unit', id: u.uid });
    ctx.refresh();
  }
}

function traitPanel(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const panel = h('div', { class: 'trait-panel' });
  panel.append(h('div', { class: 'panel-title' }, '羁绊'));
  const ats = activeTraits(st.board);
  if (!ats.length) panel.append(h('div', { class: 'hint' }, '上阵角色后激活羁绊'));
  for (const at of ats) {
    panel.append(h('div', { class: `trait-item ${at.tier ? 'active' : 'inactive'}` },
      h('div', { class: 'ti-head' },
        h('span', {}, `${at.trait.icon} ${at.trait.name}`),
        h('span', { class: 'ti-count' }, `${at.count}${at.nextAt ? '/' + at.nextAt : ''}`)
      ),
      h('div', { class: 'ti-desc' }, at.tier ? at.tier.desc : `再上阵 ${at.nextAt! - at.count} 人激活下一档`)
    ));
  }
  return panel;
}

function inventoryPanel(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const panel = h('div', { class: 'inv-panel' });
  panel.append(h('div', { class: 'panel-title' }, `装备背包 ×${st.inventory.length}`));
  const s = ctx.uiSel();
  const grid = h('div', { class: 'inv-grid' });
  st.inventory.forEach((id, idx) => {
    const e = equipById(id);
    const selected = s?.kind === 'equip' && s.id === id && s.idx === undefined;
    grid.append(h('div', {
      class: `inv-item ${e.tier === 'advanced' ? 'adv' : 'basic'} ${selected ? 'selected' : ''}`,
      style: { borderColor: e.color },
      title: `${e.name}：${e.desc}`,
      onclick: (ev: Event) => {
        ev.stopPropagation();
        const cur = ctx.uiSel();
        if (cur?.kind === 'equip' && e.tier === 'basic' && cur.id !== id) {
          const curE = equipById(cur.id);
          if (curE.tier === 'basic') {
            const err = combineEquips(st, cur.id, id);
            toast(err ?? `合成成功：${equipById(id).name} → 已放入背包`);
            ctx.setSel(null);
            ctx.refresh();
            return;
          }
        }
        ctx.setSel({ kind: 'equip', id, idx });
        ctx.refresh();
      }
    }, e.tier === 'advanced' ? '◆' : '◇'));
  });
  panel.append(grid);
  panel.append(h('div', { class: 'hint' }, s?.kind === 'equip'
    ? '已选中装备：点击角色穿戴；再点一件简易装备可合成'
    : '点击装备选中 → 点击角色穿戴；两件简易装备可合成进阶'));
  return panel;
}

function skillLine(name: string, desc: string, cls: string): HTMLElement {
  return h('div', { class: `skill-line ${cls}` }, h('b', {}, name), ' ', desc);
}

function detailPanel(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const s = ctx.uiSel();
  if (s?.kind === 'equip') {
    const e = equipById(s.id);
    return h('div', { class: 'detail-panel' },
      h('div', { class: 'panel-title' }, '装备详情'),
      h('div', { class: 'equip-detail' },
        h('div', { class: 'ed-name', style: { color: e.color } }, e.name),
        h('div', { class: 'ed-tier' }, e.tier === 'advanced' ? '进阶装备' : '简易装备', e.scope === 'team' ? ' · 全队生效' : ' · 穿戴者生效'),
        h('div', { class: 'ed-desc' }, e.desc)
      ),
      h('div', { class: 'hint' }, '点击任意角色穿戴；点击另一件简易装备尝试合成')
    );
  }
  if (!s) return intelPanel(ctx);
  const u = findUnit(st, s.id);
  if (!u) return intelPanel(ctx);
  const c = charById(u.charId);
  const m = u.star === 1 ? 1 : u.star === 2 ? 1.8 : 3.2;
  return h('div', { class: 'detail-panel', onclick: (e: Event) => e.stopPropagation() },
    h('div', { class: 'panel-title' }, '角色详情'),
    h('div', { class: 'dp-head' },
      h('span', { class: 'dp-name', style: { color: COST_COLORS[c.cost] } }, `${c.name} ${starText(u.star)}`),
      h('span', { class: 'dp-cost' }, `${c.cost}费`)
    ),
    h('div', { class: 'dp-sub' }, `${c.element} · ${c.path}`),
    h('div', { class: 'dp-stats' },
      h('span', {}, `HP ${Math.round(c.base.hp * m)}`),
      h('span', {}, `攻 ${Math.round(c.base.atk * m)}`),
      h('span', {}, `防 ${Math.round(c.base.def * m)}`),
      h('span', {}, `速 ${c.base.spd}`),
      h('span', {}, `后台强度 ${Math.round(c.backPower * m)}`)
    ),
    skillLine('普攻', `${c.basic.name}：${c.basic.desc}`, ''),
    skillLine('战技', `${c.skill.name}：${c.skill.desc}`, 'skill'),
    skillLine('终结技', `${c.ultimate.name}：${c.ultimate.desc}`, 'ult'),
    skillLine('后台赋能', `${c.backSkill.name}：${c.backSkill.desc}`, 'back'),
    u.equips.length ? h('div', { class: 'dp-equips' },
      u.equips.map((id, i) => h('div', {
        class: 'dp-equip',
        onclick: () => {
          const err = unequipItem(st, u.uid, i);
          if (err) toast(err);
          ctx.refresh();
        }
      }, `◆ ${equipById(id).name} ✕`))
    ) : h('div', { class: 'hint' }, '未穿戴装备'),
    h('div', { class: 'dp-actions' },
      u.slot ? h('button', {
        onclick: () => {
          const err = recallUnit(st, u.uid);
          if (err) toast(err);
          ctx.refresh();
        }
      }, '撤回') : h('button', {
        onclick: () => {
          const free = firstFree(ctx, 'front');
          if (free < 0) { toast('前台已满'); return; }
          placeUnit(st, u.uid, 'front', free);
          ctx.refresh();
        }
      }, '上前台'),
      !u.slot ? h('button', {
        onclick: () => {
          const free = firstFree(ctx, 'back');
          if (free < 0) { toast('后台已满'); return; }
          placeUnit(st, u.uid, 'back', free);
          ctx.refresh();
        }
      }, '上后台') : null,
      h('button', {
        class: 'danger',
        onclick: () => {
          const v = sellValue(u);
          const err = sellUnit(st, u.uid);
          if (err) toast(err); else { toast(`出售获得 ${v} 金币`); ctx.setSel(null); }
          ctx.refresh();
        }
      }, `出售 +${sellValue(u)}`)
    )
  );
}

function firstFree(ctx: AppCtx, row: 'front' | 'back'): number {
  const st = ctx.st;
  const cap = row === 'front' ? frontCapacity(st) : CFG.backSlots;
  for (let i = 0; i < cap; i++) {
    if (!st.board.some(u => u.slot?.row === row && u.slot?.index === i)) return i;
  }
  return -1;
}

function intelPanel(ctx: AppCtx): HTMLElement {
  const st = ctx.st;
  const node = PLANES[st.plane].nodes[st.node];
  const panel = h('div', { class: 'detail-panel' });
  panel.append(h('div', { class: 'panel-title' }, '对局情报'));
  if (node.kind === 'battle' || node.kind === 'boss') {
    const b = node.battle;
    const counts = new Map<string, number>();
    for (const e of b.enemies) counts.set(e.id, (counts.get(e.id) ?? 0) + (e.count ?? 1));
    panel.append(h('div', { class: 'intel-node' }, `${node.kind === 'boss' ? '👑 ' : '⚔️ '}${b.name}`));
    for (const [id, n] of counts) {
      const e = enemyById(id);
      panel.append(h('div', { class: 'intel-enemy' },
        h('span', { style: { color: e.color } }, `${e.boss ? '👑' : '●'} ${e.name}`), ` ×${n}`
      ));
    }
    panel.append(h('div', { class: 'hint' }, `敌方行动上限 ${b.enemyActionLimit} 次，超时判负`));
    panel.append(h('div', { class: 'hint' }, `战败扣 ${node.kind === 'boss' ? CFG.loseHpBoss : CFG.loseHpNormal} 点小队生命`));
  } else if (node.kind === 'strategy') {
    panel.append(h('div', { class: 'intel-node' }, '📈 投资策略'));
    panel.append(h('div', { class: 'hint' }, '出战后进入三选一，采纳后持续整局'));
  }
  if (st.strategies.length) {
    panel.append(h('div', { class: 'panel-title' }, `已采纳策略 ×${st.strategies.length}`));
    for (const id of st.strategies) {
      const s = strategyById(id);
      panel.append(h('div', { class: 'intel-strategy' },
        h('span', { style: { color: GRADE_COLORS[s.grade] } }, `[${GRADE_NAMES[s.grade]}]`),
        ` ${s.name}`
      ));
    }
  }
  panel.append(h('div', { class: 'hint tip' }, '提示：后台角色计入羁绊并周期性自动施放后台赋能（伤害取决于后台强度），不会被敌人攻击'));
  return panel;
}

export function renderPrep(root: HTMLElement, ctx: AppCtx): void {
  const st = ctx.st;
  const node = PLANES[st.plane].nodes[st.node];
  const nodeName = node.kind === 'battle' || node.kind === 'boss' ? node.battle.name : '';

  // 顶栏
  const topbar = h('div', { class: 'topbar' },
    h('div', { class: 'tb-left' },
      h('span', { class: 'tb-item hp' }, `❤ ${st.hp}`),
      h('span', { class: 'tb-item gold' }, `♦ ${st.gold}`),
      h('span', { class: 'tb-item' }, `Lv.${st.level}`,
        st.level < CFG.maxLevel
          ? h('span', { class: 'exp-pill' }, `${st.exp}/${CFG.expToNext[st.level]}`)
          : h('span', { class: 'exp-pill max' }, 'MAX')
      ),
      st.winStreak >= 2 ? h('span', { class: 'tb-item streak win' }, `🔥${st.winStreak}连胜`) : null,
      st.lossStreak >= 2 ? h('span', { class: 'tb-item streak loss' }, `💧${st.lossStreak}连败`) : null,
      nodeProgress(ctx)
    ),
    h('div', { class: 'tb-right' },
      h('button', {
        class: 'tb-btn',
        onclick: () => { const err = reroll(st); if (err) toast(err); ctx.refresh(); }
      }, `刷新 ♦${rerollCostOf(st)}`),
      h('button', {
        class: `tb-btn ${st.shopLocked ? 'on' : ''}`,
        onclick: () => { toggleLock(st); ctx.refresh(); }
      }, st.shopLocked ? '🔒已锁' : '🔓锁定'),
      h('button', {
        class: 'tb-btn',
        onclick: () => { const err = buyExp(st); if (err) toast(err); ctx.refresh(); }
      }, st.level >= CFG.maxLevel ? '满级'
        : hasStrategy(st, 'struggle_protocol') ? '经验 ❤2' : `经验 ♦${CFG.expCost}`),
      h('button', {
        class: 'tb-btn go',
        onclick: () => {
          const input = startBattle(st);
          if (!input) { toast('至少上阵 1 名前台角色'); return; }
          ctx.onBattleStart(input);
        }
      }, `⚔ 出战`)
    )
  );

  const center = h('div', { class: 'prep-center' },
    h('div', { class: 'shop-wrap' }, shopRow(ctx)),
    boardRows(ctx),
    h('div', { class: 'prep-node-name' }, nodeName)
  );

  root.append(
    topbar,
    h('div', { class: 'prep-body' },
      h('div', { class: 'prep-left' }, traitPanel(ctx), inventoryPanel(ctx)),
      center,
      h('div', { class: 'prep-right' }, detailPanel(ctx))
    )
  );
}
