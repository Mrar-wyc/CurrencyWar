# 平衡调参与测试体系

## 测试套件一览

| 测试 | 文件 | 口径 | 耗时 |
|---|---|---|---|
| 类型检查 | `npm run typecheck` | tsc strict（含 tests/） | ~2s |
| 规则单测（97 项） | `tests/core.test.ts` | 商店/站位/经济/装备/星徽羁绊/宝钻/后台/策略/引擎/倒计时/词缀/节点/存档 | ~60ms |
| 跨文件护栏（5 项） | `tests/guards.test.ts` | 画布与 CSS 1:1、画布+顶条=舞台高、舞台与 fitStage 基准、费用色双轨、扣血档位 | ~5ms |
| 平衡测试 | `tests/balance.test.ts` | bot 40 局，断言胜率 15%~98%、至少打到位面二 | ~170ms |
| soak 不变量 | `tests/soak.test.ts` | bot 300 局，逐步断言状态合法 + 终止分布断言，胜率宽带 40%~98% | ~5s |
| 单局诊断 | `tests/diag.test.ts` | 打印一场完整对局逐节点双方数值（调参用眼），并断言"确实跑完整局" | ~20ms |

全量命令：`npm run typecheck && npm test && npm run build`（`npm test` 默认跑全部 5 个文件 = 105 项）

bot 策略（`tests/bot.ts`）：优先买经验到 7 级 → 买光买得起的棋子（贵者优先）→ 满编站位（前 6 后 4）→ 装备轮穿 → 简易两两合成 → 富余刷新再买。策略节点按 prefer 列表选（lucky_dog/simple_mode/promo4/hyperinflation/middle_class，否则取第一个）。

## 不变量清单（soak 逐步断言，新机制不得破坏）

hp∈[0,100] 且有限；gold≥0 且有限；level∈[3,10]；board.length≤level；bench≤9；board 内 charId 唯一（同名唯一上阵）；星级∈{1,2,3}；每人装备≤3；strategies≤5；strategy 阶段 offers 恰好 3 条且不重复；phase 恒合法；对局必然终止。

终止方式也要断言：`playMatch` 返回 `end`（victory/gameOver/noFront/stepCap/unknownPhase）与 `steps`，soak 要求 300 局里 stepCap/noFront/unknownPhase 均为 0。**此前只数 `finished++`，步数上限空转会被当成"合法负局"静默通过**——新增 phase 分支时务必确认 bot 循环覆盖到了它（`environment` 阶段就这样漏过一次：diag 循环 400 步空转、且无断言所以测试仍绿）。

加新机制时先想清楚它会不会打破某条不变量（例如"卖光"类策略清空 board 是合法的；4★ 一旦实装需同步改星级断言）。同理，**改动只在文档里写的耦合**（画布与 CSS 尺寸、费用色双轨、舞台与 fitStage 基准）现在由 `tests/guards.test.ts` 兜底，改一边漏另一边会直接测试失败（1px 漂移即可捕获）。

## 调参历史（引以为鉴）

- 策略实装前：bot 胜率约 70%。
- 策略实装后：飙到 98-100%（卡在断言带上，结果不稳定）。原因：每局 5 条策略是纯增益，bot 曲线整体上移。
- 修复（对应官方 §23"策略抬高难度"）：每条已采纳金策略敌人属性 +4%（`strategyEnemyMult`）+ 位面二 1.75→1.9、位面三 2.7→2.9 / 2.85→3.1、可可利亚 mul 1.0→1.15。
- 现状：balance 连跑 4 次 85%~93%，soak 300 局 80%~82%。
- 路线④（角色池 24+费用校准）：55%~65%，无需调参——牌池变化被官方概率表吸收。
- 路线⑤（星徽+装备池+羁绊扩档+宝钻）：45%/65%/68%（均值 ≈59%），soak 通过，无需调参——玩家强度提升量级小于采样噪声，未触及回调。
- 路线⑥（行动值倒计时）：**首版静态预算胜率崩到 7.5%**——静态预算不随减员重算，敌方减员后旧时钟拉长而预算提前到点，把能赢的战斗提前掐死；改动态重算（预算随存活权重重算）后 6 次 68%~80%（均值 ≈73.5%）。教训：**改变时限语义时必须验证「减员路径」下的等价性，不能只看开局编队**。
- 路线⑦（词缀难度）：初版 33%~48%（33% 触线）→ 收窄三个纯数值词缀（皮糙 30→20/软弱 20→15/额外打击 6→4）后 40%~60%。教训：**新词缀先上保守数值，机制型词缀（时限/行动条/免死）比数值型词缀对胜率的影响更难预估**。
- 路线⑧（超频/环境/公司）：常规局零漂移（bot 默认关超频）。
- v0.2.1 质量轮（仅测试/文档/存档防御/渲染演出，未动数值）：balance 57/70/73/48/60%（5 次），soak 60.3~66.3%，**与改动前无系统性差异**——可作为"非数值改动不应动平衡"的对照基线。
- **采样噪声量级**：同一份代码连测 4 次即可见 48%~73%（≈25pp）跨度，故**单次 40 局结果不足以判断回调**，必须按下面的"每档重跑 3 次"执行；括号内断言带宽（15%~98%）正是为此设的宽。


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

