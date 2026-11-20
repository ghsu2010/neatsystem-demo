// Trainings visuals: milestone icons (Lucide or uploaded), rivet nodes (Design 8.1), tree graph with pan/zoom (7.6).
import { html, useState, useRef, useEffect, useLayoutEffect } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Icon, cx } from '../../core/ui.js';
import { pastel } from '../../core/color.js';

export function MsIcon({ name, size = 28, color }) {
  if (name && name.startsWith('upl:')) {
    const ic = bus.read('trainings.uploadedIcon', name.slice(4));
    if (ic) return html`<span aria-hidden="true" style=${`display:inline-block;width:${size}px;height:${size}px;background:${color || 'currentColor'};-webkit-mask:url(${ic.dataUrl}) center/contain no-repeat;mask:url(${ic.dataUrl}) center/contain no-repeat`}/>`;
    name = 'star';
  }
  return html`<${Icon} name=${name || 'star'} size=${size} color=${color}/>`;
}
const BADGE = { submitted: ['hourglass', '#7A5A00', '#FBEFC4'], approved: ['check', '#FFFFFF', 'var(--success)'], rejected: ['x', '#FFFFFF', 'var(--danger)'], needs_reapproval: ['refresh-cw', '#0B0D13', '#F8BD1D'] };
export const STATE_LABEL = { locked: 'נעול', open: 'פתוח', submitted: 'נשלחה בקשה', approved: 'מאושר', rejected: 'נדחה', needs_reapproval: 'דרוש אישור מחדש', view: '' };
/** Rivet node. state: locked/open/submitted/approved/rejected/needs_reapproval/view */
export function Node({ m, state, size = 64, onClick, draft, hidden, label = true, isNew }) {
  const p = pastel(m.color);
  let fill = p.fill, ink = p.dark, edge = p.dark, opacity = 1;
  if (state === 'locked') { fill = 'var(--node-locked)'; ink = 'var(--node-locked-ink)'; edge = 'var(--node-locked-edge)'; }
  else if (state === 'submitted') { fill = p.fill + '80'; }
  else if (state === 'rejected') { fill = 'var(--danger-tint)'; ink = 'var(--danger)'; edge = 'var(--danger)'; }
  else if (state === 'needs_reapproval') { fill = '#F8BD1D'; ink = '#0B0D13'; edge = '#9D6300'; }
  if (hidden) opacity = 0.45;
  const bd = BADGE[state];
  return html`<button type="button" class=${cx('rivet', state === 'open' && 'pulse-ring', draft && 'draft')} onClick=${onClick}
    style=${`--fill:${fill};--ink:${ink};--edge:${edge};--ring:${p.fill};--fill-d:${p.dark};--ink-d:${p.fill};width:${size}px;opacity:${opacity}`}
    aria-label=${`${m.name}, ${STATE_LABEL[state] || ''}`}>
    <span class="rivet-head" style=${`width:${size}px;height:${size}px`}>
      ${state === 'locked' ? html`<${Icon} name="lock" size=${Math.round(size * 0.4)}/>` : html`<${MsIcon} name=${m.icon} size=${Math.round(size * 0.44)}/>`}
      ${bd && html`<span class="rivet-badge" style=${`background:${bd[2]};color:${bd[1]}`}><${Icon} name=${bd[0]} size=${12} stroke=${3}/></span>`}
      ${isNew && html`<span class="dot-new" style="position:absolute;top:2px;inset-inline-end:2px"/>`}
    </span>
    ${label && html`<span class="rivet-label t-foot clamp2"><bdi>${m.name}</bdi></span>`}
  </button>`;
}

/** Layout: rows by depth; nodes centred, 32 px apart (Design 7.6). */
const COL = 112, ROW = 150, NODE = 64;
const WRAP = 10; // a depth row longer than this wraps onto extra lines (presentation only)
export function layout(list, depths) {
  const rows = {};
  list.forEach((m) => { const d = depths[m.id] || 0; (rows[d] = rows[d] || []).push(m); });
  const lines = [];
  Object.keys(rows).map(Number).sort((a, c) => a - c).forEach((d) => {
    const r = rows[d].sort((a, c) => a.order - c.order);
    for (let i = 0; i < r.length; i += WRAP) lines.push(r.slice(i, i + WRAP));
  });
  const maxLen = Math.max(1, ...lines.map((r) => r.length));
  const width = maxLen * COL + 32;
  const pos = {};
  lines.forEach((r, li) => r.forEach((m, i) => { pos[m.id] = { x: width / 2 + ((r.length - 1) / 2 - i) * COL, y: li * ROW + 24 }; })); // RTL: first on the right
  return { pos, width, height: Math.max(1, lines.length) * ROW + 24 };
}

