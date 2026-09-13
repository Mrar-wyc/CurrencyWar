import type {
  BattleEvent, BattleResult, CombatUnit, Dot, HitInfo, Side, SkillDef
} from '../logic/types';
import type { BattleInput } from '../logic/battle-build';

const AV = 10000;
/** 后台施技速度档：后台单位以 速度×此系数 的节奏周期施放后台赋能（平衡调节旋钮） */
const BACK_CAST_SPD_FACTOR = 0.4;

function rand(): number {
  return Math.random();
}

function effSpd(u: CombatUnit): number {
  let s = u.spd;
  for (const b of u.buffs) if (b.spdPct) s *= 1 + b.spdPct;
  return Math.max(30, s);
}

function effAtk(u: CombatUnit): number {
  let a = u.atk;
  for (const b of u.buffs) if (b.atkPct) a *= 1 + b.atkPct;
  a *= 1 + u.killStacks * u.unitFlags.onKillAtk;
  a *= 1 + u.attackStacks * u.unitFlags.onHitAtk;
  return a;
}

function effDef(u: CombatUnit): number {
  let d = u.def;
  for (const b of u.buffs) if (b.defPct) d *= 1 + b.defPct;
  return d;
}

/**
 * 纯逻辑战斗模拟：行动条制 + 共享战技点。
 * 产出事件流供渲染器回放；调用方须传入全新复制的单位（引擎会原地修改）。
 */
