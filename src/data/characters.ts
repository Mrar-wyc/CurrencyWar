import type { CharDef } from '../logic/types';

/**
 * 16 名角色（同人自用）。星级成长：2★ ×1.8、3★ ×3.2（hp/atk/def）。
 * 每名角色含前台技能组（basic/skill/ultimate）与后台赋能（backSkill + backPower 后台强度基准）：
 * 后台角色不直接参战，而是周期性自动施放后台赋能，强度 = backPower × 星级倍率 × (1 + 加成)。
 * 阵营：列车同行 / 仙舟罗浮 / 贝洛伯格 / 星核猎手
 * 流派：群攻 / 爆发 / 追击 / 治疗 / 护盾 / 持续伤害
 */
export const CHARACTERS: CharDef[] = [
  // ============ 1 费 ============
  {
    id: 'march7th', name: '三月七', cost: 1, faction: 'express', tags: ['shield'],
    element: '冰', path: '存护', color: '#7db8e8',
    base: { hp: 1050, atk: 360, def: 340, spd: 95 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '一板一眼', desc: '对敌方单体造成 100% 攻击的冰伤', target: 'enemy', mult: 1.0 },
    skill: { name: '可爱即正义', desc: '为生命比例最低的队友附加 180% 攻击的护盾', target: 'ally', mult: 1.8 },
    ultimate: { name: '这是…冰之艺术！', desc: '对全体敌人造成 130% 冰伤，并为全队附加 50% 攻击的护盾', target: 'allEnemies', mult: 1.3, teamShield: 0.5 },
    backSkill: { name: '冰锥驰援', desc: '后台：对随机敌人造成 120% 后台强度的冰伤，并为全队附加 20% 后台强度的护盾', target: 'enemy', mult: 1.2, teamShield: 0.2 },
    backPower: 240,
    passive: { type: 'none' },
    flavor: '「小心着凉哦，笨蛋！」'
  },
  {
    id: 'danheng', name: '丹恒', cost: 1, faction: 'express', tags: ['single'],
    element: '风', path: '巡猎', color: '#64c8b4',
    base: { hp: 950, atk: 410, def: 280, spd: 105 }, critRate: 0.10, critDmg: 1.5, maxEnergy: 100,
    basic: { name: '云骑枪术·朔风', desc: '对敌方单体造成 100% 攻击的风伤', target: 'enemy', mult: 1.0 },
    skill: { name: '疾风穿云', desc: '对敌方单体造成 200% 攻击的风伤', target: 'enemy', mult: 2.0 },
    ultimate: { name: '冷面飞霜', desc: '对敌方单体造成 420% 攻击的风伤', target: 'enemy', mult: 4.2 },
    backSkill: { name: '疾风驰援', desc: '后台：对随机敌人造成 220% 后台强度的风伤', target: 'enemy', mult: 2.2 },
    backPower: 250,
    passive: { type: 'none' },
    flavor: '「一枪，就够了。」'
  },
  {
    id: 'asta', name: '艾丝妲', cost: 1, faction: 'express', tags: ['aoe'],
    element: '火', path: '同谐', color: '#f2c94c',
    base: { hp: 980, atk: 390, def: 270, spd: 102 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '星穹礼花', desc: '对敌方单体造成 100% 攻击的火伤', target: 'enemy', mult: 1.0 },
    skill: { name: '星火流弹', desc: '弹射 3 段，每段对随机敌人造成 50% 火伤', target: 'enemy', mult: 0.5, hits: 3 },
    ultimate: { name: '燃焰颂歌', desc: '对全体敌人造成 70% 火伤，全队速度 +15%（2 回合）', target: 'allEnemies', mult: 0.7, buff: { spdPct: 0.15, turns: 2 } },
    backSkill: { name: '火力支援', desc: '后台：对全体敌人造成 45% 后台强度的火伤，全队攻击 +8%（2 回合）', target: 'allEnemies', mult: 0.45, buff: { atkPct: 0.08, turns: 2 } },
    backPower: 235,
    passive: { type: 'none' },
    flavor: '「观测数据已就绪，全弹发射！」'
  },
  {
    id: 'natasha', name: '娜塔莎', cost: 1, faction: 'belobog', tags: ['heal'],
    element: '物理', path: '丰饶', color: '#7dd87d',
    base: { hp: 1000, atk: 380, def: 300, spd: 96 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '致命 Dosage', desc: '对敌方单体造成 100% 攻击的物理伤害', target: 'enemy', mult: 1.0 },
    skill: { name: '甜甜的香气', desc: '治疗生命比例最低的队友 220% 攻击', target: 'ally', mult: 2.2 },
    ultimate: { name: '复苏颂歌', desc: '治疗全队 170% 攻击', target: 'allAllies', mult: 1.7 },
    backSkill: { name: '巡诊', desc: '后台：治疗生命比例最低的队友 150% 后台强度', target: 'ally', mult: 1.5 },
    backPower: 240,
    passive: { type: 'none' },
    flavor: '「忍一忍，很快就不疼了。」'
  },
  // ============ 2 费 ============
  {
    id: 'serval', name: '希露瓦', cost: 2, faction: 'belobog', tags: ['aoe', 'dot'],
    element: '雷', path: '智识', color: '#b06ee0',
    base: { hp: 1020, atk: 440, def: 300, spd: 100 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '机械轻抚', desc: '对敌方单体造成 100% 攻击的雷伤', target: 'enemy', mult: 1.0 },
    skill: { name: '爱的震击', desc: '对敌方单体造成 110% 雷伤并附加触电（每回合 50% 攻击，2 回合）', target: 'enemy', mult: 1.1, dot: { kind: 'shock', mult: 0.5, turns: 2 } },
    ultimate: { name: '机关浪漫', desc: '对全体敌人造成 110% 雷伤并附加触电（每回合 35% 攻击，2 回合）', target: 'allEnemies', mult: 1.1, dot: { kind: 'shock', mult: 0.35, turns: 2 } },
    backSkill: { name: '电磁脉冲', desc: '后台：对全体敌人造成 70% 后台强度的雷伤并附加触电（每回合 25% 后台强度，2 回合）', target: 'allEnemies', mult: 0.7, dot: { kind: 'shock', mult: 0.25, turns: 2 } },
    backPower: 280,
    passive: { type: 'none' },
    flavor: '「摇滚永不为奴！」'
  },
  {
    id: 'pela', name: '佩拉', cost: 2, faction: 'belobog', tags: ['single'],
    element: '冰', path: '虚无', color: '#6fa8dc',
    base: { hp: 1000, atk: 430, def: 310, spd: 102 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '战术侦察', desc: '对敌方单体造成 100% 攻击的冰伤', target: 'enemy', mult: 1.0 },
    skill: { name: '破防攻势', desc: '对敌方单体造成 140% 冰伤，防御 -25%（2 回合）', target: 'enemy', mult: 1.4, debuff: { defPct: -0.25, turns: 2 } },
    ultimate: { name: '领域扫描', desc: '对全体敌人造成 100% 冰伤，防御 -20%（2 回合）', target: 'allEnemies', mult: 1.0, debuff: { defPct: -0.20, turns: 2 } },
    backSkill: { name: '侦察标记', desc: '后台：对随机敌人造成 90% 后台强度的冰伤，其防御 -15%（2 回合）', target: 'enemy', mult: 0.9, debuff: { defPct: -0.15, turns: 2 } },
    backPower: 275,
    passive: { type: 'none' },
    flavor: '「情报，就是第一道防线。」'
  },
  {
    id: 'sushang', name: '素裳', cost: 2, faction: 'xianzhou', tags: ['single'],
    element: '物理', path: '巡猎', color: '#e8b64c',
    base: { hp: 1000, atk: 450, def: 300, spd: 105 }, critRate: 0.10, critDmg: 1.5, maxEnergy: 100,
    basic: { name: '云骑剑术', desc: '对敌方单体造成 100% 攻击的物理伤害', target: 'enemy', mult: 1.0 },
    skill: { name: '剑意昂扬', desc: '对敌方单体造成 180% 物理伤害', target: 'enemy', mult: 1.8 },
    ultimate: { name: '十王敕令·斩', desc: '对敌方单体造成 380% 物理伤害，防御 -15%（2 回合）', target: 'enemy', mult: 3.8, debuff: { defPct: -0.15, turns: 2 } },
    backSkill: { name: '剑气驰援', desc: '后台：对随机敌人造成 170% 后台强度的物理伤害', target: 'enemy', mult: 1.7 },
    backPower: 285,
    passive: { type: 'none' },
    flavor: '「正义的仙舟剑士，参上！」'
  },
  {
    id: 'qingque', name: '青雀', cost: 2, faction: 'xianzhou', tags: ['aoe'],
    element: '量子', path: '智识', color: '#5fd0a8',
    base: { hp: 1020, atk: 445, def: 300, spd: 95 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 125,
    basic: { name: '摸鱼打法', desc: '对敌方单体造成 100% 攻击的量子伤', target: 'enemy', mult: 1.0 },
    skill: { name: '海底捞月', desc: '对敌方单体造成 190% 量子伤', target: 'enemy', mult: 1.9 },
    ultimate: { name: '杠上开花！', desc: '对全体敌人造成 140% 量子伤', target: 'allEnemies', mult: 1.4 },
    backSkill: { name: '杠上开花·改', desc: '后台：对全体敌人造成 85% 后台强度的量子伤', target: 'allEnemies', mult: 0.85 },
    backPower: 280,
    passive: { type: 'none' },
    flavor: '「再摸一张，就一张……」'
  },
  {
    id: 'tingyun', name: '停云', cost: 2, faction: 'xianzhou', tags: ['single'],
    element: '雷', path: '同谐', color: '#f0a0c0',
    base: { hp: 980, atk: 400, def: 290, spd: 105 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '祥云掷签', desc: '对敌方单体造成 100% 攻击的雷伤', target: 'enemy', mult: 1.0 },
    skill: { name: '旦遇恩泽', desc: '全队攻击 +18%（3 回合）', target: 'ally', mult: 0, buff: { atkPct: 0.18, turns: 3 } },
    ultimate: { name: '妙音广布', desc: '对敌方单体造成 240% 雷伤，全队获得 15 点能量', target: 'enemy', mult: 2.4, teamEnergy: 15 },
    backSkill: { name: '后台祝福', desc: '后台：全队攻击 +12%（3 回合）', target: 'ally', mult: 0, buff: { atkPct: 0.12, turns: 3 } },
    backPower: 255,
    passive: { type: 'none' },
    flavor: '「愿旅途顺遂，财源广进～」'
  },
  // ============ 3 费 ============
  {
    id: 'himeko', name: '姬子', cost: 3, faction: 'express', tags: ['aoe', 'dot'],
    element: '火', path: '智识', color: '#f2884b',
    base: { hp: 1150, atk: 520, def: 320, spd: 100 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 115,
    basic: { name: '火眼金睛', desc: '对敌方单体造成 100% 攻击的火伤', target: 'enemy', mult: 1.0 },
    skill: { name: '燎原之火', desc: '对全体敌人造成 95% 火伤并附加灼烧（每回合 35% 攻击，2 回合）', target: 'allEnemies', mult: 0.95, dot: { kind: 'burn', mult: 0.35, turns: 2 } },
    ultimate: { name: '天坠之火', desc: '对全体敌人造成 135% 火伤并附加灼烧（每回合 30% 攻击，2 回合）', target: 'allEnemies', mult: 1.35, dot: { kind: 'burn', mult: 0.30, turns: 2 } },
    backSkill: { name: '轨道炮击', desc: '后台：对全体敌人造成 80% 后台强度的火伤并附加灼烧（每回合 22% 后台强度，2 回合）', target: 'allEnemies', mult: 0.8, dot: { kind: 'burn', mult: 0.22, turns: 2 } },
    backPower: 330,
    passive: { type: 'none' },
    flavor: '「咖啡煮好了，战斗也结束吧。」'
  },
  {
    id: 'welt', name: '瓦尔特', cost: 3, faction: 'express', tags: ['aoe'],
    element: '虚数', path: '虚无', color: '#9d7ce8',
    base: { hp: 1150, atk: 500, def: 330, spd: 98 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 115,
    basic: { name: '虚空黑幕', desc: '对敌方单体造成 100% 攻击的虚数伤', target: 'enemy', mult: 1.0 },
    skill: { name: '时空扭曲', desc: '弹射 3 段，每段对随机敌人造成 55% 虚数伤，首段目标速度 -10%（2 回合）', target: 'enemy', mult: 0.55, hits: 3, debuff: { spdPct: -0.10, turns: 2 } },
    ultimate: { name: '边界再临', desc: '对全体敌人造成 115% 虚数伤，速度 -12%（2 回合）', target: 'allEnemies', mult: 1.15, debuff: { spdPct: -0.12, turns: 2 } },
    backSkill: { name: '虚空支援', desc: '后台：弹射 3 段，每段对随机敌人造成 45% 后台强度的虚数伤，首段目标速度 -8%（2 回合）', target: 'enemy', mult: 0.45, hits: 3, debuff: { spdPct: -0.08, turns: 2 } },
    backPower: 320,
    passive: { type: 'none' },
    flavor: '「时间与重力，皆为我的武器。」'
  },
  {
    id: 'bailu', name: '白露', cost: 3, faction: 'xianzhou', tags: ['heal'],
    element: '雷', path: '丰饶', color: '#7dd8c0',
    base: { hp: 1200, atk: 470, def: 330, spd: 96 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 125,
    basic: { name: '龙鳞护体', desc: '对敌方单体造成 100% 攻击的雷伤', target: 'enemy', mult: 1.0 },
    skill: { name: '珠气流转', desc: '治疗生命比例最低的两名队友，分别 200%/100% 攻击', target: 'ally', mult: 2.0, hits: 2 },
    ultimate: { name: '雷霆玉枢', desc: '治疗全队 180% 攻击', target: 'allAllies', mult: 1.8 },
    backSkill: { name: '龙气润泽', desc: '后台：治疗生命比例最低的两名队友，各 120% 后台强度', target: 'ally', mult: 1.2, hits: 2 },
    backPower: 300,
    passive: { type: 'none' },
    flavor: '「医者仁心，龙吟护身～」'
  },
  {
    id: 'clara', name: '克拉拉', cost: 3, faction: 'belobog', tags: ['chase'],
    element: '物理', path: '毁灭', color: '#f2884b',
    base: { hp: 1250, atk: 490, def: 360, spd: 90 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 115,
    basic: { name: '小小的守护', desc: '对敌方单体造成 100% 攻击的物理伤害', target: 'enemy', mult: 1.0 },
    skill: { name: '云彻雾散', desc: '对敌方单体造成 150% 物理伤害', target: 'enemy', mult: 1.5 },
    ultimate: { name: '末中之末', desc: '对全体敌人造成 160% 物理伤害', target: 'allEnemies', mult: 1.6 },
    backSkill: { name: '史瓦罗支援', desc: '后台：对随机敌人造成 120% 后台强度的物理伤害', target: 'enemy', mult: 1.2 },
    backPower: 310,
    passive: { type: 'counter', mult: 0.9 },
    flavor: '「史瓦罗会保护克拉拉，也会保护大家。」'
  },
  // ============ 4 费 ============
  {
    id: 'seele', name: '希儿', cost: 4, faction: 'belobog', tags: ['single'],
    element: '量子', path: '巡猎', color: '#c77dff',
    base: { hp: 1150, atk: 570, def: 330, spd: 108 }, critRate: 0.12, critDmg: 1.5, maxEnergy: 100,
    basic: { name: '蝶影突刺', desc: '对敌方单体造成 100% 攻击的量子伤', target: 'enemy', mult: 1.0 },
    skill: { name: '蝴蝶梦我', desc: '对敌方单体造成 220% 量子伤', target: 'enemy', mult: 2.2 },
    ultimate: { name: '掠影蝶翼', desc: '对敌方单体造成 460% 量子伤', target: 'enemy', mult: 4.6 },
    backSkill: { name: '蝶影驰援', desc: '后台：对随机敌人造成 200% 后台强度的量子伤', target: 'enemy', mult: 2.0 },
    backPower: 360,
    passive: { type: 'killReset' },
    flavor: '「弱者，才没资格赢。」'
  },
  {
    id: 'jingyuan', name: '景元', cost: 4, faction: 'xianzhou', tags: ['chase'],
    element: '雷', path: '智识', color: '#e05d5d',
    base: { hp: 1250, atk: 560, def: 340, spd: 96 }, critRate: 0.05, critDmg: 1.5, maxEnergy: 115,
    basic: { name: '掣电伤锋', desc: '对敌方单体造成 100% 攻击的雷伤', target: 'enemy', mult: 1.0 },
    skill: { name: '十王司判', desc: '弹射 2 段，每段对随机敌人造成 80% 雷伤', target: 'enemy', mult: 0.8, hits: 2 },
    ultimate: { name: '神君敕令', desc: '对敌方单体造成 140% 雷伤，神君 +2 层', target: 'enemy', mult: 1.4 },
    backSkill: { name: '神君遥击', desc: '后台：弹射 2 段，每段对随机敌人造成 65% 后台强度的雷伤', target: 'enemy', mult: 0.65, hits: 2 },
    backPower: 355,
    passive: { type: 'shenjun', init: 2, max: 4, mult: 0.5, ultGain: 2 },
    flavor: '「神君，请。」'
  },
  // ============ 5 费 ============
  {
    id: 'kafka', name: '卡芙卡', cost: 5, faction: 'stellaron', tags: ['dot', 'chase'],
    element: '雷', path: '虚无', color: '#b06ee0',
    base: { hp: 1300, atk: 620, def: 360, spd: 100 }, critRate: 0.08, critDmg: 1.5, maxEnergy: 110,
    basic: { name: '月牙铁', desc: '对敌方单体造成 100% 攻击的雷伤', target: 'enemy', mult: 1.0 },
    skill: { name: '窈窕醉月', desc: '对敌方单体造成 100% 雷伤并附加触电（每回合 90% 攻击，2 回合）', target: 'enemy', mult: 1.0, dot: { kind: 'shock', mult: 0.9, turns: 2 } },
    ultimate: { name: '暮色朦胧', desc: '对全体敌人造成 90% 雷伤，并引爆其所有持续伤害（立即结算剩余伤害的 150%）', target: 'allEnemies', mult: 0.9, detonate: true },
    backSkill: { name: '弦乐遥奏', desc: '后台：对随机敌人造成 70% 后台强度的雷伤并附加触电（每回合 40% 后台强度，2 回合）', target: 'enemy', mult: 0.7, dot: { kind: 'shock', mult: 0.4, turns: 2 } },
    backPower: 380,
    passive: { type: 'dotZap', mult: 0.5 },
    flavor: '「跟着旋律起舞吧，弦乐团要开演了。」'
  }
];

export function charById(id: string): CharDef {
  const c = CHARACTERS.find(x => x.id === id);
  if (!c) throw new Error(`未知角色: ${id}`);
  return c;
}

/** 各费用角色在牌池中的复制数量 */
export const POOL_COPIES: Record<number, number> = { 1: 14, 2: 12, 3: 10, 4: 8, 5: 6 };

/** 星级属性倍率 */
export const STAR_MULT: Record<number, number> = { 1: 1.0, 2: 1.8, 3: 3.2 };
