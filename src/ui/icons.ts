// 内联 SVG 图标库——官方形态语言（金色描边 + 渐变填充），零图片依赖
// 所有图标工厂函数直接返回可 append 的 SVGElement，尺寸由调用方决定
import { COST_COLORS } from './dom';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function svg(viewBox: string, inner: string, size: number): SVGSVGElement {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = inner;
  return el;
}

/** 十六进制色加深/提亮（amt -100~100） */
function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const num = parseInt(full, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, v + Math.round(255 * amt / 100)));
  const r = ch((num >> 16) & 255);
  const g = ch((num >> 8) & 255);
  const b = ch(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 金币（顶栏/费用角标） */
export function coinSvg(size = 18): SVGSVGElement {
  const id = `coin${++uid}`;
  return svg('0 0 24 24',
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f0a92e"/>
    </linearGradient></defs>
    <circle cx="12" cy="12" r="10" fill="url(#${id})" stroke="#b57d12" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="6.8" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>
    <rect x="9.6" y="9.6" width="4.8" height="4.8" transform="rotate(45 12 12)" fill="#8a5c08"/>`,
    size);
}

/** 心形（小队生命） */
export function heartSvg(size = 18): SVGSVGElement {
  return svg('0 0 24 24',
    `<path d="M12 21S3.6 15.9 2.2 11.4C1 7.6 3.4 4.6 6.6 4.6c2.1 0 3.9 1.1 5.4 3 1.5-1.9 3.3-3 5.4-3 3.2 0 5.6 3 4.4 6.8C20.4 15.9 12 21 12 21z"
      fill="#ff6b81" stroke="#ffe3e8" stroke-width="1.4"/>`,
    size);
}

/** 交叉双剑（出战/战斗） */
export function swordSvg(size = 20): SVGSVGElement {
  return svg('0 0 24 24',
    `<g stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M5 5l11.5 11.5M19 5L7.5 16.5"/>
      <path d="M4 17.5L6.5 20M20 17.5L17.5 20"/>
    </g>
    <path d="M3 18.5L5.5 21 3.8 21.8 2.2 20.2z" fill="#ffd166"/>
    <path d="M21 18.5L18.5 21 20.2 21.8 21.8 20.2z" fill="#ffd166"/>`,
    size);
}

/** 锁（商店锁定/槽位未解锁） */
export function lockSvg(size = 16, open = false): SVGSVGElement {
  return svg('0 0 24 24',
    `<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#ffd166" stroke="#b57d12" stroke-width="1.4"/>
    <path d="M8 10.5V8a4 ${open ? '0' : '1'} 0 1 8 0v2.5" fill="none" stroke="#ffd166" stroke-width="2"
      transform="${open ? 'rotate(-28 12 8)' : ''}"/>
    <circle cx="12" cy="15.5" r="1.7" fill="#8a5c08"/>`,
    size);
}

/** 环形刷新箭头 */
export function rerollSvg(size = 16): SVGSVGElement {
  return svg('0 0 24 24',
    `<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M20.5 2.5v5h-5z" fill="currentColor"/>`,
    size);
}

/** 买经验（向上双箭头） */
export function xpSvg(size = 16): SVGSVGElement {
  return svg('0 0 24 24',
    `<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 13.5L12 6.5l7 7"/><path d="M5 19.5l7-7 7 7"/>
    </g>`,
    size);
}

/** 六边形羁绊图标（官方形态：金框=激活 / 灰框=未激活，内嵌 emoji 字形） */
export function hexTrait(glyph: string, active: boolean, size = 34): SVGSVGElement {
  const id = `hex${++uid}`;
  const stroke = active ? '#ffd166' : 'rgba(233,235,255,0.4)';
  const fill = active ? `url(#${id})` : 'rgba(30,28,74,0.55)';
  return svg('0 0 40 44',
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(90,74,26,0.85)"/><stop offset="1" stop-color="rgba(48,40,12,0.85)"/>
    </linearGradient></defs>
    <polygon points="20,2.5 37,12.5 37,31.5 20,41.5 3,31.5 3,12.5" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 2.4 : 1.5}"/>
    <text x="20" y="28.5" text-anchor="middle" font-size="19" font-family="'PingFang SC','Microsoft YaHei',system-ui">${glyph}</text>`,
    size);
}

/** 费用色环头像（渐变底 + 名字首字，替代官方立绘的合规方案） */
export function avatar(color: string, cost: number, ch: string, size = 44): SVGSVGElement {
  const id = `av${++uid}`;
  const ring = COST_COLORS[cost] ?? '#9aa4b2';
  return svg('0 0 44 44',
    `<defs><radialGradient id="${id}" cx="35%" cy="28%" r="85%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.92"/>
      <stop offset="0.5" stop-color="${color}"/>
      <stop offset="1" stop-color="${shade(color, -35)}"/>
    </radialGradient></defs>
    <circle cx="22" cy="22" r="18.5" fill="url(#${id})" stroke="${ring}" stroke-width="3"/>
    <text x="22" y="29.5" text-anchor="middle" font-size="19" font-weight="900"
      font-family="'PingFang SC','Microsoft YaHei',system-ui" fill="#fff" stroke="rgba(30,28,74,0.45)" stroke-width="0.6">${ch}</text>`,
    size);
}

/** 钻石主视觉（主菜单，官方 key art 元素：青白渐变宝石 + 切面线） */
export function diamondSvg(size = 150): SVGSVGElement {
  const id = `dia${++uid}`;
  return svg('0 0 100 100',
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#eafcff"/><stop offset="0.45" stop-color="#8fd8ff"/>
      <stop offset="1" stop-color="#7f7bff"/>
    </linearGradient></defs>
    <g stroke="rgba(255,255,255,0.85)" stroke-width="1.6" stroke-linejoin="round">
      <polygon points="26,22 74,22 92,42 50,88 8,42" fill="url(#${id})"/>
      <polyline points="8,42 26,42 50,22 74,42 92,42" fill="none"/>
      <polyline points="26,22 32,42 50,88 68,42 74,22" fill="none"/>
      <line x1="32" y1="42" x2="68" y2="42"/>
    </g>
    <circle cx="84" cy="16" r="2.4" fill="#fff" opacity="0.9"/>
    <circle cx="14" cy="70" r="1.8" fill="#fff" opacity="0.7"/>`,
    size);
}