/** Pan & zoom container (drag, pinch, Ctrl+wheel; 50–150%). */
export function PanZoom({ width, height, children, centerTarget, toolbar }) {
  const box = useRef();
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const ptrs = useRef(new Map());
  const start = useRef(null);
  const fit = (target) => {
    const el = box.current; if (!el) return;
    const W = el.clientWidth;
    if (target) setT((s) => ({ ...s, x: W / 2 - target.x * s.k, y: Math.max(16, 120 - target.y * s.k) }));
    else setT({ k: 1, x: width > W ? W - width + 8 : (W - width) / 2, y: 8 }); // RTL: start from the right edge
  };
  useLayoutEffect(() => { fit(null); }, [width]);
  const clampK = (k) => Math.max(0.5, Math.min(1.5, k));
  const down = (e) => {
    if (e.target.closest('button') && e.pointerType !== 'touch') return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { t: { ...t }, p: [...ptrs.current.values()].map((p) => ({ ...p })) };
  };
  const move = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = start.current; const p = [...ptrs.current.values()];
    if (p.length === 1 && s.p.length === 1) setT({ ...s.t, x: s.t.x + p[0].x - s.p[0].x, y: s.t.y + p[0].y - s.p[0].y });
    else if (p.length >= 2 && s.p.length >= 2) {
      const d0 = Math.hypot(s.p[0].x - s.p[1].x, s.p[0].y - s.p[1].y), d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      setT({ ...s.t, k: clampK(s.t.k * (d1 / d0)) });
    }
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); start.current = { t: { ...t }, p: [...ptrs.current.values()] }; };
  useEffect(() => {
    const el = box.current;
    const wheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); setT((s) => ({ ...s, k: clampK(s.k * (e.deltaY < 0 ? 1.1 : 0.9)) })); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  return html`<div class="pz" ref=${box} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
    <div class="pz-in" style=${`width:${width}px;height:${height}px;transform:translate(${t.x}px,${t.y}px) scale(${t.k})`}>${children}</div>
    <div class="pz-tools">${toolbar}
      <button class="pz-btn" aria-label="הגדלה" onClick=${() => setT({ ...t, k: clampK(t.k + 0.1) })}><${Icon} name="zoom-in" size=${20}/></button>
      <button class="pz-btn" aria-label="הקטנה" onClick=${() => setT({ ...t, k: clampK(t.k - 0.1) })}><${Icon} name="zoom-out" size=${20}/></button></div>
    ${centerTarget !== undefined && html`<button class="pz-center" aria-label="מרכוז" title="מרכוז" onClick=${() => fit(centerTarget)}><${Icon} name="locate-fixed" size=${22}/></button>`}
  </div>`;
}
export const GEOM = { COL, ROW, NODE };

const css = document.createElement('style');
css.textContent = `
:root{--node-locked:#DBDEE5;--node-locked-ink:#70747F;--node-locked-edge:#CACED6}
:root[data-theme="dark"]{--node-locked:#252931;--node-locked-ink:#70747F;--node-locked-edge:#3B404A}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--node-locked:#252931;--node-locked-ink:#70747F;--node-locked-edge:#3B404A}}
.rivet{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;padding:0;cursor:pointer;color:var(--text)}
.rivet-head{position:relative;border-radius:50%;display:grid;place-items:center;background:var(--fill);color:var(--ink);box-shadow:0 4px 0 var(--edge);transition:transform var(--dur-fast),box-shadow var(--dur-fast)}
.rivet:active .rivet-head{transform:translateY(4px);box-shadow:0 0 0 var(--edge)}
.rivet.pulse-ring .rivet-head{animation:ring 2s infinite}
@keyframes ring{0%{box-shadow:0 4px 0 var(--edge),0 0 0 0 var(--ring)}70%{box-shadow:0 4px 0 var(--edge),0 0 0 8px transparent}100%{box-shadow:0 4px 0 var(--edge),0 0 0 0 transparent}}
.rivet.draft .rivet-head{outline:2px dashed var(--border-strong);outline-offset:3px}
.rivet-badge{position:absolute;bottom:-2px;inset-inline-start:-2px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;box-shadow:0 0 0 2px var(--bg-app)}
.rivet-label{width:104px;text-align:center;color:var(--text)}
:root[data-theme="dark"] .rivet-head{background:color-mix(in srgb,var(--fill-d) 35%,var(--bg-surface));color:var(--ink-d)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .rivet-head{background:color-mix(in srgb,var(--fill-d) 35%,var(--bg-surface));color:var(--ink-d)}}
.pz{position:relative;height:min(70vh,640px);min-height:380px;overflow:hidden;touch-action:none;background:var(--bg-app);border-radius:var(--r-lg);border:1px solid var(--border);cursor:grab}
.pz-in{position:absolute;top:0;left:0;transform-origin:0 0}
.pz-tools{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:8px}
.pz-btn,.pz-center{width:44px;height:44px;border-radius:50%;border:0;background:var(--bg-raised);box-shadow:var(--shadow-lg);display:grid;place-items:center;cursor:pointer;color:var(--text)}
:root[data-theme="dark"] .pz-btn,:root[data-theme="dark"] .pz-center{border:1px solid var(--border)}
.pz-center{position:absolute;bottom:16px;inset-inline-start:16px;width:48px;height:48px}
.req-pill{position:absolute;transform:translate(-50%,-50%);background:var(--bg-subtle);border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500;padding:0 8px;height:22px;line-height:20px;white-space:nowrap;color:var(--text-secondary)}
.add-branch{position:absolute;transform:translate(-50%,0);width:24px;height:24px;border-radius:50%;border:1px solid var(--border-strong);background:var(--bg-surface);display:grid;place-items:center;cursor:pointer;color:var(--text-secondary);padding:0}
`;
document.head.appendChild(css);
