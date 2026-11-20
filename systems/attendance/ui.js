// Attendance UI: marking (Design 11.7), calendar editing, team table, settings, own history.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addRoute, addWidget } from '../../core/registry.js';
import { Button, Icon, Seg, Field, Card, EmptyState, Badge, SwitchRow, cx } from '../../core/ui.js';
import { Avatar, PersonName, safeRead } from '../../core/people.js';
import { act, toast, confirm, sheet } from '../../core/overlay.js';
import { Calendar, DateField, MenuSelect, SelectorField, selectorLabel } from '../../core/pickers.js';
import { fmtDate, fmtDayShort, todayKey, addDaysKey, byHe } from '../../core/format.js';
import { DAY_HE, DEFAULTS } from './index.js';

const me = () => bus.read('users.currentId');
export const flameColor = (n) => (n >= 60 ? '#D69E00' : n >= 45 ? '#2D9CDB' : n >= 30 ? '#7B4DFF' : n >= 15 ? '#E2445C' : '#FF751F');
const Flame = ({ n, size = 16 }) => (n >= 2 ? html`<span class="row gap4 t-foot num"><${Icon} name="flame" size=${size} fill="currentColor" color=${flameColor(n)}/>${n}</span>` : html`<span class="t-foot muted num">${n}</span>`);

/* ---------- mark (3) ---------- */
function Mark() {
  const a = bus.read('users.actor', me());
  const cal = bus.read('attendance.calendar', addDaysKey(todayKey(), -400), todayKey()).filter((m) => !m.cancelled && !m.projected);
  const days = new Set(cal.map((m) => m.date));
  const last = cal[cal.length - 1];
  const [day, setDay] = useState(last ? last.date : todayKey());
  const dayMeetings = cal.filter((m) => m.date === day);
  const [mid, setMid] = useState(null);
  const m = dayMeetings.find((x) => x.id === mid) || dayMeetings[0];
  let body = html`<${EmptyState} title="אין פגישה ביום הזה" text="בחרו יום מסומן בלוח" sticker=${false}/>`;
  if (m) {
    const aud = bus.read('attendance.audience', m.id).filter((u) => bus.read('attendance.canMark', me(), m.id, u));
    const marks = bus.read('attendance.marks', m.id);
    const teams = bus.read('users.mainTeams');
    const byTeam = teams.map((t) => ({ t, list: aud.filter((u) => (bus.read('users.get', u) || {}).main_team === t.id) })).filter((g) => g.list.length);
    const unmarked = aud.filter((u) => !marks[u]);
    const row = (u) => {
      const st = bus.read('attendance.streak', u);
      const v = marks[u] ? marks[u].v : null;
      return html`<div class="lrow" key=${u}><${Avatar} uid=${u} size=${32}/><div class="col gap4 grow" style="min-width:0"><${PersonName} uid=${u}/><${Flame} n=${st.current}/></div>
        <${Seg} small value=${v} options=${[{ value: 'present', label: 'נוכח' }, { value: 'absent', label: 'לא נוכח' }]}
          onChange=${(nv) => act(() => bus.ask('attendance.mark', { actor: me(), meetingId: m.id, uid: u, value: nv === v ? null : nv }))}/></div>`;
    };
    body = html`<div class="col gap12">
      ${dayMeetings.length > 1 && html`<${Seg} value=${m.id} onChange=${setMid} options=${dayMeetings.map((x) => ({ value: x.id, label: `${x.time}${x.title ? ' · ' + x.title : ''}` }))}/>`}
      <div class="row between"><span class="t-label">${fmtDayShort(m.date)} · ${m.time}${m.title ? ' · ' + m.title : ''}</span>
        <${Button} kind="tinted" size="sm" disabled=${!unmarked.length} onClick=${() => act(() => bus.ask('attendance.markAll', { actor: me(), meetingId: m.id, uids: unmarked }))}>כולם נוכחים</${Button}></div>
      ${aud.length === 0 ? html`<p class="t-foot sec">אין אנשים שאפשר לסמן בפגישה הזו</p>` : byTeam.map((g) => html`<div><h3 class="group-head">${g.t.name}</h3><div class="list">${g.list.sort((x, y) => byHe(bus.read('users.get', x).name_he, bus.read('users.get', y).name_he)).map(row)}</div></div>`)}
    </div>`;
  }
  return html`<div class="two-col"><div class="card b"><${Calendar} start=${day} end=${day} close=${() => {}} onPick=${(v) => { setDay(v.end); setMid(null); }}
      selectable=${(k) => days.has(k)} marked=${(k) => days.has(k)}/></div><div>${body}</div></div>`;
}

