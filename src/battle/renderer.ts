import type { BattleEvent, CombatUnit, HitInfo } from '../logic/types';

interface UnitView {
  uid: string;
  name: string;
  side: 'ally' | 'enemy';
  pos: number;
  color: string;
  maxHp: number;
  hp: number;
  shield: number;
  maxEnergy: number;
  energy: number;
  boss: boolean;
  alive: boolean;
  alpha: number;
  x: number;
  y: number;
  dots: number;
  hasBuff: boolean;
  hasDebuff: boolean;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  life: number;
}

interface HitFlash {
  x: number;
  y: number;
  born: number;
  color: string;
}

const W = 1280;
const H = 720;

/**
 * 战斗事件流回放渲染器（Canvas 2D）。
 * 逻辑与表现分离：引擎只产出事件，这里负责动画。
 */
export class BattleRenderer {
  private ctx: CanvasRenderingContext2D;
  private views: UnitView[] = [];
  private byUid = new Map<string, UnitView>();
  private floaters: Floater[] = [];
  private flashes: HitFlash[] = [];
  private raf = 0;
  private lastTs = 0;
  private evIdx = 0;
  private evElapsed = 0;
  private evApplied = 0;
  private evDur = 0;
  private current: BattleEvent | null = null;
  private sp = 0;
  private spMax = 5;
  private limit = 0;
  private enemyActions = 0;
  private finished = false;
  private speed = 1;
  private deadAt = new Map<string, boolean>();

