// NeatSystem shell: sign-in gate, top bar, navigation (bottom bar / side bar), avatar menu,
// management entry, About, install help, MoneyTeam tab, no-access screen (NeatSystem 3, 8, 9, 11).
import { html, useEffect, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { route, navigate } from '../../core/router.js';
import { matchRoute, addRoute, getManagement, tabBadge, widget } from '../../core/registry.js';
import { Icon, Button, CoinChip, CountBadge, Logo, EmptyState, IconButton, Confetti, cx } from '../../core/ui.js';
import { Avatar, safeRead } from '../../core/people.js';
import { OverlayHost, actionSheet, popover, isPhone, toast, act, closeAll } from '../../core/overlay.js';
import { isOnline } from '../../core/net.js';
import { applyTheme } from './index.js';

export const TABS = [
  { id: 'home', label: 'בית', icon: 'house', path: '/home' },
  { id: 'sunday', label: 'סאנדיי', icon: 'square-check-big', path: '/sunday' },
  { id: 'trainings', label: 'הכשרות', icon: 'route', path: '/trainings' },
  { id: 'store', label: 'חנות', icon: 'store', path: '/store' },
  { id: 'neathub', label: 'NeatHub', icon: 'link', path: '/neathub' },
  { id: 'money', label: 'MoneyTeam', icon: 'wallet', path: '/money' },
];
// NeatSystem 9: management shown per current tab
export const MANAGE_BY_TAB = {
  home: ['users', 'attendance', 'coins', 'leaderboard', 'countdown', 'announcements', 'audit-log'],
  sunday: ['sunday'], trainings: ['trainings', 'ranks'], store: ['store'], neathub: ['neathub'], money: [],
};
export const me = () => bus.read('users.currentId');
export const actorInfo = () => bus.read('users.actor', me());
export function visibleTabs(a) {
  if (!a) return [];
  if (a.noRole) return TABS.filter((t) => t.id === 'money');
  return TABS;
}
export function manageSections(tab, a) {
  return (MANAGE_BY_TAB[tab] || []).map((sys) => {
    const m = getManagement(sys);
    if (!m) return null;
    const sections = m.sections.filter((s) => { try { return s.can(a); } catch { return false; } });
    return sections.length ? { ...m, sections } : null;
  }).filter(Boolean);
}
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

/* ---------- top bar ---------- */
function TopBar({ title, a, tab, scrolled }) {
  const bal = safeRead('coins.balance', a.id);
  const unread = safeRead('notifications.unreadCount', a.id) || 0;
  const DemoSwitch = widget('demo.switchButton');
  const openMenu = (el) => actionSheet('', [
    { icon: 'user', label: 'הפרופיל שלי', onClick: () => navigate('/profile/' + a.id) },
    { icon: 'settings-2', label: 'הערות והגדרות שלי', onClick: () => navigate('/settings') },
    { icon: 'sliders-horizontal', label: 'ניהול', hidden: !manageSections(tab, a).length, onClick: () => navigate('/manage/' + tab) },
    { icon: 'info', label: 'אודות', onClick: () => navigate('/about') },
    { icon: 'download', label: 'התקנת האפליקציה', hidden: isInstalled(), onClick: () => navigate('/install') },
    { icon: 'log-out', label: 'התנתקות', onClick: () => { closeAll(); bus.ask('users.signOut'); navigate('/home'); } },
  ], el);
  const Bell = widget('notifications.open');
  return html`<header class=${cx('topbar', scrolled && 'scrolled')}>
    <div class="tb-title grow ell" aria-hidden=${!scrolled}>${title}</div>
    ${DemoSwitch && html`<${DemoSwitch}/>`}
    ${!a.noRole && html`<button class="tb-btn" aria-label="חברי הקבוצה" title="חברי הקבוצה" onClick=${() => navigate('/directory')}><${Icon} name="users"/></button>`}
    <button class="tb-btn" aria-label=${`התראות${unread ? ` (${unread})` : ''}`} title="התראות" onClick=${(e) => Bell && Bell(e.currentTarget)}>
      <${Icon} name="bell"/>${unread > 0 && html`<span class="nav-badge" style="top:4px;inset-inline-end:2px"><${CountBadge} n=${unread}/></span>`}</button>
    <button class="profile-widget" aria-label="תפריט חשבון" onClick=${(e) => openMenu(e.currentTarget)}>
      <${Avatar} uid=${a.id} size=${32} frame/>${bal && !a.isMentor && !a.noRole ? html`<${CoinChip} n=${bal.spendable}/>` : bal && a.noRole && bal.balance ? html`<${CoinChip} n=${bal.spendable}/>` : null}
    </button>
  </header>`;
}

/* ---------- navigation ---------- */
function NavIcon({ t, active }) {
  return html`<${Icon} name=${t.icon} size=${24} fill=${active ? 'currentColor' : 'none'} style=${active ? 'fill-opacity:.18' : ''}/>`;
}
function BottomNav({ tabs, tab, a }) {
  const slots = tabs.length > 5 ? tabs.slice(0, 4) : tabs;
  const rest = tabs.length > 5 ? tabs.slice(4) : [];
  const restActive = rest.some((t) => t.id === tab);
  return html`<nav class="bottomnav" aria-label="ניווט">
    ${slots.map((t) => { const n = tabBadge(t.id, a.id); return html`<a class=${cx('bn-item', t.id === tab && 'active')} href=${'#' + t.path} aria-current=${t.id === tab ? 'page' : undefined}>
      <span style="position:relative"><${NavIcon} t=${t} active=${t.id === tab}/>${n > 0 && html`<span class="nav-badge"><${CountBadge} n=${n}/></span>`}</span>${t.label}</a>`; })}
    ${rest.length > 0 && html`<button class=${cx('bn-item', restActive && 'active')} onClick=${(e) => actionSheet('עוד', rest.map((t) => ({ icon: t.icon, label: t.label, onClick: () => navigate(t.path) })))}>
      <span style="position:relative"><${Icon} name="ellipsis" size=${24}/>${rest.reduce((s, t) => s + tabBadge(t.id, a.id), 0) > 0 && html`<span class="nav-badge"><${CountBadge} n=${rest.reduce((s, t) => s + tabBadge(t.id, a.id), 0)}/></span>`}</span>עוד</button>`}
  </nav>`;
}
function SideBar({ tabs, tab, a }) {
  const collapsed = safeRead('neatsystem.sidebarCollapsed');
  return html`<nav class=${cx('sidebar', collapsed && 'collapsed')} aria-label="ניווט">
    ${tabs.map((t) => { const n = tabBadge(t.id, a.id); return html`<a class=${cx('side-item', t.id === tab && 'active')} href=${'#' + t.path} title=${t.label} aria-current=${t.id === tab ? 'page' : undefined}>
      <span style="position:relative;display:inline-flex"><${Icon} name=${t.icon} size=${24}/>${n > 0 && collapsed && html`<span class="nav-badge"><${CountBadge} n=${n}/></span>`}</span>
      <span class="side-label grow">${t.label}</span>${n > 0 && !collapsed && html`<${CountBadge} n=${n}/>`}</a>`; })}
    <span class="spacer"/>
    <button class="side-item" aria-label=${collapsed ? 'הרחבת סרגל' : 'כיווץ סרגל'} title=${collapsed ? 'הרחבת סרגל' : 'כיווץ סרגל'} onClick=${() => bus.ask('neatsystem.setSidebar', { collapsed: !collapsed })}>
      <${Icon} name=${collapsed ? 'panel-right-open' : 'panel-right-close'} size=${22}/><span class="side-label">כיווץ</span></button>
  </nav>`;
}

/* ---------- full-screen moments: rank-up (Design 11.2), flame toast ---------- */
function Celebrations({ a }) {
  const c = safeRead('ranks.pendingCelebration', a.id);
  useEffect(() => {
    const f = safeRead('attendance.flameToastPending', a.id);
    if (f) { toast('הלהבה שלך שינתה צבע!'); act(() => bus.ask('attendance.ackFlameToast', { actor: a.id })); }
  });
  if (!c) return null;
  return html`<div class="brand-screen" style="position:fixed;inset:0;z-index:150;background:var(--bg-app)" role="dialog" aria-label="עלית דרגה">
    <${Confetti}/>
    <div class="scale-in" style="width:120px;height:120px"><${RankBadgeBig} badge=${c.badge}/></div>
    <h1 class="t-title1 center">${c.rankName}</h1><p class="t-foot sec">${c.categoryName}</p>
    <p class="t-body center">עלית דרגה! עכשיו את/ה ${c.rankName} ב${c.categoryName}</p>
    <${Button} kind="primary" onClick=${() => bus.ask('ranks.ackCelebration', { actor: a.id, id: c.id })}>יאללה</${Button}>
  </div>`;
}
function RankBadgeBig({ badge }) {
  return html`<span class="rank-badge" style="width:120px;height:120px;font-size:56px">${badge && badge.url ? html`<img src=${badge.url} alt=""/>` : badge ? badge.name[0] : ''}</span>`;
}

/* ---------- simple screens ---------- */
function NoAccess({ a }) {
  return html`<div class="brand-card" style="margin:48px auto"><div class="center"><${Icon} name="lock" size=${32} cls="sec"/></div>
    <h1 class="t-title2 center">אין לך גישה לאפליקציה הזו</h1>
    <${Button} kind="secondary" full onClick=${() => navigate('/profile/' + a.id)}>לפרופיל</${Button}></div>`;
}
function About() {
  const DemoReset = widget('demo.resetButton');
  return html`<div class="col gap16" style="align-items:center;padding-top:24px">
    <${Logo} kind="plain" size=${140}/><${Logo} kind="wordmark" width=${220}/>
    <p class="t-label">Neat Team #1943</p><p class="t-foot sec">NeatSystem · גרסה 4.0 (הדגמה)</p>
    <${Logo} kind="wordmarkDark" width=${260}/>
    ${DemoReset && html`<${DemoReset}/>`}
  </div>`;
}
function Install() {
  const shot = html`<div style="height:180px;border-radius:var(--r-md);background:var(--bg-subtle);display:grid;place-items:center" class="t-foot muted">צילום מסך יתווסף בהמשך</div>`;
  return html`<div class="col gap16">
    <div class="card"><h2 class="card-title">iPhone (Safari)</h2><ol class="t-body" style="padding-inline-start:20px">
      <li>פותחים את האתר ב-Safari.</li><li>לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה).</li><li>בוחרים "הוספה למסך הבית".</li><li>לוחצים "הוספה" — האייקון של Neat Team יופיע במסך הבית.</li></ol>${shot}</div>
    <div class="card"><h2 class="card-title">Android (Chrome)</h2><ol class="t-body" style="padding-inline-start:20px">
      <li>פותחים את האתר ב-Chrome.</li><li>לוחצים על שלוש הנקודות למעלה.</li><li>בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".</li><li>מאשרים — האפליקציה תיפתח בלי שורת הכתובת.</li></ol>${shot}</div></div>`;
}
const MONEYTEAM_URL = ''; // not configured in the demo
function MoneyTeam() {
  const open = () => { if (MONEYTEAM_URL) window.open(MONEYTEAM_URL, '_blank', 'noopener'); else toast('עוד לא הוגדרה כתובת ל-MoneyTeam'); };
  return html`<div class="col" style="margin:-8px -16px 0">
    <div class="row between" style="background:var(--bg-subtle);padding:4px 16px;min-height:44px"><span class="t-foot sec">MoneyTeam</span>
      <${Button} kind="link" size="sm" iconEnd="external-link" onClick=${open}>פתיחה בחלון חדש</${Button}></div>
    <div class="empty"><${Icon} name="wallet" size=${32} cls="sec"/><div class="t-title3">MoneyTeam לא נטען</div>
      <${Button} kind="tinted" iconEnd="external-link" onClick=${open}>פתיחה בחלון חדש</${Button}></div></div>`;
}

/* ---------- management entry (NeatSystem 9, Design 7.8) ---------- */
function Manage({ tab, system, section, query, a }) {
  const groups = manageSections(tab, a);
  if (!groups.length) return html`<${EmptyState} title=${'אין לך הרשאה לפעולה הזו'} sticker=${false}/>`;
  const phone = isPhone();
  const cur = system && groups.find((g) => g.system === system);
  const sec = cur && cur.sections.find((s) => s.id === section);
  const list = html`<nav class="col gap4" aria-label="ניהול">${groups.map((g) => html`<div><h3 class="group-head">${g.title}</h3>
    ${g.sections.map((s) => { const n = s.badge ? s.badge(a) : 0; return html`<a class=${cx('subnav-row', sec === s && cur.system === g.system && 'active')} href=${`#/manage/${tab}/${g.system}/${s.id}`}>
      <${Icon} name=${s.icon} size=${20}/><span class="grow">${s.title}</span>${n > 0 && html`<${CountBadge} n=${n}/>`}${phone && html`<${Icon} name="chevron-left" size=${18} cls="sec"/>`}</a>`; })}</div>`)}</nav>`;
  if (phone) {
    if (!sec) return html`<div><h1 class="page-title">ניהול</h1>${list}</div>`;
    return html`<div><div class="row"><${IconButton} icon="arrow-right" label="חזרה" onClick=${() => navigate('/manage/' + tab)}/><h1 class="t-title2 grow">${sec.title}</h1></div>
      <p class="t-foot sec" style="margin:0 0 12px 44px">${cur.title}</p>${sec.render(query, a)}</div>`;
  }
  const first = groups[0];
  const shown = sec || first.sections[0];
  const sys = sec ? cur : first;
  return html`<div><h1 class="page-title">ניהול</h1><div class="manage-layout">${list}
    <div class="col gap12"><div><p class="t-foot sec">${sys.title}</p><h2 class="t-title2">${shown.title}</h2></div>${shown.render(query, a)}</div></div></div>`;
}

/* ---------- routes owned by NeatSystem ---------- */
addRoute({ path: '/about', tab: 'home', title: 'אודות', access: 'any', render: () => html`<${About}/>` });
addRoute({ path: '/install', tab: 'home', title: 'התקנת האפליקציה', access: 'any', render: () => html`<${Install}/>` });
addRoute({ path: '/money', tab: 'money', title: 'MoneyTeam', render: () => html`<${MoneyTeam}/>` });
addRoute({ path: '/manage/:tab', tab: (p) => p.tab, title: 'ניהול', access: 'any', render: (p, q) => html`<${Manage} tab=${p.tab} query=${q} a=${actorInfo()}/>` });
addRoute({ path: '/manage/:tab/:system/:section', tab: (p) => p.tab, title: 'ניהול', access: 'any', wideFn: (p) => p.system === 'sunday' || p.system === 'audit-log',
  render: (p, q) => html`<${Manage} tab=${p.tab} system=${p.system} section=${p.section} query=${q} a=${actorInfo()}/>` });

/* ---------- the shell ---------- */
function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => { const f = () => setS(window.scrollY > 36); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  return s;
}
function SignedIn({ a }) {
  const r = route();
  const scrolled = useScrolled();
  useEffect(() => { applyTheme(safeRead('neatsystem.theme', a.id) || 'system'); }, [a.id]);
  const tabs = visibleTabs(a);
  let m = matchRoute(r.parts);
  if (!m || r.path === '/') {
    const def = a.noRole ? '/profile/' + a.id : '/home';
    if (r.path !== def) setTimeout(() => navigate(def, { replace: true }));
    m = matchRoute(def.split('/').filter(Boolean));
  }
  const { route: rt, params } = m;
  const tab = typeof rt.tab === 'function' ? rt.tab(params) : rt.tab;
  // access: a tab the user can't see → no access; no-role users see only their profile, settings, MoneyTeam
  let allowed = rt.access === 'any' || tabs.some((t) => t.id === tab);
  if (a.noRole && rt.path === '/profile/:id' && params.id !== a.id) allowed = false;
  if (a.noRole && rt.path === '/directory') allowed = false;
  if (a.noRole && rt.path.startsWith('/manage')) allowed = false;
  if (rt.guard && !rt.guard(a, params)) allowed = false;
  const title = typeof rt.title === 'function' ? rt.title(params) : rt.title;
  useEffect(() => { document.title = `${title} · Neat Team`; }, [title]);
  const navTab = tabs.some((t) => t.id === tab) ? tab : 'home';
  const wide = rt.wide || (rt.wideFn && rt.wideFn(params));
  return html`<div class="shell">
    <${SideBar} tabs=${tabs} tab=${navTab} a=${a}/>
    <div class="main">
      <${TopBar} title=${title} a=${a} tab=${navTab} scrolled=${scrolled}/>
      ${!isOnline() && html`<div class="offline-banner" role="status"><${Icon} name="cloud-off" size=${20}/>אין חיבור לאינטרנט</div>`}
      <main class=${cx('content', wide && 'wide')} id="main">${allowed ? rt.render(params, r.query) : html`<${NoAccess} a=${a}/>`}</main>
    </div>
    <${BottomNav} tabs=${tabs} tab=${navTab} a=${a}/>
    <${Celebrations} a=${a}/>
  </div>`;
}
function SignedOut() {
  const [google, setGoogle] = useState(false);
  const Flow = widget('demo.googleFlow');
  if (google && Flow) return html`<${Flow} onBack=${() => setGoogle(false)}/>`;
  const SignIn = widget('users.signIn');
  return html`<${SignIn} onGoogle=${() => setGoogle(true)}/>`;
}
export function Shell() {
  const s = safeRead('users.session');
  let body;
  if (!s || (!s.uid && !s.google)) body = html`<${SignedOut}/>`;
  else if (!s.uid) body = html`<${widget('users.welcome')}/>`;
  else {
    const u = safeRead('users.get', s.uid);
    if (!u) { bus.ask('users.signOut'); body = html`<${SignedOut}/>`; }
    else if (u.status === 'pending') body = html`<${widget('users.waiting')}/>`;
    else body = html`<${SignedIn} a=${bus.read('users.actor', s.uid)}/>`;
  }
  return html`<div class="app">${body}${!isOnline() && (!s || !s.uid) ? html`<div class="offline-banner" style="position:fixed;top:0;inset-inline:0"><${Icon} name="cloud-off" size=${20}/>אין חיבור לאינטרנט</div>` : null}<${OverlayHost}/></div>`;
}
