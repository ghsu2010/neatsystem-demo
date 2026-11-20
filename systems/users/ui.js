// Users screens: sign-in, welcome form, waiting screen, Users management (Users 3, 4, 6, 7, 10).
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Button, Card, Field, Icon, Logo, Seg, Switch, SwitchRow, Badge, SearchInput, EmptyState, CheckRow, Chips, CountBadge, cx } from '../../core/ui.js';
import { Avatar, PersonName, TeamBadge } from '../../core/people.js';
import { act, confirm, toast, sheet, actionSheet } from '../../core/overlay.js';
import { DateField, MenuSelect, pickColor } from '../../core/pickers.js';
import { fmtDate, relTime, byHe, todayKey } from '../../core/format.js';
import { now } from '../../core/clock.js';
import { addManagement, addWidget } from '../../core/registry.js';
import { navigate } from '../../core/router.js';
import { PRESETS } from '../../core/color.js';
import { ROLE_HE, nameOk, dobOk, phoneOk } from './index.js';

const me = () => bus.read('users.currentId');
const actor = () => bus.read('users.actor', me());

/* ---------- sign-in / welcome / waiting (Users 3.2, Design 7.1) ---------- */
export function BrandScreen({ children }) {
  return html`<div class="brand-screen"><${Logo} kind="sticker" size=${160}/><${Logo} kind="wordmark" width=${220}/>
    <div class="brand-card">${children}</div></div>`;
}
/** onGoogle: what the Google button does (demo: opens "כניסה כ…"). */
export function SignInScreen({ onGoogle, error }) {
  return html`<${BrandScreen}>
    <${Button} kind="primary" full icon="google" onClick=${onGoogle}>התחברות עם Google</${Button}>
    ${error && html`<span class="field-error"><${Icon} name="circle-alert" size=${16}/>ההתחברות נכשלה — נסו שוב</span>`}
  </${BrandScreen}>`;
}
export function WelcomeScreen() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState(null);
  const [touched, setTouched] = useState(false);
  const nOk = nameOk(name), dOk = dob && dobOk(dob);
  const dobLimit = (k) => k <= todayKey();
  return html`<${BrandScreen}>
    <h1 class="t-title2">ברוכים הבאים!</h1>
    <${Field} label="שם מלא בעברית" error=${touched && !nOk ? 'שם מלא בעברית, 2–40 אותיות' : null}>
      <input class=${cx('input', touched && !nOk && 'err')} value=${name} maxlength="40" onInput=${(e) => setName(e.target.value)} onBlur=${() => setTouched(true)}/></${Field}>
    <${Field} label="תאריך לידה" error=${dob && !dOk ? 'הגיל חייב להיות בין 10 ל-99' : null}>
      <${DobPicker} value=${dob} onChange=${setDob}/></${Field}>
    <${Button} kind="primary" full disabled=${!nOk || !dOk} onClick=${() => act(() => bus.ask('users.submitWelcome', { name_he: name, date_of_birth: dob }))}>שליחה</${Button}>
    <${Button} kind="ghost" full onClick=${() => bus.ask('users.signOut')}>התנתקות</${Button}>
  </${BrandScreen}>`;
}
/** Date-of-birth picker: year/month/day menus + calendar (calendar picker per Users 3.2). */
function DobPicker({ value, onChange }) {
  return html`<${DateField} value=${value} onChange=${onChange} placeholder="בחירת תאריך" selectable=${(k) => k <= todayKey()}/>
    <${YearJump} value=${value} onChange=${onChange}/>`;
}
function YearJump({ value, onChange }) {
  const y = now().getFullYear();
  const years = Array.from({ length: 60 }, (_, i) => y - 10 - i);
  const cur = value ? Number(value.slice(0, 4)) : null;
  return html`<div class="row gap4"><span class="t-foot sec">קפיצה לשנה:</span>
    <${MenuSelect} value=${cur} placeholder="שנה" options=${years.map((x) => ({ value: x, label: String(x) }))}
      onChange=${(yy) => onChange(`${yy}${value ? value.slice(4) : '-01-01'}`)}/></div>`;
}
export function WaitingScreen() {
  const u = bus.read('users.current');
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(u.name_he);
  const [dob, setDob] = useState(u.date_of_birth);
  return html`<${BrandScreen}>
    <div class="center"><${Icon} name="clock" size=${32} cls="sec"/></div>
    <h1 class="t-title2 center">הבקשה שלך ממתינה לאישור</h1>
    ${!edit ? html`<div class="subtle-box col gap4"><span class="t-label">${u.name_he}</span><span class="t-foot sec">תאריך לידה: ${fmtDate(u.date_of_birth)}</span>
        <button class="btn btn-link btn-sm" style="align-self:flex-start" onClick=${() => setEdit(true)}><${Icon} name="pencil" size=${16}/>עריכה</button></div>`
    : html`<div class="col gap12"><${Field} label="שם מלא בעברית"><input class="input" value=${name} onInput=${(e) => setName(e.target.value)}/></${Field}>
        <${Field} label="תאריך לידה"><${DateField} value=${dob} onChange=${setDob}/></${Field}>
        <div class="row"><${Button} kind="primary" onClick=${() => act(() => { bus.ask('users.updatePending', { actor: u.id, name_he: name, date_of_birth: dob }); setEdit(false); }, 'נשמר')}>שמירה</${Button}>
        <${Button} kind="ghost" onClick=${() => setEdit(false)}>ביטול</${Button}></div></div>`}
    <${Button} kind="secondary" full onClick=${() => bus.ask('users.signOut')}>התנתקות</${Button}>
  </${BrandScreen}>`;
}

