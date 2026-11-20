// Pickers (Design 10.2) — never the browser's native select.
import { html, useState, useRef, useEffect } from './lib.js';
import { Icon } from './icons.js';
import { popover, sheet, isPhone } from './overlay.js';
import { PRESETS, PASTELS, tintVars } from './color.js';
import { HE_MONTHS, HE_DAYS_SHORT, dayKey, parseDay, todayKey, byHe } from './format.js';
import { Avatar, safeRead, TeamBadge, TeamRankBadge } from './people.js';
import { Checkbox, SearchInput, cx } from './ui.js';
import { bus } from './bus.js';

/* ---------- pill picker ---------- */
export function PillList({ options, current, onPick, close, footer }) {
  return html`<div class="pill-list" role="listbox">
    ${options.map((o) => html`<button type="button" role="option" aria-selected=${o.key === current ? 'true' : 'false'} class="pill-opt tinted" style=${tintVars(o.color)}
      onClick=${() => { close(); onPick(o.key); }}>${o.icon ? html`<${Icon} name=${o.icon} size=${14}/>` : html`<span class="dot" style="width:6px;height:6px;border-radius:50%;background:currentColor"/>`}<span class="ell">${o.text}</span>
      ${o.key === current && html`<${Icon} name="check" size=${16} cls="check"/>`}</button>`)}
    ${footer && html`<div class="menu-sep"/><button type="button" class="menu-item" onClick=${() => { close(); footer.onClick(); }}><${Icon} name="pencil" size=${18}/>${footer.label}</button>`}
  </div>`;
}
export function pickPill(anchor, { options, current, onPick, footer, title }) {
  return popover(anchor, (close) => html`<${PillList} options=${options} current=${current} onPick=${onPick} close=${close} footer=${footer}/>`, { title });
}

/* ---------- date picker ---------- */
function Calendar({ start, end, allowRange, rangeOn: r0, onPick, close, selectable, marked, clearable, onClear }) {
  const base = parseDay(start || todayKey());
  const [ym, setYm] = useState([base.getFullYear(), base.getMonth()]);
  const [range, setRange] = useState(!!(r0 || (start && end && start !== end)));
  const [a, setA] = useState(range ? start : null);
  const first = new Date(ym[0], ym[1], 1);
  const startPad = first.getDay();
  const days = [];
  for (let i = 0; i < 42; i++) days.push(new Date(ym[0], ym[1], 1 - startPad + i));
  const today = todayKey();
  const pick = (k) => {
    if (range) {
      if (!a) { setA(k); return; }
      const [s, e] = a <= k ? [a, k] : [k, a];
      close(); onPick({ start: s, end: e });
    } else { close(); onPick({ start: null, end: k }); }
  };
  const move = (d) => { const m = ym[1] + d; setYm([ym[0] + Math.floor(m / 12), ((m % 12) + 12) % 12]); };
  const selS = range ? a || start : null, selE = range ? (a ? null : end) : (end || start);
  return html`<div class="cal">
    ${allowRange && html`<label class="check-row" style="min-height:40px"><${Checkbox} on=${range} onChange=${(v) => { setRange(v); setA(null); }} label="טווח זמנים"/><span class="t-label">טווח זמנים</span></label>`}
    <div class="cal-head"><button type="button" class="icon-btn sm" aria-label="החודש הקודם" onClick=${() => move(-1)}><${Icon} name="chevron-right" size=${20}/></button>
      <span class="t-label">${HE_MONTHS[ym[1]]} ${ym[0]}</span>
      <button type="button" class="icon-btn sm" aria-label="החודש הבא" onClick=${() => move(1)}><${Icon} name="chevron-left" size=${20}/></button></div>
    <div class="cal-grid" onKeyDown=${(e) => {
      const map = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }; // RTL: left = next day
      if (!(e.key in map)) return;
      const btns = [...e.currentTarget.querySelectorAll('.cal-day')];
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      const n = btns[i + map[e.key]]; if (n) { n.focus(); e.preventDefault(); }
    }}>${HE_DAYS_SHORT.map((d) => html`<div class="cal-dow">${d}</div>`)}
      ${days.map((d) => {
        const k = dayKey(d);
        const inMonth = d.getMonth() === ym[1];
        const ok = !selectable || selectable(k);
        const isSel = k === selS || k === selE;
        const isIn = range && selS && selE && k > selS && k < selE;
        return html`<button type="button" class=${cx('cal-day', !inMonth && 'other', k === today && 'today', isSel && 'sel', isIn && 'in')} disabled=${!ok}
          onClick=${() => pick(k)} aria-label=${k}>${d.getDate()}${marked && marked(k) ? html`<span class="mark"/>` : null}</button>`;
      })}</div>
    ${clearable && html`<button type="button" class="btn btn-link btn-sm" onClick=${() => { close(); onClear(); }}>ניקוי תאריך</button>`}
  </div>`;
}
export { Calendar };
/** opts: {start, end, allowRange, onPick({start,end}), clearable, onClear, selectable(k), marked(k)} */
export function pickDate(anchor, opts) {
  return popover(anchor, (close) => html`<${Calendar} ...${opts} close=${close}/>`, { title: opts.title || 'תאריך', width: 296 });
}

