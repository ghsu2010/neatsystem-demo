// Layers: bottom sheets (phone) / modals (desktop), dialogs, popovers, side panel, action sheets,
// toasts (Design 6, 10.2, 10.3, 10.9). One host renders them; content re-renders with the app.
import { html, useEffect, useRef, useState } from './lib.js';
import { Icon } from './icons.js';
import { scheduleRefresh } from './refresh.js';

let layers = [];
let toasts = [];
let seq = 0;
export const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

// Phone back gesture closes the top sheet/panel first (Design 10.7, 10.9): each phone layer pushes a
// same-URL history entry; "back" pops it and we close the layer instead of leaving the page.
let ignorePop = false;
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  const top = layers[layers.length - 1];
  if (top && top.historyEntry) { top.historyEntry = false; closeTop(); }
});
function push(layer) {
  const id = ++seq;
  layer.id = id;
  if (isPhone() && layer.kind !== 'popover') { history.pushState({ nsLayer: id }, '', location.href); layer.historyEntry = true; }
  layers = [...layers, layer];
  scheduleRefresh();
  return () => close(id);
}
function close(id, reason) {
  const l = layers.find((x) => x.id === id);
  if (!l) return;
  if (l.historyEntry && history.state && history.state.nsLayer === id) { ignorePop = true; history.back(); }
  layers = layers.filter((x) => x.id !== id);
  l.onClose && l.onClose(reason);
  scheduleRefresh();
  if (l.returnFocus && l.returnFocus.focus) setTimeout(() => l.returnFocus.focus(), 0);
}
export function closeTop() {
  const top = layers[layers.length - 1];
  if (!top) return false;
  if (top.dirty && top.dirty() && top.onDirtyClose) { top.onDirtyClose(() => close(top.id)); return true; }
  if (top.dirty && top.dirty()) {
    confirm({ title: 'לצאת בלי לשמור?', text: 'השינויים שלא נשמרו יימחקו.', ok: 'יציאה', danger: true }).then((ok) => ok && close(top.id));
    return true;
  }
  close(top.id, 'esc');
  return true;
}
export function closeAll() { layers.slice().reverse().forEach((l) => close(l.id)); }
export function hasLayers() { return layers.length > 0; }

/**
 * Sheet: bottom sheet on phone, centred modal on desktop.
 * render(close) → content. opts: {title, foot:(close)=>vnode, full, wide, dirty:()=>bool, onClose}
 */
export function sheet(title, render, opts = {}) {
  return push({ kind: 'sheet', title, render, returnFocus: document.activeElement, ...opts });
}
/** Side panel (desktop 480 px from the inline end, phone full-screen). Only one at a time; swaps content. */
let panelId = null;
export function panel(key, title, render, opts = {}) {
  const existing = layers.find((l) => l.id === panelId);
  if (existing) {
    existing.key = key; existing.render = render; existing.title = title; Object.assign(existing, opts);
    layers = [...layers]; scheduleRefresh();
    return () => close(existing.id);
  }
  const c = push({ kind: 'panel', key, title, render, ...opts, onClose: () => { panelId = null; opts.onClose && opts.onClose(); } });
  panelId = seq;
  return c;
}
export function panelKey() { const p = layers.find((l) => l.id === panelId); return p ? p.key : null; }
export function closePanel() { if (panelId) close(panelId); }

