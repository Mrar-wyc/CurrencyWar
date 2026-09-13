// 极简 DOM 构建工具
export type Attrs = Record<string, unknown>;
type Child = Node | string | null | undefined;

export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  }
  const flat = (cs: (Child | Child[])[]): Child[] => cs.flat(4) as Child[];
  for (const c of flat(children)) {
    if (c === null || c === undefined) continue;
    el.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let toastTimer = 0;
export function toast(msg: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
}

export function starText(star: number): string {
  return '★'.repeat(star);
}

/** 费用颜色 */
export const COST_COLORS: Record<number, string> = {
  1: '#9aa4b2',
  2: '#4fc47f',
  3: '#4f9ee8',
  4: '#c77dff',
  5: '#ffd166'
};
