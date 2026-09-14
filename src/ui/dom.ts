// 极简 DOM 构建工具
export type Attrs = Record<string, unknown>;
type Child = Node | string | null | undefined;

/**
 * 极简 DOM 构建工具。泛型返回值让调用方拿到具体元素类型
 * （如 `h<HTMLCanvasElement>('canvas', ...)`），无需再写 `as` 断言。
 */
export function h<T extends HTMLElement = HTMLElement>(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): T {
  const el = document.createElement(tag) as T;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  }
  // 递归展平（原先 flat(4) 在更深嵌套时会静默把数组当文本塞进去）
  const flat = (cs: (Child | Child[])[]): Child[] => {
    const out: Child[] = [];
    for (const c of cs) {
      if (Array.isArray(c)) out.push(...flat(c));
      else out.push(c);
    }
    return out;
  };
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
