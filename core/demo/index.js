// כלי הדגמה — demo-only tools (prompt section 5). Nothing here is part of the real app.
//  * "כניסה כ…" instead of Google sign-in, plus "חשבון Google חדש" (runs the real sign-up flow)
//  * switch-user button in the top bar → user list + testing panel (date/time override, offline switch)
//  * "איפוס נתוני הדגמה" in About
import { html, useState } from '../lib.js';
import { bus } from '../bus.js';
import { addWidget } from '../registry.js';
import { Button, Field, Icon, Switch, SwitchRow, Badge, SearchInput, cx } from '../ui.js';
import { Avatar, TeamBadge } from '../people.js';
import { sheet, act, toast, confirm, closeAll } from '../overlay.js';
import { navigate } from '../router.js';
import { now, setNow, resetClock, hasOverride } from '../clock.js';
import { isDemoOffline, setDemoOffline } from '../net.js';
import { fmtDateTime, dayKey, fmtTime } from '../format.js';
import { clearAllNamespaces, clearAllFiles, flushNow } from '../storage.js';
import { DateField } from '../pickers.js';
import { SYSTEMS } from '../app.js';
import { DEMO_COSMETICS } from './cosmetics.js';

// demo cosmetics live in memory in Store's registry, so register them on every boot
if (bus.has('store.registerDemoCosmetics')) bus.ask('store.registerDemoCosmetics', DEMO_COSMETICS);

export const DemoTag = () => html`<span class="demo-tag"><${Icon} name="flask-conical" size=${14}/>כלי הדגמה</span>`;

const ROLE_GROUPS = [
  ['מנטורים', (u) => u.status === 'active' && u.role === 'mentor'],
  ['קפטנים', (u) => u.status === 'active' && u.role === 'captain'],
  ['רש"צים', (u) => u.status === 'active' && u.role === 'lead'],
  ['חברי צוות', (u) => u.status === 'active' && u.role === 'member'],
  ['בוגרים', (u) => u.status === 'alumni'],
  ['ללא צוות', (u) => u.status === 'active' && !u.role],
  ['ממתינים לאישור', (u) => u.status === 'pending'],
];
function UserList({ onPick }) {
  const [q, setQ] = useState('');
  const all = bus.read('users.list', { statuses: ['active', 'alumni', 'pending'] }).filter((u) => !q || u.name_he.includes(q));
  const cur = bus.read('users.currentId');
  return html`<div class="col gap8">
    <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש משתמש"/>
    ${ROLE_GROUPS.map(([title, f]) => { const list = all.filter(f); return list.length ? html`<div><h3 class="group-head">${title}</h3><div class="list">
      ${list.map((u) => html`<button key=${u.id} class="lrow" onClick=${() => onPick(u.id)}>
        <${Avatar} uid=${u.id} size=${32}/><span class="col gap4 grow"><span class="t-label">${u.name_he}${u.id === cur ? ' (מחובר/ת)' : ''}</span>
        <span class="row wrap gap4">${u.main_team && html`<${TeamBadge} teamId=${u.main_team}/>`}${u.is_admin && html`<${Badge} text="אדמין"/>`}
          ${u.status === 'alumni' && html`<${Badge} text=${u.alumni_active ? 'בוגר/ת · פעיל' : 'בוגר/ת · קריאה בלבד'}/>`}
          ${u.grade && u.grade.label && u.status === 'active' && u.role !== 'mentor' && html`<span class="t-foot muted">${u.grade.label}</span>`}</span></span></button>`)}</div></div>` : null; })}
  </div>`;
}

/** Replaces the Google screen: "כניסה כ…" */
function GoogleFlow({ onBack }) {
  const [mode, setMode] = useState('list');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const signIn = (uid) => { act(() => bus.ask('users.signInAs', { uid })); navigate('/home'); };
  return html`<div style="max-width:560px;margin:0 auto;padding:24px 16px 48px" class="col gap16">
    <div class="row"><button class="icon-btn" aria-label="חזרה" onClick=${onBack}><${Icon} name="arrow-right"/></button><h1 class="t-title2 grow">כניסה כ…</h1><${DemoTag}/></div>
    <p class="t-foot sec">במקום התחברות עם Google: בחרו משתמש הדגמה, או צרו חשבון Google חדש כדי לעבור את תהליך ההרשמה האמיתי.</p>
    ${mode === 'list' ? html`
      <${Button} kind="tinted" icon="user-plus" onClick=${() => setMode('new')}>חשבון Google חדש</${Button}>
      <${UserList} onPick=${signIn}/>`
    : html`<div class="card col gap12">
      <${Field} label="מייל (מומצא)"><input class="input" dir="ltr" type="email" placeholder="new.member@example.com" value=${email} onInput=${(e) => setEmail(e.target.value)}/></${Field}>
      <${Field} label="שם בחשבון Google"><input class="input" dir="auto" value=${name} onInput=${(e) => setName(e.target.value)}/></${Field}>
      <div class="row"><${Button} kind="primary" disabled=${!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name.trim()} onClick=${() => act(() => bus.ask('users.signInGoogle', { email, google_name: name.trim(), device: 'demo' }))}>המשך</${Button}>
        <${Button} kind="ghost" onClick=${() => setMode('list')}>ביטול</${Button}></div></div>`}
  </div>`;
}

