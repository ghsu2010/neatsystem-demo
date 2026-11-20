// Countdown UI: Home cards (Design 11.6), full-screen view, management (ספירות לאחור).
import { html, useState, useEffect } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addWidget } from '../../core/registry.js';
import { Button, Icon, Seg, Field, EmptyState, IconButton, Logo, cx } from '../../core/ui.js';
import { act, confirm, sheet, toast } from '../../core/overlay.js';
import { DateField } from '../../core/pickers.js';
import { fmtDate, fmtTime, fmtLongDay, dayKey, todayKey, daysBetween } from '../../core/format.js';
import { now } from '../../core/clock.js';
import { navigate } from '../../core/router.js';

const me = () => bus.read('users.currentId');
function left(e) {
  const ms = new Date(e.at) - now();
  if (dayKey(e.at) === todayKey()) return { today: true };
  const mins = Math.max(0, Math.floor(ms / 60000));
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}
function Numbers({ e, mode, big }) {
  const l = left(e);
  const cls = big ? 'cd-big' : 't-display';
  const lab = big ? 'cd-lab' : 't-foot sec';
  if (l.today) return html`<div class=${cls}>היום!</div>`;
  const blocks = mode === 'meetings' ? [[bus.read('countdown.meetingsLeft', e.id), 'פגישות']] : [[l.d, 'ימים'], [l.h, 'שעות'], [l.m, 'דקות']];
  return html`<div class="row" style=${`gap:${big ? 24 : 16}px;justify-content:${big ? 'center' : 'flex-start'}`}>${blocks.map(([n, label]) => html`<div class="col" style="gap:0;align-items:center;min-width:${big ? 0 : 56}px">
    <span class=${cls + ' num'}>${n}</span><span class=${lab}>${label}</span></div>`)}</div>`;
}
function openFull(id) {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  sheet('', (close) => html`<${Full} id=${id} close=${() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); close(); }}/>`, { screen: true, onClose: () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } });
}
function Full({ id, close }) {
  const e = bus.read('countdown.all').find((x) => x.id === id);
  const [mode, setMode] = useState('time');
  if (!e) return null;
  return html`<div class="cd-full">
    <button class="icon-btn" style="position:absolute;top:16px;inset-inline-start:16px" aria-label="סגירה" onClick=${close}><${Icon} name="x"/></button>
    <${Logo} kind="sticker" size=${96}/>
    <h1 class="cd-name">${e.name}</h1>${e.desc && html`<p class="t-body sec center" dir="auto">${e.desc}</p>`}
    <${Numbers} e=${e} mode=${mode} big/>
    <${Seg} value=${mode} onChange=${setMode} options=${[{ value: 'time', label: 'זמן' }, { value: 'meetings', label: 'פגישות' }]}/>
  </div>`;
}
function HomeCountdowns({ uid }) {
  const list = bus.read('countdown.upcoming');
  const canEdit = bus.read('countdown.canEdit', uid);
  const [mode, setMode] = useState({});
  if (!list.length) return null;
  const [first, ...rest] = list;
  const m = mode[first.id] || 'time';
  return html`<div class="col gap8">
    <section class="card" style="background:var(--brand-subtle);box-shadow:none">
      <div class="row gap8"><h2 class="t-title3 grow">${first.name}</h2>
        ${canEdit && html`<${IconButton} small icon="pencil" label="עריכה" onClick=${() => editForm(first)}/>`}
        <${IconButton} small icon="maximize" label="מסך מלא" onClick=${() => openFull(first.id)}/></div>
      <div class="mt8"><${Numbers} e=${first} mode=${m}/></div>
      <div class="row between wrap mt8"><span class="t-foot sec">${fmtLongDay(first.at)} · ${fmtTime(first.at)}</span>
        <${Seg} small value=${m} onChange=${(v) => setMode({ ...mode, [first.id]: v })} options=${[{ value: 'time', label: 'זמן' }, { value: 'meetings', label: 'פגישות' }]}/></div>
    </section>
    ${rest.length > 0 && html`<div class="list shadow">${rest.map((e) => { const l = left(e); const mm = mode[e.id] || 'time'; return html`<div class="lrow" key=${e.id}>
      <div class="col gap4 grow"><span class="t-label">${e.name}</span><span class="t-foot sec">${l.today ? 'היום!' : mm === 'meetings' ? `בעוד ${bus.read('countdown.meetingsLeft', e.id)} פגישות` : `בעוד ${daysBetween(now(), new Date(e.at))} ימים`}</span></div>
      <${Seg} small value=${mm} onChange=${(v) => setMode({ ...mode, [e.id]: v })} options=${[{ value: 'time', label: 'זמן' }, { value: 'meetings', label: 'פגישות' }]}/>
      ${canEdit && html`<${IconButton} small icon="pencil" label="עריכה" onClick=${() => editForm(e)}/>`}
      <${IconButton} small icon="maximize" label="מסך מלא" onClick=${() => openFull(e.id)}/></div>`; })}</div>`}
  </div>`;
}
addWidget('countdown.home', HomeCountdowns);

