// Leaderboard UI: Home card (Design 11.4) and management (Leaderboard 6).
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addWidget } from '../../core/registry.js';
import { Button, Icon, Seg, Card, Switch, Field, Badge, cx } from '../../core/ui.js';
import { Avatar, PersonName, TeamBadge } from '../../core/people.js';
import { act, confirm } from '../../core/overlay.js';
import { MenuSelect, DateField } from '../../core/pickers.js';
import { fmtDate, daysBetween } from '../../core/format.js';
import { now } from '../../core/clock.js';
import { SCHEDULE_HE } from './index.js';

const MEDAL = { 1: '#D69E00', 2: '#9AA3AF', 3: '#B26B32' };
const me = () => bus.read('users.currentId');

function HomeCard({ uid }) {
  const a = bus.read('users.actor', uid);
  const [view, setView] = useState('team');
  const hasTeam = a.team && bus.read('leaderboard.board', a.team) && bus.read('leaderboard.board', a.team).on;
  const id = !hasTeam || a.isMentor ? 'all' : view === 'team' ? a.team : 'all';
  const bd = bus.read('leaderboard.board', id);
  if (!bd || !bd.on) return null;
  const rows = bus.read('leaderboard.standings', id);
  const end = new Date(bus.read('leaderboard.periodEnd', id));
  const days = Math.max(0, daysBetween(now(), end));
  const top = rows.slice(0, 10);
  const mine = rows.find((r) => r.uid === uid);
  const pinned = mine && !top.includes(mine) ? mine : null;
  const empty = !rows.some((r) => r.score > 0);
  const row = (r) => html`<div class="lrow" key=${r.uid} style=${`min-height:52px;${r.uid === uid ? 'background:var(--brand-subtle);border-radius:var(--r-sm)' : ''}`}>
    <span class="t-label sec num" style="width:20px;text-align:center">${r.place || ''}</span><${Avatar} uid=${r.uid} size=${32}/>
    <span class="row gap4 grow" style="min-width:0"><${PersonName} uid=${r.uid}/>${r.place && r.place <= 3 && html`<${Icon} name="flame" size=${18} fill="currentColor" color=${MEDAL[r.place]} label=${`מקום ${r.place}`}/>`}</span>
    ${id === 'all' && html`<${TeamBadge} teamId=${r.team}/>`}<span class="coin-chip sm"><${Icon} name="coin" size=${14}/>${r.score}</span></div>`;
  return html`<${Card} title="טבלת מובילים" icon="trophy">
    <div class="row between wrap" style="margin:-4px 0 12px"><span class="t-foot sec">מתאפס בעוד ${days} ימים</span>
      ${hasTeam && !a.isMentor && html`<${Seg} small value=${view} onChange=${setView} options=${[{ value: 'team', label: 'הצוות שלי' }, { value: 'all', label: 'כל הצוותים' }]}/>`}</div>
    ${empty ? html`<p class="t-foot sec">עוד אין מטבעות בתקופה הזו</p>` : html`<div class="col" style="gap:2px">${top.map(row)}${pinned && html`<div class="divider"/>${row(pinned)}`}</div>`}
  </${Card}>`;
}
addWidget('leaderboard.home', HomeCard);

function BoardRow({ bd }) {
  const [s, setS] = useState({ ...bd.schedule });
  const name = bd.team ? (bus.read('users.team', bd.team) || {}).name : 'כל הצוותים';
  const [open, setOpen] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(bd.schedule);
  return html`<div class="card b col gap12">
    <div class="row gap8"><span class="t-title3 grow">${name}</span><span class="t-foot sec">${bd.on ? 'מוצג' : 'כבוי'}</span><${Switch} on=${bd.on} label="הצגה" onChange=${(v) => act(() => bus.ask('leaderboard.setBoard', { actor: me(), id: bd.id, on: v }))}/></div>
    <div class="row wrap gap8"><div style="min-width:160px"><${MenuSelect} value=${s.type} options=${Object.entries(SCHEDULE_HE).map(([v, l]) => ({ value: v, label: l }))} onChange=${(v) => setS({ ...s, type: v })}/></div>
      ${s.type === 'season' && html`<div style="min-width:150px"><${DateField} value=${s.start} onChange=${(v) => setS({ ...s, start: v })} placeholder="התחלה"/></div><div style="min-width:150px"><${DateField} value=${s.end} onChange=${(v) => setS({ ...s, end: v })} placeholder="סיום"/></div>`}
      ${s.type === 'custom' && html`<div style="min-width:150px"><${DateField} value=${s.customEnd} onChange=${(v) => setS({ ...s, customEnd: v })} placeholder="עד תאריך"/></div>`}
      <${Button} size="sm" kind="primary" disabled=${!dirty} onClick=${() => act(() => bus.ask('leaderboard.setBoard', { actor: me(), id: bd.id, schedule: s }), 'נשמר')}>שמירה</${Button}></div>
    <span class="t-foot sec">תקופה נוכחית: ${fmtDate(bd.periodStart)} – ${fmtDate(new Date(new Date(bus.read('leaderboard.periodEnd', bd.id)).getTime() - 1))}</span>
    <div class="row wrap"><${Button} size="sm" kind="danger" onClick=${async () => { if (await confirm({ title: 'איפוס עכשיו', text: `טבלת ${name} תתחיל מ-0. שלושת הראשונים יישמרו בתקופות קודמות.`, ok: 'איפוס עכשיו', danger: true })) act(() => bus.ask('leaderboard.resetNow', { actor: me(), id: bd.id }), 'אופס'); }}>איפוס עכשיו</${Button}>
      <${Button} size="sm" kind="ghost" onClick=${() => setOpen(!open)}>תקופות קודמות (${(bd.history || []).length})</${Button}></div>
    ${open && html`<div class="list">${(bd.history || []).slice().reverse().map((h) => html`<div class="lrow"><span class="t-foot sec num">${fmtDate(h.start)} – ${fmtDate(new Date(new Date(h.end).getTime() - 1))}</span>
      <span class="row wrap gap8 grow">${h.top3.length ? h.top3.map((t) => html`<span class="row gap4 t-foot"><${Icon} name="flame" size=${14} fill="currentColor" color=${MEDAL[t.place]}/>${t.name} · ${t.score}</span>`) : html`<span class="t-foot muted">אין</span>`}</span></div>`)}</div>`}
  </div>`;
}
addManagement('leaderboard', 'טבלת מובילים', [
  { id: 'boards', title: 'טבלאות מובילים', icon: 'trophy', can: (a) => a.isCaptain || a.isAdmin || a.isMentor, render: () => html`<div class="col gap12">${bus.read('leaderboard.boards').map((bd) => html`<${BoardRow} key=${bd.id + JSON.stringify(bd.schedule)} bd=${bd}/>`)}</div>` },
]);
