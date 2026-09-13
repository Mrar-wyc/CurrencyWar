// ================= 全局类型定义 =================

export type Side = 'ally' | 'enemy';

/** 技能/行动定义（角色普攻、战技、终结技共用） */
export interface SkillDef {
  name: string;
  desc: string;
  target: 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self';
  /** ATK 倍率（伤害或治疗/护盾基准） */
  mult: number;
  /** 多段攻击段数（默认1） */
  hits?: number;
  /** 附着持续伤害：每回合 dmg = mult*ATK */
  dot?: { kind: 'shock' | 'burn'; mult: number; turns: number };
  /** 附带增益 */
  buff?: { atkPct?: number; spdPct?: number; defPct?: number; turns: number };
  /** 附带减益（敌方） */
  debuff?: { defPct?: number; spdPct?: number; turns: number };
  /** 附带能量恢复（全队） */
  teamEnergy?: number;
  /** 附带战技点恢复 */
  teamSp?: number;
  /** 附带全队护盾 = mult × ATK */
  teamShield?: number;
  /** 该技能的 mult 效果为护盾而非治疗 */
  appliesShield?: boolean;
  /** 引爆敌方所有持续伤害（立即结算剩余伤害 ×1.5） */
  detonate?: boolean;
}

/** 角色被动类型 */
export type PassiveDef =
  | { type: 'none' }
  /** 克拉拉：敌方攻击己方后反击 */
  | { type: 'counter'; mult: number }
  /** 景元：行动结束后神君追加弹射 */
  | { type: 'shenjun'; init: number; max: number; mult: number; ultGain: number }
  /** 卡芙卡：敌人持续伤害结算时追加电击 */
  | { type: 'dotZap'; mult: number }
  /** 希儿：击杀后立即再次行动 */
  | { type: 'killReset' };

export interface CharDef {
  id: string;
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  faction: string;
  tags: string[];
  element: string;
  path: string;
  color: string;
  base: { hp: number; atk: number; def: number; spd: number };
  critRate: number;
  critDmg: number;
  maxEnergy: number;
  basic: SkillDef;
  skill: SkillDef;
  ultimate: SkillDef;
  /** 后台赋能：位于后台时周期性自动施放的技能 */
  backSkill: SkillDef;
  /** 后台强度基准值（后台赋能伤害/治疗/护盾的属性基准） */
  backPower: number;
  passive: PassiveDef;
  flavor: string;
}

/** 敌人技能行动 */
export interface EnemyMove {
  name: string;
  mult: number;
  aoe?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
  moves: EnemyMove[];
  boss?: boolean;
}

/** 战斗输入：全队全局加成（羁绊+团队级装备+后台赋能） */
export interface TeamFlags {
  atkPct: number;
  defPct: number;
  hpPct: number;
  spdPct: number;
  critRate: number;
  /** 普攻后追加一次普攻的概率（追击流） */
  followupChance: number;
  /** 持续伤害倍率加成 */
  dotAmp: number;
  /** 每次己方行动后全体回复 maxHP 比例（治疗流） */
  regenPct: number;
  /** 开战全队护盾（maxHP 比例，护盾流） */
  startShieldPct: number;
  spStart: number;
  spMaxBonus: number;
  /** 终结技能量获取加成 */
  ultCharge: number;
  healBonus: number;
  dmgReduce: number;
  /** 受击反伤比例（荆棘） */
  thorns: number;
  /** 击杀后叠加攻击（破晓之刃） */
  onKillAtk: number;
  /** 开战能量比例 */
  energyStart: number;
  /** 后台强度加成（策略/词缀预留） */
  backPowerPct: number;
}

export const EMPTY_TEAM_FLAGS: TeamFlags = {
  atkPct: 0, defPct: 0, hpPct: 0, spdPct: 0, critRate: 0,
  followupChance: 0, dotAmp: 0, regenPct: 0, startShieldPct: 0,
  spStart: 0, spMaxBonus: 0, ultCharge: 0, healBonus: 0, dmgReduce: 0,
  thorns: 0, onKillAtk: 0, energyStart: 0, backPowerPct: 0
};

/** 单体装备提供的局部加成 */
export interface UnitFlags {
  atkPct: number;
  defPct: number;
  hpPct: number;
  spdPct: number;
  healBonus: number;
  ultCharge: number;
  dmgReduce: number;
  thorns: number;
  onKillAtk: number;
  energyStart: number;
  /** 每次己方行动后回复 maxHP 比例（生机之种） */
  regenPct: number;
  /** 每次攻击后攻击 +此值，可叠层（上限 5 层，火力风暴潮） */
  onHitAtk: number;
}

export const EMPTY_UNIT_FLAGS: UnitFlags = {
  atkPct: 0, defPct: 0, hpPct: 0, spdPct: 0, healBonus: 0, ultCharge: 0, dmgReduce: 0, thorns: 0, onKillAtk: 0, energyStart: 0, regenPct: 0, onHitAtk: 0
};

// ================= 羁绊 =================

export interface TraitTier {
  count: number;
  desc: string;
  flags: Partial<TeamFlags>;
}

export interface TraitDef {
  id: string;
  name: string;
  kind: 'faction' | 'school';
  color: string;
  icon: string;
  desc: string;
  tiers: TraitTier[];
}

// ================= 装备 =================

