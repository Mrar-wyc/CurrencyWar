---
name: currency-wars-dev
description: 崩铁「货币战争·零和博弈」单机自走棋项目的专属开发技能。凡在本仓库做任何开发——添加/修改角色羁绊装备策略数据、调整平衡、改战斗引擎或UI、修bug、存档迁移、跑测试、打包APK、发版本、规划路线图——都必须先加载本技能。触发词包括：货币战争、自走棋、角色/羁绊/装备/策略/赋能、上阵/站位、平衡/胜率、版本/路线图、APK、发版、官方规则。
---

# 货币战争·零和博弈 开发技能

崩坏：星穹铁道「货币战争·零和博弈」玩法的单机自走棋同人复刻（安卓 APK）。
技术栈：Vite + TypeScript + Canvas 2D（零运行时依赖）+ Capacitor 7；vitest 单测；GitHub Actions 云端打包。

## 当前状态（八步路线全部完成 → v0.2.2）

- ✅ ①商店概率表+Lv10（`4130e36`）　✅ ②后台自动施技（`f52bb81`）　✅ ③投资策略三选一（`d9b98f2`）
- ✅ ④角色池 24 名+官方费用校准（`af304c4`）　✅ ⑤星徽 10 枚+装备池 41+财富宝钻（`b6f50d7`~`acb2361`）　✅ ⑥行动值倒计时（`83553cb`）　✅ ⑦词缀难度 10 条（`80f96ee`~`4da29d7`）　✅ ⑧上 投资环境 16 条+随行顾问×4（`fb259ac`）　✅ ⑧下 超频模式+对手公司+概念股加权（`03a8dbf`~`e3db8d2`）
- ✅ v0.2.1 质量轮：测试补齐（105 项）/ 视觉全屏验收 / 版本号三处对齐 / 文档同步 / 死代码清理
- ✅ v0.2.2 深挖轮：三路审计后修 14 类问题（团队暴击双计、减防无下限、景元神君一次性、佩拉顾问空转、末节点首领失败被判通关、牌池只减不增、四费晋升满席溢出、存档脏数据 7 处、选择节点软锁、渲染白屏兜底、战斗中双重结算、开局护盾不显示、静态层预渲染、类型收口）。测试 122 项
- 现有内容：24 角色（含专属后台赋能）/ 10 羁绊（7 条扩档）/ 41 装备（简易 8+进阶 23+星徽 10）/ 20 策略 / 16 环境（含 4 条随行顾问）/ 22 节点 / 财富宝钻 / 行动值倒计时战斗制 / 敌人词缀 10 条 / 超频模式 / 对手公司 11 节点
- ⬜ 长期：顾问商店招募版、环境+74 条、词缀+35 条、超频难度分档、契约类环境
- 详情：`docs/开发进度.md`（进度快照、**数值近似清单**、调参记录、复查清单、**§十 深挖审计与修正清单**、UI 设计规范 §九）

## 第一步：按任务类型读取参考文件

| 任务 | 必读 |
|---|---|
| 任何平衡/数值/规则相关改动 | `references/rules-cheatsheet.md`（浓缩规则速查） |
| 添加角色/策略/装备/敌人/节点 | `references/recipes.md`（数据驱动扩展配方，含代码样例） |
| 跑测试/调平衡/存档迁移/发版 | `references/balance-and-testing.md`（测试体系、调参历史、出带回调顺序） |
| 官方内容库查询（角色名单/羁绊阈值/装备/策略总量） | `references/content-library.md` |
| 规划新系统/大版本功能 | `references/roadmap.md`（v0.2+ 优先级与设计决策） |
| 规则细节存疑 | 读 `docs/官方规则详解.md`（28 章完整调研，本项目唯一规则权威；§22 开发顺序/§23 难度公式/§16 策略原文/§28 进度对照） |

写新代码前先在官方规则详解里搜该机制：搜到了按记录实现，没搜到才自拟并登记 `docs/开发进度.md` §四"数值近似清单"（将来官方公布数值时按清单校准）。

## 项目结构与铁律