function editForm(e) {
  const st = e ? { name: e.name, date: dayKey(e.at), time: fmtTime(e.at), desc: e.desc, showFrom: e.showFrom } : { name: '', date: null, time: '19:00', desc: '', showFrom: null };
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    return html`<div class="col gap12">
      <${Field} label="שם (עד 40)"><input class="input" maxlength="40" placeholder="קיקאוף 2027" value=${f.name} onInput=${(x) => set('name')(x.target.value)}/></${Field}>
      <div class="two-col"><${Field} label="תאריך"><${DateField} value=${f.date} onChange=${set('date')} selectable=${(k) => k >= todayKey()}/></${Field}>
        <${Field} label="שעה"><input class="input num" type="time" value=${f.time} onInput=${(x) => set('time')(x.target.value)}/></${Field}></div>
      <${Field} label="תיאור (לא חובה, עד 140)"><textarea class="textarea" maxlength="140" value=${f.desc} onInput=${(x) => set('desc')(x.target.value)}/></${Field}>
      <${Field} label="מוצג החל מ (לא חובה)"><${DateField} value=${f.showFrom} onChange=${set('showFrom')} clearable placeholder="מיד"/></${Field}></div>`;
  };
  sheet(e ? 'עריכת ספירה' : '+ ספירה חדשה', () => html`<${Body}/>`, {
    dirty: () => !e && !!(st.name || st.date),
    foot: (c) => html`${e && html`<${Button} kind="danger" onClick=${async () => { if (await confirm({ title: `מחיקת ${e.name}`, text: 'הספירה תימחק מהבית.', ok: 'מחיקה', danger: true })) { if (act(() => bus.ask('countdown.remove', { actor: me(), id: e.id })) !== undefined) c(); } }}>מחיקה</${Button}>`}
      <${Button} kind="primary" cls="grow" onClick=${() => { if (!st.date) return toast('בחרו תאריך'); const [y, mo, d] = st.date.split('-').map(Number); const [hh, mm] = st.time.split(':').map(Number);
        if (act(() => bus.ask('countdown.save', { actor: me(), id: e && e.id, name: st.name, at: new Date(y, mo - 1, d, hh, mm).toISOString(), desc: st.desc, showFrom: st.showFrom }))) { c(); toast('נשמר'); } }}>שמירה</${Button}>`,
  });
}
function Manage() {
  const all = bus.read('countdown.all');
  const t = todayKey();
  const up = all.filter((e) => dayKey(e.at) >= t), past = all.filter((e) => dayKey(e.at) < t);
  const canCal = bus.read('attendance.canEditCalendar', me());
  const row = (e) => html`<button class="lrow" key=${e.id} onClick=${() => editForm(e)}><${Icon} name="timer" size=${20} cls="sec"/><div class="col gap4 grow"><span class="t-label">${e.name}</span>
    <span class="t-foot sec">${fmtDate(e.at)} ${fmtTime(e.at)}${e.showFrom ? ` · מוצג מ-${fmtDate(e.showFrom)}` : ''}</span></div><${Icon} name="chevron-left" size=${20} cls="chev"/></button>`;
  return html`<div class="col gap12"><div class="row wrap"><${Button} kind="tinted" size="sm" onClick=${() => editForm(null)}>+ ספירה חדשה</${Button}>
      ${canCal && html`<${Button} kind="link" size="sm" onClick=${() => navigate('/manage/home/attendance/meetings')}>עריכת ימי פגישות</${Button}>`}</div>
    ${up.length ? html`<div class="list">${up.map(row)}</div>` : html`<${EmptyState} title="אין ספירות פעילות" sticker=${false}/>`}
    ${past.length > 0 && html`<h3 class="group-head">עברו</h3><div class="list">${past.map(row)}</div>`}</div>`;
}
addManagement('countdown', 'ספירה לאחור', [{ id: 'events', title: 'ספירות לאחור', icon: 'timer', can: (a) => a.isMentor || a.isAdmin, render: () => html`<${Manage}/>` }]);

const css = document.createElement('style');
css.textContent = `.cd-full{position:relative;min-height:calc(100dvh - 32px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px 16px;isolation:isolate}
.cd-name{font-size:48px;line-height:56px;font-weight:700;text-align:center}
.cd-big{font-size:clamp(56px,18vw,120px);line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
.cd-lab{font-size:24px;line-height:32px;font-weight:500;color:var(--text-secondary)}
@media (max-width:480px){.cd-name{font-size:32px;line-height:40px}.cd-lab{font-size:18px}}`;
document.head.appendChild(css);