/* ---------- management: approvals (3.3) ---------- */
const yearOptions = () => { const y = now().getFullYear(); return Array.from({ length: 7 }, (_, i) => ({ value: y + i, label: String(y + i) })); };
const teamOptions = (withNone = true) => [...(withNone ? [{ value: '', label: 'ללא צוות' }] : []),
  ...bus.read('users.mainTeams').map((t) => ({ value: t.id, label: t.name }))];
function SubTeamChips({ value, onChange, disabled }) {
  const subs = bus.read('users.teams').filter((t) => t.kind === 'sub' && !t.archived);
  return html`<div class="row wrap gap4">${subs.map((t) => html`<button type="button" disabled=${disabled} class=${cx('chip', value.includes(t.id) && 'on')}
    onClick=${() => onChange(value.includes(t.id) ? value.filter((x) => x !== t.id) : [...value, t.id])}>${t.name}</button>`)}</div>`;
}
function ApprovalRow({ u }) {
  const a = actor();
  const [team, setTeam] = useState('');
  const [role, setRole] = useState('member');
  const [subs, setSubs] = useState([]);
  const [gy, setGy] = useState(null);
  const [name, setName] = useState(u.name_he);
  const [dob, setDob] = useState(u.date_of_birth);
  const roles = [{ value: 'member', label: 'חבר צוות' }, { value: 'lead', label: 'רש"צ' }, { value: 'captain', label: 'קפטן' }, ...(a.isMentor ? [{ value: 'mentor', label: 'מנטור' }] : [])];
  const isMentorRole = role === 'mentor';
  const valid = isMentorRole || !team || gy;
  const doApprove = async (swap) => {
    const r = act(() => bus.ask('users.approve', { actor: me(), uid: u.id, team: isMentorRole ? null : team || null, role: team || isMentorRole ? role : null, sub_teams: subs, graduation_year: gy, name_he: name, date_of_birth: dob, swap }));
    if (r && r.needSwap) {
      const holder = bus.read('users.get', r.needSwap[0]);
      const tName = team ? bus.read('users.team', team).name : '';
      const ok = await confirm({ title: 'הגבלת תפקידים', text: role === 'lead' ? `לצוות ${tName} כבר יש רש"צ: ${holder.name_he}. להחליף?` : `כבר יש מספר מקסימלי של קפטנים (${holder.name_he}). להחליף?`, ok: 'החלפה' });
      if (ok) doApprove(true);
    } else if (r && r.ok) toast(`${name} אושר/ה`);
  };
  return html`<div class="card b col gap12">
    <div class="row gap12"><${Avatar} uid=${u.id} size=${40}/><div class="col gap4 grow"><span class="t-label">${u.name_he}</span>
      <span class="t-foot sec"><bdi>${u.google_name}</bdi> · <bdi>${u.google_email}</bdi></span><span class="t-foot muted">ביקש/ה ${relTime(u.created_at)}</span></div></div>
    <div class="two-col">
      <${Field} label="שם מלא"><input class="input" value=${name} onInput=${(e) => setName(e.target.value)}/></${Field}>
      <${Field} label="תאריך לידה"><${DateField} value=${dob} onChange=${setDob}/></${Field}>
      <${Field} label="צוות"><${MenuSelect} value=${isMentorRole ? '' : team} options=${teamOptions()} onChange=${(v) => { setTeam(v); if (!v && role !== 'mentor') setRole('member'); }} disabled=${isMentorRole}/></${Field}>
      <${Field} label="תפקיד"><${MenuSelect} value=${role} options=${team ? roles : roles.filter((r) => r.value === 'mentor' || r.value === 'member')} onChange=${setRole} disabled=${!team && !a.isMentor}/></${Field}>
      ${team && !isMentorRole && html`<${Field} label="שנת סיום (יב')"><${MenuSelect} value=${gy} placeholder="בחירת שנה" options=${yearOptions()} onChange=${setGy}/></${Field}>`}
    </div>
    <${Field} label="תתי-צוותים"><${SubTeamChips} value=${subs} onChange=${setSubs}/></${Field}>
    <div class="row"><${Button} kind="primary" disabled=${!valid} onClick=${() => doApprove(false)}>אישור</${Button}>
      <${Button} kind="danger" onClick=${async () => { if (await confirm({ title: 'דחיית הבקשה', text: `הבקשה של ${u.name_he} תימחק והמשתמש/ת יקבל/תקבל מייל.`, ok: 'דחייה', danger: true })) act(() => bus.ask('users.reject', { actor: me(), uid: u.id }), 'הבקשה נדחתה'); }}>דחייה</${Button}></div>
  </div>`;
}
function Approvals() {
  const list = bus.read('users.list', { statuses: ['pending'] }).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  if (!list.length) return html`<${EmptyState} title="אין בקשות ממתינות" text="בקשות הצטרפות חדשות יופיעו כאן"/>`;
  return html`<div class="col gap12">${list.map((u) => html`<${ApprovalRow} key=${u.id} u=${u}/>`)}</div>`;
}

