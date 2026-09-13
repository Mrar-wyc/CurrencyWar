import type { BattleInput } from '../logic/battle-build';
import type { MatchState } from '../logic/types';
import type { SaveData } from '../game/save';

export interface Selection {
  kind: 'unit' | 'equip';
  id: string;
  idx?: number;
}

export interface FinishSummary {
  victory: boolean;
  rankGain: number;
  newRank: number;
  hp: number;
  wins: number;
  losses: number;
  bestStreak: number;
  threeStars: number;
}

export interface AppCtx {
  st: MatchState;
  save: SaveData;
  /** 全量重绘当前界面 */
  refresh(): void;
  goMenu(): void;
  /** 备战界面点"出战"后调用 */
  onBattleStart(input: BattleInput): void;
  /** 战斗界面结算完成点"继续"后调用（allyDeaths 供"无伤通关"类策略判定） */
  onBattleDone(win: boolean, enemyActions: number, limit: number, remaining: number, allyDeaths?: number): void;
  /** 当前选中项 */
  uiSel(): Selection | null;
  setSel(s: Selection | null): void;
  /** 主菜单动作 */
  resume(): void;
  newGame(): void;
  showCodex(): void;
  showCodexTab(tab: 'char' | 'trait' | 'equip' | 'enemy'): void;
  showHelp(): void;
  backToMenu(): void;
}

/** 界面级易变状态（不进存档） */
export const ui: {
  sel: Selection | null;
  finishSummary: FinishSummary | null;
} = {
  sel: null,
  finishSummary: null
};
