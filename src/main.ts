import './style.css';
import { Capacitor } from '@capacitor/core';
import { finishMatch, loadSave, persistMatch } from './game/save';
import { newMatch, resolveBattle } from './game/match';
import type { BattleInput } from './logic/battle-build';
import type { MatchState } from './logic/types';
import type { AppCtx, FinishSummary, Selection } from './ui/ctx';
import { renderMenu } from './ui/menu';
import { renderPrep } from './ui/prep';
import { renderBattle } from './ui/battle';
import { renderGameOver, renderReward, renderSupply, renderVictory } from './ui/overlays';
import { renderStrategy } from './ui/strategy';
import { renderEnvironment } from './ui/environment';
import { renderCodex } from './ui/codex';
import { renderHelp } from './ui/help';
import { clear, h } from './ui/dom';

type Screen = 'menu' | 'game' | 'codex' | 'help';

const save = loadSave();
let screen: Screen = 'menu';
let codexTab: 'char' | 'trait' | 'equip' | 'enemy' = 'char';
let st: MatchState | null = save.current;
let pendingBattle: BattleInput | null = null;
const uiState: { sel: Selection | null; finishSummary: FinishSummary | null } = {
  sel: null,
  finishSummary: null
};

async function lockOrientation(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const mod = await import('@capacitor/screen-orientation');
      await mod.ScreenOrientation.lock({ orientation: 'landscape' });
    }
  } catch {
    /* 浏览器环境忽略 */
  }
}

function requireSt(): MatchState {
  if (!st) throw new Error('对局不存在');
  return st;
}

const ctx: AppCtx = {
  st: null!,
  save,
  refresh: render,
  goMenu: () => {
    st = null;
    pendingBattle = null;
    uiState.sel = null;
    screen = 'menu';
    render();
  },
  onBattleStart: input => {
    pendingBattle = input;
    persistMatch(save, requireSt());
    render();
  },
  onBattleDone: (win, ticks, limit, remaining, allyDeaths) => {
    resolveBattle(requireSt(), win, ticks, limit, remaining, allyDeaths ?? 0);
    pendingBattle = null;
    uiState.sel = null;
    persistMatch(save, requireSt());
    render();
  },
  uiSel: () => uiState.sel,
  setSel: s => {
    uiState.sel = s;
  },
  resume: () => {
    if (!save.current) return;
    st = save.current;
    screen = 'game';
    uiState.finishSummary = null;
    render();
  },
  newGame: () => {
    st = newMatch();
    screen = 'game';
    uiState.finishSummary = null;
    uiState.sel = null;
    persistMatch(save, st);
    render();
  },
  showCodex: () => {
    screen = 'codex';
    render();
  },
  showCodexTab: tab => {
    codexTab = tab;
    render();
  },
  showHelp: () => {
    screen = 'help';
    render();
  },
  backToMenu: () => {
    screen = 'menu';
    render();
  }
};

/** 上次渲染的「屏幕:阶段」key——仅变化时播淡入动画，点击刷新不重播防屏闪 */
let lastRenderKey = '';

function render(): void {
  const app = document.getElementById('app')!;
  clear(app);
  const key = `${screen}:${st?.phase ?? ''}:${pendingBattle ? 'battle' : ''}`;
  const changed = key !== lastRenderKey;
  lastRenderKey = key;
  const stage = h('div', { class: `stage${changed ? ' stage-anim' : ''}` });
  app.append(stage);
  fitStage();

  if (screen === 'codex') {
    renderCodex(stage, ctx, codexTab);
    return;
  }
  if (screen === 'help') {
    renderHelp(stage, ctx);
    return;
  }
  if (screen === 'menu' || !st) {
    renderMenu(stage, ctx);
    return;
  }

  ctx.st = st;

  // 对局结束：一次性结算职级
  if ((st.phase === 'victory' || st.phase === 'gameOver') && !uiState.finishSummary) {
    const { rankGain, newRank } = finishMatch(save, st);
    uiState.finishSummary = {
      victory: st.phase === 'victory',
      rankGain,
      newRank,
      hp: st.hp,
      wins: st.battlesWon,
      losses: st.battlesLost,
      bestStreak: st.bestWinStreak,
      threeStars: st.threeStarsMade
    };
  }
  const summary = uiState.finishSummary;

  switch (st.phase) {
    case 'prep':
      persistMatch(save, st);
      renderPrep(stage, ctx);
      break;
    case 'battle':
      if (pendingBattle) renderBattle(stage, ctx, pendingBattle);
      else renderPrep(stage, ctx);
      break;
    case 'reward':
      persistMatch(save, st);
      renderReward(stage, ctx);
      break;
    case 'strategy':
      persistMatch(save, st);
      renderStrategy(stage, ctx);
      break;
    case 'environment':
      persistMatch(save, st);
      renderEnvironment(stage, ctx);
      break;
    case 'supplyResult':
      persistMatch(save, st);
      renderSupply(stage, ctx);
      break;
    case 'gameOver':
      if (summary) renderGameOver(stage, ctx, summary);
      break;
    case 'victory':
      if (summary) renderVictory(stage, ctx, summary);
      break;
  }
}

function fitStage(): void {
  const stage = document.querySelector('.stage') as HTMLElement | null;
  if (!stage) return;
  const s = Math.min(window.innerWidth / 1440, window.innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  let rotate = document.getElementById('rotate-hint');
  if (window.innerHeight > window.innerWidth * 1.05) {
    if (!rotate) {
      rotate = h('div', { id: 'rotate-hint' }, '📱 请横屏游玩');
      document.body.append(rotate);
    }
  } else if (rotate) {
    rotate.remove();
  }
}

window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', fitStage);

// 调试钩子：?debug 下暴露对局状态控制（仅开发用）
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__game = {
    get st() {
      return st;
    },
    setPhase(p: string): void {
      if (st) {
        (st as unknown as { phase: string }).phase = p;
        uiState.finishSummary = null;
        render();
      }
    },
    cheat(): void {
      if (!st) return;
      st.gold = 999;
      st.level = 9;
      st.hp = 100;
      render();
    }
  };
}

lockOrientation();
render();
fitStage();
