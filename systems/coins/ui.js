// Coins UI: ledger ("היסטוריה"), award form, recent lines, settings, profile button, coin toasts.
import { html, useState, useEffect, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addRoute, addWidget } from '../../core/registry.js';
import { Button, Icon, Chips, Field, EmptyState, IconButton, cx } from '../../core/ui.js';
import { PersonName, Avatar } from '../../core/people.js';
import { sheet, act, toast, promptText } from '../../core/overlay.js';
import { pickPeople } from '../../core/pickers.js';
import { fmtDate, fmtDateTime } from '../../core/format.js';
import { route } from '../../core/router.js';
import { TYPE_HE, EARNING, DEFAULTS } from './index.js';

const me = () => bus.read('users.currentId');
const TYPE_ICON = { milestone: 'route', sunday_task: 'square-check-big', attendance: 'calendar-check', streak_bonus: 'flame', manual_award: 'gift', purchase: 'shopping-bag', hold: 'lock', hold_release: 'lock-open', refund: 'undo-2', reversal: 'rotate-ccw' };

function LedgerLine({ l, canReverse, hl }) {
  const ref = useRef();
  useEffect(() => { if (hl && ref.current) { ref.current.scrollIntoView({ block: 'center' }); } }, []);
  const amt = l.type === 'hold' ? html`<span class="t-label muted num">(${l.hold})</span>`
    : l.amount > 0 ? html`<span class="t-label successt num">+${l.amount}</span>` : l.amount < 0 ? html`<span class="t-label dangert num">−${-l.amount}</span>` : html`<span class="t-label muted num">0</span>`;
  return html`<div ref=${ref} class="lrow" style=${hl ? 'background:var(--brand-subtle)' : ''}>
    <${Icon} name=${TYPE_ICON[l.type] || 'coin'} size=${20} cls="sec"/>
    <div class="col gap4 grow" style="min-width:0"><span class="t-label" dir="auto">${l.desc}</span>
      <span class="t-foot sec">${fmtDateTime(l.at)} · ${TYPE_HE[l.type]}${l.by && l.by !== 'system' ? html` · <${PersonName} uid=${l.by} rank=${false}/>` : ''}</span>
      ${l.reversedBy && html`<span class="badge" style="align-self:flex-start">בוטל</span>`}
      ${l.shortfall > 0 && html`<span class="t-foot dangert">חוסר שלא קוזז: ${l.shortfall}</span>`}</div>
    ${amt}
    ${canReverse && EARNING.includes(l.type) && !l.reversedBy && html`<${Button} size="xs" kind="ghost" onClick=${async () => {
      const r = await promptText({ title: 'ביטול שורה', text: `${l.desc} (${l.amount})`, label: 'סיבה', min: 3, max: 140 });
      if (r) act(() => bus.ask('coins.reverse', { actor: me(), lineId: l.id, reason: r }), 'בוטל');
    }}>ביטול</${Button}>`}
  </div>`;
}
function Ledger({ uid }) {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const a = bus.read('users.actor', me());
  const lines = bus.read('coins.ledger', uid, type || undefined);
  const bal = bus.read('coins.balance', uid);
  const hl = route().query.line;
  const types = [{ value: '', label: 'הכל' }, ...Object.entries(TYPE_HE).map(([v, l]) => ({ value: v, label: l }))];
  return html`<div class="col gap12">
    <div class="row between wrap"><div class="row gap8"><${Avatar} uid=${uid} size=${40}/><div class="col gap4"><${PersonName} uid=${uid}/><span class="t-foot sec">היסטוריה</span></div></div>
      <div class="col gap4" style="align-items:flex-end"><span class="coin-chip lg"><${Icon} name="coin" size=${22}/>${bal.balance}</span>${bal.held > 0 && html`<span class="t-foot sec">שמורים: ${bal.held}</span>`}</div></div>
    <${Chips} items=${types} value=${type} onChange=${(v) => { setType(v); setPage(1); }}/>
    ${lines.length === 0 ? html`<${EmptyState} title="אין עדיין תנועות" sticker=${false}/>` : html`<div class="list">${lines.slice(0, page * 50).map((l) => html`<${LedgerLine} key=${l.id} l=${l} hl=${hl === l.id} canReverse=${a && (a.isAdmin || a.isMentor)}/>`)}</div>`}
    ${lines.length > page * 50 && html`<${Button} kind="secondary" onClick=${() => setPage(page + 1)}>עוד 50</${Button}>`}
  </div>`;
}
addRoute({ path: '/ledger/:uid', tab: 'home', title: 'היסטוריה', access: 'any', render: (p) => html`<${Ledger} uid=${p.uid} key=${p.uid}/>` });