/* ---------- calendar editing (2) ---------- */
function Meetings() {
  const s = bus.read('attendance.schedule');
  const [slots, setSlots] = useState(s.slots.map((x) => ({ ...x })));
  const [range, setRange] = useState([s.seasonStart, s.seasonEnd]);
  const dirty = JSON.stringify(slots) !== JSON.stringify(s.slots) || range[0] !== s.seasonStart || range[1] !== s.seasonEnd;
  const upcoming = bus.read('attendance.calendar', addDaysKey(todayKey(), -14), addDaysKey(todayKey(), 30)).filter((m) => !m.projected);
  const cancel = async (m) => {
    const marks = bus.read('attendance.marks', m.id);
    const n = Object.keys(marks).length;
    const ok = await confirm({ title: 'ביטול פגישה', text: n ? `בפגישה הזו כבר יש ${n} סימונים. המטבעות שלהם יבוטלו והרצפים יחושבו מחדש.` : `הפגישה ב-${fmtDate(m.date)} תבוטל והקהל יקבל הודעה.`, ok: 'ביטול פגישה', danger: true });
    if (ok) act(() => bus.ask('attendance.cancelMeeting', { actor: me(), meetingId: m.id }), 'הפגישה בוטלה');
  };
  return html`<div class="col gap16">
    <${Card} border title="מערכת שבועית">
      <div class="col gap8">${slots.map((sl, i) => html`<div class="row wrap gap8" key=${sl.id || i}>
        <div style="width:120px"><${MenuSelect} value=${sl.day} options=${DAY_HE.map((d, j) => ({ value: j, label: d }))} onChange=${(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, day: v } : x)))}/></div>
        <input class="input num" style="width:110px" type="time" value=${sl.time} onInput=${(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} aria-label="שעה"/>
        <input class="input grow" style="min-width:140px" placeholder="כותרת (לא חובה)" value=${sl.title} onInput=${(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}/>
        <button class="icon-btn" aria-label="הסרה" onClick=${() => setSlots(slots.filter((_, j) => j !== i))}><${Icon} name="x"/></button></div>`)}
        <div><${Button} kind="tinted" size="sm" onClick=${() => setSlots([...slots, { id: null, day: 0, time: '17:00', title: '' }])}>+ יום פגישה</${Button}></div>
        <div class="two-col"><${Field} label="תחילת עונה"><${DateField} value=${range[0]} onChange=${(v) => setRange([v, range[1]])}/></${Field}>
          <${Field} label="סוף עונה"><${DateField} value=${range[1]} onChange=${(v) => setRange([range[0], v])}/></${Field}></div>
        <span class="t-foot muted">שינוי חל רק על פגישות עתידיות שלא סומנו.</span>
        <div><${Button} kind="primary" disabled=${!dirty} onClick=${() => act(() => bus.ask('attendance.saveSchedule', { actor: me(), slots, seasonStart: range[0], seasonEnd: range[1] }), 'נשמר')}>שמירה</${Button}></div>
      </div></${Card}>
    <div class="row between"><h3 class="t-title3">פגישות קרובות</h3><${Button} kind="tinted" size="sm" onClick=${addExtra}>+ פגישה נוספת</${Button}></div>
    <div class="list">${upcoming.map((m) => html`<div class="lrow" key=${m.id}><${Icon} name=${m.kind === 'extra' ? 'calendar-plus' : 'calendar'} size=${20} cls="sec"/>
      <div class="col gap4 grow"><span class=${cx('t-label', m.cancelled && 'muted')} style=${m.cancelled ? 'text-decoration:line-through' : ''}>${fmtDayShort(m.date)} · ${m.time}${m.title ? ' · ' + m.title : ''}</span>
        <span class="t-foot sec">${m.kind === 'extra' ? `נוספת · ${selectorLabel(m.audience)} · ${m.coins} מטבעות` : 'קבועה'}${m.cancelled ? ' · בוטלה' : ''}</span></div>
      ${!m.cancelled && html`<${Button} size="xs" kind="danger" onClick=${() => cancel(m)}>ביטול פגישה</${Button}>`}</div>`)}</div>
  </div>`;
}
function addExtra() {
  const st = { date: null, time: '17:00', title: '', audience: { all: true }, coins: '' };
  const Body = () => {
    const [f, setF] = useState(st);
    Object.assign(st, f);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    return html`<div class="col gap12">
      <${Field} label="תאריך"><${DateField} value=${f.date} onChange=${set('date')}/></${Field}>
      <${Field} label="שעה"><input class="input num" type="time" value=${f.time} onInput=${(e) => set('time')(e.target.value)}/></${Field}>
      <${Field} label="כותרת"><input class="input" maxlength="40" value=${f.title} onInput=${(e) => set('title')(e.target.value)}/></${Field}>
      <${Field} label="קהל"><${SelectorField} value=${f.audience} onChange=${set('audience')} title="קהל הפגישה"/></${Field}>
      <${Field} label=${`מטבעות (ברירת מחדל ${bus.read('attendance.settings').coins_extra})`}><input class="input num" type="number" min="0" value=${f.coins} onInput=${(e) => set('coins')(e.target.value)}/></${Field}></div>`;
  };
  sheet('+ פגישה נוספת', () => html`<${Body}/>`, {
    dirty: () => !!(st.date || st.title),
    foot: (c) => html`<${Button} kind="primary" full onClick=${() => { const r = act(() => bus.ask('attendance.addMeeting', { actor: me(), ...st })); if (r) { c(); toast('הפגישה נוספה והקהל קיבל הודעה'); } }}>הוספה</${Button}>`,
  });
}

/* ---------- team table ---------- */
function TeamTable() {
  const a = bus.read('users.actor', me());
  const past = bus.read('attendance.calendar', addDaysKey(todayKey(), -120), todayKey()).filter((m) => !m.cancelled && !m.projected).slice(-16);
  const teams = bus.read('users.mainTeams').filter((t) => !(a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)) || t.id === a.team);
  const [team, setTeam] = useState(teams[0] && teams[0].id);
  const people = bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => u.main_team === team && (bus.read('users.actor', u.id) || {}).teamMember);
  const markMap = Object.fromEntries(past.map((m) => [m.id, bus.read('attendance.marks', m.id)]));
  return html`<div class="col gap12">
    ${teams.length > 1 && html`<${Seg} value=${team} onChange=${setTeam} options=${teams.map((t) => ({ value: t.id, label: t.name }))}/>`}
    <div class="table-wrap"><table class="table"><thead><tr><th>שם</th>${past.map((m) => html`<th class="num">${fmtDate(m.date).slice(0, 5)}</th>`)}<th>%</th></tr></thead>
      <tbody>${people.map((u) => {
        const vals = past.map((m) => (markMap[m.id][u.id] || {}).v);
        const marked = vals.filter(Boolean);
        const pct = marked.length ? Math.round((vals.filter((v) => v === 'present').length / marked.length) * 100) : 0;
        return html`<tr><td style="white-space:nowrap"><${PersonName} uid=${u.id}/></td>${vals.map((v) => html`<td class="center">${v === 'present' ? html`<${Icon} name="check" size=${16} color="var(--success)" label="נוכח"/>` : v === 'absent' ? html`<${Icon} name="x" size=${16} color="var(--danger)" label="לא נוכח"/>` : html`<span class="muted">·</span>`}</td>`)}<td class="num">${pct}%</td></tr>`;
      })}</tbody></table></div></div>`;
}
const SETTING_HE = { coins_regular: 'מטבעות לפגישה קבועה', coins_extra: 'מטבעות לפגישה נוספת', streak_length: 'אורך רצף לבונוס', freeze_cap: 'מקסימום הקפאות', edit_window_days: 'ימים לשינוי סימון' };
function Settings() {
  const s = bus.read('attendance.settings');
  return html`<div class="card b col gap12">${Object.keys(DEFAULTS).map((k) => html`<${Field} label=${`${SETTING_HE[k]} (attendance.${k})`}>
    <input class="input num" type="number" min="0" value=${s[k]} onChange=${(e) => act(() => bus.ask('attendance.setSettings', { actor: me(), patch: { [k]: Number(e.target.value) } }), 'נשמר')}/></${Field}>`)}</div>`;
}

