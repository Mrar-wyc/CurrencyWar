# 平衡调参与测试体系

## 测试套件一览

| 测试 | 文件 | 口径 | 耗时 |
|---|---|---|---|
| 类型检查 | `npm run typecheck` | tsc strict | ~2s |
| 规则单测（41 项） | `tests/core.test.ts` | 商店/站位/经济/装备/羁绊/后台/策略/引擎/节点 | ~30ms |
| 平衡测试 | `tests/balance.test.ts` | bot 40 局，断言胜率 15%~98%、至少打到位面二 | ~120ms |
| soak 不变量 | `tests/soak.test.ts` | bot 300 局，逐步断言状态合法，胜率宽带 40%~98% | ~3.3s |
| 单局诊断 | `tests/diag.test.ts` | 打印一场完整对局逐节点双方数值（调参用眼） | ~15ms |

全量命令：`npm run typecheck && npm test && npm run build`

bot 策略（`tests/bot.ts`）：优先买经验到 7 级 → 买光买得起的棋子（贵者优先）→ 满编站位（前 6 后 4）→ 装备轮穿 → 简易两两合成 → 富余刷新再买。策略节点按 prefer 列表选（lucky_dog/simple_mode/promo4/hyperinflation/middle_class，否则取第一个）。

## 不变量清单（soak 逐步断言，新机制不得破坏）

hp∈[0,100] 且有限；gold≥0 且有限；level∈[3,10]；board.length≤level；bench≤9；board 内 charId 唯一（同名唯一上阵）；星级∈{1,2,3}；每人装备≤3；strategies≤5；strategy 阶段 offers 恰好 3 条且不重复；phase 恒合法；对局必然终止（victory/gameOver）。

加新机制时先想清楚它会不会打破某条不变量（例如"卖光"类策略清空 board 是合法的；4★ 一旦实装需同步改星级断言）。

## 调参历史（引以为鉴）

- 策略实装前：bot 胜率约 70%。
- 策略实装后：飙到 98-100%（卡在断言带上，结果不稳定）。原因：每局 5 条策略是纯增益，bot 曲线整体上移。
- 修复（对应官方 §23"策略抬高难度"）：每条已采纳金策略敌人属性 +4%（`strategyEnemyMult`）+ 位面二 1.75→1.9、位面三 2.7→2.9 / 2.85→3.1、可可利亚 mul 1.0→1.15。
- 现状：balance 连跑 4 次 85%~93%，soak 300 局 80%~82%。

经验：**大幅给玩家加成的新系统，必须同时有对冲的难度机制**，否则平衡带必然击穿；且回调优先改"数值"而不是改"结构"。

## 出带回调顺序（从改动面小到大）

1. 收窄本次新增的效果数值（flags 百分比、策略收益）
2. `engine.ts` `BACK_CAST_SPD_FACTOR` 0.4→0.35（全体后台变弱，影响所有后台型阵容）
3. `stages.ts` 位面二/三 mul ±5%（普适加压/减压，最后手段）

胜率偏低反向操作。每档改完重跑 balance 3 次确认稳定。所有调整记入 `docs/开发进度.md` §五（改了什么、为什么、前后数值）。

## 浏览器冒烟与调试钩子

```bash
npm run dev   # http://localhost:5173
```

加 `?debug` 后控制台可用：

- `__game.st` — 对局状态对象（可直接改字段后 `__game.setPhase('prep')` 触发重绘）
- `__game.setPhase(p)` — 跳 phase；`__game.cheat()` — 999 金/9 级/满血

标准冒烟路径：新局 → 注入棋子/首胜 → 策略三选一 → 采纳 → 备战出战 → 战斗画面（后台支援栏/横幅/飘字）→ 结算。注意：改完 `localStorage.clear()` 防污染本地档。

## 旧档迁移测试（动存档必测）

MatchState 每加新字段，`save.ts` 的 `migrateMatch` 必须补迁移（默认值/合法 id 过滤/非法 phase 回退）。测试方法（浏览器）：

1. 开新局生成新格式存档（或正常玩到目标阶段）
2. 控制台剥掉新字段模拟旧档：`const r=JSON.parse(localStorage.getItem('currencywars_save_v1')); delete r.current.新字段; localStorage.setItem('currencywars_save_v1', JSON.stringify(r))`
3. 刷新页面 → 点"继续对局" → 验证无崩溃、字段补齐
4. 中断续玩类 phase（如 strategy）另外测：到达该阶段 → 刷新 → 继续对局 → 界面与数据完整恢复
5. 测完 `localStorage.clear()`

## 构建与发布

- `npm run build` 产出 dist/；`npx cap sync android` 同步；`cd android && ./gradlew assembleDebug` 打 APK
- CI：`.github/workflows/android-build.yml` 推送自动构建并发 Release；仓库根目录的 debug APK 是历史产物，以 Releases 为准
