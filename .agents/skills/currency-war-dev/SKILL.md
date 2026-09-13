---
name: currency-war-dev
description: 货币战争·零和博弈（CurrencyWar）项目专属开发技能——架构速览、数据驱动扩展配方（角色/羁绊/装备/策略/节点）、平衡调参流程与测试体系。在本仓库做任何开发工作时都应使用：新增角色、羁绊、装备、投资策略、敌人、节点，改战斗引擎，调平衡，修游戏 bug，规划 v0.2 ④-⑧ 路线，或用户提到货币战争/自走棋/角色/羁绊/策略/平衡/版本——即使用户没有点名本技能。
---

# 货币战争·零和博弈 — 项目开发技能

单机自走棋网页游戏（还原星穹铁道 4.4 同名玩法），Vite 7 + TypeScript 5.8 strict + Canvas 2D 零运行时依赖，Capacitor 7 打包安卓 APK。开始改动前先读完本文件；按需再读 references/。

## 第一步：确认规格与现状（不要重新摸索）

本项目有两份事实源文档，改动前先查它们，**不要靠重新探索代码来了解规则**：

- `docs/官方规则详解.md` — 还原基准 = 需求规格。§22 是 v0.2 开发顺序（①概率表+Lv10 ✅ → ②后台赋能 ✅ → ③投资策略 ✅ → ④角色池扩 24+ ⬜ → ⑤星徽 ⬜ → ⑥行动值 ⬜ → ⑦词缀难度 ⬜ → ⑧超频等 ⬜）；§23 敌人难度公式（做 ⑦ 时照抄）；§16 投资策略效果原文；§28 进度对照。
- `docs/开发进度.md` — 进度快照、**数值近似清单**（哪些数字是自拟的）、平衡调参记录、系统→文件映射。

写新代码前先在官方规则详解里搜该机制；搜到了按记录实现，没搜到才自拟（见下方"近似还原守则"）。

## 架构速览（改动时依赖方向单向向下）

```
src/data/     纯数据表：characters(角色+后台赋能) traits(羁绊) equipment enemies stages(节点/经济/概率) strategies(策略)
src/logic/    纯函数规则：types(全部领域类型) shop synergy strategy battle-build(战前编译)
src/battle/   engine(无头模拟,产出事件流) renderer(Canvas 回放,消费事件流)
src/game/     match(对局状态机) save(localStorage,migrateMatch 迁移)
src/ui/       menu prep battle strategy overlays codex help（经 AppCtx 回调解耦，不直改状态）
tests/        core(41项规则) balance(40局胜率带) soak(300局不变量) diag(单局诊断) bot(自动对局机器人)
```

关键机制坐标（改前先看这些）：

- **后台赋能**：`characters.ts` 每角色的 `backSkill`/`backPower`；引擎以 `BACK_CAST_SPD_FACTOR=0.4` 降速档周期施放；后台单位在 `BattleInput.backers` 独立池，不可被敌人选中、不吃能量、不耗战技点。
- **策略效果分流**：条件型 flags → `logic/strategy.ts` 的 `strategyTeamFlags`；即时效果 → `game/match.ts` 的 `applyInstantStrategy`；买/刷新/经验/结算钩子 → `match.ts` 对应函数；战斗内修改 → `StrategyBattleMods` + engine。
- **敌人难度**：`strategyEnemyMult`（简单模式-10%、难度修改器-15%、伟大征服+4%×连胜、每条已采纳金策略+4%）× `stages.ts` 节点 mul。
- **节点序列**：`stages.ts` 的 PLANES（现 22 节点/每局 5 个策略点）；节点 kind 决定 phase 分支——match.ts `advanceNode`、main.ts switch、ui/ 对应渲染器**三处必须同时改**。

## 数据驱动扩展配方

常用改动的精确步骤与代码样例见 `references/recipes.md`：

- **新增角色**（前后台技能设计规则、backPower 估算法、牌池/图鉴为何零改动）
- **新增投资策略**（按效果类型分流到 5 个接线点）
- **新增装备 / 敌人 / 调整节点编排**

改数据表即生效，这是本项目的核心设计——**优先加数据，其次改逻辑，最后才动 UI**。

## 平衡调参流程（改玩法后必做）

玩家强度来自策略与角色池，bot 会如实反映。每次改完跑：

```bash
npm run typecheck && npm test && npm run build
```

看 `[balance] 40 局: 胜率 X%`（断言带 15%~98%，soak 300 局不变量另测）。出带时按此顺序回调（改动面从小到大）：

1. **收窄新加的效果数值**（flags 百分比、策略收益）
2. `engine.ts` 的 `BACK_CAST_SPD_FACTOR` 0.4→0.35（全体后台变弱）
3. `stages.ts` 位面二/三 mul 上调 ~5%（普适加压）

反向同理。每次调参把数字与原因记入 `docs/开发进度.md` §五。细节见 `references/balance-and-testing.md`。

## 近似还原守则

官方没公开的数值一律自拟，但必须：

1. 数值集中写在数据表里（不要散在逻辑中）
2. 在 `docs/开发进度.md` §四"数值近似清单"登记一条——将来官方数值公布时按清单逐项校准
3. 玩法说明（`src/ui/help.ts`）与 README 玩法速览同步更新

## 验证与调试

- `?debug` 查询参数开调试钩子：控制台 `__game.st`（对局状态）、`__game.setPhase(p)`、`__game.cheat()`（999金/9级/满血）
- 浏览器冒烟路径：新局 → 首胜 → 策略三选一 → 采纳 → 备战出战；若动了存档结构，必须补测**旧档迁移**（剥掉新字段→刷新→继续对局）——`save.ts` 的 `migrateMatch` 是脏数据防线，MatchState 每加新字段都要在这里补迁移
- 提交风格：conventional commits 中文（feat/fix/test/docs），一个逻辑改动一个提交

## 路线图

下一项是 §22 的 ④：角色池按官方费用/站位校准扩到 24+，每角色设计前后台赋能（官方费用表在官方规则详解 §4，注意卡芙卡 2 费、瓦尔特 5 费与当前自拟相反）。做 ④ 时新增角色走 `references/recipes.md` 的角色配方；扩池会显著改变 bot 买人曲线，扩完必须跑平衡回归。①②③ 已完成，不要重做。