/* ---------- own history ---------- */
function History({ uid }) {
  const h = bus.read('attendance.history', uid);
  const st = bus.read('attendance.streak', uid);
  return html`<div class="col gap12">
    <div class="row wrap gap8">${st.current >= 2 && html`<span class="badge"><${Icon} name="flame" size=${14} fill="currentColor" color=${flameColor(st.current)}/>רצף נוכחות: ${st.current}</span>`}
      <span class="badge">שיא: ${st.best}</span>${uid === me() && html`<span class="badge"><${Icon} name="snowflake" size=${14}/>הקפאות: ${st.freezes}</span>`}</div>
    ${h.length === 0 ? html`<p class="t-foot sec">עוד אין סימוני נוכחות</p>` : html`<div class="list">${h.slice(0, 60).map((m) => html`<div class="lrow" key=${m.id} style="min-height:48px">
      <span class="t-label num grow">${fmtDayShort(m.date)}${m.title ? ' · ' + m.title : ''}</span>
      ${m.cancelled ? html`<${Badge} text="בוטלה"/>` : m.value === 'present' ? html`<${Badge} kind="success" text="נוכח" icon="check"/>` : html`<${Badge} kind="danger" text="לא נוכח" icon="x"/>`}
      ${m.freezeUsed && html`<${Badge} text="הקפאה" icon="snowflake"/>`}
      <span class="coin-chip sm"><${Icon} name="coin" size=${14}/>${m.coins}</span></div>`)}</div>`}</div>`;
}
addRoute({ path: '/attendance/me', tab: 'home', title: 'נוכחות', access: 'any', render: () => html`<div><h1 class="page-title">נוכחות</h1><${History} uid=${me()}/></div>` });
addWidget('attendance.profileHistory', ({ viewer, target }) => (viewer === target ? html`<${Card} title="נוכחות" icon="calendar-check"><${History} uid=${target}/></${Card}>` : null));

addManagement('attendance', 'נוכחות', [
  { id: 'mark', title: 'נוכחות', icon: 'calendar-check', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), render: () => html`<${Mark}/>` },
  { id: 'meetings', title: 'פגישות', icon: 'calendar', can: (a) => a.isMentor || a.isAdmin || a.isCaptain, render: () => html`<${Meetings}/>` },
  { id: 'table', title: 'טבלת נוכחות', icon: 'table', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), render: () => html`<${TeamTable}/>` },
  { id: 'settings', title: 'הגדרות', icon: 'settings', can: (a) => a.isMentor, render: () => html`<${Settings}/>` },
]);