/** Popover anchored to an element on desktop; bottom sheet on phone. */
export function popover(anchor, render, opts = {}) {
  if (isPhone()) return sheet(opts.title || '', render, { ...opts, compact: true });
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 };
  return push({ kind: 'popover', render, rect: r, returnFocus: anchor, ...opts });
}
/** Confirmation dialog → Promise<boolean>. Destructive button on the inline end (left). */
export function confirm({ title, text, ok = 'אישור', cancel = 'ביטול', danger = false, body }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, c) => { if (done) return; done = true; c(); resolve(v); };
    push({
      kind: 'dialog', title,
      render: (c) => html`<div class="stack">${text && html`<p class="t-body sec">${text}</p>`}${body ? body() : null}</div>`,
      foot: (c) => html`<button class="btn btn-secondary grow" onClick=${() => finish(false, c)}>${cancel}</button>
        <button class=${'btn grow ' + (danger ? 'btn-danger-fill' : 'btn-primary')} onClick=${() => finish(true, c)}>${ok}</button>`,
      onClose: () => { if (!done) { done = true; resolve(false); } },
    });
  });
}
/** Dialog with a required text field → Promise<string|null>. */
export function promptText({ title, text, label, ok = 'אישור', danger = false, min = 1, max = 280, multiline = true, value = '' }) {
  return new Promise((resolve) => {
    let v = value, done = false;
    const Body = () => {
      const [s, setS] = useState(v);
      v = s;
      const ref = useRef();
      useEffect(() => { ref.current && ref.current.focus(); }, []);
      return html`<div class="stack">${text && html`<p class="t-body sec">${text}</p>`}
        <div class="field">${label && html`<label>${label}</label>`}
        ${multiline ? html`<textarea ref=${ref} class="textarea" maxlength=${max} value=${s} onInput=${(e) => setS(e.target.value)}/>`
          : html`<input ref=${ref} class="input" maxlength=${max} value=${s} onInput=${(e) => setS(e.target.value)}/>`}
        <span class="kbd-hint num">${s.trim().length}/${max}</span></div></div>`;
    };
    push({
      kind: 'dialog', title, render: () => html`<${Body}/>`,
      foot: (c) => html`<button class="btn btn-secondary grow" onClick=${() => { done = true; c(); resolve(null); }}>ביטול</button>
        <button class=${'btn grow ' + (danger ? 'btn-danger-fill' : 'btn-primary')} onClick=${() => { if (v.trim().length < min) return toast(`צריך לפחות ${min} תווים`); done = true; c(); resolve(v.trim()); }}>${ok}</button>`,
      onClose: () => { if (!done) resolve(null); },
    });
  });
}
/** Action sheet (Design 10.7): rows {icon, label, onClick, danger, hidden}. Phone: bottom sheet; desktop: popover. */
export function actionSheet(title, rows, anchor) {
  const vis = rows.filter((r) => r && !r.hidden);
  const render = (c) => html`<div class="col gap4" style="min-width:220px">
    ${vis.map((r) => html`<button class=${'menu-item action-row' + (r.danger ? ' danger' : '')} disabled=${r.disabled} title=${r.title}
      onClick=${() => { c(); r.onClick && r.onClick(); }}>${r.icon && html`<${Icon} name=${r.icon} size=${20}/>`}<span class="grow">${r.label}</span></button>`)}
    ${isPhone() ? html`<button class="menu-item action-row" onClick=${c}><${Icon} name="x" size=${20}/>ביטול</button>` : null}
  </div>`;
  if (anchor && !isPhone()) return popover(anchor, render);
  return sheet(title, render, { compact: true });
}

/** Toast: text, {undo: fn, coin: n (+25 coin toast), duration} (Design 6, 10.3) */
export function toast(text, opts = {}) {
  const id = ++seq;
  const t = { id, text, ...opts };
  toasts = [...toasts.slice(-2), t];
  scheduleRefresh();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== id); scheduleRefresh(); }, opts.duration || (opts.undo ? 5000 : 4000));
}
/** Run a write; show its error as a toast. Returns the result or undefined. */
export function act(fn, okText) {
  try {
    const r = fn();
    if (okText) toast(okText);
    return r;
  } catch (e) {
    console.warn(e);
    toast(e && e.message ? e.message : 'לא נשמר', { retry: true });
    return undefined;
  }
}