export interface EquipDef {
  id: string;
  name: string;
  tier: 'basic' | 'advanced' | 'emblem';
  color: string;
  desc: string;
  /** unit: 仅穿戴者生效；team: 全队生效 */
  scope: 'unit' | 'team';
  flags: Partial<UnitFlags> & Partial<TeamFlags>;
  /** 由哪些简易装备合成（advanced 用，排序后的 id 拼接） */
  recipe?: [string, string];
  /** 星徽专属：装备者加入该羁绊（计数 +1，仅穿戴中生效） */
  emblemTrait?: string;
}

// ================= 战斗单位 =================

export interface Buff {
  atkPct?: number;
  defPct?: number;
  spdPct?: number;
  turns: number;
}

export interface Dot {
  kind: 'shock' | 'burn';
  dmg: number;
  turns: number;
}

export interface CombatUnit {
  uid: string;
  name: string;
  side: Side;
  color: string;
  charId?: string;
  boss: boolean;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
  maxEnergy: number;
  energy: number;
  shield: number;
  buffs: Buff[];
  dots: Dot[];
  alive: boolean;
  /** 敌人行动轮换 */
  moves?: EnemyMove[];
  moveIdx: number;
  char?: CharDef;
  passive: PassiveDef;
  unitFlags: UnitFlags;
  /** 后台参战单位（不可被选中，周期施放后台赋能） */
  backend?: boolean;
  /** 景元神君层数 */
  shenjunStacks: number;
  /** 破晓之刃击杀叠层 */
  killStacks: number;
  /** 攻击叠层（onHitAtk，上限 5） */
  attackStacks: number;
  nextActionAt: number;
  pos: number;
}

export type HitInfo = {
  uid: string;
  dmg?: number;
  crit?: boolean;
  heal?: number;
  shield?: number;
  dot?: Dot;
  hpAfter: number;
  shieldAfter: number;
  died: boolean;
};

export type BattleEvent =
  | { t: 'start'; sp: number; spMax: number; countdown: number; shieldPct: number }
  | {
      t: 'act';
      uid: string;
      kind: 'basic' | 'skill' | 'ult' | 'enemy' | 'counter' | 'shenjun' | 'zap' | 'dot' | 'followup' | 'thorns' | 'regen' | 'backend' | 'nuke' | 'selfharm';
      name: string;
      sp: number;
      hits: HitInfo[];
    }
  | { t: 'clock'; countdown: number }
  | { t: 'end'; win: boolean; ticks: number; remaining: number };

export interface BattleResult {
  win: boolean;
  /** 消耗的行动值（双方每次行动 -1） */
  ticks: number;
  events: BattleEvent[];
}

// ================= 关卡 =================

export interface BattleNode {
  name: string;
  enemies: { id: string; mul: number; count?: number }[];
  /** 敌方行动上限（难度拨盘）：battle-build 换算为双方共享的行动值倒计时 */
  enemyActionLimit: number;
}

export type StageNode =
  | { kind: 'battle' | 'boss'; battle: BattleNode }
  | { kind: 'reward' }
  | { kind: 'supply' }
  | { kind: 'strategy' };

export interface PlaneDef {
  name: string;
  nodes: StageNode[];
}

// ================= 对局状态 =================

export type Phase = 'prep' | 'battle' | 'reward' | 'strategy' | 'supplyResult' | 'gameOver' | 'victory';

export interface OwnedUnit {
  uid: string;
  charId: string;
  star: 1 | 2 | 3;
  /** 所在位置；不在棋盘则在备战席 */
  slot: { row: 'front' | 'back'; index: number } | null;
  equips: string[];
}

export interface ShopOffer {
  /** null = 已被买走 */
  charId: string | null;
}

export interface PendingReward {
  kind: 'equip' | 'gold';
  equipId?: string;
  gold?: number;
}

export interface MatchState {
  phase: Phase;
  plane: number; // 0..2
  node: number; // 当前位面内节点索引
  hp: number;
  gold: number;
  level: number;
  exp: number;
  winStreak: number;
  lossStreak: number;
  battlesWon: number;
  battlesLost: number;
  bestWinStreak: number;
  threeStarsMade: number;
  shop: ShopOffer[];
  shopLocked: boolean;
  /** 共享牌池：各角色剩余复制数 */
  pool: Record<string, number>;
  bench: OwnedUnit[];
  board: OwnedUnit[];
  inventory: string[];
  rewards: PendingReward[];
  /** 已采纳的投资策略 id */
  strategies: string[];
  /** 当前投资策略三选一（id ×3，已采纳后清空） */
  strategyOffers: string[];
  /** 策略计数器（超发货币节点数与失去数额 / 四费晋升待定 / 现金为王剩余场数等） */
  strategyData: Record<string, number>;
  /** 免费刷新次数（策略/环境发放，reroll 优先消耗） */
  freeRerolls: number;
  /** 免费购买次数（策略发放，buyShop 优先消耗） */
  freeBuys: number;
  /** 财富宝钻（首个首领战胜利获得）：后台位 +1，每 3 个备战阶段 +1 金 */
  wealthGem: boolean;
  gemGoldTick: number;
  /** 刚获得宝钻的一次性提示标记 */
  gemNew?: boolean;
  /** 战斗快照（用于结果展示） */
  lastBattle?: { win: boolean; ticks: number; limit: number; remaining: number };
  /** 待领取的补给内容 */
  supplyItems?: string[];
  seq: number;
}