/** Testing panel: date/time override + offline switch */
function TestingPanel() {
  const n = now();
  const [d, setD] = useState(dayKey(n));
  const [t, setT] = useState(fmtTime(n));
  const offline = isDemoOffline();
  const go = () => {
    const [hh, mm] = t.split(':').map(Number);
    const [y, m, dd] = d.split('-').map(Number);
    setNow(new Date(y, m - 1, dd, hh || 0, mm || 0));
    toast('התאריך עודכן והמשימות שהגיע זמנן רצו');
  };
  const jump = (days) => { setNow(new Date(now().getTime() + days * 86400000)); toast('הזמן התקדם'); };
  return html`<div class="col gap12">
    <div class="row between"><h3 class="t-title3">לוח בדיקות</h3><${DemoTag}/></div>
    <div class="subtle-box col gap8"><span class="t-label">תאריך ושעה באפליקציה</span>
      <span class="t-foot sec num">עכשיו: ${fmtDateTime(n)}${hasOverride() ? ' (מוגדר ידנית)' : ''}</span>
      <div class="row wrap"><div style="min-width:180px" class="grow"><${DateField} value=${d} onChange=${(v) => v && setD(v)}/></div>
        <input class="input num" style="width:110px" type="time" value=${t} onInput=${(e) => setT(e.target.value)} aria-label="שעה"/></div>
      <div class="row wrap"><${Button} kind="primary" size="sm" onClick=${go}>החלה</${Button}>
        <${Button} kind="secondary" size="sm" onClick=${() => jump(1)}>+יום</${Button}><${Button} kind="secondary" size="sm" onClick=${() => jump(7)}>+שבוע</${Button}>
        <${Button} kind="ghost" size="sm" onClick=${() => { resetClock(); toast('חזרנו לזמן האמיתי'); }}>זמן אמיתי</${Button}></div>
      <span class="t-foot muted">קדימה בזמן מריץ: איפוס טבלאות מובילים, שינוי ספירות לאחור, מעבר שכבה ב-1 בספטמבר, תזכורות הכשרות, סגירת סקרים.</span></div>
    <div class="subtle-box"><${SwitchRow} label="מצב לא מקוון" sub="מציג את פס 'אין חיבור לאינטרנט' וחוסם פעולות" on=${offline} onChange=${setDemoOffline}/></div>
  </div>`;
}
function openSwitcher() {
  sheet('החלפת משתמש', (close) => html`<div class="col gap16">
    <${TestingPanel}/>
    <div class="row between"><h3 class="t-title3">כניסה כ…</h3></div>
    <${UserList} onPick=${(uid) => { close(); closeAll(); act(() => bus.ask('users.signInAs', { uid })); navigate('/home'); }}/>
  </div>`, { wide: true });
}
function SwitchButton() {
  return html`<button class="tb-btn" aria-label="כלי הדגמה: החלפת משתמש" title="כלי הדגמה: החלפת משתמש ולוח בדיקות" onClick=${openSwitcher}
    style="color:var(--warning-text)"><${Icon} name="flask-conical"/></button>`;
}
function ResetButton() {
  return html`<div class="card b col gap8" style="max-width:400px;width:100%;align-items:center"><${DemoTag}/>
    <${Button} kind="danger" icon="rotate-ccw" onClick=${async () => {
      if (!(await confirm({ title: 'איפוס נתוני הדגמה', text: 'כל השינויים יימחקו ונתוני ההדגמה ייטענו מחדש.', ok: 'איפוס', danger: true }))) return;
      await resetDemo();
    }}>איפוס נתוני הדגמה</${Button}></div>`;
}
export async function resetDemo() {
  flushNow();
  clearAllNamespaces();
  await clearAllFiles(SYSTEMS.map(([s]) => s));
  localStorage.removeItem('ns:demo:clock_offset');
  location.hash = '#/home';
  location.reload();
}

addWidget('demo.googleFlow', GoogleFlow);
addWidget('demo.switchButton', SwitchButton);
addWidget('demo.resetButton', ResetButton);