/* ---------- management: users table + user page (4.1) ---------- */
function UsersTable({ initial }) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState('active');
  const [open, setOpen] = useState(initial || null);
  if (open) return html`<${UserPage} uid=${open} onBack=${() => setOpen(null)}/>`;
  const list = bus.read('users.list', { statuses: st === 'all' ? ['active', 'alumni'] : [st] })
    .filter((u) => !q || u.name_he.includes(q) || (u.google_email || '').includes(q.toLowerCase()) || (u.google_name || '').toLowerCase().includes(q.toLowerCase()));
  return html`<div class="col gap12">
    <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש לפי שם או מייל"/>
    <${Chips} value=${st} onChange=${setSt} items=${[{ value: 'active', label: 'פעילים' }, { value: 'alumni', label: 'בוגרים' }, { value: 'all', label: 'הכל' }]}/>
    <div class="list">${list.map((u) => html`<button key=${u.id} class="lrow" onClick=${() => setOpen(u.id)}>
      <${Avatar} uid=${u.id} size=${40}/><div class="col gap4 grow"><span class="t-label">${u.name_he}</span>
        <span class="row wrap gap4"><${TeamBadge} teamId=${u.main_team}/>${u.role && u.role !== 'member' && html`<${Badge} text=${ROLE_HE[u.role]}/>`}
        ${u.is_admin && html`<${Badge} text="אדמין"/>`}${u.status === 'alumni' && html`<${Badge} text="בוגר/ת"/>`}${!u.role && u.status === 'active' && html`<${Badge} text="ללא צוות"/>`}</span></div>
      <${Icon} name="chevron-left" size=${20} cls="chev"/></button>`)}
      ${!list.length && html`<div class="lrow t-foot sec">לא נמצאו חברים</div>`}</div></div>`;
}
export function UserPage({ uid, onBack }) {
  const a = actor();
  const u = bus.read('users.get', uid);
  if (!u) return html`<div class="col gap12"><${Button} kind="ghost" icon="arrow-right" onClick=${onBack}>חזרה</${Button}><p>משתמש שנמחק</p></div>`;
  const phone = bus.read('users.phone', me(), uid) || '';
  const [f, setF] = useState({ name_he: u.name_he, date_of_birth: u.date_of_birth, phone, main_team: u.main_team || '', sub_teams: u.sub_teams || [], role: u.role || '', graduation_year: u.graduation_year, is_admin: !!u.is_admin, favorite_feature: u.favorite_feature || '' });
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const self = uid === me();
  const mentorRecord = u.role === 'mentor' && u.status === 'active';
  const canEdit = (a.isAdmin || a.isMentor) && (!mentorRecord || a.isMentor);
  const isAlumni = u.status === 'alumni';
  const roles = [{ value: 'member', label: 'חבר צוות' }, { value: 'lead', label: 'רש"צ' }, { value: 'captain', label: 'קפטן' }, ...(a.isMentor || u.role === 'mentor' ? [{ value: 'mentor', label: 'מנטור' }] : [])];
  const save = async (extra = {}) => {
    const changes = { ...f, main_team: f.role === 'mentor' ? '' : f.main_team, role: f.main_team || f.role === 'mentor' ? f.role || 'member' : null };
    if (isAlumni) { delete changes.main_team; delete changes.role; delete changes.is_admin; delete changes.graduation_year; }
    if (self) { delete changes.role; delete changes.is_admin; }
    const r = act(() => bus.ask('users.update', { actor: me(), uid, changes, ...extra }));
    if (!r) return;
    if (r.needLeadConfirm) {
      const tName = bus.read('users.team', u.main_team).name;
      if (await confirm({ title: 'העברת צוות', text: `${u.name_he} הוא רש"צ של ${tName}. העברה תהפוך אותו לחבר צוות.`, ok: 'העברה' })) save({ ...extra, confirmLeadMove: true });
    } else if (r.needSwap) {
      const holder = bus.read('users.get', r.needSwap[0]);
      const tName = f.main_team ? bus.read('users.team', f.main_team).name : '';
      if (await confirm({ title: 'הגבלת תפקידים', text: f.role === 'lead' ? `לצוות ${tName} כבר יש רש"צ: ${holder.name_he}. להחליף?` : `כבר יש מספר מקסימלי של קפטנים (${holder.name_he}). להחליף?`, ok: 'החלפה' })) save({ ...extra, swap: true });
    } else toast('נשמר');
  };
  return html`<div class="col gap16">
    <div class="row"><${Button} kind="ghost" icon="arrow-right" onClick=${onBack}>חזרה לרשימה</${Button}><span class="spacer"/>
      <${Button} kind="tinted" size="sm" onClick=${() => navigate('/profile/' + uid)}>לפרופיל</${Button}></div>
    <div class="row gap12"><${Avatar} uid=${uid} size=${64}/><div class="col gap4"><span class="t-title2">${u.name_he}</span>
      <span class="t-foot sec"><bdi>${u.google_email}</bdi> · Google: <bdi>${u.google_name}</bdi></span></div></div>
    <${Card} border>
      <div class="two-col">
        <${Field} label="שם מלא"><input class="input" disabled=${!canEdit} value=${f.name_he} onInput=${(e) => set('name_he')(e.target.value)}/></${Field}>
        <${Field} label="תאריך לידה"><${DateField} value=${f.date_of_birth} onChange=${set('date_of_birth')}/></${Field}>
        <${Field} label="טלפון" error=${f.phone && !phoneOk(f.phone) ? 'מספר נייד לא תקין' : null}><input class="input" dir="ltr" inputmode="tel" disabled=${!canEdit} value=${f.phone} onInput=${(e) => set('phone')(e.target.value)}/></${Field}>
        ${!isAlumni && html`
          <${Field} label="צוות"><${MenuSelect} disabled=${!canEdit || f.role === 'mentor'} value=${f.role === 'mentor' ? '' : f.main_team} options=${teamOptions()} onChange=${(v) => setF({ ...f, main_team: v, role: v ? f.role || 'member' : '' })}/></${Field}>
          <${Field} label="תפקיד"><${MenuSelect} disabled=${!canEdit || self || (!f.main_team && !a.isMentor)} value=${f.role} placeholder="ללא תפקיד" options=${f.main_team ? roles : roles.filter((r) => r.value === 'mentor')} onChange=${set('role')}/></${Field}>
          ${f.role !== 'mentor' && f.main_team && html`<${Field} label="שנת סיום (יב')"><${MenuSelect} disabled=${!canEdit} value=${f.graduation_year} placeholder="בחירת שנה" options=${yearOptions()} onChange=${set('graduation_year')}/></${Field}>`}`}
      </div>
      <div class="mt16"><${Field} label="תתי-צוותים"><${SubTeamChips} disabled=${!canEdit} value=${f.sub_teams} onChange=${set('sub_teams')}/></${Field}></div>
      <div class="mt16"><${Field} label="דבר אהוב" hint="עד 80 תווים"><input class="input" maxlength="80" disabled=${!canEdit} value=${f.favorite_feature} onInput=${(e) => set('favorite_feature')(e.target.value)}/></${Field}></div>
      ${a.isMentor && !isAlumni && !self && html`<div class="mt16"><${SwitchRow} label="אדמין" sub="רק מנטורים משנים את הדגל הזה" on=${f.is_admin} onChange=${set('is_admin')}/></div>`}
      ${canEdit && html`<div class="mt16"><${Button} kind="primary" onClick=${() => save()}>שמירה</${Button}></div>`}
    </${Card}>
    ${isAlumni && a.isMentor && html`<${Card} border title="בוגר/ת">
      <${SwitchRow} label=${'מצב בוגר: ' + (u.alumni_active ? 'פעיל' : 'קריאה בלבד')} on=${!!u.alumni_active} onChange=${(v) => act(() => bus.ask('users.setAlumniMode', { actor: me(), uid, on: v }))}/>
      <div class="mt16"><${Button} kind="secondary" onClick=${() => returnDialog(uid)}>החזרה לפעילות</${Button}></div></${Card}>`}
    ${a.isAdmin || a.isMentor ? html`<${Card} border title="תמונת פרופיל">
      ${u.picture && u.picture.startsWith('idb:') ? html`<${Button} kind="danger" onClick=${async () => { if (await confirm({ title: 'הסרת תמונה', text: `התמונה של ${u.name_he} תוסר והוא/היא יקבל/תקבל הודעה.`, ok: 'הסרה', danger: true })) act(() => bus.ask('users.removePicture', { actor: me(), uid }), 'התמונה הוסרה'); }}>הסרת התמונה שהועלתה</${Button}>` : html`<span class="t-foot sec">אין תמונה שהועלתה</span>`}</${Card}>` : null}
    ${a.isMentor && !self && html`<div class="card danger-card col gap12"><span class="t-title3 dangert">מחיקת משתמש</span>
      <span class="t-foot sec">מחיקה מיידית, בלי הקפאה ובלי ביטול.</span>
      <div><${Button} kind="danger" icon="trash-2" onClick=${() => deleteDialog(uid)}>מחיקת משתמש</${Button}></div></div>`}
  </div>`;
}
function returnDialog(uid) {
  let team = null, gy = null;
  const Body = () => {
    const [t, setT] = useState(null); const [y, setY] = useState(null); team = t; gy = y;
    return html`<div class="col gap12"><${Field} label="צוות"><${MenuSelect} value=${t} options=${teamOptions(false)} onChange=${setT} placeholder="בחירת צוות"/></${Field}>
      <${Field} label="שנת סיום חדשה"><${MenuSelect} value=${y} options=${yearOptions()} onChange=${setY} placeholder="בחירת שנה"/></${Field}></div>`;
  };
  sheet('החזרה לפעילות', () => html`<${Body}/>`, {
    foot: (c) => html`<${Button} kind="primary" full onClick=${() => { const r = act(() => bus.ask('users.returnToActive', { actor: me(), uid, team, graduation_year: gy })); if (r) { c(); toast('הוחזר/ה לפעילות'); } }}>החזרה לפעילות</${Button}>`,
  });
}
function deleteDialog(uid) {
  const u = bus.read('users.get', uid);
  let typed = '';
  const Body = ({ close }) => {
    const [v, setV] = useState(''); typed = v;
    return html`<div class="col gap12"><p class="t-body">כל המידע של ${u.name_he} יימחק עכשיו בכל המערכות:</p>
      <ul class="t-foot sec" style="margin:0;padding-inline-start:20px"><li>פרופיל</li><li>מטבעות והיסטוריה</li><li>פריטים ותגיות</li><li>התקדמות בהכשרות ודרגות</li><li>נוכחות ורצף</li><li>שיוכים ותגובות בסאנדיי</li><li>הודעות שכתב/ה</li><li>התראות</li></ul>
      <${Field} label=${`כדי לאשר, הקלידו את השם: ${u.name_he}`}><input class="input" value=${v} onInput=${(e) => setV(e.target.value)}/></${Field}>
      <${Button} kind="danger-fill" full disabled=${v !== u.name_he} onClick=${() => { const r = act(() => bus.ask('users.deleteUser', { actor: me(), uid, confirmName: v })); if (r) { close(); toast('המשתמש נמחק'); navigate('/manage/home/users/users'); } }}>מחיקה לצמיתות</${Button}></div>`;
  };
  sheet('מחיקת משתמש', (close) => html`<${Body} close=${close}/>`);
}