/* ---------- award form (Coins 4) ---------- */
function AwardForm({ initial = [], onDone }) {
  const actor = me();
  const al = bus.read('coins.awardAllowance', actor);
  const [uids, setUids] = useState(initial);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  if (!al) return html`<p class="t-foot sec">אין לך הרשאה לפעולה הזו</p>`;
  const n = Number(amount) || 0;
  const total = n * uids.length;
  const over = al.remaining != null && total > al.remaining;
  const valid = uids.length && n >= 1 && n <= al.max && reason.trim().length >= 3 && reason.trim().length <= 140 && !over;
  return html`<div class="col gap12">
    ${al.remaining != null && html`<div class=${cx('subtle-box t-foot', over && 'dangert')}>נשארו לך ${al.remaining} מטבעות להענקה החודש</div>`}
    <${Field} label="למי"><button type="button" class="select-btn" onClick=${(e) => pickPeople(e.currentTarget, { title: 'למי להעניק', selected: uids, onChange: setUids, candidates: (u) => bus.read('coins.canAwardTo', actor, u.id), relevantTeam: al.team })}>
      <${Icon} name="users" size=${20} cls="sec"/><span class="grow ell">${uids.length ? uids.map((u) => (bus.read('users.get', u) || {}).name_he).join(', ') : 'בחירת אנשים'}</span></button></${Field}>
    <${Field} label=${`סכום (1–${al.max})`}><input class="input num" type="number" min="1" max=${al.max} value=${amount} onInput=${(e) => setAmount(e.target.value)}/></${Field}>
    <${Field} label="סיבה" hint=${`${reason.trim().length}/140`}><input class="input" maxlength="140" value=${reason} onInput=${(e) => setReason(e.target.value)}/></${Field}>
    ${confirming ? html`<div class="subtle-box col gap8"><span class="t-label num">${n} × ${uids.length} = ${total}</span>
        <div class="row"><${Button} kind="primary" onClick=${() => { const r = act(() => bus.ask('coins.award', { actor, uids, amount: n, reason })); if (r) { toast('המטבעות הוענקו'); setUids([]); setAmount(''); setReason(''); setConfirming(false); onDone && onDone(); } }}>אישור</${Button}>
        <${Button} kind="ghost" onClick=${() => setConfirming(false)}>ביטול</${Button}></div></div>`
    : html`<${Button} kind="primary" disabled=${!valid} onClick=${() => setConfirming(true)}>הענק מטבעות</${Button}>`}
    ${over && html`<span class="field-error"><${Icon} name="circle-alert" size=${16}/>נשארו לך ${al.remaining} מטבעות להענקה החודש</span>`}
  </div>`;
}
addWidget('coins.profileAction', ({ viewer, target }) => {
  if (!bus.read('coins.canAwardTo', viewer, target)) return null;
  return html`<${Button} kind="tinted" size="sm" icon="coin" onClick=${() => sheet('הענק מטבעות', (close) => html`<${AwardForm} initial=${[target]} onDone=${close}/>`)}>הענק מטבעות</${Button}>`;
});

function Recent() {
  const a = bus.read('users.actor', me());
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const lines = bus.read('coins.all').filter((l) => !type || l.type === type);
  return html`<div class="col gap12"><${Chips} items=${[{ value: '', label: 'הכל' }, ...Object.entries(TYPE_HE).map(([v, l]) => ({ value: v, label: l }))]} value=${type} onChange=${setType}/>
    <div class="list">${lines.slice(0, page * 50).map((l) => html`<div key=${l.id} class="col" style="gap:0"><div class="lrow" style="min-height:36px;padding-bottom:0"><${PersonName} uid=${l.uid}/></div><${LedgerLine} l=${l} canReverse=${a.isAdmin || a.isMentor}/></div>`)}</div>
    ${lines.length > page * 50 && html`<${Button} kind="secondary" onClick=${() => setPage(page + 1)}>עוד 50</${Button}>`}</div>`;
}
const SETTING_LABELS = { task_small: 'משימה קטנה', task_medium: 'משימה בינונית', task_large: 'משימה גדולה', task_huge: 'משימה ענקית', streak_bonus: 'בונוס רצף', max_single_award: 'הענקה מקסימלית לאדם', award_cap_lead: 'תקרה חודשית לרש"צ', award_cap_captain: 'תקרה חודשית לקפטן' };
function Settings() {
  const s = bus.read('coins.settings');
  return html`<div class="card b col gap12">${Object.keys(DEFAULTS).map((k) => html`<${Field} label=${`${SETTING_LABELS[k]} (coins.${k})`}>
    <input class="input num" type="number" min="0" value=${s[k]} onChange=${(e) => act(() => bus.ask('coins.setSettings', { actor: me(), patch: { [k]: Number(e.target.value) } }), 'נשמר')}/></${Field}>`)}</div>`;
}
addManagement('coins', 'מטבעות', [
  { id: 'award', title: 'הענקת מטבעות', icon: 'gift', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), render: () => html`<div class="card b"><${AwardForm}/></div>` },
  { id: 'recent', title: 'תנועות אחרונות', icon: 'list', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Recent}/>` },
  { id: 'settings', title: 'הגדרות', icon: 'settings', can: (a) => a.isMentor, render: () => html`<${Settings}/>` },
]);

// Coin toasts for the signed-in user (Design 5.5 / 8.5): "+25" with the coin icon.
bus.on('coins.changed', ({ uid, line }) => {
  if (!window.__appReady || uid !== me() || line.silent || !line.amount) return;
  toast(line.desc, { coin: line.amount });
});
