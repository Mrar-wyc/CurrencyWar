import { ENVIRONMENTS, ADVISOR_PREFIX } from '../data/environments';
import type { MatchState, TeamFlags } from './types';

export function hasEnvironment(st: MatchState, id: string): boolean {
  return st.environments.includes(id);
}

/** 投资环境三选一：每条独立按 银70%/金30% 摇档，同屏不重复（模式同 rollStrategyOffers） */
export function rollEnvironmentOffers(): string[] {
  const offers: string[] = [];
  const used = new Set<string>();
  while (offers.length < 3) {
    const grade: 'silver' | 'gold' = Math.random() < 0.7 ? 'silver' : 'gold';
    const pool = ENVIRONMENTS.filter(e => e.grade === grade && !used.has(e.id));
    const fallback = ENVIRONMENTS.filter(e => !used.has(e.id));
    const list = pool.length ? pool : fallback;
    if (!list.length) break;
    const picked = list[Math.floor(Math.random() * list.length)];
    used.add(picked.id);
    offers.push(picked.id);
  }
  return offers;
}

/**
 * 环境的全队战斗加成（特邀专家随行增益 + 进化算法叠层）。
 * 在 buildBattleInput 中与 strategyTeamFlags 并列合并进 TeamFlags。
 */
export function environmentTeamFlags(st: MatchState): Partial<TeamFlags> {
  const flags: Partial<TeamFlags> = {};
  const add = (k: keyof TeamFlags, v: number): void => {
    (flags as Record<string, number>)[k] = ((flags as Record<string, number>)[k] ?? 0) + v;
  };
  for (const id of st.environments) {
    if (id === 'advisor_sangbo') add('dotAmp', 0.15);
    else if (id === 'advisor_blade') add('atkPct', 0.08);
    else if (id === 'advisor_pela') add('onKillAtk', 0.10);
    else if (id === 'advisor_himeko') add('ultCharge', 0.15);
    else if (id === 'evolution') {
      const stacks = st.environmentData.evolution ?? 0;
      add('atkPct', 0.03 * stacks);
      add('hpPct', 0.03 * stacks);
      add('dmgReduce', 0.02 * stacks);
    }
  }
  return flags;
}

/** 已采纳的顾问环境 id 列表（情报面板展示用） */
export function advisorsOf(st: MatchState): string[] {
  return st.environments.filter(id => id.startsWith(ADVISOR_PREFIX));
}