/* ---------- graduation (4.3) ---------- */
function Graduation() {
  const [year, setYear] = useState(now().getFullYear());
  const cands = bus.read('users.list', { statuses: ['active'] }).filter((u) => u.graduation_year === year && u.role !== 'mentor');
  const [off, setOff] = useState([]);
  const ticked = cands.filter((u) => !off.includes(u.id));
  const years = Array.from({ length: 5 }, (_, i) => now().getFullYear() - 1 + i);
  const run = async () => {
    const ok = await confirm({ title: `סיום לימודים למחזור ${year}`, text: `${ticked.length} יעברו למצב בוגר/ת (קריאה בלבד): ${ticked.map((u) => u.name_he).join(', ')}`, ok: 'סיום לימודים' });
    if (ok) act(() => bus.ask('users.graduate', { actor: me(), year, uids: ticked.map((u) => u.id) }), 'בוצע');
  };
  return html`<div class="col gap12">
    <${Field} label="מחזור"><${MenuSelect} value=${year} options=${years.map((y) => ({ value: y, label: String(y) }))} onChange=${(y) => { setYear(y); setOff([]); }}/></${Field}>
    ${cands.length ? html`<div class="list">${cands.map((u) => html`<div class="lrow"><${CheckRow} on=${!off.includes(u.id)} label=${u.name_he} sub=${(bus.read('users.team', u.main_team) || {}).name}
      onChange=${(v) => setOff(v ? off.filter((x) => x !== u.id) : [...off, u.id])}/></div>`)}</div>
      <div><${Button} kind="primary" disabled=${!ticked.length} onClick=${run}>סיום לימודים למחזור ${year}</${Button}></div>`
    : html`<${EmptyState} title="אין תלמידים במחזור הזה" sticker=${false}/>`}
  </div>`;
}

