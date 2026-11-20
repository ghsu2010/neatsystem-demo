// NeatSystem pages: Home (4), Profile (5), Members directory (6), Personal settings (7).
// Every value comes from another system through the bus; cards fail independently (NeatSystem 4).
import { html, useState, useEffect, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { navigate } from '../../core/router.js';
import { addRoute, widget } from '../../core/registry.js';
import { Icon, Button, Card, Badge, Tag, Seg, SearchInput, Chips, EmptyState, Safe, Progress, IconButton, SwitchRow, Field, cx } from '../../core/ui.js';
import { Avatar, PersonName, RankBadge, TeamBadge, safeRead } from '../../core/people.js';
import { act, toast, promptText, sheet, confirm } from '../../core/overlay.js';
import { fmtLongDay, fmtDate, byHe } from '../../core/format.js';
import { now } from '../../core/clock.js';
import { tintVars } from '../../core/color.js';
import { me, actorInfo } from './shell.js';

const ROLE_BADGE = { lead: 'רש"צ', captain: 'קפטן', mentor: 'מנטור' };
export const FLAME = (n) => (n >= 60 ? '#D69E00' : n >= 45 ? '#2D9CDB' : n >= 30 ? '#7B4DFF' : n >= 15 ? '#E2445C' : '#FF751F');
const MEDAL = { 1: '#D69E00', 2: '#9AA3AF', 3: '#B26B32' };
const W = (name, props = {}) => { const C = widget(name); return C ? html`<${C} ...${props}/>` : null; };

/* ================= Home ================= */
function Home() {
  const a = actorInfo();
  const u = bus.read('users.get', a.id);
  const first = u.name_he.split(' ')[0];
  const meeting = safeRead('attendance.todayMeeting', a.id);
  const canSunday = true;
  const canStudy = safeRead('trainings.canStudy', a.id) && !a.isMentor;
  const right = html`
    <div class="col gap4" style="margin-bottom:8px"><h2 class="t-title2">היי ${first}</h2>
      <p class="t-foot sec">${fmtLongDay(now())}${meeting ? ` · היום יש פגישה ב-${meeting.time}` : ''}</p></div>
    <${Safe} render=${() => W('countdown.home', { uid: a.id })}/>
    ${canSunday && html`<${Card} title="המשימות שלי" icon="square-check-big"><${Safe} render=${() => W('sunday.homeTasks', { uid: a.id })}/></${Card}>`}
    ${canStudy && html`<${Card} title="ההכשרות הבאות שלי" icon="route"><${Safe} render=${() => html`${W('trainings.homeNext', { uid: a.id })}${W('ranks.homeLine', { uid: a.id })}`}/></${Card}>`}`;
  const left = html`
    ${!a.noRole && html`<${Safe} render=${() => W('leaderboard.home', { uid: a.id })}/>`}
    <${Safe} render=${() => W('announcements.home', { uid: a.id })}/>`;
  return html`<div><h1 class="page-title">בית</h1><div class="two-col"><div class="col gap16">${right}</div><div class="col gap16">${left}</div></div></div>`;
}

/* ================= Profile ================= */
function StatTile({ children, accent }) {
  return html`<div class="col gap4" style=${`flex:1;min-width:0;background:var(--bg-subtle);border-radius:var(--r-md);padding:12px;align-items:center;text-align:center;${accent ? `box-shadow:inset 0 -3px 0 ${accent}` : ''}`}>${children}</div>`;
}
function Profile({ id }) {
  const a = actorInfo();
  const u = safeRead('users.get', id);
  if (!u) return html`<${EmptyState} title="משתמש שנמחק" sticker=${false}/>`;
  const own = id === a.id;
  const t = safeRead('users.actor', id);
  const eq = safeRead('store.equipped', id) || {};
  const tags = safeRead('store.shownTags', id) || [];
  const allTags = safeRead('store.ownedTags', id) || [];
  const bal = safeRead('coins.balance', id);
  const streak = safeRead('attendance.streak', id);
  const approved = safeRead('trainings.approvedCount', id) || 0;
  const place = safeRead('leaderboard.place', id);
  const team = u.main_team && safeRead('users.team', u.main_team);
  const teamIcon = u.status === 'active' || u.status === 'alumni' ? (u.role === 'mentor' ? 'graduation-cap' : team && u.status === 'active' ? team.icon : null) : null;
  const rankBadge = safeRead('ranks.teamRankBadge', id);
  const phone = safeRead('users.phone', a.id, id);
  const canEditFav = a.isMentor || a.isAdmin || a.isCaptain || (a.isLead && a.team === u.main_team);
  const noRole = t && t.noRole;
  const theme = eq.theme;
  const bannerStyle = eq.banner ? eq.banner.style : 'background:linear-gradient(135deg,var(--hero-from),var(--hero-to))';
  const Effect = widget('store.effectLayer');

  const header = html`<div style="position:relative">
    <div style=${`height:140px;border-radius:0 0 var(--r-lg) var(--r-lg);${bannerStyle};${theme ? `box-shadow:inset 0 0 0 999px ${theme.bannerTint}` : ''}`}/>
    ${Effect && eq.effect && html`<${Effect} kind=${eq.effect.kind} key=${id}/>`}
    <div style="padding:0 16px;margin-top:-44px;position:relative" class="col gap8">
      <${Avatar} uid=${id} size=${88} frame ring/>
      <div class="row wrap gap8"><h1 class=${cx('t-title1', eq.nameColor && eq.nameColor.cls, eq.nameColor && eq.nameColor.animated && 'anim')} style=${eq.nameColor ? eq.nameColor.style : ''}><bdi>${u.name_he}</bdi></h1>
        ${teamIcon && html`<span class="tinted" style=${(safeRead('users.teamTint', u.role === 'mentor' ? null : u.main_team) || '') + ';background:none;display:inline-flex'} title=${u.role === 'mentor' ? 'מנטורים' : team && team.name}><${Icon} name=${teamIcon} size=${20} label=${u.role === 'mentor' ? 'מנטורים' : team && team.name}/></span>`}
        <${RankBadge} badge=${rankBadge} size=${24}/>
        ${place && html`<span title=${`מקום ${place} בטבלת המובילים`}><${Icon} name="flame" size=${18} fill="currentColor" color=${MEDAL[place]} label=${`מקום ${place}`}/></span>`}</div>
      ${!noRole && tags.length > 0 && html`<div class="row wrap gap4">${tags.map((x) => html`<${Tag} text=${x.text} color=${x.color}/>`)}
        ${allTags.length > tags.length && html`<button class="btn btn-link btn-xs" onClick=${() => sheet('תגיות', () => html`<div class="row wrap gap4">${allTags.map((x) => html`<${Tag} text=${x.text} color=${x.color}/>`)}</div>`)}>+${allTags.length - tags.length} תגיות</button>`}</div>`}
      ${!noRole && html`<div class="row wrap gap4">
        ${team && html`<${TeamBadge} teamId=${u.main_team}/>`}${(u.sub_teams || []).map((s) => html`<${TeamBadge} teamId=${s}/>`)}
        ${u.status === 'active' && ROLE_BADGE[u.role] && html`<${Badge} text=${ROLE_BADGE[u.role]}/>`}${u.is_admin && u.status === 'active' && html`<${Badge} text="אדמין"/>`}
        ${u.status === 'alumni' && html`<${Badge} text="בוגר/ת"/>`}</div>`}
      ${noRole && html`<p class="t-foot sec">עדיין לא שויכת לצוות</p>`}
    </div></div>`;

  const stats = html`<div class="row gap8" style="align-items:stretch">
    <${StatTile} accent=${theme && theme.accent}><span class="row gap4"><${Icon} name="coin" size=${24} color="var(--reward)"/><span class="t-display">${bal ? bal.balance : 0}</span></span>
      <button class="btn btn-link btn-xs" onClick=${() => navigate('/ledger/' + id)}>היסטוריה</button></${StatTile}>
    ${!noRole && streak && streak.current >= 2 && html`<${StatTile} accent=${theme && theme.accent}><span class="row gap4"><${Icon} name="flame" size=${20} fill="currentColor" color=${FLAME(streak.current)}/><span class="t-title2 num">${streak.current}</span>
      ${own && streak.freezes > 0 && html`<span class="row gap4 t-foot sec" title="הקפאות רצף"><${Icon} name="snowflake" size=${14}/>${streak.freezes}</span>`}</span>
      <span class="t-foot sec">רצף נוכחות: ${streak.current}</span></${StatTile}>`}
    ${!noRole && html`<${StatTile} accent=${theme && theme.accent}><span class="t-title2 num">${approved}</span><span class="t-foot sec">הכשרות מאושרות</span></${StatTile}>`}
  </div>`;

  const actions = !own && !noRole && html`<div class="row wrap gap8">
    ${W('coins.profileAction', { viewer: a.id, target: id })}${W('store.profileActions', { viewer: a.id, target: id })}${W('trainings.profileAction', { viewer: a.id, target: id })}
    ${a.isMentor && u.status === 'alumni' && html`<${Button} kind="tinted" size="sm" onClick=${() => act(() => bus.ask('users.setAlumniMode', { actor: a.id, uid: id, on: !u.alumni_active }))}>מצב בוגר: ${u.alumni_active ? 'פעיל' : 'קריאה בלבד'}</${Button}>`}
    ${(a.isAdmin || a.isMentor) && html`<${Button} kind="tinted" size="sm" icon="pencil" onClick=${() => navigate('/manage/home/users/users?uid=' + id)}>עריכה בניהול</${Button}>`}
  </div>`;

  const sections = html`
    ${!noRole && html`<${Safe} render=${() => W('ranks.profileCard', { uid: id })}/>`}
    ${!noRole && (u.favorite_feature || canEditFav) && html`<${Card} title="דבר אהוב" action=${canEditFav && html`<${IconButton} icon="pencil" small label="עריכת דבר אהוב" onClick=${async () => {
      const v = await promptText({ title: 'דבר אהוב', value: u.favorite_feature || '', max: 80, min: 0, multiline: false });
      if (v !== null) act(() => bus.ask('users.update', { actor: a.id, uid: id, changes: { favorite_feature: v } }), 'נשמר');
    }}/>`}>${u.favorite_feature ? html`<p class="t-body" dir="auto">${u.favorite_feature}</p>` : html`<p class="t-foot muted">עוד לא נכתב</p>`}</${Card}>`}
    <${Card} title="פרטים">
      <div class="col gap8 t-body"><span class="row gap8"><${Icon} name="cake" size=${20} cls="sec"/>${fmtDate(u.date_of_birth)} · גיל ${u.age}</span>
        ${!noRole && html`<span class="row gap8"><${Icon} name="mail" size=${20} cls="sec"/><bdi>${u.google_email}</bdi></span>`}
        ${phone ? html`<span class="row gap8"><${Icon} name="phone" size=${20} cls="sec"/><a href=${'tel:' + phone} dir="ltr">${phone}</a></span>` : null}</div></${Card}>
    ${own && W('store.myItemsCard', { uid: id })}
    ${(own || !noRole) && W('store.wishlistCard', { viewer: a.id, target: id })}
    ${!noRole && W('attendance.profileHistory', { viewer: a.id, target: id })}`;

  return html`<div style="margin:-8px -16px 0">${header}
    <div style="padding:16px" class="profile-grid">
      <div class="col gap16">${stats}${actions}</div>
      <div class="col gap16">${sections}</div></div></div>`;
}

/* ================= Directory (6) ================= */
function Directory() {
  const a = actorInfo();
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const teams = (bus.read('users.teams') || []).filter((t) => !t.archived);
  const users = bus.read('users.list', { statuses: ['active', 'alumni'] });
  const chips = [{ value: 'all', label: 'הכל' }, ...teams.filter((t) => t.kind === 'main').map((t) => ({ value: t.id, label: t.name })),
    ...teams.filter((t) => t.kind === 'sub').map((t) => ({ value: t.id, label: t.name })),
    { value: 'leads', label: 'רש"צים וקפטנים' }, { value: 'mentors', label: 'מנטורים' }, { value: 'alumni', label: 'בוגרים' },
    ...(a.isAdmin || a.isMentor ? [{ value: 'norole', label: 'ללא צוות' }] : [])];
  const ql = q.trim().toLowerCase();
  const match = (u) => !ql || u.name_he.toLowerCase().includes(ql) || (u.google_name || '').toLowerCase().includes(ql) || (u.google_email || '').toLowerCase().includes(ql);
  const filt = (u) => {
    if (chip === 'all') return u.status === 'active' && !!u.role;
    if (chip === 'leads') return u.status === 'active' && (u.role === 'lead' || u.role === 'captain');
    if (chip === 'mentors') return u.status === 'active' && u.role === 'mentor';
    if (chip === 'alumni') return u.status === 'alumni';
    if (chip === 'norole') return u.status === 'active' && !u.role;
    return u.status === 'active' && (u.main_team === chip || (u.sub_teams || []).includes(chip));
  };
  const list = users.filter((u) => filt(u) && match(u));
  let groups;
  if (chip === 'all') {
    const order = (x, y) => (x.role === 'lead' ? -1 : 0) - (y.role === 'lead' ? -1 : 0) || byHe(x.name_he, y.name_he);
    groups = [{ title: 'מנטורים', list: list.filter((u) => u.role === 'mentor') }, { title: 'קפטנים', list: list.filter((u) => u.role === 'captain') },
      ...teams.filter((t) => t.kind === 'main').map((t) => ({ title: t.name, list: list.filter((u) => u.main_team === t.id && u.role !== 'captain' && u.role !== 'mentor').sort(order) }))].filter((g) => g.list.length);
  } else groups = [{ title: null, list }];
  const row = (u) => {
    const eq = safeRead('store.equipped', u.id) || {};
    const tags = (safeRead('store.shownTags', u.id) || []).slice(0, 3);
    return html`<button key=${u.id} class="lrow dir-row" onClick=${() => navigate('/profile/' + u.id)}>
      <${Avatar} uid=${u.id} size=${40} frame/>
      <div class="col gap4 grow" style="min-width:0">
        <span class="row gap4"><span class=${cx('t-label nameplate', eq.nameColor && eq.nameColor.cls)} style=${(eq.nameplate ? eq.nameplate.style : '') + ';' + (eq.nameColor ? eq.nameColor.style : '')}><bdi>${u.name_he}</bdi></span>
          <${RankBadge} badge=${safeRead('ranks.teamRankBadge', u.id)} size=${16}/></span>
        ${tags.length > 0 && html`<span class="row wrap gap4">${tags.map((x) => html`<${Tag} text=${x.text} color=${x.color}/>`)}</span>`}
        <span class="row wrap gap4">${u.main_team && html`<${TeamBadge} teamId=${u.main_team}/>`}${u.status === 'active' && ROLE_BADGE[u.role] && html`<${Badge} text=${ROLE_BADGE[u.role]}/>`}${u.status === 'alumni' && html`<${Badge} text="בוגר/ת"/>`}</span>
      </div></button>`;
  };
  return html`<div class="col gap12">
    <h1 class="page-title" style="margin-bottom:0">חברי הקבוצה</h1>
    <div style="position:sticky;top:56px;z-index:5;background:var(--bg-app);padding:4px 0" class="col gap8">
      <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש לפי שם או מייל"/><${Chips} items=${chips} value=${chip} onChange=${setChip}/></div>
    ${list.length === 0 ? html`<${EmptyState} title="לא נמצאו חברים"/>` : groups.map((g) => html`<div>${g.title && html`<h3 class="group-head">${g.title}</h3>`}<div class="list dir-list grid">${g.list.map(row)}</div></div>`)}
  </div>`;
}

/* ================= Personal settings (7) ================= */
function Settings() {
  const a = actorInfo();
  const u = bus.read('users.get', a.id);
  const theme = safeRead('neatsystem.theme', a.id) || 'system';
  const phone = safeRead('users.phone', a.id, a.id) || '';
  const fileRef = useRef();
  const [ph, setPh] = useState(phone);
  const uploaded = u.picture && u.picture.startsWith('idb:');
  return html`<div class="col gap16" style="max-width:640px">
    <h1 class="page-title" style="margin-bottom:0">הערות והגדרות שלי</h1>
    <div class="list shadow"><div class="lrow"><${Avatar} uid=${a.id} size=${64}/><div class="col gap8 grow">
      <span class="t-label">תמונת פרופיל</span><div class="row wrap">
        <${Button} size="sm" kind="tinted" icon="upload" onClick=${() => fileRef.current.click()}>העלאת תמונה</${Button}>
        ${uploaded && html`<${Button} size="sm" kind="ghost" onClick=${() => act(() => bus.ask('users.revertPicture', { actor: a.id }), 'חזרנו לתמונת Google')}>חזרה לתמונת Google</${Button}>`}</div>
      <span class="t-foot muted">JPG, PNG או WebP עד 5 MB</span></div>
      <input ref=${fileRef} type="file" accept="image/jpeg,image/png,image/webp" class="hide" onChange=${async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { await bus.ask('users.setPicture', { actor: a.id, blob: f }); toast('התמונה עודכנה'); } catch (err) { toast(err.message || 'לא נשמר'); }
      }}/></div></div>
    <div class="list shadow"><div class="lrow"><div class="col gap8 grow"><${Field} label="טלפון נייד" hint="רק את/ה והנהלת הצוות רואים">
      <div class="row"><input class="input" dir="ltr" inputmode="tel" placeholder="050-0000000" value=${ph} onInput=${(e) => setPh(e.target.value)}/>
      <${Button} kind="secondary" disabled=${ph === phone} onClick=${() => act(() => bus.ask('users.update', { actor: a.id, uid: a.id, changes: { phone: ph } }), 'נשמר')}>שמירה</${Button}></div></${Field}></div></div></div>
    <div class="list shadow"><div class="lrow"><span class="t-label grow">ערכת צבעים</span>
      <${Seg} small value=${theme} onChange=${(v) => bus.ask('neatsystem.setTheme', { actor: a.id, theme: v })} options=${[{ value: 'system', label: 'מערכת' }, { value: 'light', label: 'בהיר' }, { value: 'dark', label: 'כהה' }]}/></div></div>
    ${W('notifications.emailPrefs', { uid: a.id })}
    ${W('sunday.settingsLink', { uid: a.id })}
    <${Button} kind="secondary" icon="log-out" onClick=${() => { bus.ask('users.signOut'); navigate('/home'); }}>התנתקות</${Button}>
  </div>`;
}

addRoute({ path: '/home', tab: 'home', title: 'בית', render: () => html`<${Home}/>` });
addRoute({ path: '/profile/:id', tab: 'home', title: 'פרופיל', access: 'any', render: (p) => html`<${Profile} id=${p.id} key=${p.id}/>` });
addRoute({ path: '/profile', tab: 'home', title: 'פרופיל', access: 'any', render: () => html`<${Profile} id=${me()}/>` });
addRoute({ path: '/directory', tab: 'home', title: 'חברי הקבוצה', render: () => html`<${Directory}/>` });
addRoute({ path: '/settings', tab: 'home', title: 'הערות והגדרות שלי', access: 'any', render: () => html`<${Settings}/>` });