function placePopover(el, rect, width) {
  if (!el) return;
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = rect.right - w; // RTL: align to the inline start (right edge)
  if (left < 8) left = Math.min(rect.left, innerWidth - w - 8);
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = rect.bottom + 4;
  if (top + hgt > innerHeight - 8) top = Math.max(8, rect.top - hgt - 4);
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

function Popover({ l }) {
  const ref = useRef();
  useEffect(() => { placePopover(ref.current, l.rect); const f = ref.current && ref.current.querySelector('input,button'); if (f && !l.noAutofocus) f.focus(); }, []);
  return html`<div class="backdrop clear" onMouseDown=${() => close(l.id)}/>
    <div ref=${ref} class="popover" role="dialog" style=${`left:-9999px;top:0;${l.width ? `width:${l.width}px` : ''}`} onKeyDown=${menuKeys}>${l.render(() => close(l.id))}</div>`;
}
function menuKeys(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = [...e.currentTarget.querySelectorAll('button:not(:disabled)')];
  const i = items.indexOf(document.activeElement);
  const n = e.key === 'ArrowDown' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
  if (n) { n.focus(); e.preventDefault(); }
}
function SheetLayer({ l }) {
  const c = () => closeTop();
  const phone = isPhone();
  const head = (l.title || l.closeBtn !== false) && html`<div class="sheet-head">
      <div class="sheet-title clamp2">${l.title}</div>
      <button class="icon-btn" aria-label="סגירה" onClick=${c}><${Icon} name="x"/></button></div>`;
  const body = html`<div class="sheet-body">${l.render(() => close(l.id))}</div>`;
  const foot = l.foot && html`<div class="sheet-foot">${l.foot(() => close(l.id))}</div>`;
  if (l.screen) return html`<div class="screen-layer" role="dialog" aria-modal="true">${l.render(() => close(l.id))}</div>`;
  if (l.kind === 'dialog') {
    return html`<div class="backdrop" onClick=${c}/><div class="modal dialog" role="alertdialog" aria-modal="true">${head}${body}${foot}</div>`;
  }
  if (phone) {
    // swipe down on the handle/header closes the sheet (Design 10.9)
    const swipe = (e) => {
      const y0 = e.clientY; const el = e.currentTarget.parentElement;
      const mv = (ev) => { const dy = Math.max(0, ev.clientY - y0); el.style.transform = `translateY(${dy}px)`; };
      const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); el.style.transform = ''; if (ev.clientY - y0 > 80) c(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    return html`<div class="backdrop" onClick=${c}/><div class=${'sheet' + (l.full ? ' full' : '')} role="dialog" aria-modal="true">
      ${!l.full && html`<div class="grab-zone" onPointerDown=${swipe}><div class="grab"/></div>`}${head}${body}${foot}</div>`;
  }
  return html`<div class="backdrop" onClick=${c}/><div class=${'modal' + (l.wide ? ' wide' : '') + (l.xwide ? ' xwide' : '') + (l.full ? ' full' : '')} role="dialog" aria-modal="true">${head}${body}${foot}</div>`;
}
function PanelLayer({ l }) {
  const phone = isPhone();
  return html`<div class=${phone ? 'sheet full' : 'panel'} role="complementary">
    <div class="sheet-head"><div class="sheet-title clamp2">${l.title}</div>
      <button class="icon-btn" aria-label="סגירה" onClick=${() => close(l.id)}><${Icon} name="x"/></button></div>
    <div class="sheet-body">${l.render(() => close(l.id))}</div></div>`;
}

export function OverlayHost() {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && layers.length) { e.preventDefault(); closeTop(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return html`<div class="layer-root">
    ${layers.map((l) => html`<div key=${l.id}>
      ${l.kind === 'popover' ? html`<${Popover} l=${l}/>` : l.kind === 'panel' ? html`<${PanelLayer} l=${l}/>` : html`<${SheetLayer} l=${l}/>`}
    </div>`)}
    <div class="toasts" role="status" aria-live="polite">
      ${toasts.map((t) => html`<div key=${t.id} class="toast">
        ${t.coin != null && html`<${Icon} name="coin" size=${20} cls="coin"/><span class=${t.coin >= 0 ? 'plus' : ''}>${t.coin >= 0 ? '+' + t.coin : '−' + Math.abs(t.coin)}</span>`}
        <span class="grow">${t.text}</span>
        ${t.undo && html`<button onClick=${() => { toasts = toasts.filter((x) => x.id !== t.id); scheduleRefresh(); act(t.undo); }}>ביטול</button>`}
        ${t.retryFn && html`<button onClick=${() => { toasts = toasts.filter((x) => x.id !== t.id); act(t.retryFn); }}>נסה שוב</button>`}
      </div>`)}
    </div></div>`;
}