export function simulateBattle(input: BattleInput): BattleResult {
  const { allies, enemies } = input;
  const backers = input.backers ?? [];
  const tf = input.teamFlags;
  const all = [...allies, ...enemies, ...backers];
  const events: BattleEvent[] = [];
  /**
   * 行动值倒计时（双方每次行动 -1，耗尽判负）：按存活编队的速度权重动态换算
   * 「敌方行动上限」—— budget = 上限 × Σ存活权重 / Σ存活敌方权重（后台 ×0.4）。
   * 单位阵亡即时重算：敌方减员→预算拉伸、我方减员→预算收缩，与旧「敌方行动计数」
   * 制在一阶上逐局等价（平衡零漂移）；追击/反击/神君/dot 等追加结算不消耗。
   */
  const budget = (): number => {
    let wAlly = 0;
    let wEnemy = 0;
    for (const a of allies) if (a.alive) wAlly += a.spd * (a.backend ? BACK_CAST_SPD_FACTOR : 1);
    for (const b of backers) if (b.alive) wAlly += b.spd * BACK_CAST_SPD_FACTOR;
    for (const e of enemies) if (e.alive) wEnemy += e.spd;
    if (wEnemy <= 0) return input.enemyActionLimit;
    return Math.max(1, Math.round((input.enemyActionLimit * (wAlly + wEnemy)) / wEnemy));
  };
  let lastClock = budget();
  let sp = Math.max(0, Math.min(input.spMax, input.spStart));
  const spMax = input.spMax;
  let ticks = 0;
  let win = false;
  const extraActions: string[] = [];

  const aliveOf = (side: Side): CombatUnit[] => (side === 'ally' ? allies : enemies).filter(u => u.alive);

  if (input.shieldPct > 0) {
    for (const a of allies) a.shield += Math.round(a.maxHp * input.shieldPct);
  }
  // 后台单位首次施技延后一个完整周期
  for (const b of backers) {
    b.nextActionAt = AV / (effSpd(b) * BACK_CAST_SPD_FACTOR);
  }
  events.push({ t: 'start', sp, spMax, countdown: lastClock, shieldPct: input.shieldPct });
  // 当头一棒：开战对生命最高的敌人造成策略伤害并减防
  const mods = input.strategyMods ?? {};
  if (mods.nuke && allies.length) {
    const power = Math.max(...allies.filter(a => a.alive).map(a => a.atk), 0);
    const target = enemies.filter(e => e.alive).reduce<CombatUnit | null>(
      (best, e) => (!best || e.hp > best.hp ? e : best), null);
    if (target && power > 0) {
      const hits: HitInfo[] = [applyDamage(target, power * mods.nuke.mult)];
      if (target.alive) target.buffs.push({ defPct: mods.nuke.defPct, turns: mods.nuke.turns });
      events.push({ t: 'act', uid: target.uid, kind: 'nuke', name: '当头一棒', sp, hits });
    }
  }
  // 风暴骑士：开战时 1 号位受到固定比例生命上限的伤害（官方原文歧义下的可用解读，docs 近似清单）
  if (mods.firstSelfHarmPct && allies.length && allies[0].alive) {
    const h = applyDamage(allies[0], Math.round(allies[0].maxHp * mods.firstSelfHarmPct));
    events.push({ t: 'act', uid: allies[0].uid, kind: 'selfharm', name: '风暴反噬', sp, hits: [h] });
  }

  const pushAct = (uid: string, kind: Extract<BattleEvent, { t: 'act' }>['kind'], name: string, hits: HitInfo[]) => {
    events.push({ t: 'act', uid, kind, name, sp, hits });
  };

  function applyDamage(target: CombatUnit, raw: number): HitInfo {
    let dmg = raw;
    const reduce = target.unitFlags.dmgReduce + (target.side === 'ally' ? tf.dmgReduce : 0);
    dmg *= 1 - Math.min(0.8, reduce);
    let remain = dmg;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remain);
      target.shield -= absorbed;
      remain -= absorbed;
    }
    target.hp = Math.max(0, target.hp - Math.round(remain));
    let died = false;
    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      died = true;
    }
    return { uid: target.uid, dmg: Math.round(dmg), hpAfter: target.hp, shieldAfter: Math.round(target.shield), died };
  }

  function onDeath(killer: CombatUnit | null, victim: CombatUnit): void {
    if (killer && killer.side === 'ally' && killer.alive) {
      if (killer.unitFlags.onKillAtk > 0) killer.killStacks = Math.min(3, killer.killStacks + 1);
      if (killer.passive.type === 'killReset') extraActions.push(killer.uid);
    }
  }

  function dealDamage(caster: CombatUnit, target: CombatUnit, mult: number): HitInfo {
    let dmg = effAtk(caster) * mult;
    const def = effDef(target);
    dmg *= 1 - def / (def + 320);
    let crit = false;
    const cr = caster.critRate + (caster.side === 'ally' ? tf.critRate : 0);
    if (rand() < cr) {
      crit = true;
      dmg *= caster.critDmg;
    }
    dmg *= 0.95 + rand() * 0.1;
    const hit = applyDamage(target, dmg);
    hit.crit = crit;
    if (target.side === 'ally') {
      target.energy = Math.min(target.maxEnergy, target.energy + 10);
    }
    if (hit.died) onDeath(caster, target);
    // 荆棘反伤
    if (target.side === 'ally' && target.unitFlags.thorns > 0 && caster.alive && caster.side === 'enemy') {
      const th = applyDamage(caster, Math.max(1, hit.dmg! * target.unitFlags.thorns));
      pushAct(target.uid, 'thorns', '荆棘反伤', [th]);
      if (th.died) onDeath(target, caster);
    }
    return hit;
  }

  function healUnit(target: CombatUnit, amount: number): HitInfo {
    const healed = Math.round(amount);
    target.hp = Math.min(target.maxHp, target.hp + healed);
    return { uid: target.uid, heal: healed, hpAfter: target.hp, shieldAfter: Math.round(target.shield), died: false };
  }

  function shieldUnit(target: CombatUnit, amount: number): HitInfo {
    target.shield += Math.round(amount);
    return { uid: target.uid, shield: Math.round(amount), hpAfter: target.hp, shieldAfter: Math.round(target.shield), died: false };
  }

  function attachDot(u: CombatUnit, target: CombatUnit, def: SkillDef, hits: HitInfo[]): void {
    if (!def.dot || !target.alive) return;
    const dot: Dot = { kind: def.dot.kind, dmg: effAtk(u) * def.dot.mult * (1 + tf.dotAmp), turns: def.dot.turns };
    target.dots.push({ ...dot });
    hits.push({ uid: target.uid, dot, hpAfter: target.hp, shieldAfter: Math.round(target.shield), died: false });
  }

  function castSkill(u: CombatUnit, def: SkillDef, kind: 'basic' | 'skill' | 'ult' | 'backend'): void {
    const hits: HitInfo[] = [];
    const charge = 1 + (u.side === 'ally' ? tf.ultCharge : 0) + u.unitFlags.ultCharge;

    if (def.target === 'enemy') {
      const n = def.hits ?? 1;
      for (let i = 0; i < n; i++) {
        const pool = aliveOf('enemy');
        if (!pool.length) break;
        const t = pool[Math.floor(rand() * pool.length)];
        if (def.mult > 0) hits.push(dealDamage(u, t, def.mult));
        attachDot(u, t, def, hits);
        if (def.debuff && i === 0 && t.alive) t.buffs.push({ ...def.debuff });
      }
    } else if (def.target === 'allEnemies') {
      for (const t of aliveOf('enemy')) {
        if (def.mult > 0) hits.push(dealDamage(u, t, def.mult));
        attachDot(u, t, def, hits);
        if (def.debuff && t.alive) t.buffs.push({ ...def.debuff });
      }
    } else if (def.target === 'ally') {
      const n = def.hits ?? 1;
      for (let i = 0; i < n; i++) {
        const pool = aliveOf('ally');
        if (!pool.length) break;
        const t = pool.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
        if (def.mult > 0) {
          if (def.appliesShield) hits.push(shieldUnit(t, effAtk(u) * def.mult));
          else hits.push(healUnit(t, effAtk(u) * def.mult * (1 + tf.healBonus + u.unitFlags.healBonus)));
        }
      }
    } else if (def.target === 'allAllies') {
      for (const a of aliveOf('ally')) {
        if (def.mult > 0) {
          if (def.appliesShield) hits.push(shieldUnit(a, effAtk(u) * def.mult));
          else hits.push(healUnit(a, effAtk(u) * def.mult * (1 + tf.healBonus + u.unitFlags.healBonus)));
        }
      }
    }

    // 全队增益（任意目标类型均可携带，如艾丝妲终结技加速、停云后台祝福）
    if (def.buff) {
      for (const a of aliveOf('ally')) a.buffs.push({ ...def.buff });
    }

    if (def.teamEnergy) {
      for (const a of aliveOf('ally')) a.energy = Math.min(a.maxEnergy, a.energy + def.teamEnergy);
    }
    if (def.teamShield) {
      for (const a of aliveOf('ally')) hits.push(shieldUnit(a, effAtk(u) * def.teamShield));
    }
    if (def.teamSp) sp = Math.min(spMax, sp + def.teamSp);
    if (def.detonate) {
      for (const e of aliveOf('enemy')) {
        if (!e.dots.length) continue;
        let total = 0;
        for (const d of e.dots) total += d.dmg * d.turns * 1.5;
        e.dots = [];
        const h = applyDamage(e, total);
        h.crit = false;
        hits.push(h);
        if (h.died) onDeath(u, e);
      }
    }

    pushAct(u.uid, kind, def.name, hits);

    // 火力风暴潮：造成伤害的攻击后攻击叠层（上限 5）
    if (u.unitFlags.onHitAtk > 0 && def.mult > 0 && hits.length &&
        (def.target === 'enemy' || def.target === 'allEnemies')) {
      u.attackStacks = Math.min(5, u.attackStacks + 1);
    }

    if (kind === 'ult') {
      u.energy = 0;
    } else {
      u.energy = Math.min(u.maxEnergy, u.energy + (kind === 'skill' ? 30 : 20) * charge);
    }

    // 追击羁绊：普攻后概率追加
    if (kind === 'basic' && tf.followupChance > 0 && rand() < tf.followupChance) {
      const pool = aliveOf('enemy');
      if (pool.length) {
        const t = pool[Math.floor(rand() * pool.length)];
        pushAct(u.uid, 'followup', '追击', [dealDamage(u, t, 1.0)]);
        u.energy = Math.min(u.maxEnergy, u.energy + 10 * charge);
      }
    }
  }

  function decayBuffs(u: CombatUnit): void {
    u.buffs = u.buffs.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0);
  }

  function allyAct(u: CombatUnit): void {
    if (u.energy >= u.maxEnergy && u.maxEnergy > 0) {
      castSkill(u, u.char!.ultimate, 'ult');
    } else if (sp > 0) {
      sp--;
      castSkill(u, u.char!.skill, 'skill');
    } else {
      castSkill(u, u.char!.basic, 'basic');
      sp = Math.min(spMax, sp + 1);
    }
    // 神君追加
    if (u.passive.type === 'shenjun' && u.shenjunStacks > 0) {
      const n = u.shenjunStacks;
      u.shenjunStacks = 0;
      const hits: HitInfo[] = [];
      for (let i = 0; i < n; i++) {
        for (const t of aliveOf('enemy')) hits.push(dealDamage(u, t, u.passive.mult));
      }
      if (hits.length) pushAct(u.uid, 'shenjun', '神君', hits);
    }
    decayBuffs(u);
  }

  function enemyAct(u: CombatUnit): void {
    ticks++;
    const mv = u.moves![u.moveIdx % u.moves!.length];
    u.moveIdx++;
    const hits: HitInfo[] = [];
    let anyAllyHit = false;
    if (mv.aoe) {
      for (const a of aliveOf('ally')) {
        hits.push(dealDamage(u, a, mv.mult));
        anyAllyHit = true;
      }
    } else {
      const t = aliveOf('ally')[0];
      if (t) {
        hits.push(dealDamage(u, t, mv.mult));
        anyAllyHit = true;
      }
    }
    pushAct(u.uid, 'enemy', mv.name, hits);
    // 克拉拉反击
    if (anyAllyHit && u.alive) {
      const clara = allies.find(a => a.alive && a.passive.type === 'counter');
      if (clara) {
        const cm = clara.passive.type === 'counter' ? clara.passive.mult : 0;
        pushAct(clara.uid, 'counter', '铠影追斩', [dealDamage(clara, u, cm)]);
      }
    }
    decayBuffs(u);
  }

  function tickDots(u: CombatUnit): HitInfo[] {
    const hits: HitInfo[] = [];
    for (const d of u.dots) {
      if (d.turns <= 0) continue;
      hits.push(applyDamage(u, d.dmg));
      d.turns--;
      if (!u.alive) break;
    }
    u.dots = u.dots.filter(d => d.turns > 0 && u.alive);
    return hits;
  }

  let guard = 0;
  while (guard++ < 5000) {
    if (!aliveOf('enemy').length) {
      win = true;
      break;
    }
    if (!aliveOf('ally').length || ticks >= budget()) break;

    let actor: CombatUnit | null = null;
    for (const x of all) {
      if (x.alive && (!actor || x.nextActionAt < actor.nextActionAt)) actor = x;
    }
    if (!actor) break;
    // 后台单位按降速档推进行动条，其余单位按正常速度
    actor.nextActionAt += actor.backend
      ? AV / (effSpd(actor) * BACK_CAST_SPD_FACTOR)
      : AV / effSpd(actor);

    // 行动开始：持续伤害结算
    if (actor.dots.length) {
      const hits = tickDots(actor);
      if (hits.length) {
        pushAct(actor.uid, 'dot', '持续伤害', hits);
        if (actor.side === 'enemy' && actor.alive) {
          const kafka = allies.find(a => a.alive && a.passive.type === 'dotZap');
          if (kafka) {
            const zm = kafka.passive.type === 'dotZap' ? kafka.passive.mult : 0;
            pushAct(kafka.uid, 'zap', '电击追射', [dealDamage(kafka, actor, zm)]);
          }
        }
      }
      if (!actor.alive) continue;
    }

    if (actor.backend) {
      // 后台参战：只施放后台赋能，不耗战技点、不吃能量、不触发生机回复
      ticks++;
      castSkill(actor, actor.char!.backSkill, 'backend');
    } else if (actor.side === 'ally') {
      ticks++;
      allyAct(actor);
      // 希儿击杀再动
      if (extraActions.length && aliveOf('enemy').length) {
        const uid = extraActions.shift()!;
        const u2 = all.find(x => x.uid === uid);
        if (u2 && u2.alive) allyAct(u2);
      }
      // 治疗光环：每次己方行动后
      const regenFlags = aliveOf('ally').filter(a => tf.regenPct + a.unitFlags.regenPct > 0);
      if (regenFlags.length) {
        const hits = regenFlags
          .map(a => healUnit(a, a.maxHp * (tf.regenPct + a.unitFlags.regenPct)))
          .filter(h => (h.heal ?? 0) > 0);
        if (hits.length) pushAct(actor.uid, 'regen', '生机回复', hits);
      }
    } else {
      enemyAct(actor);
    }

    // 减员导致预算变化：同步时钟事件（渲染器据此更新倒计时显示）
    const now = budget();
    if (now !== lastClock) {
      lastClock = now;
      events.push({ t: 'clock', countdown: now });
    }
  }

  const remaining = aliveOf('enemy').length;
  events.push({ t: 'end', win, ticks, remaining });
  return { win, ticks, events };
}
