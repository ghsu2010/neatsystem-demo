// Notifications UI: bell panel (phone full sheet, desktop 380 px popover) and email switches.
import { html } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addWidget } from '../../core/registry.js';
import { Icon, Button, Switch, cx } from '../../core/ui.js';
import { popover, sheet, isPhone, act } from '../../core/overlay.js';
import { navigate } from '../../core/router.js';
import { relTime } from '../../core/format.js';

const ICON = { users: 'user', announcements: 'megaphone', coins: 'coin', store: 'store', attendance: 'calendar-check', trainings: 'route', ranks: 'award', sunday: 'square-check-big' };
const me = () => bus.read('users.currentId');

function Panel({ close }) {
  const uid = me();
  const items = bus.read('notifications.list', uid);
  const unread = items.some((n) => !n.read);
  return html`<div class="col gap4" style=${isPhone() ? '' : 'width:368px'}>
    <div class="row between" style="padding:4px 4px 8px"><span class="t-title3">התראות</span>
      ${unread && html`<${Button} kind="link" size="sm" onClick=${() => act(() => bus.ask('notifications.markAllRead', { actor: uid }))}>סמן הכל כנקרא</${Button}>`}</div>
    ${items.length === 0 ? html`<div class="empty" style="padding:32px 16px"><${Icon} name="bell-off" size=${32} cls="sec"/><span class="t-title3">אין התראות</span></div>`
    : items.slice(0, 100).map((n) => html`<button key=${n.id} class=${cx('lrow')} style=${`border-radius:var(--r-sm);${!n.read ? 'background:var(--brand-subtle)' : ''}`}
        onClick=${() => { act(() => bus.ask('notifications.markRead', { actor: uid, id: n.id })); close(); navigate(n.link); }}>
        <${Icon} name=${ICON[n.system] || 'bell'} size=${20} cls="sec"/>
        <span class="col gap4 grow" style="min-width:0"><span class=${cx('t-foot', !n.read && 'w7')} style="font-size:15px;line-height:20px">${n.text}</span><span class="t-foot muted">${relTime(n.at)}</span></span>
        ${!n.read && html`<span class="dot-new" aria-label="לא נקרא"/>`}</button>`)}
  </div>`;
}
addWidget('notifications.open', (anchor) => {
  if (isPhone()) sheet('', (close) => html`<${Panel} close=${close}/>`, { full: true });
  else popover(anchor, (close) => html`<${Panel} close=${close}/>`, { width: 380 });
});

function EmailPrefs({ uid }) {
  const groups = bus.read('notifications.types');
  return html`<div class="list shadow"><div class="lrow"><span class="t-title3">מיילים</span></div>
    ${groups.map((g) => html`<div class="lrow col" style="align-items:stretch;gap:0"><span class="t-foot sec w5" style="margin-bottom:4px">${g.label}</span>
      ${g.types.map(([id, label, o = {}]) => html`<div class="switch-row" style="min-height:44px"><span class="t-foot grow" style="font-size:15px">${label}${o.locked ? ' (תמיד)' : ''}</span>
        <${Switch} on=${bus.read('notifications.emailOn', uid, id)} disabled=${o.locked} label=${label} onChange=${(v) => act(() => bus.ask('notifications.setEmailPref', { actor: uid, type: id, on: v }))}/></div>`)}</div>`)}
    <div class="lrow t-foot muted">אין התראות פוש לטלפון — רק בתוך האתר ובמייל.</div></div>`;
}
addWidget('notifications.emailPrefs', EmailPrefs);
