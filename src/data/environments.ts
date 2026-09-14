/**
 * 投资环境（官方 §33 全表 ~90 条的首批 16 条）：对局开始与位面开始时的全局修正三选一。
 * 与投资策略独立（不占策略栏、不抬敌人难度——官方环境属规则层而非策略层）。
 * 特邀专家（官方 4.4：桑博/刃/佩拉/姬子，§21）在本体系内作为金环境出现，
 * 效果为随行小额增益（官方"解锁后可招募"的完整体系未实装，登记近似清单）。
 */
export interface EnvDef {
  id: string;
  name: string;
  grade: 'silver' | 'gold';
  desc: string;
}

export const ENVIRONMENTS: EnvDef[] = [
  // ===== 银：概念股（每羁绊一条，官方为开局送羁绊角色+初始装备+该羁绊刷新概率提高） =====
  { id: 'stock_express', name: '概念股·列车同行', grade: 'silver', desc: '立刻获得 1 名列车同行 1 费角色和 1 件简易装备。' },
  { id: 'stock_xianzhou', name: '概念股·仙舟罗浮', grade: 'silver', desc: '立刻获得 1 名仙舟罗浮 1 费角色和 1 件简易装备。' },
  { id: 'stock_belobog', name: '概念股·贝洛伯格', grade: 'silver', desc: '立刻获得 1 名贝洛伯格 1 费角色和 1 件简易装备。' },
  { id: 'stock_stellaron', name: '概念股·星核猎手', grade: 'silver', desc: '立刻获得 1 名星核猎手 1 费角色和 1 件简易装备。' },
  // ===== 银：经济/成长 =====
  { id: 'money_printing', name: '增发货币', grade: 'silver', desc: '立刻获得金币（位面一 6 / 位面二 8 / 位面三 12）。' },
  { id: 'accident_insurance', name: '人身意外险', grade: 'silver', desc: '每个首领节点开战前，自动获得 1 件简易装备。' },
  { id: 'success_exp', name: '成功经验', grade: 'silver', desc: '达到 8 级后，每个节点额外获得 2 经验。' },
  { id: 'fixed_fund', name: '固定理财', grade: 'silver', desc: '立刻获得 4 经验和 2 次免费刷新。' },
  // ===== 金：战斗/经济 =====
  { id: 'deep_pit', name: '深井角斗场', grade: 'gold', desc: '首次达成 5 连胜时获得财富宝钻（已持有则改为 +15 金）。' },
  { id: 'strategy_master', name: '策略大师', grade: 'gold', desc: '每采纳 1 条投资策略，立刻获得 2×已有策略数的金币。' },
  { id: 'evolution', name: '进化算法', grade: 'gold', desc: '每次战斗胜利，全队攻击与生命上限 +3%、受伤降低 +2%（可叠加）。' },
  { id: 'long_term', name: '长期主义', grade: 'gold', desc: '之后 4 次战斗胜利，每次额外获得 7 金币。' },
  // ===== 金：特邀专家（随行顾问） =====
  { id: 'advisor_sangbo', name: '特邀专家·桑博', grade: 'gold', desc: '桑博随行：全队持续伤害 +15%。' },
  { id: 'advisor_blade', name: '特邀专家·刃', grade: 'gold', desc: '刃随行：全队攻击 +8%。' },
  { id: 'advisor_pela', name: '特邀专家·佩拉', grade: 'gold', desc: '佩拉随行：全队击杀敌人后攻击 +10%（可叠 3 层）。' },
  { id: 'advisor_himeko', name: '特邀专家·姬子', grade: 'gold', desc: '姬子随行：全队终结技能量获取 +15%。' }
];

/** 随行顾问环境 id 前缀（情报面板展示用） */
export const ADVISOR_PREFIX = 'advisor_';

export function envById(id: string): EnvDef {
  const e = ENVIRONMENTS.find(x => x.id === id);
  if (!e) throw new Error(`未知环境: ${id}`);
  return e;
}