  constructor(
    private canvas: HTMLCanvasElement,
    private events: BattleEvent[],
    private allies: CombatUnit[],
    private enemies: CombatUnit[],
    private onDone: (win: boolean) => void
  ) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    this.ctx = ctx;
    for (const u of [...allies, ...enemies]) {
      const layout = this.layoutPos(u.side, u.pos, u.boss);
      const v: UnitView = {
        uid: u.uid, name: u.name, side: u.side, pos: u.pos, color: u.color,
        maxHp: u.maxHp, hp: u.hp, shield: u.shield, maxEnergy: u.maxEnergy, energy: u.energy,
        boss: u.boss, alive: u.alive, alpha: 1, x: layout.x, y: layout.y,
        dots: 0, hasBuff: false, hasDebuff: false
      };
      this.views.push(v);
      this.byUid.set(u.uid, v);
    }
  }

  private layoutPos(side: 'ally' | 'enemy', pos: number, boss: boolean): { x: number; y: number } {
    // 我方 2列×3行 在左侧；敌方镜像在右侧
    const col = Math.floor(pos / 3);
    const row = pos % 3;
    const baseX = side === 'ally' ? 250 + col * 130 : W - 250 - col * 130;
    const y = boss && pos >= 0 ? 330 : 280 + row * 130;
    return { x: baseX, y };
  }

  setSpeed(s: number): void {
    this.speed = s;
  }

  start(): void {
    this.enterEvent(0);
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  skip(): void {
    // 快进：应用所有剩余事件到最终状态
    while (this.evIdx < this.events.length) {
      this.applyEventFully(this.events[this.evIdx]);
      this.evIdx++;
    }
    this.finishFromEvents();
  }

  private finishFromEvents(): void {
    if (this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this.raf);
    const end = this.events[this.events.length - 1];
    const win = end.t === 'end' ? end.win : false;
    setTimeout(() => this.onDone(win), 60);
  }

  private enterEvent(idx: number): void {
    if (idx >= this.events.length) {
      this.finishFromEvents();
      return;
    }
    this.current = this.events[idx];
    this.evIdx = idx;
    this.evElapsed = 0;
    this.evApplied = 0;
    const ev = this.current;
    if (ev.t === 'start') {
      this.sp = ev.sp;
      this.spMax = ev.spMax;
      this.limit = ev.limit;
      this.evDur = 400;
    } else if (ev.t === 'act') {
      this.sp = ev.sp;
      if (ev.kind === 'enemy') this.enemyActions++;
      this.evDur = 380 + ev.hits.length * 260;
    } else {
      this.evDur = 700;
    }
    // 事件开始时同步单位状态标记（存活的 dot/增益图标）
    this.syncIcons(ev);
  }

  private syncIcons(ev: BattleEvent): void {
    for (const v of this.views) {
      v.dots = 0;
      v.hasBuff = false;
      v.hasDebuff = false;
    }
    if (ev.t === 'act') {
      for (const h of ev.hits) {
        if (h.dot) {
          const v = this.byUid.get(h.uid);
          if (v) v.dots++;
        }
      }
    }
  }

  /** 立即应用事件内的所有效果（跳过模式或事件播完兜底） */
  private applyEventFully(ev: BattleEvent): void {
    if (ev.t === 'start') {
      this.sp = ev.sp;
      this.spMax = ev.spMax;
      this.limit = ev.limit;
      return;
    }
    if (ev.t === 'act') {
      this.sp = ev.sp;
      const caster = this.byUid.get(ev.uid);
      for (const h of ev.hits) {
        this.applyHit(h, caster, true);
      }
      return;
    }
    if (ev.t === 'end') {
      for (const v of this.views) {
        if (!v.alive) v.alpha = 0.18;
      }
    }
  }

  private applyHit(h: HitInfo, caster: UnitView | undefined, instant: boolean): void {
    const v = this.byUid.get(h.uid);
    if (!v) return;
    if (h.dmg !== undefined) {
      v.hp = h.hpAfter;
      v.shield = h.shieldAfter;
      if (instant) {
        this.addFloater(v, `${Math.round(h.dmg)}`, h.crit ? '#ffd166' : '#ffffff');
        this.flashes.push({ x: v.x, y: v.y, born: performance.now(), color: h.crit ? '#ffd166' : '#ff8888' });
      }
    }
    if (h.heal !== undefined) {
      v.hp = h.hpAfter;
      if (instant) this.addFloater(v, `+${Math.round(h.heal)}`, '#7dd87d');
    }
    if (h.shield !== undefined && h.dmg === undefined) {
      v.shield = h.shieldAfter;
      if (instant) this.addFloater(v, `盾+${Math.round(h.shield)}`, '#7db8e8');
    }
    if (h.dot) {
      if (instant) this.addFloater(v, h.dot.kind === 'shock' ? '⚡触电' : '🔥灼烧', '#b06ee0');
    }
    if (h.died) {
      v.alive = false;
      v.alpha = 0.18;
      if (instant) this.addFloater(v, '倒下', '#ff8888');
    }
    void caster;
  }

  private addFloater(v: UnitView, text: string, color: string): void {
    this.floaters.push({ x: v.x + (Math.random() * 30 - 15), y: v.y - 46, text, color, born: performance.now(), life: 900 });
  }

  private frame = (ts: number): void => {
    if (this.finished) return;
    const dt = Math.min(50, ts - this.lastTs);
    this.lastTs = ts;
    this.evElapsed += dt * this.speed;

    const ev = this.current;
    if (ev) {
      if (ev.t === 'act') {
        const caster = this.byUid.get(ev.uid);
        // 分段应用 hits
        while (this.evApplied < ev.hits.length && this.evElapsed > 200 + this.evApplied * 260) {
          const h = ev.hits[this.evApplied];
          this.applyHit(h, caster, true);
          this.evApplied++;
        }
        // 行动倒下标记
        if (ev.kind === 'dot' && ev.hits.some(h => h.died)) {
          for (const h of ev.hits) {
            if (h.died) {
              const v = this.byUid.get(h.uid);
              if (v) { v.alive = false; v.alpha = 0.18; }
            }
          }
        }
      }
      if (this.evElapsed >= this.evDur) {
        this.applyEventFully(ev);
        this.enterEvent(this.evIdx + 1);
      }
    }

    this.draw(ts);
    if (!this.finished) this.raf = requestAnimationFrame(this.frame);
  };

  private draw(ts: number): void {
    const ctx = this.ctx;
    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1024');
    grad.addColorStop(0.7, '#131735');
    grad.addColorStop(1, '#1a1440');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 307) % W;
      const sy = (i * 173) % 300;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // 地面
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 590, W, 2);
    ctx.font = '12px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('货币战争 · 零和博弈', 16, H - 14);

    // 行动条（即将行动的单位）
    this.drawActionStrip(ts);
    // 战技点
    this.drawSp();
    // 行动限制
    ctx.font = 'bold 17px system-ui';
    ctx.fillStyle = this.enemyActions > this.limit - 4 ? '#ff8888' : 'rgba(255,255,255,0.7)';
    ctx.fillText(`敌方行动 ${this.enemyActions}/${this.limit}`, W / 2 - 60, 88);

    // 单位
    for (const v of this.views) {
      this.drawUnit(ctx, v, ts);
    }

    // 特效
    this.flashes = this.flashes.filter(f => ts - f.born < 300);
    for (const f of this.flashes) {
      const p = (ts - f.born) / 300;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 44 + p * 30, 0, Math.PI * 2);
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 飘字
    this.floaters = this.floaters.filter(f => ts - f.born < f.life);
    for (const f of this.floaters) {
      const p = (ts - f.born) / f.life;
      ctx.font = 'bold 23px system-ui';
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 1 - p * p;
      ctx.fillText(f.text, f.x - f.text.length * 5, f.y - p * 36);
      ctx.globalAlpha = 1;
    }
  }

  private drawActionStrip(ts: number): void {
    const ctx = this.ctx;
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('行动顺序', 20, 26);
    let n = 0;
    for (let i = this.evIdx; i < this.events.length && n < 8; i++) {
      const e = this.events[i];
      if (e.t !== 'act') continue;
      const v = this.byUid.get(e.uid);
      if (!v) continue;
      const x = 20 + n * 52;
      ctx.beginPath();
      ctx.arc(x + 18, 46, 16, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.globalAlpha = n === 0 ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(v.name.slice(0, 3), x + 2, 76);
      n++;
    }
  }

  private drawSp(): void {
    const ctx = this.ctx;
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('战技点', 20, 108);
    for (let i = 0; i < this.spMax; i++) {
      ctx.beginPath();
      ctx.arc(78 + i * 26, 104, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < this.sp ? '#ffd166' : 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, v: UnitView, ts: number): void {
    const r = v.boss ? 52 : 38;
    ctx.save();
    ctx.globalAlpha = v.alpha;
    const x = v.x;
    const y = v.y;

    // 底座
    ctx.beginPath();
    ctx.ellipse(x, y + r + 10, r * 0.9, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 本体
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = v.alive ? v.color : '#3a3f55';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = v.side === 'ally' ? 'rgba(255,255,255,0.7)' : 'rgba(255,120,120,0.8)';
    ctx.stroke();

    if (v.boss) {
      ctx.font = 'bold 15px system-ui';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('首领', x - 16, y - r - 8);
    }

    // 名字
    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(v.name, x, y + r + 26);
    ctx.textAlign = 'left';

    // 血条
    const bw = r * 2.2;
    const bx = x - bw / 2;
    const by = y + r + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, 9);
    ctx.fillStyle = '#e05d5d';
    ctx.fillRect(bx, by, bw * Math.max(0, v.hp / v.maxHp), 9);
    // 护盾条
    if (v.shield > 0) {
      const sh = Math.min(1, v.shield / v.maxHp);
      ctx.fillStyle = '#7db8e8';
      ctx.fillRect(bx, by - 5, bw * sh, 4);
    }
    ctx.font = 'bold 13px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${Math.max(0, Math.round(v.hp))}`, x - 16, by + 22);

    // 终结技能量环（我方）
    if (v.side === 'ally' && v.maxEnergy > 0 && v.alive) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.energy / v.maxEnergy));
      ctx.strokeStyle = v.energy >= v.maxEnergy ? '#ffd166' : 'rgba(255,209,102,0.45)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      if (v.energy >= v.maxEnergy) {
        ctx.font = 'bold 13px system-ui';
        ctx.fillStyle = '#ffd166';
        ctx.fillText('终结技!', x - 26, y - r - 6);
      }
    }

    // 持续伤害/增益图标
    let ix = x - (v.dots + (v.hasBuff ? 1 : 0) + (v.hasDebuff ? 1 : 0)) * 9;
    for (let i = 0; i < v.dots; i++) {
      ctx.font = '14px system-ui';
      ctx.fillText('⚡', ix, y - r - 6);
      ix += 16;
    }
    ctx.restore();
    void ts;
  }

  destroy(): void {
    this.finished = true;
    cancelAnimationFrame(this.raf);
  }
}