/* ---------- teams (6) ---------- */
function Teams() {
  const all = bus.read('users.teams').filter((t) => !t.archived);
  const users = bus.read('users.list', { statuses: ['active'] });
  const count = (t) => users.filter((u) => u.main_team === t.id || (u.sub_teams || []).includes(t.id)).length;
  const icons = bus.has('trainings.iconLibrary') ? bus.read('trainings.iconLibrary') : [];
  const rename = async (t) => { const v = await (await import('../../core/overlay.js')).promptText({ title: 'שינוי שם', value: t.name, multiline: false, max: 30 }); if (v) act(() => bus.ask('users.updateTeam', { actor: me(), id: t.id, name: v })); };
  const icon = (t, el) => import('../../core/overlay.js').then(({ popover }) => popover(el, (close) => html`<div style="display:grid;grid-template-columns:repeat(6,44px);gap:4px;max-width:300px">
    ${icons.map((i) => html`<button class="icon-btn" title=${i.name} onClick=${() => { close(); act(() => bus.ask('users.updateTeam', { actor: me(), id: t.id, icon: i.name })); }}><${Icon} name=${i.name}/></button>`)}</div>`, { title: 'אייקון' }));
  const row = (t) => html`<div class="lrow" key=${t.id}>
    <span class="tinted" style=${bus.read('users.teamTint', t.id) + `;width:16px;height:16px;border-radius:4px;flex:none;${t.tint.startsWith('p:') ? 'background:' + PRESETS[parseInt(t.tint.slice(2)) - 1].hex : ''}`}/>
    ${t.kind === 'main' && t.icon && html`<${Icon} name=${t.icon} size=${20} cls="sec"/>`}
    <span class="t-label grow">${t.name}</span><span class="t-foot sec num">${count(t)}</span>
    <button class="icon-btn sm" aria-label="פעולות" onClick=${(e) => actionSheet(t.name, [
      { icon: 'pencil', label: 'שינוי שם', onClick: () => rename(t) },
      { icon: 'palette', label: 'שינוי צבע', onClick: () => pickColor(e.target, { current: t.tint, onPick: (c) => act(() => bus.ask('users.updateTeam', { actor: me(), id: t.id, tint: c })) }) },
      { icon: 'shapes', label: 'שינוי אייקון', hidden: t.kind !== 'main', onClick: () => icon(t, e.target) },
      { icon: 'archive', label: 'ארכון', danger: true, onClick: async () => { if (await confirm({ title: `ארכון ${t.name}`, text: 'הצוות ייעלם מהבחירות אבל יישאר בהיסטוריה.', ok: 'ארכון', danger: true })) act(() => bus.ask('users.archiveTeam', { actor: me(), id: t.id }), 'הועבר לארכיון'); } },
    ], e.currentTarget)}><${Icon} name="ellipsis" size=${20}/></button></div>`;
  const add = async (kind) => {
    const { promptText } = await import('../../core/overlay.js');
    const v = await promptText({ title: kind === 'main' ? 'צוות חדש' : 'תת-צוות חדש', label: 'שם', multiline: false, max: 30 });
    if (v) act(() => bus.ask('users.createTeam', { actor: me(), kind, name: v }), 'נוצר');
  };
  return html`<div class="col gap16">
    <div><div class="row between"><h3 class="group-head">צוותים</h3><${Button} size="sm" kind="tinted" onClick=${() => add('main')}>+ צוות</${Button}></div>
      <div class="list">${all.filter((t) => t.kind === 'main').map(row)}</div></div>
    <div><div class="row between"><h3 class="group-head">תתי-צוותים</h3><${Button} size="sm" kind="tinted" onClick=${() => add('sub')}>+ תת-צוות</${Button}></div>
      <div class="list">${all.filter((t) => t.kind === 'sub').map(row)}</div></div></div>`;
}
function Settings() {
  const s = bus.read('users.settings');
  const num = (k, label) => html`<${Field} label=${label}><input class="input num" type="number" min="0" max="20" value=${s[k]}
    onChange=${(e) => act(() => bus.ask('users.setSettings', { actor: me(), patch: { [k]: Number(e.target.value) } }), 'נשמר')}/></${Field}>`;
  return html`<div class="card b col gap16">${num('leads_per_team', 'מספר רש"צים לצוות (limits.leads_per_team)')}${num('captains', 'מספר קפטנים (limits.captains)')}</div>`;
}

addManagement('users', 'משתמשים', [
  { id: 'approvals', title: 'אישור משתמשים', icon: 'user-check', can: (a) => a.isAdmin || a.isMentor, badge: () => bus.read('users.pendingCount'), render: () => html`<${Approvals}/>` },
  { id: 'users', title: 'משתמשים', icon: 'users', can: (a) => a.isAdmin || a.isMentor, render: (q) => html`<${UsersTable} key=${q && q.uid} initial=${q && q.uid}/>` },
  { id: 'graduation', title: 'סיום לימודים', icon: 'graduation-cap', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Graduation}/>` },
  { id: 'teams', title: 'צוותים ותתי-צוותים', icon: 'shapes', can: (a) => a.isMentor, render: () => html`<${Teams}/>` },
  { id: 'settings', title: 'הגדרות', icon: 'settings', can: (a) => a.isMentor, render: () => html`<${Settings}/>` },
]);

// Screens the NeatSystem shell shows before the app (Users 3.2): offered as widgets, not imports.
addWidget('users.signIn', SignInScreen);
addWidget('users.welcome', WelcomeScreen);
addWidget('users.waiting', WaitingScreen);
