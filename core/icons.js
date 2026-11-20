// Lucide icons (Design 5.4) rendered as Preact SVG, plus the custom `coin` and `rivet` glyphs.
// Lucide is loaded from the CDN in index.html (window.lucide).
import { h } from './lib.js';

const CUSTOM = {
  coin: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 5.5 }], ['circle', { cx: 12, cy: 12, r: 1.6, fill: 'currentColor' }]],
  rivet: [['path', { d: 'M4.5 13.5a7.5 7.5 0 0 1 15 0z' }], ['path', { d: 'M10 13.5V21h4v-7.5' }]],
  google: [['path', { d: 'M21.8 10.2H12v3.9h5.6c-.5 2.5-2.7 4.1-5.6 4.1a6.2 6.2 0 1 1 4-10.9l2.9-2.8A10.2 10.2 0 1 0 22 12c0-.6 0-1.2-.2-1.8z' }]],
};
// Directional icons that flip in RTL (Design 5.4)
const MIRROR = new Set(['arrow-right', 'arrow-left', 'chevron-right', 'chevron-left', 'chevrons-right', 'chevrons-left', 'send', 'undo-2', 'redo-2', 'reply', 'log-out', 'corner-down-left', 'external-link']);
export const missingIcons = new Set();

const pascal = (n) => n.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
const memo = new Map();
export function iconNode(name) {
  if (memo.has(name)) return memo.get(name);
  let n = CUSTOM[name];
  if (!n) {
    const L = window.lucide;
    const lib = (L && (L.icons || L)) || {};
    n = lib[pascal(name)];
    if (!n) { missingIcons.add(name); n = lib.Star || []; }
    if (Array.isArray(n) && n[0] === 'svg') n = n[2] || [];
  }
  memo.set(name, n);
  return n;
}
export function hasIcon(name) { iconNode(name); return !missingIcons.has(name); }

export function Icon({ name, size = 24, stroke = 2, fill = 'none', color, cls = '', label, style }) {
  const n = iconNode(name) || [];
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill,
    stroke: 'currentColor', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: `icon ${MIRROR.has(name) ? 'mirror ' : ''}${cls}`, style: color ? { color, ...(style || {}) } : style,
    'aria-hidden': label ? undefined : 'true', 'aria-label': label, role: label ? 'img' : undefined, focusable: 'false',
  }, n.map(([t, a], i) => h(t, { ...a, key: i })));
}
