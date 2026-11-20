// Shared UI components (Design 6). Pure presentation — no system data here.
import { html, useEffect, useRef, useState } from './lib.js';
import { Icon } from './icons.js';
import { tintVars } from './color.js';
export { Icon };

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ kind = 'secondary', size, icon, children, onClick, disabled, loading, title, cls, full, type = 'button', iconEnd }) {
  const inner = html`${icon && html`<${Icon} name=${icon} size=${20}/>`}${children}${iconEnd && html`<${Icon} name=${iconEnd} size=${18}/>`}`;
  return html`<button type=${type} class=${cx('btn', 'btn-' + kind, size && 'btn-' + size, full && 'btn-full', cls)}
    disabled=${disabled || loading} onClick=${onClick} title=${title}>
    ${loading ? html`<span class="btn-label-hidden">${inner}</span><span class="spinner"/>` : inner}</button>`;
}
export function IconButton({ icon, label, onClick, disabled, small, badge, cls, color, size }) {
  return html`<button type="button" class=${cx('icon-btn', small && 'sm', cls)} aria-label=${label} title=${label} onClick=${onClick} disabled=${disabled} style=${color ? `color:${color}` : ''}>
    <${Icon} name=${icon} size=${size || (small ? 18 : 22)}/>${badge ? html`<span class="nav-badge"><${CountBadge} n=${badge}/></span>` : null}</button>`;
}
export function CountBadge({ n }) {
  if (!n) return null;
  return html`<span class="count-badge" dir="ltr" aria-label=${n + ''}>${n > 9 ? '9+' : n}</span>`;
}
export function Card({ title, action, children, cls, border, style, onClick, icon }) {
  return html`<section class=${cx('card', border && 'b', onClick && 'tap', cls)} style=${style} onClick=${onClick}>
    ${(title || action) && html`<div class="card-head">${icon && html`<${Icon} name=${icon} size=${20} cls="sec"/>`}<h2 class="card-title grow">${title}</h2>${action}</div>`}
    ${children}</section>`;
}
/** Tinted pill (status/priority/label). color = 'fx:done' | 'p:7' */
export function Pill({ text, color, dot = true, icon, cls, style }) {
  return html`<span class=${cx('pill tinted', cls)} style=${tintVars(color) + ';' + (style || '')}>${dot && !icon && html`<span class="dot"/>`}${icon && html`<${Icon} name=${icon} size=${14}/>`}<span class="ell">${text}</span></span>`;
}
export function Badge({ text, color, kind, icon, title }) {
  if (color) return html`<span class="badge tinted" style=${tintVars(color)} title=${title}>${icon && html`<${Icon} name=${icon} size=${14}/>`}${text}</span>`;
  return html`<span class=${cx('badge', kind)} title=${title}>${icon && html`<${Icon} name=${icon} size=${14}/>`}${text}</span>`;
}
export function Tag({ text, color }) {
  return html`<span class="tag tinted" style=${tintVars(color)}><bdi>${text}</bdi></span>`;
}
/** Coin chip — pulses once when the number grows (Design 6). */
export function CoinChip({ n, size, cls, title, danger }) {
  const prev = useRef(n);
  const [pulse, setPulse] = useState(false);
  const [shown, setShown] = useState(n);
  useEffect(() => {
    const from = prev.current; prev.current = n;
    if (from === n) { setShown(n); return; }
    if (n > from) setPulse(true);
    // count up (earning) or down (spending) over 400 ms
    const t0 = performance.now(); let raf;
    const step = (t) => { const k = Math.min(1, (t - t0) / 400); setShown(Math.round(from + (n - from) * k)); if (k < 1) raf = requestAnimationFrame(step); else setPulse(false); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return html`<span class=${cx('coin-chip', size, pulse && 'pulse', danger && 'danger', cls)} title=${title} aria-live="polite"><${Icon} name="coin" size=${size === 'lg' ? 22 : 16}/><span>${shown}</span></span>`;
}
export function Switch({ on, onChange, label, disabled, title }) {
  return html`<button type="button" role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${label} title=${title}
    class=${cx('switch', on && 'on')} disabled=${disabled} onClick=${() => onChange && onChange(!on)}/>`;
}
export function SwitchRow({ label, sub, on, onChange, disabled, title }) {
  return html`<div class="switch-row" title=${title}><div class="col gap4 grow"><span class="t-label">${label}</span>${sub && html`<span class="t-foot sec">${sub}</span>`}</div>
    <${Switch} on=${on} onChange=${onChange} label=${label} disabled=${disabled}/></div>`;
}
export function Checkbox({ on, onChange, label, disabled }) {
  return html`<button type="button" role="checkbox" aria-checked=${on ? 'true' : 'false'} aria-label=${label} disabled=${disabled}
    class=${cx('checkbox', on && 'on')} onClick=${(e) => { e.stopPropagation(); onChange && onChange(!on); }}>${on && html`<${Icon} name="check" size=${16} stroke=${3}/>`}</button>`;
}
export function CheckRow({ on, onChange, label, sub, disabled }) {
  return html`<div class="check-row" onClick=${() => !disabled && onChange(!on)}><${Checkbox} on=${on} onChange=${onChange} label=${label} disabled=${disabled}/>
    <span class="col gap4 grow"><span class="t-label">${label}</span>${sub && html`<span class="t-foot sec">${sub}</span>`}</span></div>`;
}
export function Radio({ on }) { return html`<span class=${cx('radio', on && 'on')}/>`; }
export function RadioRow({ on, onClick, label }) {
  return html`<button type="button" class="check-row" role="radio" aria-checked=${on ? 'true' : 'false'} onClick=${onClick}><${Radio} on=${on}/><span class="t-label">${label}</span></button>`;
}
export function Seg({ options, value, onChange, small, full, label }) {
  return html`<div class=${cx('seg', small && 'sm', full && 'full')} role="tablist" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="tab" aria-selected=${o.value === value ? 'true' : 'false'} class=${o.value === value ? 'on' : ''}
      disabled=${o.disabled} onClick=${() => onChange(o.value)}>${o.label}</button>`)}</div>`;
}
export function Chips({ items, value, onChange }) {
  return html`<div class="chips" role="tablist">${items.map((it) => it.head
    ? html`<span class="chip-head">${it.head}</span>`
    : html`<button type="button" role="tab" aria-selected=${it.value === value ? 'true' : 'false'} class=${cx('chip', it.value === value && 'on')} onClick=${() => onChange(it.value)}>${it.icon && html`<${Icon} name=${it.icon} size=${16}/>`}${it.label}${it.count != null ? html` <span class="num">${it.count}</span>` : null}</button>`)}</div>`;
}
export function Tabs({ items, value, onChange }) {
  return html`<div class="text-tabs" role="tablist">${items.map((it) => html`<button type="button" role="tab" aria-selected=${it.value === value ? 'true' : 'false'}
    class=${cx('text-tab', it.value === value && 'on')} onClick=${() => onChange(it.value)}>${it.label}${it.badge ? html` <${CountBadge} n=${it.badge}/>` : null}</button>`)}</div>`;
}
export function Field({ label, error, children, hint }) {
  return html`<div class="field">${label && html`<label>${label}</label>`}${children}
    ${error && html`<span class="field-error"><${Icon} name="circle-alert" size=${16}/>${error}</span>`}
    ${hint && !error && html`<span class="kbd-hint">${hint}</span>`}</div>`;
}
export function Progress({ value, max }) {
  const p = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return html`<div class="progress" role="progressbar" aria-valuenow=${value} aria-valuemax=${max}><div style=${`width:${p}%`}/></div>`;
}
export function SearchInput({ value, onInput, placeholder = 'חיפוש', autofocus }) {
  const ref = useRef();
  useEffect(() => { if (autofocus && ref.current) ref.current.focus(); }, []);
  return html`<div class="search"><${Icon} name="search" size=${20}/><input ref=${ref} class="input" type="search" placeholder=${placeholder} value=${value} onInput=${(e) => onInput(e.target.value)} aria-label=${placeholder}/></div>`;
}

/** Brand artwork from assets/ (Design 2). Missing files fall back to the simplified glyph. */
const LOGO_FILES = {
  sticker: 'assets/neat_logo_no_background_drop_shadow.png',
  plain: 'assets/neat_logo_no_background.png',
  wordmark: 'assets/NeatTeam-Banner.png',
  wordmarkDark: 'assets/NeatTeam-banner-dark.png',
};
const missingLogos = new Set();
export function Logo({ kind = 'sticker', size = 96, width }) {
  const [bad, setBad] = useState(missingLogos.has(kind));
  if (bad) {
    if (kind.startsWith('wordmark')) return html`<div class="t-title1" style=${`width:${width || 220}px;text-align:center`}><bdi>Neat Team</bdi></div>`;
    return html`<div class="glyph" style=${`width:${size}px;height:${size}px`} aria-label="Neat Team"><${Glyph} size=${size * 0.7}/></div>`;
  }
  return html`<img class="logo-img" src=${LOGO_FILES[kind]} alt="Neat Team" style=${width ? `width:${width}px;height:auto` : `width:${size}px;height:${size}px`}
    onError=${() => { missingLogos.add(kind); setBad(true); }}/>`;
}
/** Temporary simplified rivet-gun glyph (white silhouette), also used for the PWA icon. */
export function Glyph({ size = 48, color = '#fff' }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 64 64" aria-hidden="true"><g fill=${color}>
    <rect x="10" y="16" width="34" height="14" rx="5"/><rect x="44" y="20" width="12" height="6" rx="2"/>
    <rect x="54" y="19" width="4" height="8" rx="1.5"/><path d="M20 28h12l-3 22a3 3 0 0 1-3 2.6h-5a2 2 0 0 1-2-2.3z"/>
    <rect x="14" y="10" width="20" height="8" rx="3"/><circle cx="33" cy="34" r="3"/></g></svg>`;
}
export function EmptyState({ title, text, action, sticker = true }) {
  return html`<div class="empty">${sticker && html`<${Logo} kind="sticker" size=${96}/>`}
    <div class="t-title3">${title}</div>${text && html`<div class="t-foot sec">${text}</div>`}${action && html`<div class="mt8">${action}</div>`}</div>`;
}
export function LoadError({ onRetry }) {
  return html`<div class="load-error t-foot"><${Icon} name="circle-alert" size=${18}/><span class="grow">לא הצלחנו לטעון — נסה שוב</span>
    <${Button} size="sm" kind="tinted" onClick=${onRetry}>נסה שוב</${Button}></div>`;
}
/** Renders children; if they throw, shows the load-error line with retry (NeatSystem 4). */
export function Safe({ render }) {
  const [n, setN] = useState(0);
  try { return render(n); }
  catch (e) { console.error(e); return html`<${LoadError} onRetry=${() => setN(n + 1)}/>`; }
}
export function Skel({ w = '100%', h = 16, r }) {
  return html`<div class="skel" style=${`width:${w};height:${h}px;${r ? `border-radius:${r}px` : ''}`}/>`;
}
export function ReadOnlyNote({ text = 'בוגרים במצב קריאה בלבד' }) {
  return html`<div class="ro-note"><${Icon} name="eye" size=${16}/>${text}</div>`;
}
export function Confetti() {
  const colors = ['#3D2BFF', '#FF751F', '#FFFFFF', '#798CFF'];
  return html`<div class="confetti" aria-hidden="true">${Array.from({ length: 60 }, (_, i) => html`<i style=${`left:${(i * 37) % 100}%;background:${colors[i % 4]};animation-delay:${(i % 10) * 30}ms;animation-duration:${700 + (i % 5) * 80}ms;${colors[i % 4] === '#FFFFFF' ? 'box-shadow:0 0 0 1px #CACED6;' : ''}`}/>`)}</div>`;
}
/** Text-tab strip (Sunday board bar, sub-tabs) */
export function PageTitle({ children, action }) {
  return html`<div class="row between" style="margin:4px 0 16px"><h1 class="page-title" style="margin:0">${children}</h1>${action}</div>`;
}