/** 策略品质宝石（银/金/棱彩） */
export function gemSvg(grade: 'silver' | 'gold' | 'prism', size = 22): SVGSVGElement {
  const id = `gem${++uid}`;
  const fill = grade === 'silver' ? 'url(#gs)' : grade === 'gold' ? 'url(#gg)' : `url(#${id})`;
  const defs = grade === 'prism'
    ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#c77dff"/><stop offset="0.5" stop-color="#8fd8ff"/><stop offset="1" stop-color="#ffd166"/>
      </linearGradient>`
    : `<linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f6ff"/><stop offset="1" stop-color="#aab4cf"/></linearGradient>
       <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f0a92e"/></linearGradient>`;
  return svg('0 0 24 24',
    `<defs>${defs}</defs>
    <g stroke="rgba(255,255,255,0.8)" stroke-width="1.2" stroke-linejoin="round">
      <polygon points="7,4 17,4 22,10 12,21 2,10" fill="${fill}"/>
      <polyline points="2,10 8.5,10 12,4 15.5,10 22,10" fill="none"/>
    </g>`,
    size);
}

/** 敌人图标（图鉴/情报：小怪圆点 / 首领皇冠） */
export function enemyMark(boss: boolean, color: string, size = 16): SVGSVGElement {
  if (!boss) return svg('0 0 24 24', `<circle cx="12" cy="12" r="7" fill="${color}" stroke="rgba(255,255,255,0.7)" stroke-width="1.6"/>`, size);
  return svg('0 0 24 24',
    `<path d="M4 18h16l-1.2-9-4.3 3.4L12 5l-2.5 7.4L5.2 9z" fill="#ffd166" stroke="#b57d12" stroke-width="1.2" stroke-linejoin="round"/>`,
    size);
}
