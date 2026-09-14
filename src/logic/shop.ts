import { CHARACTERS, POOL_COPIES } from '../data/characters';
import { MATCH_CONFIG as CFG, SHOP_ODDS } from '../data/stages';
import type { ShopOffer } from './types';

/** 初始化共享牌池 */
export function createPool(): Record<string, number> {
  const pool: Record<string, number> = {};
  for (const c of CHARACTERS) pool[c.id] = POOL_COPIES[c.cost];
  return pool;
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function rollCost(level: number): number {
  const odds = SHOP_ODDS[Math.min(level, 10)];
  const total = odds.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

/** 按概率摇一个费用，并从该费用中有剩余复制的角色里随机取一个 */
function pickChar(level: number, pool: Record<string, number>, used: Set<string>, factionBias?: string): string | null {
  // 依次尝试：概率费用 → 逐级回退到 1 费
  let cost = rollCost(level);
  const fallbacks = [cost, 4, 3, 2, 1];
  for (const c of fallbacks) {
    const candidates = CHARACTERS.filter(x => x.cost === c && (pool[x.id] ?? 0) > 0 && !used.has(x.id));
    if (candidates.length > 0) {
      // 概念股阵营加权：bias 阵营角色权重 ×2.5
      if (factionBias) {
        const weights = candidates.map(x => (x.faction === factionBias ? 2.5 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        for (let i = 0; i < candidates.length; i++) {
          roll -= weights[i];
          if (roll <= 0) return candidates[i].id;
        }
      }
      const picked = candidates[randInt(candidates.length)];
      return picked.id;
    }
  }
  return null;
}

/** 摇一屏商店（从牌池取出复制） */
export function rollShop(level: number, pool: Record<string, number>, factionBias?: string): ShopOffer[] {
  const offers: ShopOffer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < CFG.shopSize; i++) {
    const id = pickChar(level, pool, used, factionBias);
    if (!id) {
      offers.push({ charId: null });
      continue;
    }
    used.add(id);
    pool[id] = (pool[id] ?? 0) - 1;
    offers.push({ charId: id });
  }
  return offers;
}

/** 把未购买的商品放回牌池 */
export function returnOffers(pool: Record<string, number>, offers: ShopOffer[]): void {
  for (const o of offers) {
    if (o.charId) pool[o.charId] = (pool[o.charId] ?? 0) + 1;
  }
}
