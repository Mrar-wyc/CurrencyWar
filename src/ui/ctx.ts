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
  overclock: boolean;
}

export interface AppCtx {
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

/**
 * 对局界面（备战/战斗/奖励/策略/环境/结算）用的上下文：`st` 一定非空。
 *
 * 菜单/图鉴/玩法说明只接 `AppCtx`，因此**在类型层面就读不到对局状态**——
 * 此前 `st` 是必填字段且菜单阶段仍留着上一局的对象（`goMenu` 不清），
 * 新写的菜单代码一旦读它就会拿到一份已脱离存档的旧状态。
 */
export type GameCtx = AppCtx & { st: MatchState };