/* ---------- colour pickers ---------- */
export function pickColor(anchor, { current, onPick, title = 'צבע' }) {
  return popover(anchor, (close) => html`<div class="swatches" role="listbox">${PRESETS.map((p) => html`<button type="button" class=${cx('swatch', current === 'p:' + p.i && 'on')}
    style=${`background:${p.hex}`} title=${p.name} aria-label=${p.name} onClick=${() => { close(); onPick('p:' + p.i); }}/>`)}</div>`, { title });
}
export function pickPastel(anchor, { current, onPick, title = 'צבע' }) {
  return popover(anchor, (close) => html`<div class="swatches pastel" role="listbox">${PASTELS.map((p) => html`<button type="button" class=${cx('swatch')}
    style=${`background:${p.fill};color:${p.dark}`} title=${p.name} aria-label=${p.name} onClick=${() => { close(); onPick(p.i); }}>${current === p.i && html`<${Icon} name="check" size=${18} stroke=${3}/>`}</button>`)}</div>`, { title, width: 200 });
}
export function ColorSwatchButton({ value, onPick, label = 'צבע' }) {
  const hex = value && value.startsWith('p:') ? PRESETS[parseInt(value.slice(2), 10) - 1].hex : '#6B7280';
  return html`<button type="button" class="swatch" style=${`background:${hex}`} aria-label=${label} onClick=${(e) => pickColor(e.currentTarget, { current: value, onPick })}/>`;
}

/* ---------- size picker ---------- */
export const SIZE_LABELS = { small: 'קטנה', medium: 'בינונית', large: 'גדולה', huge: 'ענקית', none: 'ללא מטבעות' };
export const SIZE_COINS = { small: 1, medium: 2, large: 3, huge: 4 };
export function pickSize(anchor, { current, amounts, onPick }) {
  return popover(anchor, (close) => html`<div class="size-seg">
    ${['small', 'medium', 'large', 'huge'].map((k) => html`<button type="button" class=${cx('menu-item', current === k && 'kbd')} onClick=${() => { close(); onPick(k); }}>
      <span class="row gap4" style="color:var(--reward)">${Array.from({ length: SIZE_COINS[k] }, () => html`<${Icon} name="coin" size=${14}/>`)}</span>
      <span class="grow">${SIZE_LABELS[k]} · <span class="num">${amounts[k]}</span></span>${current === k && html`<${Icon} name="check" size=${16}/>`}</button>`)}
    <div class="menu-sep"/>
    <button type="button" class=${cx('menu-item', current === 'none' && 'kbd')} onClick=${() => { close(); onPick('none'); }}><span class="grow">ללא מטבעות</span>${current === 'none' && html`<${Icon} name="check" size=${16}/>`}</button>
  </div>`, { title: 'גודל' });
}

