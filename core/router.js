// Hash router (#/home, #/profile/<id>, …). Hash URLs let the app run from any static server.
import { scheduleRefresh } from './refresh.js';

function parse() {
  const raw = (location.hash || '#/').slice(1) || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: '/' + parts.join('/'), parts, query, raw };
}
let current = parse();
const listeners = new Set();
window.addEventListener('hashchange', () => {
  const prev = current;
  current = parse();
  if (prev.path !== current.path) window.scrollTo(0, 0);
  listeners.forEach((f) => f(current, prev));
  scheduleRefresh();
});
export function route() { return current; }
export function navigate(path, { replace = false } = {}) {
  const h = '#' + path;
  if (location.hash === h) return;
  if (replace) location.replace(h); else location.hash = h;
}
export function onRoute(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const href = (path) => '#' + path;
