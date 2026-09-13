---
name: currency-wars-dev
description: 崩铁「货币战争·零和博弈」单机自走棋项目的专属开发技能。凡在本仓库做任何开发——添加/修改角色羁绊装备数据、调整平衡、改战斗引擎或UI、修bug、打包APK、发版本——都必须先加载本技能。触发词包括：货币战争、自走棋、角色/羁绊/装备/策略、上阵/站位、羁绊效果、APK、发版、官方规则。
---

# 货币战争·零和博弈 开发技能

崩坏：星穹铁道「货币战争·零和博弈」玩法的单机自走棋同人复刻（安卓 APK）。
技术栈：Vite + TypeScript + Canvas 2D（零运行时依赖）+ Capacitor 7；vitest 单测；GitHub Actions 云端打包。

## 第一步：按任务类型读取参考文件

| 任务 | 必读 |
|---|---|
| 任何平衡/数值/规则相关改动 | `references/rules-cheatsheet.md`（浓缩规则速查） |
| 添加角色/羁绊/装备/策略内容 | `references/content-library.md`（官方内容库与 MVP 差距） |
| 规划新系统/大版本功能 | `references/roadmap.md`（v0.2+ 优先级与设计决策） |
| 规则细节存疑 | 读 `docs/官方规则详解.md`（27 章完整调研，本项目唯一规则权威） |

## 项目结构与铁律

```
src/data/     全部内容数据表（characters/traits/equipment/enemies/stages）——加内容只改这里
src/logic/    纯函数游戏逻辑（economy/shop/synergy/battle-build/types）——必须保持无 UI 依赖、可单测
src/battle/   战斗纯引擎(engine.ts，产出事件流) + Canvas 回放渲染器(renderer.ts)
src/game/     对局状态机(match.ts) + 存档(save.ts)
src/ui/       DOM 界面（prep/battle/menu/overlays/codex/help）——禁止在此写游戏规则
docs/         官方规则详解（调研权威）
tests/        vitest（core 单测 + bot.ts 自动对局机器人 + balance.test.ts 平衡验证）
android/      Capacitor 工程；tools/ 本机 JDK21+SDK（env.sh）；.github/workflows 云端打包
```

铁律：
1. **数据表驱动**：加角色 = 在 `characters.ts` 加一条 CharDef；逻辑层不出现具体角色名硬编码
2. **逻辑可测**：经济/商店/升星/羁绊/战斗全部是纯函数；改规则必须同步补/改 `tests/core.test.ts` 并跑 `npx vitest run`（含 bot 40 局平衡验证，胜率健康区间约 60~85%）
3. **战斗逻辑与表现分离**：引擎只产出 `BattleEvent[]`，渲染器消费事件回放；新演出效果加在 renderer
4. **规则以 docs/官方规则详解.md 为准**：已知的官方未公开数值（刷新 2 金、经验 4 金/4exp 等）标注 ⚠️ 近似，不要臆造"官方数值"

## 已确认的设计红线（来自用户反馈，勿回退）

- **同名角色只能上阵一个**（前台+后台合计），3 合 1 合成不受影响（placeUnit 校验）
- **亮紫官方风 UI**，禁止暗黑主题回潮；最小字号 ≥13.5px、按钮 `white-space: nowrap`、顶栏不得溢出（历史上因字号过大/过小各翻车过一次，改动字号必须截图验收顶栏）
- 沉浸式全屏已实现（MainActivity 隐藏状态栏），勿动
- 战斗演出：我方右侧近景/敌人左侧远景、行动条左上竖排、战技点右下、技能名横幅

## 常用命令

```bash
npx tsc --noEmit && npx vitest run   # 类型 + 全部测试（改动后必跑）
npm run build                        # 产出 dist/
(npx vite --port 5174 &)             # 浏览器试玩 http://localhost:5174
source tools/env.sh                  # 提供 JAVA_HOME/ANDROID_HOME
cd android && ./gradlew assembleDebug  # 本地出 APK（debug 签名）
# 发版（CI 自动构建 Release APK）：
git tag vX.Y.Z && git push origin vX.Y.Z
```

调试钩子：浏览器访问 `?debug`，控制台 `__game.setPhase('victory')`、`__game.cheat()`。
浏览器 UI 验收用应用内浏览器（WebFetch 会被反爬拦截；米游社/B站正文必须用浏览器渲染后抽取）。

## 发布流程

改动 → tsc+vitest → commit → push main → `git tag vX.Y.Z && git push origin vX.Y.Z` → `gh run watch` 盯 CI → 验证 Release 资产（`gh release view vX.Y.Z`）。版本号从 v0.1.4 起递增。
