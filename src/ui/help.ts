import { h } from './dom';
import type { AppCtx } from './ctx';

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: '🎯 目标',
    lines: [
      '穿越 3 个位面，招募并强化你的队伍，最终击败每个位面的首领即通关。',
      '小队生命归零则对局失败；通关时按剩余生命评价职级晋升（+1~+3 级）。'
    ]
  },
  {
    title: '🛒 备战阶段',
    lines: [
      '每场战斗前可自由操作：商店会刷出 5 名 1~5 费角色，花金币购买。',
      '刷新商店花费 2 金币；锁定商店可保留当前商品到下一轮。',
      '购买经验（4金 +4exp）提升等级——等级 = 可上阵角色总数（前台 + 后台）。',
      '每场战斗结束自动 +2 经验。'
    ]
  },
  {
    title: '⭐ 升星',
    lines: [
      '购买 3 个同名 1★ 角色自动合成 2★；3 个同名 2★ 合成 3★。',
      '星级直接放大角色属性（2★×1.8 / 3★×3.2）。'
    ]
  },
  {
    title: '💰 经济',
    lines: [
      '每场战斗后获得：基础收入 5 + 利息（每持有 10 金 +1，上限 5）。',
      '连胜有额外奖励（2/4/6/8 连胜 → +1/2/3/4）；战败有 2 金补偿。',
      '钱花在刀刃上：连败时可以攒钱吃利息。'
    ]
  },
  {
    title: '🧩 羁绊与站位',
    lines: [
      '前台角色参战；后台角色不参战，但同样激活羁绊，并为全队提供 +4% 攻击/生命。',
      '阵营羁绊（列车同行/仙舟/贝洛伯格/星核猎手）与流派羁绊（群攻/爆发/追击/治疗/护盾/持续伤害）按人数分档激活。'
    ]
  },
  {
    title: '⚔️ 战斗',
    lines: [
      '战斗全自动：按速度决定行动顺序（行动条制）。',
      '全队共享战技点（上限5）：普攻 +1 点，战技 -1 点，能量满自动放终结技。',
      '在敌方行动次数耗尽前消灭所有敌人即胜；超时或全灭判负并扣小队生命。'
    ]
  },
  {
    title: '🎽 装备',
    lines: [
      '奖励/补给节点获得装备；每名角色最多穿 3 件。',
      '任意 2 件简易装备可在背包中点击合成 1 件进阶装备。'
    ]
  },
  {
    title: 'ℹ️ 说明',
    lines: [
      '本作为同人自制单机游戏，数值为近似还原（部分数值参考同类自走棋），非官方产品。',
      '崩坏：星穹铁道 © miHoYo / HoYoverse。仅供个人学习交流，请勿用于商业用途。'
    ]
  }
];

export function renderHelp(root: HTMLElement, ctx: AppCtx): void {
  root.append(
    h('div', { class: 'help-screen' },
      h('div', { class: 'codex-head' },
        h('button', { class: 'mid-btn', onclick: () => ctx.backToMenu() }, '← 返回'),
        h('div', { class: 'codex-title' }, '玩法说明')
      ),
      h('div', { class: 'help-body' },
        ...SECTIONS.map(s => h('div', { class: 'help-sec' },
          h('div', { class: 'hs-title' }, s.title),
          ...s.lines.map(l => h('div', { class: 'hs-line' }, l))
        ))
      )
    )
  );
}