标准冒烟路径（注意：`newMatch()` 开局就进 `environment` 三选一，不是直接备战）：新局 → **投资环境三选一 → 采纳** → 备战（`cheat()` 后买满棋子、前台 6 + 后台 3、穿装备）→ 出战 → 战斗画面（行动条/横幅/战技点/**后台支援栏**/飘字）→ 结算 → 继续 → 策略三选一 → 采纳 → 奖励节点 → 领取 → 再战 → 补给节点。

覆盖清单（改 UI 后逐屏截图核对）：菜单（含超控解锁态）/ 图鉴四页（含敌人页底部「晋升词缀」卡）/ 玩法说明 / 环境三选一 / 备战（情报面板 + 角色详情）/ 顶栏特写 / 战斗 / 结算 / 策略 / 奖励 / 补给 / 对局结束 / 通关胜利。截图按 1440×720 视口（`fitStage` 缩放在该尺寸恰为 1.0），存 `.ui-shots/`（已 gitignore）。

要点：
- 截屏前**先 `localStorage.clear()` 再刷新**，否则菜单会变成「继续对局 / 新的一局」、备战直接续档
- 每次切屏/切阶段后等 ≥300ms 再截（`.stage-anim` 淡入 0.18s，抢在动画中截图会整屏发虚）
- **宽裁剪截图不可靠**（该后端在 1440px 宽的 clip 上会拼出幻影图形）：需要顶栏特写时改用 DOM 放大——把 `.stage` 的 `transform` 临时改成 `scale(2)`（配 `transform-origin:0 0`、`left/top:0`）分左右两半各截一张，截完还原
- 画布内演出（飘字/后台支援栏）无法用 DOM 断言，只能靠截图目检
- 路线⑤ 补充：注入 `e_express` 穿戴 → 羁绊面板计数 +1 并激活档位；置 `st.wealthGem=true` → 后台 5 格、情报面板宝钻行；图鉴装备页 41 卡（★10）

## 旧档迁移测试（动存档必测）

MatchState 每加新字段，`save.ts` 的 `migrateMatch` 必须补迁移（默认值/合法 id 过滤/非法 phase 回退）。数值字段同样要防御：`hp/gold/level/exp/各种计数器` 用统一 `num()` 钳回合法区间（NaN/负数/越界；**生命下限钳 1 而不是 0**——0 血档已由 `loadSave` 弃档），并保证 `board.length ≤ level`、`bench ≤ 9` 这两条规模不变量在载入后成立。测试方法（浏览器）：

1. 开新局生成新格式存档（或正常玩到目标阶段）
2. 控制台剥掉新字段模拟旧档：`const r=JSON.parse(localStorage.getItem('currencywars_save_v1')); delete r.current.新字段; localStorage.setItem('currencywars_save_v1', JSON.stringify(r))`
3. 刷新页面 → 点"继续对局" → 验证无崩溃、字段补齐
4. 中断续玩类 phase（如 strategy）另外测：到达该阶段 → 刷新 → 继续对局 → 界面与数据完整恢复
5. 测完 `localStorage.clear()`

## 构建与发布

- `npm run build` 产出 dist/；`npx cap sync android` 同步；`cd android && ./gradlew assembleDebug` 打 APK
- CI：`.github/workflows/android-build.yml` 推送自动构建并发 Release；APK 只从 Releases / Actions Artifacts 获取（仓库内不存 APK，`*.apk` 已 gitignore）
- **版本号三处必须同步**：`package.json`、`android/app/build.gradle` 的 `versionName`/`versionCode`、git tag。`versionCode` 漏加会让侧载更新不被识别为升级（历史上 0.1.5 之后漏了 4 个版本，v0.2.1 才补齐）
