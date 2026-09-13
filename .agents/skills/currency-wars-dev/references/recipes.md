# 扩展配方（recipes）

数据驱动的精确接线步骤。改完任何数据后跑 `npx tsc --noEmit && npx vitest run`，平衡出带按 balance-and-testing.md 的回调顺序处理。

## 1. 新增角色

只改 `src/data/characters.ts`（牌池、商店、图鉴、后台支援栏全部自动生效）：

```ts
{
  id: 'serval',            // 全局唯一，小写
  name: '希露瓦', cost: 2,  // cost: 1|2|3|4|5
  faction: 'belobog',      // 必须是 traits.ts 里的阵营 id
  tags: ['aoe', 'dot'],    // 必须是流派羁绊 id：aoe群攻/single爆发/chase追击/heal治疗/shield护盾/dot持续伤害
  element: '雷', path: '智识', color: '#b06ee0',
  base: { hp: 1020, atk: 440, def: 300, spd: 100 },
  critRate: 0.05, critDmg: 1.5, maxEnergy: 110,
  basic:   { name: '..', desc: '..', target: 'enemy', mult: 1.0 },
  skill:   { ... },        // SkillDef 支持hits多段/dot/buff/debuff/teamEnergy/teamShield/detonate
  ultimate: { ... },
  backSkill: { ... },      // 后台赋能：周期自动施放
  backPower: 280,          // 后台强度基准 ≈ 0.6×atk，2★×1.8、3★×3.2 自动缩放
  passive: { type: 'none' },  // 特殊被动仅 counter/shenjun/dotZap/killReset，新增需改 engine
  flavor: '「..」'
}
```

规则与注意：

- **前后台设计规则**：前台套（basic/skill/ultimate）体现本职定位；后台赋能（backSkill）做简化支援版——输出位给单点/AOE 伤害，辅助位给治疗/护盾/全队增益。backSkill 复用 SkillDef，target 为 `ally`/`allAllies` 时自动治疗/增益前台队友。
- **backPower 估算法**：取 `0.6 × base.atk`，按费用分档微调（现值：1费 235-250 / 2费 255-285 / 3费 300-330 / 4费 355-360 / 5费 380）。后台施技频率由 `BACK_CAST_SPD_FACTOR` 统一控制，不要用 backPower 调频率。
- 牌池复制数按 cost 自动取 `POOL_COPIES`；星级倍率自动 `STAR_MULT`（仅支持 1-3★，4★ 需改 types + engine + merge 逻辑）。
- bot 按"费用高者优先"买人——新角色会自动进入 bot 曲线，加完必须跑平衡回归。
- 费用校准提示：官方费用表在官方规则详解 §4（卡芙卡 2 费、瓦尔特 5 费），改费用会同时改变商店概率落点与升星难度，属于路线 ④ 的范畴，单独成提交。

## 2. 新增投资策略（5 类接线点）

先在 `src/data/strategies.ts` 加 `StrategyDef { id, name, grade: 'silver'|'gold', desc }`，再按效果类型接线（一条策略可组合多类）：

1. **条件型全队加成** → `src/logic/strategy.ts` 的 `strategyTeamFlags` 加分支（读 st.board/bench 判断条件，返回 Partial<TeamFlags>）。样例：`horde`（上阵≥8 → +20%）。
2. **采纳时即时效果** → `src/game/match.ts` 的 `applyInstantStrategy` switch。会改棋盘/金币的写在这里（如 `layoff_front` 卖全场）。
3. **规则钩子** → `match.ts` 对应函数：买人 `buyShop`（如 promo4）、刷新 `reroll`、买经验 `buyExp`（如 struggle_protocol）、战斗结算 `resolveBattle`（如 lucky_dog/no_damage）、节点推进 `advanceNode`（如 hyperinflation）。计数器放 `st.strategyData`。
4. **战斗内修改器** → `logic/strategy.ts` 的 `strategyBattleMods`（扩展 `StrategyBattleMods` 接口）+ `battle-build.ts` 编译 + `engine.ts` 结算 + 事件 kind（如 head_bash 的 nuke）。
5. **敌人数值** → `strategyEnemyMult`（注意：每条金策略已自动 +4%，除非有特殊理由不要在这里重复加）。

配套动作：

- `tests/core.test.ts` 的 `投资策略` describe 加用例（offers 阶段用 `strategyPhase([...])` 辅助函数构造）
- 希望 bot 采纳则在 `tests/bot.ts` 的 `prefer` 列表加 id
- UI 三选一卡片、档位颜色、情报面板列表全部自动；desc 写玩家视角完整效果
- 金策略天然带 +4% 敌属性（策略难度加成），设计强度时把这个代价算进去

## 3. 新增装备

`src/data/equipment.ts`：`EquipDef { id, name, tier, color, desc, scope: 'unit'|'team', flags, recipe? }`。

- `scope: 'unit'` 只加穿戴者（flags 限 UnitFlags 字段）；`scope: 'team'` 全队（可含 TeamFlags 字段，如战意勋章）
- `recipe: [idA, idB]` 定义进阶合成（两件简易）；奖励节点掉落由 `match.ts rollRewards` 的概率控制
- 图鉴/背包合成/穿戴 UI 全自动。新 flags 字段需同步 `UnitFlags`/`TeamFlags`、`EMPTY_*`、engine

## 4. 新增敌人 / 调整节点

- 敌人：`src/data/enemies.ts` 的 `EnemyDef { id, name, color, hp, atk, def, spd, critRate, critDmg, moves, boss? }`。敌人无能量系统，按 `moves` 数组轮换，单体永远打前台 1 号位。
- 节点：`src/data/stages.ts` 的 PLANES。`mul` 缩放敌人属性，`enemyActionLimit` 超时判负（14/18/20）。
- **新增节点 kind 三处同步**：`types.ts` 的 StageNode + `match.ts advanceNode` 的 phase 分支 + main.ts switch + ui/ 渲染器 + `save.ts` persistMatch 的可持久化 phase 列表（如在策略阶段可中断）+ np-dot 样式。参考 strategy 节点的现有实现。
- 改节点序列会破坏 core.test.ts 的节点索引断言（如"末节点 index 7"），记得同步。
