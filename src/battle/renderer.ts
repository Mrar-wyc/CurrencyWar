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
  r: number;
  dots: number;
  /** 飘字出生序号（同单位连续跳字横向扇开用） */
  floaterSeq?: number;
  /** 后台支援单位（画面下缘，不参战站位） */
  backend?: boolean;
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

/** 后台支援弹道（施技演出） */
interface Bolt {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  born: number;
  color: string;
}

const W = 1440;
/** 画布高 = 720 - 46px DOM 顶条，保证 1:1 不变形 */
const H = 674;

const FONT = "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif";

/** 飘字横向扇开档位（0 居中，其余左右错开） */
const FLOATER_LANES = [0, -38, 38];

/**
 * 战斗事件流回放渲染器（Canvas 2D）——官方 HSR 布局：
 * 我方在左（近景）、敌人在右（远景）；行动条左上竖排；战技点右下；技能名横幅。
 */
export class BattleRenderer {
  private ctx: CanvasRenderingContext2D;
  /** 静态场景预渲染缓存（构造期画一次，每帧 drawImage） */
  private bg: HTMLCanvasElement | null = null;
  /** 行动条名字截断结果缓存（key = 宽度|名字） */
  private nameCache = new Map<string, string>();
  private views: UnitView[] = [];
  private byUid = new Map<string, UnitView>();
  private floaters: Floater[] = [];
  private flashes: HitFlash[] = [];
  private bolts: Bolt[] = [];
  private raf = 0;
  /** 结算延时回调句柄与销毁标记（destroy 后不得再回调 onDone） */
  private doneTimer = 0;
  private destroyed = false;
  private lastTs = 0;
  private evIdx = 0;
  private evElapsed = 0;
  private evApplied = 0;
  private evDur = 0;
  private current: BattleEvent | null = null;
  private sp = 0;
  private spMax = 5;
  private countdown = 0;
  private ticks = 0;
  /** 消耗行动值的行动类型（追击/反击/神君/dot/回复不消耗） */
  private static readonly TICK_KINDS = new Set(['basic', 'skill', 'ult', 'enemy', 'backend']);
  private finished = false;
  private speed = 1;
  /** 技能名横幅（官方演出） */
  private bannerText = '';
  private bannerKind: 'basic' | 'skill' | 'ult' | 'enemy' | 'backend' | 'nuke' | 'none' = 'none';
  private bannerUntil = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private events: BattleEvent[],
    private allies: CombatUnit[],
    private enemies: CombatUnit[],
    private onDone: (win: boolean) => void,
    private backers: CombatUnit[] = []
  ) {
    const rect = canvas.getBoundingClientRect();
    // 舞台被缩放到手机视口时（fitStage 的 scale<1），位图无需按 1440 满分辨率光栅化
    const shown = rect.width > 0 ? rect.width / W : 1;
    const px = Math.min(1, shown) * Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(W * px));
    canvas.height = Math.max(1, Math.round(H * px));
    const ctx = canvas.getContext('2d')!;
    ctx.scale(px, px);
    this.ctx = ctx;
    this.bg = this.buildBackground(px);
    for (const u of [...allies, ...enemies]) {
      const layout = this.layoutPos(u.side, u.pos, u.boss);
      const v: UnitView = {
        uid: u.uid, name: u.name, side: u.side, pos: u.pos, color: u.color,
        maxHp: u.maxHp, hp: u.hp, shield: u.shield, maxEnergy: u.maxEnergy, energy: u.energy,
        boss: u.boss, alive: u.alive, alpha: 1, x: layout.x, y: layout.y, r: layout.r,
        dots: 0
      };
      this.views.push(v);
      this.byUid.set(u.uid, v);
    }
    // 后台支援单位：画面左下缘横排（不参战站位，仅施技演出；y 避开我方底排 HUD）
    for (const b of this.backers) {
      const x = 56 + b.pos * 84;
      const y = H - 46;
      const v: UnitView = {
        uid: b.uid, name: b.name, side: 'ally', pos: b.pos, color: b.color,
        maxHp: b.maxHp, hp: b.hp, shield: 0, maxEnergy: 0, energy: 0,
        boss: false, alive: true, alpha: 1, x, y, r: 20,
        dots: 0, backend: true
      };
      this.views.push(v);
      this.byUid.set(b.uid, v);
    }
  }

  /**
   * 静态场景预渲染：夜空渐变 + 星点 + 竞技场地台/格线 + 敌我半场辉光。
   * 这些内容每帧都一样，却是整帧填充像素的绝大部分（≈9.5M 设备像素/帧），
   * 原先每帧重新光栅化一遍；现在只画一次，之后每帧一次 drawImage。
   */
  private buildBackground(px: number): HTMLCanvasElement {
    const bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(W * px));
    bg.height = Math.max(1, Math.round(H * px));
    const ctx = bg.getContext('2d')!;
    ctx.scale(px, px);
    // 背景：深蓝紫夜空（官方战斗场景基调）
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#151138');
    grad.addColorStop(0.6, '#221a4d');
    grad.addColorStop(1, '#2a2058');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 46; i++) {
      const sx = (i * 307) % W;
      const sy = (i * 173) % 300;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // 中央竞技场地台（透视椭圆 + 紫色发光格线，官方场地质感）
    const cx = W / 2;
    const cy = 400;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 640, 218, 0, 0, Math.PI * 2);
    const arena = ctx.createRadialGradient(cx, cy, 60, cx, cy, 640);
    arena.addColorStop(0, 'rgba(122,110,240,0.30)');
    arena.addColorStop(0.7, 'rgba(90,80,200,0.14)');
    arena.addColorStop(1, 'rgba(70,60,170,0.05)');
    ctx.fillStyle = arena;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,217,138,0.35)';
    ctx.stroke();
    // 场地格线：纵向射线 + 横向弧
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(180,170,255,0.14)';
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 135, cy - 210);
      ctx.lineTo(cx + i * 185, cy + 214);
      ctx.stroke();
    }
    for (const k of [-140, -70, 0, 70, 140]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + k, 640 * (1 - Math.abs(k) / 320), 218 * (1 - Math.abs(k) / 320), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 敌我半场微光（我左紫 / 敌右红）
    const allyGlow = ctx.createRadialGradient(360, 380, 30, 360, 380, 460);
    allyGlow.addColorStop(0, 'rgba(138,143,245,0.14)');
    allyGlow.addColorStop(1, 'rgba(138,143,245,0)');
    ctx.fillStyle = allyGlow;
    ctx.fillRect(0, 0, W / 2, H);
    const enemyGlow = ctx.createRadialGradient(W - 360, 380, 30, W - 360, 380, 460);
    enemyGlow.addColorStop(0, 'rgba(255,120,120,0.10)');
    enemyGlow.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = enemyGlow;
    ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.restore();
    return bg;
  }

  /** 我方左侧近景（大），敌人右侧远景（小）——官方 HSR 战斗视角 */
  private layoutPos(side: 'ally' | 'enemy', pos: number, boss: boolean): { x: number; y: number; r: number } {
    if (side === 'enemy') {
      const col = Math.floor(pos / 3);
      const row = pos % 3;
      const r = boss ? 50 : 33;
      return { x: W - 250 - col * 125, y: 265 + row * 122, r };
    }
    const col = Math.floor(pos / 3);
    const row = pos % 3;
    // 我方整体上移，底排 HUD（名字/血条）与左下后台支援栏脱开
    return { x: 300 + col * 140, y: 235 + row * 135, r: 40 };
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
    // 句柄要留着：否则 destroy() 之后这个延时回调仍会触发 onDone → 二次结算
    this.doneTimer = window.setTimeout(() => {
      this.doneTimer = 0;
      if (!this.destroyed) this.onDone(win);
    }, 60);
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
      this.applyStart(ev);
      this.evDur = 400;
    } else if (ev.t === 'clock') {
      this.countdown = ev.countdown;
      this.evDur = 60;
    } else if (ev.t === 'act') {
      this.sp = ev.sp;
      if (!ev.noTick && BattleRenderer.TICK_KINDS.has(ev.kind)) this.ticks++;
      this.evDur = 380 + ev.hits.length * 260;
      // 技能名横幅：普攻/战技/终结技/敌方技能/后台赋能/策略核爆
      if (ev.kind === 'basic' || ev.kind === 'skill' || ev.kind === 'ult' || ev.kind === 'enemy' || ev.kind === 'backend' || ev.kind === 'nuke') {
        const v = this.byUid.get(ev.uid);
        if (v) {
          this.bannerText = ev.kind === 'ult'
            ? `${v.name}　${ev.name}！`
            : ev.kind === 'backend'
              ? `【后台】${v.name}　${ev.name}`
              : ev.kind === 'nuke'
                ? `【策略】${ev.name}`
                : `${v.name}　${ev.name}`;
          this.bannerKind = ev.kind;
          this.bannerUntil = performance.now() + (ev.kind === 'ult' ? 1400 : 900);
        }
      }
    } else {
      this.evDur = 700;
    }
  }

  /** 立即应用事件内的效果（跳过模式全量；事件播完兜底只补未应用部分，防飘字重复） */
  /**
   * 开战事件：战技点/倒计时 + 开局护盾。
   * 引擎在事件之外就把 startShieldPct 的盾加好了，并把比例放在 start 事件里；
   * 此前渲染器只取 sp/spMax/countdown，于是盾条要等该单位第一次挨打才出现
   * （护盾羁绊/磐盾星徽/现金为王都看不见开局盾）。
   */
  private applyStart(ev: Extract<BattleEvent, { t: 'start' }>): void {
    this.sp = ev.sp;
    this.spMax = ev.spMax;
    this.countdown = ev.countdown;
    if (ev.shieldPct > 0) {
      for (const v of this.views) {
        if (v.side !== 'ally' || v.backend || !v.alive) continue;
        v.shield = Math.round(v.maxHp * ev.shieldPct);
      }
    }
  }

  private applyEventFully(ev: BattleEvent, fromIdx = 0): void {
    if (ev.t === 'start') {
      this.applyStart(ev);
      return;
    }
    if (ev.t === 'clock') {
      this.countdown = ev.countdown;
      return;
    }
    if (ev.t === 'act') {
      this.sp = ev.sp;
      const caster = this.byUid.get(ev.uid);
      for (let i = fromIdx; i < ev.hits.length; i++) {
        this.applyHit(ev.hits[i], caster, true, ev.kind === 'dot');
      }
      // 能量视图近似同步（事件末态）：终结技清零、战技+30、普攻+20、追击+10
      if (caster && caster.maxEnergy > 0) {
        if (ev.kind === 'ult') caster.energy = 0;
        else if (ev.kind === 'skill') caster.energy = Math.min(caster.maxEnergy, caster.energy + 30);
        else if (ev.kind === 'basic') caster.energy = Math.min(caster.maxEnergy, caster.energy + 20);
        else if (ev.kind === 'followup') caster.energy = Math.min(caster.maxEnergy, caster.energy + 10);
      }
      return;
    }
    if (ev.t === 'end') {
      for (const v of this.views) {
        if (!v.alive) v.alpha = 0.18;
      }
    }
  }

  private applyHit(h: HitInfo, caster: UnitView | undefined, instant: boolean, dotTick = false): void {
    const v = this.byUid.get(h.uid);
    if (!v) return;
    if (h.dmg !== undefined) {
      v.hp = h.hpAfter;
      v.shield = h.shieldAfter;
      if (instant) {
        this.addFloater(v, `${Math.round(h.dmg)}`, h.crit ? '#ffd166' : '#ffffff');
        this.flashes.push({ x: v.x, y: v.y, born: performance.now(), color: h.crit ? '#ffd166' : '#ff8888' });
        // 后台支援弹道：从支援单位飞向目标
        if (caster?.backend) {
          this.bolts.push({ x0: caster.x, y0: caster.y, x1: v.x, y1: v.y, born: performance.now(), color: caster.color });
        }
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
      v.dots = Math.min(9, v.dots + 1);
      if (instant) this.addFloater(v, h.dot.kind === 'shock' ? '⚡触电' : '🔥灼烧', '#c9a0ff');
    }
    if (dotTick && h.dmg !== undefined) {
      v.dots = Math.max(0, v.dots - 1);
    }
    if (h.died) {
      v.alive = false;
      v.alpha = 0.18;
      if (instant) this.addFloater(v, '倒下', '#ff8888');
    }
  }

  /**
   * 飘字出生位：贴在本体上并按出生次序横向扇开 + 交替升降。
   * 原先固定落在头顶上方 50px，会正好压住上一排单位的角色名/血条数字（历史 P2）；
   * 改到本体范围内后，飘字只覆盖自己的色块，既不叠字也不堆在同一锚点。
   */
  private addFloater(v: UnitView, text: string, color: string): void {
    v.floaterSeq = (v.floaterSeq ?? 0) + 1;
    const lane = FLOATER_LANES[(v.floaterSeq - 1) % FLOATER_LANES.length];
    const lift = ((v.floaterSeq - 1) % 2) * v.r * 0.45;
    this.floaters.push({
      x: v.x + lane,
      y: v.y + v.r * 0.35 - lift,
      text, color, born: performance.now(), life: 900
    });
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
        while (this.evApplied < ev.hits.length && this.evElapsed > 200 + this.evApplied * 260) {
          const h = ev.hits[this.evApplied];
          this.applyHit(h, caster, true);
          this.evApplied++;
        }
      }
      if (this.evElapsed >= this.evDur) {
        this.applyEventFully(ev, this.evApplied);
        this.enterEvent(this.evIdx + 1);
      }
    }

    this.draw(ts);
    if (!this.finished) this.raf = requestAnimationFrame(this.frame);
  };

  private draw(ts: number): void {
    const ctx = this.ctx;
    // 静态场景（夜空/星点/竞技场/格线/半场辉光）来自预渲染缓存，只做一次 drawImage
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);

    // 竖排行动条（左上，官方样式）
    this.drawActionStrip();
    // 敌方行动限制（右上）
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'right';
    const remain = Math.max(0, this.countdown - this.ticks);
    ctx.fillStyle = remain <= 4 ? '#ff9d9d' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`⏳ 行动值 ${remain}/${this.countdown}`, W - 24, 40);
    ctx.textAlign = 'left';

    // 技能名横幅（顶部中央，官方演出）
    if (ts < this.bannerUntil && this.bannerText) {
      const alpha = Math.min(1, (this.bannerUntil - ts) / 250);
      ctx.save();
      ctx.globalAlpha = alpha;
      const bw = 460;
      const bx = W / 2 - bw / 2;
      const by = 24;
      const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      const tint = this.bannerKind === 'ult' ? ['rgba(255,209,102,0.95)', 'rgba(240,169,46,0.85)']
        : this.bannerKind === 'enemy' ? ['rgba(255,120,120,0.9)', 'rgba(200,80,80,0.8)']
        : this.bannerKind === 'backend' ? ['rgba(110,220,200,0.92)', 'rgba(70,180,160,0.85)']
        : this.bannerKind === 'nuke' ? ['rgba(255,196,120,0.95)', 'rgba(230,120,80,0.85)']
        : ['rgba(167,160,255,0.92)', 'rgba(120,110,235,0.85)'];
      bg.addColorStop(0, 'rgba(30,26,70,0)');
      bg.addColorStop(0.2, tint[0]);
      bg.addColorStop(0.8, tint[1]);
      bg.addColorStop(1, 'rgba(30,26,70,0)');
      ctx.fillStyle = bg;
      // 两端斜切的横幅带（官方演出）
      const skew = 14;
      ctx.beginPath();
      ctx.moveTo(bx + skew, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw - skew, by + 44);
      ctx.lineTo(bx, by + 44);
      ctx.closePath();
      ctx.fill();
      // 两侧装饰竖线
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(bx + skew + 8, by + 8, 2, 28);
      ctx.fillRect(bx + bw - skew - 10, by + 8, 2, 28);
      ctx.font = `bold ${this.bannerKind === 'ult' ? 24 : 20}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.bannerKind === 'ult' ? '#3a2a00' : '#ffffff';
      ctx.fillText(this.bannerText, W / 2, by + 30);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // 单位
    for (const v of this.views) {
      this.drawUnit(ctx, v);
    }
    // 后台支援栏标签
    if (this.backers.length) {
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = 'rgba(110,220,200,0.85)';
      ctx.fillText('后台支援', 20, H - 72);
    }

    // 战技点（右下，官方位置）
    this.drawSp();

    // 特效（三个数组平时多为空：先判长度再过滤，省掉每帧 3 次数组分配）
    if (this.flashes.length) this.flashes = this.flashes.filter(f => ts - f.born < 300);
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
    // 后台支援弹道
    if (this.bolts.length) this.bolts = this.bolts.filter(b => ts - b.born < 260);
    for (const b of this.bolts) {
      const p = (ts - b.born) / 260;
      const hx = b.x0 + (b.x1 - b.x0) * p;
      const hy = b.y0 + (b.y1 - b.y0) * p - 60 * Math.sin(p * Math.PI);
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 1 - p * 0.4;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // 飘字
    if (this.floaters.length) this.floaters = this.floaters.filter(f => ts - f.born < f.life);
    for (const f of this.floaters) {
      const p = (ts - f.born) / f.life;
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(20,16,50,0.7)';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 1 - p * p;
      const fy = f.y - p * 38;
      ctx.strokeText(f.text, f.x - f.text.length * 6, fy);
      ctx.fillText(f.text, f.x - f.text.length * 6, fy);
      ctx.globalAlpha = 1;
    }
  }

  /** 左上角竖排行动条：第一个大金框，其余小（带深色底托）；整体下移避开顶部横幅区 */
  private drawActionStrip(): void {
    const ctx = this.ctx;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('行动顺序', 20, 48);
    let n = 0;
    for (let i = this.evIdx; i < this.events.length && n < 8; i++) {
      const e = this.events[i];
      if (e.t !== 'act') continue;
      if (!(e.kind === 'basic' || e.kind === 'skill' || e.kind === 'ult' || e.kind === 'enemy' || e.kind === 'dot' || e.kind === 'backend')) continue;
      const v = this.byUid.get(e.uid);
      if (!v) continue;
      const big = n === 0;
      const r = big ? 24 : 17;
      const cx = 20 + r + 4;
      const cy = 84 + (big ? 0 : n * 42 + 14);
      // 深色底托
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,16,50,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = v.alive ? v.color : '#4a4666';
      ctx.fill();
      if (big) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffd166';
        ctx.stroke();
      } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
        ctx.globalAlpha = 0.75;
      }
      ctx.font = `bold ${big ? 16 : 15}px ${FONT}`;
      ctx.fillStyle = '#fff';
      // 名字按可用宽度截断（避免长名逼近我方圆），超出加省略号。
      // 结果只取决于 (名字, 宽度)：记忆化后不再每帧调 30~60 次 measureText
      const maxW = big ? 165 : 150;
      ctx.fillText(this.truncateName(v.name, maxW), cx + r + 10, cy + 6);
      ctx.globalAlpha = 1;
      n++;
    }
  }

  /** 按像素宽度截断名字（带省略号），结果缓存复用 */
  private truncateName(name: string, maxW: number): string {
    const key = `${maxW}|${name}`;
    const hit = this.nameCache.get(key);
    if (hit !== undefined) return hit;
    const ctx = this.ctx;
    let label = name;
    while (label.length > 1 && ctx.measureText(label).width > maxW) label = label.slice(0, -1);
    if (label !== name) {
      while (label.length > 1 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
      label += '…';
    }
    this.nameCache.set(key, label);
    return label;
  }

  /** 战技点：右下角菱形宝石（官方位置，避开控制按钮区） */
  private drawSp(): void {
    const ctx = this.ctx;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText('战技点', W - 400, H - 66);
    ctx.textAlign = 'left';
    for (let i = 0; i < this.spMax; i++) {
      const x = W - 408 - (this.spMax - 1 - i) * 30;
      const y = H - 38;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      if (i < this.sp) {
        const gem = ctx.createLinearGradient(-8, -8, 8, 8);
        gem.addColorStop(0, '#ffe08a');
        gem.addColorStop(1, '#f0a92e');
        ctx.fillStyle = gem;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -8, 16, 16);
        // 宝石高光
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -1);
        ctx.lineTo(-1, -4);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-8, -8, 16, 16);
      }
      ctx.restore();
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, v: UnitView): void {
    const r = v.r;
    ctx.save();
    ctx.globalAlpha = v.alpha;
    const x = v.x;
    const y = v.y;

    // 后台支援单位：小圆 + 虚线环 + 名字（不参战，无血条）
    if (v.backend) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.globalAlpha *= 0.85;
      ctx.fill();
      ctx.globalAlpha = v.alpha;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(110,220,200,0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.fillText(v.name, x, y + r + 16);
      ctx.textAlign = 'left';
      ctx.restore();
      return;
    }

    // 阵营光环底座
    ctx.beginPath();
    ctx.ellipse(x, y + r + 10, r * 1.15, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = v.side === 'ally' ? 'rgba(138,143,245,0.30)' : 'rgba(255,120,120,0.24)';
    ctx.fill();
    // 底影
    ctx.beginPath();
    ctx.ellipse(x, y + r + 10, r * 0.95, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 本体
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = v.alive ? v.color : '#4a4666';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = v.side === 'ally' ? 'rgba(255,255,255,0.85)' : 'rgba(255,140,140,0.9)';
    ctx.stroke();

    if (v.boss) {
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText('首领', x, y - r - 10);
      ctx.textAlign = 'left';
    }

    // 名字
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(v.name, x, y + r + 28);
    ctx.textAlign = 'left';

    // 血条
    const bw = r * 2.4;
    const bx = x - bw / 2;
    const by = y + r + 34;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = '#e05d5d';
    ctx.fillRect(bx, by, bw * Math.max(0, v.hp / v.maxHp), 10);
    // 护盾条
    if (v.shield > 0) {
      const sh = Math.min(1, v.shield / v.maxHp);
      ctx.fillStyle = '#7db8e8';
      ctx.fillRect(bx, by - 6, bw * sh, 5);
    }
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`${Math.max(0, Math.round(v.hp))}`, x - 16, by + 24);

    // 终结技能量环（我方）
    if (v.side === 'ally' && v.maxEnergy > 0 && v.alive) {
      ctx.beginPath();
      ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.energy / v.maxEnergy));
      ctx.strokeStyle = v.energy >= v.maxEnergy ? '#ffd166' : 'rgba(255,209,102,0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();
      if (v.energy >= v.maxEnergy) {
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillStyle = '#ffd166';
        ctx.textAlign = 'center';
        ctx.fillText('终结技!', x, y - r - 8);
        ctx.textAlign = 'left';
      }
    }

    // 持续伤害图标
    let ix = x - (v.dots - 1) * 9;
    for (let i = 0; i < v.dots; i++) {
      ctx.font = `15px ${FONT}`;
      ctx.fillText('⚡', ix, y - r - 6);
      ix += 18;
    }
    ctx.restore();
  }

  /** 幂等销毁：停掉动画帧与待触发的结算回调，释放视图与缓存 */
  destroy(): void {
    this.finished = true;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.doneTimer) {
      clearTimeout(this.doneTimer);
      this.doneTimer = 0;
    }
    this.views = [];
    this.byUid.clear();
    this.floaters = [];
    this.flashes = [];
    this.bolts = [];
    this.bg = null;
    this.current = null;
  }
}