```
src/data/     内容数据表：characters(角色+后台赋能) traits equipment enemies affixes(词缀) environments(投资环境) stages(节点/经济/概率) strategies(策略)
src/logic/    纯函数：types(领域类型) shop synergy strategy(策略效果分流) battle-build(战前编译)
src/battle/   engine.ts(无头模拟,产出事件流) + renderer.ts(Canvas 回放)——逻辑与表现分离
src/game/     match.ts(对局状态机) + save.ts(存档,migrateMatch 迁移与脏数据防御)
src/ui/       menu/prep/battle/strategy/overlays/codex/help + icons.ts(内联SVG图标库)——禁止在此写游戏规则；主题 token 在 src/style.css :root
docs/         官方规则详解（规则权威）+ 开发进度（进度/近似清单/调参记录/UI设计规范§九）
tests/        core(115项) + guards(5项跨文件护栏) + balance(40局) + soak(300局不变量+终止分布) + diag(单局诊断) + bot.ts(自动对局)
android/      Capacitor 工程；tools/ 本机 JDK21+SDK（env.sh）；.github/workflows 云端打包
```

铁律：

1. **数据表驱动**：加内容优先改 `src/data/`，其次 logic，最后才动 UI。逻辑层不硬编码具体角色名。
2. **逻辑可测**：经济/商店/升星/羁绊/战斗全部纯函数；改规则必须同步补/改 `tests/core.test.ts` 并跑全量测试。
3. **战斗逻辑与表现分离**：引擎只产出 `BattleEvent[]`，渲染器消费事件回放；新演出加在 renderer。
4. **规则以 docs/官方规则详解.md 为准**：官方未公开数值标注 ⚠️ 近似并登记开发进度.md，不要臆造"官方数值"。
5. **改玩法必跑平衡回归**：`[balance]` 胜率断言带 15%~98%（⑧全部完成后实测 57%~73%，超频局单独定标不入常规带）；大幅给玩家加成的新系统必须配对冲的难度机制（先例：金策略自动 +4% 敌属性）。
6. **动存档必测旧档迁移**：MatchState 加新字段要在 `save.ts` migrateMatch 补迁移，并按 references/balance-and-testing.md 的方法实测。

## 设计红线（来自用户反馈，勿回退）

- **同名角色只能上阵一个**（前台+后台合计），3 合 1 合成不受影响（placeUnit 校验）
- **折中紫罗兰官方风 UI**（2026-09 UI 全面改版定稿：紫罗兰中明度底 + 深蓝紫半透明卡片 + 金色强调 + 钻石/六边形/菱形几何语言，设计 token 见 `src/style.css` :root），禁止暗黑主题回潮；最小字号 ≥13.5px、按钮 `white-space: nowrap`、顶栏不得溢出（历史上因字号过大/过小各翻车过一次，改动字号必须截图验收顶栏）
- 沉浸式全屏已实现（MainActivity 隐藏状态栏），勿动
- 战斗演出：**我方左侧近景/敌人右侧远景（2026-09 按官方截图原向翻转，勿改回镜像）**、行动条左上竖排（整体下移避开顶部横幅）、战技点右下、技能名横幅；后台支援栏在画面左下（与我方底排 HUD 已脱开，动 y 坐标需复查）；Canvas 1440×674（高=720-46 顶条），改尺寸必须与 CSS 保持 1:1 防变形；舞台 1440×720（2:1）
- 图标一律用 `src/ui/icons.ts` 内联 SVG（金币/心形/六边形羁绊框/费用色环头像/装备菱形/品质宝石等），新图标先进图标库，禁止退回裸 emoji 当图标

## 常用命令

```bash
npx tsc --noEmit && npx vitest run   # 类型 + 全部测试（改动后必跑；含 balance/soak）
npm run build                        # 产出 dist/
(npx vite --port 5174 &)             # 浏览器试玩 http://localhost:5174
source tools/env.sh                  # 提供 JAVA_HOME/ANDROID_HOME
cd android && ./gradlew assembleDebug  # 本地出 APK（debug 签名）
# 发版（CI 自动构建 Release APK）：
git tag vX.Y.Z && git push origin vX.Y.Z
```

调试钩子：浏览器访问 `?debug`，控制台 `__game.st`（对局状态引用）、`__game.setPhase(p)`、`__game.cheat()`。
浏览器 UI 验收用应用内浏览器（WebFetch 会被反爬拦截；米游社/B站正文必须用浏览器渲染后抽取）。
提交风格：conventional commits 中文（feat/fix/test/docs），一个逻辑改动一个提交。

## 发布流程

改动 → tsc+vitest → commit → push main → `git tag vX.Y.Z && git push origin vX.Y.Z` → `gh run watch` 盯 CI → 验证 Release 资产（`gh release view vX.Y.Z`）。版本号从 v0.1.4 起递增；平衡验证不过（bot 胜率出带）不发布。