/* ---------- people picker ---------- */
export const ROLE_OPTIONS = [
  { value: 'member', label: 'חברי צוות' }, { value: 'lead', label: 'רש"צים' }, { value: 'captain', label: 'קפטנים' },
  { value: 'mentor', label: 'מנטורים' }, { value: 'admin', label: 'אדמינים' },
];
export const emptySelector = () => ({ all: false, users: [], teams: [], subteams: [], roles: [] });
export function selectorLabel(sel) {
  if (!sel) return 'כולם';
  if (sel.all) return 'כולם';
  const parts = [];
  (sel.teams || []).forEach((t) => { const x = safeRead('users.team', t); if (x) parts.push(x.name); });
  (sel.subteams || []).forEach((t) => { const x = safeRead('users.team', t); if (x) parts.push(x.name); });
  (sel.roles || []).forEach((r) => { const x = ROLE_OPTIONS.find((o) => o.value === r); if (x) parts.push(x.label); });
  const n = (sel.users || []).length;
  if (n) parts.push(n === 1 ? (safeRead('users.get', sel.users[0]) || {}).name_he || 'אדם אחד' : `${n} אנשים`);
  return parts.length ? parts.join(', ') : 'אף אחד';
}

function PeopleBody({ selected: sel0, onChange, candidates, relevantTeam, selectorMode, allowAll, me, single }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(sel0);
  const users = (safeRead('users.list', { statuses: ['active', 'alumni'] }) || []);
  const teams = (safeRead('users.teams') || []).filter((t) => !t.archived);
  const ids = selectorMode ? sel.users || [] : sel;
  const ql = q.trim().toLowerCase();
  const match = (u) => !ql || u.name_he.toLowerCase().includes(ql) || (u.google_name || '').toLowerCase().includes(ql) || (u.google_email || '').toLowerCase().includes(ql);
  let list = users.filter((u) => (ids.includes(u.id) || !candidates || candidates(u)) && match(u));
  list.sort((a, b) => {
    const ka = a.id === me ? 0 : ids.includes(a.id) ? 1 : relevantTeam && a.main_team === relevantTeam ? 2 : 3;
    const kb = b.id === me ? 0 : ids.includes(b.id) ? 1 : relevantTeam && b.main_team === relevantTeam ? 2 : 3;
    return ka - kb || byHe(a.name_he, b.name_he);
  });
  const update = (next) => { setSel(next); onChange(next); };
  const toggleUser = (id) => {
    if (selectorMode) { const u = sel.users || []; update({ ...sel, all: false, users: u.includes(id) ? u.filter((x) => x !== id) : [...u, id] }); }
    else if (single) update(sel.includes(id) ? [] : [id]);
    else update(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };
  const toggleKey = (key, v) => { const a = sel[key] || []; update({ ...sel, all: false, [key]: a.includes(v) ? a.filter((x) => x !== v) : [...a, v] }); };
  const inactive = (u) => candidates && !candidates(u);
  return html`<div class="people-picker">
    <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש לפי שם או מייל" autofocus=${!isPhone()}/>
    ${selectorMode && html`<div class="col gap4">
      ${allowAll && html`<div class="chips"><button type="button" class=${cx('chip', sel.all && 'on')} onClick=${() => update({ ...emptySelector(), all: !sel.all })}>כולם</button></div>`}
      <div class="chips">${teams.filter((t) => t.kind === 'main').map((t) => html`<button type="button" class=${cx('chip', (sel.teams || []).includes(t.id) && 'on')} onClick=${() => toggleKey('teams', t.id)}>${t.name}</button>`)}</div>
      <div class="chips">${teams.filter((t) => t.kind === 'sub').map((t) => html`<button type="button" class=${cx('chip', (sel.subteams || []).includes(t.id) && 'on')} onClick=${() => toggleKey('subteams', t.id)}>${t.name}</button>`)}</div>
      <div class="chips">${ROLE_OPTIONS.map((r) => html`<button type="button" class=${cx('chip', (sel.roles || []).includes(r.value) && 'on')} onClick=${() => toggleKey('roles', r.value)}>${r.label}</button>`)}</div>
    </div>`}
    ${ids.length > 0 && html`<div class="row wrap gap4">${ids.map((id) => { const u = users.find((x) => x.id === id); return u && html`<span class="sel-chip">${u.name_he}<button type="button" aria-label=${'הסרה ' + u.name_he} onClick=${() => toggleUser(id)}><${Icon} name="x" size=${14}/></button></span>`; })}</div>`}
    <div class="col gap4" style="max-height:340px;overflow:auto">
      ${list.length === 0 && html`<div class="t-foot sec center" style="padding:16px">לא נמצאו חברים</div>`}
      ${list.map((u) => html`<button type="button" key=${u.id} class=${cx('pp-row', inactive(u) && 'inactive')} onClick=${() => toggleUser(u.id)}>
        <${Avatar} uid=${u.id} size=${32} inactive=${inactive(u)}/>
        <span class="col gap4 grow" style="min-width:0"><span class="row gap4 t-label"><bdi class="ell">${u.name_he}</bdi>${u.id === me ? html`<span class="muted t-foot">(אני)</span>` : null}<${TeamRankBadge} uid=${u.id}/></span>
          ${inactive(u) ? html`<span class="t-foot muted">לא פעיל/ה</span>` : null}</span>
        <${TeamBadge} teamId=${u.main_team}/>
        <${Checkbox} on=${ids.includes(u.id)} onChange=${() => toggleUser(u.id)} label=${u.name_he}/></button>`)}
    </div></div>`;
}
/**
 * People picker. Saves on every toggle (onChange). Modes:
 *  - people: selected = [uid], onChange([uid])
 *  - selector: selected = {all, users, teams, subteams, roles}, onChange(selector)
 * candidates(user) → bool limits who is listed (inactive ones already selected stay, greyed).
 */
export function pickPeople(anchor, { title = 'בחירת אנשים', selected, onChange, candidates, relevantTeam, selector = false, allowAll = false, single = false }) {
  const me = safeRead('users.currentId');
  return popover(anchor, () => html`<${PeopleBody} selected=${selected} onChange=${onChange} candidates=${candidates} relevantTeam=${relevantTeam}
    selectorMode=${selector} allowAll=${allowAll} me=${me} single=${single}/>`, { title, noAutofocus: true });
}
/** Inline selector field (button showing the label; opens the picker). */
export function SelectorField({ value, onChange, allowAll = true, title, disabled }) {
  const [v, setV] = useState(value || emptySelector());
  useEffect(() => setV(value || emptySelector()), [JSON.stringify(value)]);
  return html`<button type="button" class="select-btn" disabled=${disabled} onClick=${(e) => pickPeople(e.currentTarget, { title, selector: true, allowAll, selected: v, onChange: (n) => { setV(n); onChange(n); } })}>
    <${Icon} name="users" size=${20} cls="sec"/><span class="grow ell">${selectorLabel(v)}</span><${Icon} name="chevron-down" size=${18} cls="sec"/></button>`;
}
/** Select-like button that opens a menu of options (replaces native <select>). */
export function MenuSelect({ value, options, onChange, placeholder = 'בחירה', disabled, title }) {
  const cur = options.find((o) => o.value === value);
  return html`<button type="button" class="select-btn" disabled=${disabled} onClick=${(e) => popover(e.currentTarget, (close) => html`<div class="col gap4" style="min-width:200px">
      ${options.map((o) => html`<button type="button" class=${cx('menu-item', o.value === value && 'kbd')} onClick=${() => { close(); onChange(o.value); }}><span class="grow">${o.label}</span>${o.value === value && html`<${Icon} name="check" size=${16}/>`}</button>`)}</div>`, { title: title || placeholder })}>
    <span class=${cx('grow ell', !cur && 'muted')}>${cur ? cur.label : placeholder}</span><${Icon} name="chevron-down" size=${18} cls="sec"/></button>`;
}
/** Date field button using the calendar picker. */
export function DateField({ value, onChange, placeholder = 'בחירת תאריך', selectable, clearable }) {
  return html`<button type="button" class="select-btn" onClick=${(e) => pickDate(e.currentTarget, { end: value, start: null, onPick: (v) => onChange(v.end), selectable, clearable, onClear: () => onChange(null) })}>
    <${Icon} name="calendar" size=${20} cls="sec"/><span class=${cx('grow', !value && 'muted')}>${value ? value.split('-').reverse().join('.') : placeholder}</span></button>`;
}
