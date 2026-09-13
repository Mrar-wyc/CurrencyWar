# 货币战争·零和博弈 — 单机自走棋（同人）

[![Android Build](https://github.com/Mrar-wyc/CurrencyWar/actions/workflows/android-build.yml/badge.svg)](https://github.com/Mrar-wyc/CurrencyWar/actions/workflows/android-build.yml)

基于《崩坏：星穹铁道》「货币战争·零和博弈」玩法还原的**单机自走棋小游戏**，
横屏安卓 APK，本地运行、无需联网。**同人作品，仅供个人学习交流，请勿商用。**
崩坏：星穹铁道 © miHoYo / HoYoverse。

## 安卓安装

**方式一（推荐）**：到 [Releases](https://github.com/Mrar-wyc/CurrencyWar/releases) 下载最新的 `CurrencyWar-debug.apk`。

**方式二**：到 [Actions](https://github.com/Mrar-wyc/CurrencyWar/actions/workflows/android-build.yml) 手动触发或选择最近一次构建，在页面底部 Artifacts 下载 `CurrencyWar-APK`。

1. 把 APK 传到安卓手机（微信/QQ/数据线均可）
2. 点击安装（需允许"安装未知来源应用"）
3. 要求 Android 7.0+，横屏游玩

## 玩法速览

- **目标**：穿越 3 个位面（战斗/奖励/补给/首领节点），击败最终首领通关
- **招募**：商店买 1~5 费角色，3 个同名自动升星（1★→2★→3★）
- **经济**：每战基础收入 5 + 持币利息（每 10 金 +1，上限 5）+ 连胜奖励
- **等级**：买经验（4金+4exp）提升等级 = 上阵总数；前台参战、后台激活羁绊+全队 +4% 攻/血
- **战斗**：自动进行。行动条制（速度决定出手）；全队共享战技点（普攻+1/战技-1）；
  能量满放终结技；敌方行动次数耗尽未清场判负，扣小队生命
- **羁绊**：4 阵营（列车同行/仙舟/贝洛伯格/星核猎手）+ 6 流派（群攻/爆发/追击/治疗/护盾/持续伤害），人数分档激活
- **装备**：奖励/补给节点掉落；每角色 3 件；任意 2 件简易在背包点击合成进阶
- **职级**：通关按剩余生命评价晋升（黑铁 → … → 财富造物主），进度本地存档

16 名角色 / 11 种敌人（3 位面首领）/ 14 种装备 / 手工设计的 3 位面难度曲线。
数值为近似还原：原版未公开的数值（刷新价、经验价、利息率）参考同类自走棋成熟方案。

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 浏览器试玩 http://localhost:5173
npm test             # vitest 单测 + 自动对局平衡验证（机器人 40 局）
npm run build        # 产出 dist/
npx cap sync android # 同步 Web 资源到安卓工程
cd android && ./gradlew assembleDebug   # 打 APK
```

- 技术栈：Vite + TypeScript + Canvas 2D（零运行时依赖）+ Capacitor 7
- 结构：`src/data`（角色/羁绊/装备/敌人/关卡数据表）· `src/logic`（经济/商店/升星/羁绊，纯函数可单测）
  · `src/battle`（战斗引擎 + Canvas 回放渲染器）· `src/game`（对局状态机/存档）· `src/ui`（六大界面）
- 本机工具链：JDK 21 与 Android SDK 位于 `tools/`（`source tools/env.sh` 后可直接用 gradle/adb）
- 调试钩子：浏览器访问 `?debug`，控制台 `__game.setPhase('victory')`、`__game.cheat()`

## 免责声明

本项目为玩家自制同人作品，与 miHoYo/HoYoverse 无关。游戏内角色名称等素材版权归原权利方所有，
仅用于个人学习交流，禁止商业用途或公开分发。
