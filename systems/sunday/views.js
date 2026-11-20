// Sunday: kanban & calendar views (C13), coin approval queue (C15), trash, dashboard (C19),
// board settings, new board, filter builder, add-column menu, label editor, scope dialog.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Icon, Button, Seg, Field, Chips, Switch, SwitchRow, Pill, Badge, EmptyState, IconButton, Checkbox, RadioRow, Card, cx } from '../../core/ui.js';
import { Avatar, AvatarStack, PersonName } from '../../core/people.js';
import { act, toast, confirm, sheet, popover, promptText, actionSheet } from '../../core/overlay.js';
import { MenuSelect, SelectorField, pickColor, ColorSwatchButton, SIZE_LABELS } from '../../core/pickers.js';
import { HE_MONTHS, HE_DAYS_SHORT, dayKey, parseDay, todayKey, addDaysKey, fmtShort, fmtDate, fmtDayShort, daysBetween, relTime, uid as newId } from '../../core/format.js';
import { navigate, route } from '../../core/router.js';
import { now } from '../../core/clock.js';
import { presetHex, tintVars, PRESETS } from '../../core/color.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { me, lbl, isLead, canEdit, SizeCell } from './cells.js';
import { openPanel } from './panel.js';
import { COL_TYPES, UNIQUE } from './index.js';

const A = () => bus.read('users.actor', me());

/* ---------- Kanban ---------- */
export function Kanban({ bd, groups, filterItems }) {
  const uid = me();
  const labels = [];
  groups.forEach((g) => g.statusLabels.forEach((l) => { if (!labels.some((x) => x.text === l.text)) labels.push(l); }));
  const all = groups.flatMap((g) => filterItems(g).map((it) => ({ it, g })));
  return html`<div class="kanban">${labels.map((l) => {
    const list = all.filter(({ it, g }) => (lbl(g.statusLabels, it.status) || {}).text === l.text);
    return html`<div class="k-col" key=${l.text}><div class="row gap8" style="padding:4px 4px 8px"><${Pill} text=${l.text} color=${l.color}/><span class="t-foot sec num">${list.length}</span></div>
      <div class="col gap8" data-drop-list=${`kanban-${bd.id}:${l.text}`} style="min-height:80px">${list.map(({ it, g }) => html`<div class="k-card" data-drag-item key=${it.id}
        onPointerDown=${canEdit(it) && !bus.read('sunday.subitems', it.id).length ? (e) => { if (e.target.closest('button')) return; startDrag(e, { group: 'kanban-' + bd.id, listId: l.text, longPress: e.pointerType === 'touch', onDrop: ({ toList }) => { const target = lbl(g.statusLabels, (g.statusLabels.find((x) => x.text === toList) || {}).key); if (target) { const prev = it.status; if (act(() => bus.ask('sunday.setStatus', { actor: uid, itemId: it.id, key: target.key })) !== undefined) toast(`הסטטוס שונה ל"${target.text}"`, { undo: () => bus.ask('sunday.setStatus', { actor: uid, itemId: it.id, key: prev }) }); } else toast('לסטטוס הזה אין מקבילה בקבוצה של המשימה'); } }); } : undefined}
        onClick=${() => openPanel(it.id)}>
        <span class="t-label clamp2">${it.name}</span>
        <div class="row gap8 wrap"><${AvatarStack} uids=${it.assignments.map((x) => x.uid)} size=${24}/>${it.dateEnd && html`<span class="t-foot sec num">${fmtShort(it.dateEnd)}</span>`}<span class="spacer"/><${SizeCell} it=${it} bd=${bd}/></div></div>`)}</div></div>`;
  })}</div>`;
}

/* ---------- Calendar ---------- */
export function CalendarView({ bd, groups, prefs }) {
  const uid = me();
  const base = new Date(now());
  const [ym, setYm] = useState([base.getFullYear(), base.getMonth()]);
  const hide = prefs.calendarHideEmpty;
  const all = groups.flatMap((g) => bus.read('sunday.items', g.id).filter((it) => it.dateEnd).map((it) => ({ it, g })));
  const first = new Date(ym[0], ym[1], 1);
  const startPad = first.getDay();
  const monthStart = dayKey(first), monthEnd = dayKey(new Date(ym[0], ym[1] + 1, 0));
  const inMonth = all.filter(({ it }) => (it.dateStart || it.dateEnd) <= monthEnd && it.dateEnd >= monthStart);
  const move = (d) => { const m = ym[1] + d; setYm([ym[0] + Math.floor(m / 12), ((m % 12) + 12) % 12]); };
  const head = html`<div class="row wrap gap8" style="margin-bottom:12px"><button class="icon-btn" aria-label="החודש הקודם" onClick=${() => move(-1)}><${Icon} name="chevron-right"/></button>
    <span class="t-title3" style="min-width:140px;text-align:center">${HE_MONTHS[ym[1]]} ${ym[0]}</span><button class="icon-btn" aria-label="החודש הבא" onClick=${() => move(1)}><${Icon} name="chevron-left"/></button>
    <${Button} size="sm" kind="secondary" onClick=${() => setYm([base.getFullYear(), base.getMonth()])}>היום</${Button}><span class="spacer"/>
    <label class="row gap8 t-foot">הסתרת ימים ללא משימות <${Switch} on=${hide} label="הסתרת ימים ללא משימות" onChange=${(v) => bus.ask('sunday.setPrefs', { actor: uid, boardId: bd.id, patch: { calendarHideEmpty: v } })}/></label></div>`;
  if (hide) {
    const days = {};
    inMonth.forEach((x) => { for (let k = (x.it.dateStart || x.it.dateEnd) < monthStart ? monthStart : x.it.dateStart || x.it.dateEnd; k <= x.it.dateEnd && k <= monthEnd; k = addDaysKey(k, 1)) (days[k] = days[k] || []).push(x); });
    const keys = Object.keys(days).sort();
    return html`<div>${head}${keys.length === 0 ? html`<${EmptyState} title="אין משימות בחודש הזה" sticker=${false}/>` : keys.map((k) => html`<div key=${k} style="margin-bottom:12px"><h3 class="group-head">${fmtDayShort(k)}</h3>
      <div class="list">${days[k].map(({ it, g }) => html`<button class="lrow" onClick=${() => openPanel(it.id)}><span class="t-label grow">${it.name}</span>
        <${Pill} text=${(lbl(g.statusLabels, it.status) || {}).text} color=${(lbl(g.statusLabels, it.status) || {}).color}/><${AvatarStack} uids=${it.assignments.map((x) => x.uid)} size=${24}/></button>`)}</div></div>`)}</div>`;
  }
  const weeks = [];
  for (let w = 0; w < 6; w++) { const days = []; for (let d = 0; d < 7; d++) days.push(dayKey(new Date(ym[0], ym[1], 1 - startPad + w * 7 + d))); if (w < 4 || days.some((k) => k >= monthStart && k <= monthEnd)) weeks.push(days); }
  const t = todayKey();
  return html`<div>${head}<div class="cal-month">
    <div class="cal-row cal-dows">${HE_DAYS_SHORT.map((d) => html`<div class="t-foot sec center">${d}</div>`)}</div>
    ${weeks.map((days) => {
      const ws = days[0], we = days[6];
      const bars = all.filter(({ it }) => (it.dateStart || it.dateEnd) <= we && it.dateEnd >= ws).map(({ it, g }) => {
        const s = (it.dateStart || it.dateEnd) < ws ? ws : it.dateStart || it.dateEnd; const e = it.dateEnd > we ? we : it.dateEnd;
        return { it, g, col: days.indexOf(s) + 1, span: days.indexOf(e) - days.indexOf(s) + 1 };
      });
      return html`<div class="cal-week">
        <div class="cal-row">${days.map((k) => html`<div class=${cx('cal-cell', (k < monthStart || k > monthEnd) && 'other', k === t && 'today')} data-day=${k}><span class="t-foot num">${parseDay(k).getDate()}</span></div>`)}</div>
        <div class="cal-bars">${bars.map((x) => html`<button class="cal-bar tinted" style=${`grid-column:${x.col} / span ${x.span};${tintVars(x.g.color)}`} onClick=${() => openPanel(x.it.id)}
          onPointerDown=${canEdit(x.it) ? (e) => dragDate(e, x.it) : undefined} title=${x.it.name}><span class="ell">${x.it.name}</span></button>`)}</div></div>`;
    })}</div></div>`;
}
function dragDate(e, it) {
  if (e.pointerType === 'touch') return;
  const sx = e.clientX, sy = e.clientY;
  const dayAt = (x, y) => { const el = document.elementsFromPoint(x, y).find((n) => n.dataset && n.dataset.day); return el && el.dataset.day; };
  const from = dayAt(sx, sy);
  const up = (ev) => {
    window.removeEventListener('pointerup', up);
    if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 8) return;
    const to = dayAt(ev.clientX, ev.clientY);
    if (!from || !to || from === to) return;
    const delta = daysBetween(parseDay(from), parseDay(to));
    const prev = { start: it.dateStart, end: it.dateEnd };
    const next = { start: it.dateStart ? addDaysKey(it.dateStart, delta) : null, end: addDaysKey(it.dateEnd, delta) };
    if (act(() => bus.ask('sunday.setDate', { actor: me(), itemId: it.id, ...next })) !== undefined) toast('התאריך עודכן', { undo: () => bus.ask('sunday.setDate', { actor: me(), itemId: it.id, ...prev }) });
  };
  window.addEventListener('pointerup', up);
}

/* ---------- coin approval queue (C15.9) ---------- */
export function Approvals() {
  const uid = me();
  const q = route().query;
  const [tab, setTab] = useState('waiting');
  const [boardF, setBoardF] = useState('');
  const amounts = bus.read('coins.taskAmounts');
  const all = bus.read('sunday.queue', uid);
  const waiting = all.filter((it) => it.coin.state === 'awaiting').sort((x, y) => (x.coin.doneAt < y.coin.doneAt ? -1 : 1));
  const decided = all.filter((it) => it.coin.state !== 'awaiting').sort((x, y) => (y.coin.decidedAt > x.coin.decidedAt ? 1 : -1));
  const list = (tab === 'waiting' ? waiting : decided).filter((it) => !boardF || bus.read('sunday.boardOfItem', it.id).id === boardF);
  const boards = [...new Map(all.map((it) => { const bd = bus.read('sunday.boardOfItem', it.id); return [bd.id, bd]; })).values()];
  const [sizes, setSizes] = useState({});
  return html`<div class="col gap12">
    <${Seg} value=${tab} onChange=${setTab} options=${[{ value: 'waiting', label: `ממתינים (${waiting.length})` }, { value: 'decided', label: 'הוכרעו' }]}/>
    ${boards.length > 1 && html`<${Chips} value=${boardF} onChange=${setBoardF} items=${[{ value: '', label: 'כל הלוחות' }, ...boards.map((bd) => ({ value: bd.id, label: bd.name }))]}/>`}
    ${list.length === 0 ? html`<${EmptyState} title=${tab === 'waiting' ? 'אין משימות שממתינות לאישור' : 'עוד לא הוכרעו משימות'} sticker=${false}/>` : html`<div class="list">${list.map((it) => {
      const g = bus.read('sunday.group', it.groupId); const bd = bus.read('sunday.board', g.boardId);
      const can = bus.read('sunday.canApprove', uid, it.id);
      const size = sizes[it.id] || it.size;
      return html`<div class="lrow col" key=${it.id} style=${`align-items:stretch;${q.item === it.id ? 'background:var(--brand-subtle)' : ''}`}>
        <div class="row gap8 wrap"><div class="col gap4 grow" style="min-width:180px"><a class="t-label" href=${`#/sunday/board/${bd.id}?item=${it.id}`}>${it.name}</a><span class="t-foot sec">${bd.name} · ${g.name} · בוצע ${fmtDate(it.coin.doneAt)}</span></div>
          <${AvatarStack} uids=${it.assignments.map((x) => x.uid)} size=${28}/></div>
        ${tab === 'waiting' ? html`<div class="row wrap gap8" style="margin-top:8px">
            <div class="seg" role="radiogroup" aria-label="גודל">${['small', 'medium', 'large', 'huge', 'none'].map((s) => html`<button class=${size === s ? 'on' : ''} onClick=${() => setSizes({ ...sizes, [it.id]: s })}>${SIZE_LABELS[s]}${s !== 'none' ? html` · <span class="num">${amounts[s]}</span>` : ''}</button>`)}</div>
            <span class="spacer"/>
            ${can ? html`<${Button} size="sm" kind="primary" disabled=${!size} onClick=${() => { if (act(() => bus.ask('sunday.approveCoins', { actor: uid, itemId: it.id, size })) !== undefined) toast('אושר', { undo: () => bus.ask('sunday.undoCoinDecision', { actor: uid, itemId: it.id }) }); }}>אישור</${Button}>
              <${Button} size="sm" kind="secondary" onClick=${async () => { const n = await promptText({ title: 'דחיית מטבעות', label: 'הערה לאחראים', min: 2, max: 280 }); if (n && act(() => bus.ask('sunday.rejectCoins', { actor: uid, itemId: it.id, note: n })) !== undefined) toast('נדחה', { undo: () => bus.ask('sunday.undoCoinDecision', { actor: uid, itemId: it.id }) }); }}>דחייה</${Button}>`
            : html`<span class="t-foot sec">את/ה משויך/ת למשימה — קפטן או מנטור/ית יאשרו</span>`}</div>`
        : html`<div class="row wrap gap8" style="margin-top:8px"><${Badge} kind=${it.coin.state === 'approved' ? 'success' : 'danger'} text=${it.coin.state === 'approved' ? `אושר · ${SIZE_LABELS[it.coin.size]}` : 'נדחה'}/>
            <span class="t-foot sec">${(bus.read('users.get', it.coin.decidedBy) || {}).name_he || ''} · ${fmtDate(it.coin.decidedAt)}${it.coin.note ? ' · ' + it.coin.note : ''}</span><span class="spacer"/>
            ${can && it.status === 'done' && html`${it.coin.state === 'approved' ? html`<${Button} size="xs" kind="secondary" onClick=${async () => { const n = await promptText({ title: 'שינוי לדחייה', label: 'הערה', min: 2 }); if (n) act(() => bus.ask('sunday.rejectCoins', { actor: uid, itemId: it.id, note: n }), 'עודכן'); }}>שינוי לדחייה</${Button}>`
              : html`<${Button} size="xs" kind="secondary" onClick=${() => act(() => bus.ask('sunday.undoCoinDecision', { actor: uid, itemId: it.id }), 'הוחזר לממתינים')}>החזרה לממתינים</${Button}>`}`}</div>`}
      </div>`;
    })}</div>`}</div>`;
}

/* ---------- trash ---------- */
const KIND = { board: ['layout-dashboard', 'לוח'], group: ['folder', 'קבוצה'], item: ['square-check-big', 'משימה'], subitem: ['list-checks', 'תת-משימה'], column: ['columns-3', 'עמודה'] };
export function Trash() {
  const uid = me();
  const list = bus.read('sunday.trash', uid);
  const days = bus.read('sunday.appSettings').trash_days;
  if (!list.length) return html`<${EmptyState} title="הפח ריק"/>`;
  return html`<div class="list">${list.map((x) => html`<div class="lrow" key=${x.id}><${Icon} name=${KIND[x.kind][0]} size=${20} cls="sec"/>
    <div class="col gap4 grow"><span class="t-label">${x.name}</span><span class="t-foot sec">${KIND[x.kind][1]} · ${(bus.read('sunday.board', x.boardId) || {}).name || ''}${x.groupName ? ' · ' + x.groupName : ''} · נמחק ע"י ${(bus.read('users.get', x.deletedBy) || { name_he: 'משתמש שנמחק' }).name_he} · עוד ${Math.max(0, days - daysBetween(new Date(x.deletedAt), now()))} ימים</span></div>
    <${Button} size="xs" kind="secondary" onClick=${() => act(() => bus.ask('sunday.restore', { actor: uid, kind: x.kind, targetId: x.id }), x.kind === 'column' ? 'שוחזר (ללא ערכים)' : 'שוחזר')}>שחזור</${Button}></div>`)}</div>`;
}

/* ---------- dashboard (C19) ---------- */
function Bars({ rows, color = 'var(--brand)', onBar }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return html`<div class="col gap8">${rows.map((r) => html`<button class="row gap8" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;text-align:start" onClick=${() => onBar && onBar(r)}>
    <span class="t-foot" style="width:96px;flex:none" title=${r.label}><span class="ell" style="display:block">${r.label}</span></span>
    <span style="flex:1;height:18px;background:var(--bg-subtle);border-radius:4px;overflow:hidden"><span style=${`display:block;height:100%;width:${(r.v / max) * 100}%;background:${color};border-radius:4px`}/></span>
    <span class="t-foot num" style="width:32px">${r.v}</span></button>`)}</div>`;
}
function Stacked({ rows, onRow }) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((s, p) => s + p.v, 0)));
  return html`<div class="col gap8">${rows.map((r) => html`<button class="row gap8" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;width:100%" onClick=${() => onRow && onRow(r)}><span class="t-foot" style="width:96px;flex:none;text-align:start">${r.label}</span>
    <span style="flex:1;height:18px;display:flex;gap:1px;border-radius:4px;overflow:hidden;background:var(--bg-subtle)">${r.parts.filter((p) => p.v).map((p) => html`<span title=${`${p.label}: ${p.v}`} class="tinted" style=${`${tintVars(p.color)};width:${(p.v / max) * 100}%;background:var(--tfl)`}/>`)}</span></button>`)}
    <div class="row wrap gap8">${(rows[0] || { parts: [] }).parts.map((p) => html`<${Pill} text=${p.label} color=${p.color}/>`)}</div></div>`;
}
function Line({ points }) {
  const W = 320, H = 120, max = Math.max(1, ...points.map((p) => p.v));
  const xy = points.map((p, i) => [W - (i * (W - 20)) / Math.max(1, points.length - 1) - 10, H - 16 - (p.v / max) * (H - 32)]);
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style="width:100%;height:140px" role="img" aria-label="משימות שהושלמו לפי שבוע">
    <polyline points=${xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--brand)" stroke-width="2"/>
    ${xy.map(([x, y], i) => html`<g style="cursor:pointer" onClick=${() => navigate('/sunday/approvals')}><circle cx=${x} cy=${y} r="6" fill="var(--brand)"/><text x=${x} y=${H - 2} font-size="10" text-anchor="middle" fill="var(--text-secondary)">${points[i].label}</text><text x=${x} y=${y - 8} font-size="10" text-anchor="middle" fill="var(--text)">${points[i].v}</text></g>`)}</svg>`;
}
export function Dashboard() {
  const items = bus.read('sunday.allItems').filter((it) => !it.parentId);
  const teams = bus.read('users.mainTeams');
  const teamOf = (it) => (bus.read('sunday.boardOfItem', it.id) || {}).team;
  const t = todayKey();
  const statusParts = (list) => [['todo', 'לביצוע', 'fx:todo'], ['working', 'בעבודה', 'fx:working'], ['stuck', 'תקוע', 'fx:stuck'], ['done', 'בוצע', 'fx:done']].map(([k, l, c]) => ({ label: l, color: c, v: list.filter((it) => it.status === k).length }));
  const teamRows = [...teams.map((tm) => ({ id: tm.id, label: tm.name })), { id: null, label: 'כללי' }];
  const goBoard = (teamId) => { const bd = bus.read('sunday.boards', me()).find((x) => x.team === teamId); if (bd) navigate('/sunday/board/' + bd.id); };
  const perAssignee = {};
  items.filter((it) => it.status !== 'done').forEach((it) => it.assignments.forEach((x) => { perAssignee[x.uid] = (perAssignee[x.uid] || 0) + 1; }));
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = addDaysKey(t, -7 * i), start = addDaysKey(end, -6); return { label: fmtShort(start), v: items.filter((it) => it.status === 'done' && it.coin && it.coin.doneAt && dayKey(it.coin.doneAt) >= start && dayKey(it.coin.doneAt) <= end).length }; });
  const amounts = bus.read('coins.taskAmounts');
  const since = addDaysKey(t, -30);
  const coinsPerTeam = teamRows.map((r) => ({ ...r, v: items.filter((it) => teamOf(it) === r.id && it.coin && it.coin.state === 'approved' && dayKey(it.coin.decidedAt) >= since).reduce((s, it) => s + (amounts[it.coin.size] || 0) * (it.coin.paid || []).length, 0) }));
  return html`<div class="col gap16"><div class="dash-grid">
    <${Card} title="משימות לפי סטטוס וצוות"><${Stacked} onRow=${(r) => goBoard(r.id)} rows=${teamRows.map((r) => ({ id: r.id, label: r.label, parts: statusParts(items.filter((it) => teamOf(it) === r.id)) }))}/></${Card}>
    <${Card} title="משימות באיחור לפי צוות"><${Bars} color="var(--danger)" onBar=${(r) => goBoard(r.id)} rows=${teamRows.map((r) => ({ ...r, v: items.filter((it) => teamOf(it) === r.id && it.dateEnd && it.dateEnd < t && it.status !== 'done').length }))}/></${Card}>
    <${Card} title="משימות פתוחות לפי אחראי (10 מובילים)"><${Bars} rows=${Object.entries(perAssignee).sort((a, c) => c[1] - a[1]).slice(0, 10).map(([u, v]) => ({ label: (bus.read('users.get', u) || { name_he: 'משתמש שנמחק' }).name_he, v, uid: u }))} onBar=${(r) => navigate('/profile/' + r.uid)}/></${Card}>
    <${Card} title="משימות שהושלמו ב-8 השבועות האחרונים"><${Line} points=${weeks}/></${Card}></div>
    <${Card} title="מטבעות ששולמו לפי צוות (30 יום)"><${Bars} color="var(--reward)" rows=${coinsPerTeam} onBar=${(r) => goBoard(r.id)}/></${Card}></div>`;
}

/* ---------- personal settings ---------- */
export function SundaySettings() {
  const uid = me();
  const a = A();
  const s = bus.read('sunday.settings', uid);
  const teams = bus.read('users.mainTeams');
  const follow = s.follow || teams.map((t) => t.id);
  return html`<div class="col gap12"><${SwitchRow} label="שייך אותי אוטומטית למשימות שאני יוצר/ת" on=${s.autoAssign} onChange=${(v) => act(() => bus.ask('sunday.setSettings', { actor: uid, patch: { autoAssign: v } }))}/>
    ${a.isMentor && html`<div class="col gap4"><span class="t-label">מעקב התראות</span><span class="t-foot sec">התראות על לוחות של הצוותים המסומנים. אפשר לפעול בכל לוח בכל מקרה.</span>
      ${teams.map((t) => html`<label class="check-row"><${Checkbox} on=${follow.includes(t.id)} label=${t.name} onChange=${(v) => act(() => bus.ask('sunday.setSettings', { actor: uid, patch: { follow: v ? [...follow, t.id] : follow.filter((x) => x !== t.id) } }))}/><span class="t-label">${t.name}</span></label>`)}</div>`}</div>`;
}

/* ---------- dialogs ---------- */
export function newBoardDialog() {
  const a = A();
  const leadOnly = a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor);
  const st = { name: '', team: leadOnly ? a.team : null };
  const Body = () => { const [f, setF] = useState(st); Object.assign(st, f);
    return html`<div class="col gap12"><${Field} label="שם הלוח"><input class="input" maxlength="60" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
      <${Field} label="צוות"><${MenuSelect} value=${f.team} disabled=${leadOnly} options=${[...(leadOnly ? [] : [{ value: null, label: 'כללי' }]), ...bus.read('users.mainTeams').map((t) => ({ value: t.id, label: t.name }))]} onChange=${(v) => setF({ ...f, team: v })}/></${Field}></div>`; };
  sheet('לוח חדש', () => html`<${Body}/>`, { foot: (c) => html`<${Button} kind="primary" full onClick=${() => { const id = act(() => bus.ask('sunday.createBoard', { actor: me(), name: st.name, team: st.team })); if (id) { c(); navigate('/sunday/board/' + id); } }}>יצירה</${Button}>` });
}
export function boardSettings(bd) {
  const a = A();
  const st = { name: bd.name, team: bd.team, views: bd.views.slice(), access: bd.access };
  const Body = () => { const [f, setF] = useState(st); Object.assign(st, f);
    const VIEW_HE = { table: 'טבלה', kanban: 'קנבן', calendar: 'לוח שנה' };
    return html`<div class="col gap12"><${Field} label="שם"><input class="input" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
      <${Field} label="צוות"><${MenuSelect} value=${f.team} disabled=${a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)} options=${[{ value: null, label: 'כללי' }, ...bus.read('users.mainTeams').map((t) => ({ value: t.id, label: t.name }))]} onChange=${(v) => setF({ ...f, team: v })}/></${Field}>
      <${Field} label="תצוגות">${['table', 'kanban', 'calendar'].map((v) => html`<label class="check-row"><${Checkbox} on=${f.views.includes(v)} disabled=${f.views.length === 1 && f.views.includes(v)} label=${VIEW_HE[v]} onChange=${(x) => setF({ ...f, views: x ? [...f.views, v] : f.views.filter((y) => y !== v) })}/><span class="t-label">${VIEW_HE[v]}</span></label>`)}</${Field}>
      <${Field} label="גישה ללוח" hint="קפטנים, אדמינים ומנטורים תמיד רואים את כל הלוחות"><${SelectorField} value=${f.access} onChange=${(v) => setF({ ...f, access: v })} title="מי רואה את הלוח"/></${Field}></div>`; };
  sheet('הגדרות לוח', () => html`<${Body}/>`, {
    foot: (c) => html`<${Button} kind="danger" onClick=${async () => { if (await confirm({ title: `מחיקת ${bd.name}`, text: 'הלוח וכל הקבוצות והמשימות שבו יעברו לפח ל-30 יום.', ok: 'מחיקת לוח', danger: true }) && act(() => bus.ask('sunday.deleteBoard', { actor: me(), boardId: bd.id })) !== undefined) { c(); navigate('/sunday'); toast('הלוח הועבר לפח'); } }}>מחיקת לוח</${Button}>
      <${Button} kind="primary" cls="grow" onClick=${() => { if (act(() => bus.ask('sunday.updateBoard', { actor: me(), boardId: bd.id, patch: { name: st.name, team: st.team, views: st.views, access: st.access } })) !== undefined) { c(); toast('נשמר'); } }}>שמירה</${Button}>`,
  });
}
export function filterBuilder(existing) {
  const uid = me();
  const boards = bus.read('sunday.boards', uid);
  const statuses = [...new Set(bus.read('sunday.assignedTo', uid).map((it) => { const g = bus.read('sunday.group', it.groupId); return g.statusLabels.map((l) => l.text); }).flat().concat(['לביצוע', 'בעבודה', 'תקוע', 'בוצע']))];
  const st = existing ? { ...existing } : { name: '', statuses: [], priorities: [], due: 'all', boards: [] };
  const KEY = { 'לביצוע': 'todo', 'בעבודה': 'working', 'תקוע': 'stuck', 'בוצע': 'done' };
  const PRI = [['crit', 'קריטית'], ['high', 'גבוהה'], ['med', 'בינונית'], ['low', 'נמוכה']];
  const Body = () => { const [f, setF] = useState(st); Object.assign(st, f);
    const tog = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
    return html`<div class="col gap12"><${Field} label="שם"><input class="input" maxlength="30" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
      <${Field} label="סטטוס"><div class="row wrap gap4">${statuses.map((s) => html`<button class=${cx('chip', f.statuses.includes(KEY[s] || s) && 'on')} onClick=${() => tog('statuses', KEY[s] || s)}>${s}</button>`)}</div></${Field}>
      <${Field} label="עדיפות"><div class="row wrap gap4">${PRI.map(([k, l]) => html`<button class=${cx('chip', f.priorities.includes(k) && 'on')} onClick=${() => tog('priorities', k)}>${l}</button>`)}</div></${Field}>
      <${Field} label="תאריך"><${Seg} value=${f.due} onChange=${(v) => setF({ ...f, due: v })} options=${[{ value: 'all', label: 'הכל' }, { value: 'overdue', label: 'באיחור' }, { value: 'week', label: 'השבוע' }]}/></${Field}>
      <${Field} label="לוחות"><div class="row wrap gap4">${boards.map((bd) => html`<button class=${cx('chip', f.boards.includes(bd.id) && 'on')} onClick=${() => tog('boards', bd.id)}>${bd.name}</button>`)}</div></${Field}></div>`; };
  sheet('פילטר', () => html`<${Body}/>`, { foot: (c) => html`<${Button} kind="ghost" onClick=${c}>ביטול</${Button}><${Button} kind="primary" cls="grow" onClick=${() => { if (act(() => bus.ask('sunday.saveFilter', { actor: uid, filter: st }))) c(); }}>שמירה והפעלה</${Button}>` });
}
export function scopeDialog(title) {
  return new Promise((resolve) => {
    let scope = 'group', done = false;
    const Body = () => { const [s, setS] = useState('group'); scope = s; return html`<div class="col gap4"><${RadioRow} on=${s === 'group'} label="רק בקבוצה הזו" onClick=${() => setS('group')}/><${RadioRow} on=${s === 'all'} label="בכל הקבוצות בלוח" onClick=${() => setS('all')}/></div>`; };
    sheet(title, () => html`<${Body}/>`, { onClose: () => { if (!done) resolve(null); }, foot: (c) => html`<${Button} kind="secondary" cls="grow" onClick=${() => { done = true; c(); resolve(null); }}>ביטול</${Button}><${Button} kind="primary" cls="grow" onClick=${() => { done = true; c(); resolve(scope); }}>אישור</${Button}>` });
  });
}
const DELETE_EFFECTS = { status: 'אין כפתור "בוצע" ואין מטבעות בקבוצה הזו', assignees: 'המשימות ייעלמו מ"המשימות שלי" של כולם', date: 'אין התראות על תאריכי יעד', size: 'משימות שיאושרו לא ישלמו מטבעות', priority: 'אין מיון לפי עדיפות' };
export async function deleteColumn(g, c) {
  const ok = await confirm({ title: `מחיקת העמודה ${c.label}`, text: `${DELETE_EFFECTS[c.type] ? DELETE_EFFECTS[c.type] + '. ' : ''}הערכים בעמודה יימחקו; עמודה שתתווסף מחדש תתחיל ריקה.`, ok: 'מחיקה', danger: true });
  if (!ok) return;
  const scope = await scopeDialog('איפה למחוק?');
  if (scope) act(() => bus.ask('sunday.deleteColumn', { actor: me(), groupId: g.id, colId: c.id, scope }), 'העמודה נמחקה');
}
const TYPE_ICON = { text: 'type', checkbox: 'square-check', dropdown: 'list', date_custom: 'calendar', drive_link: 'link', status: 'circle-dot', assignees: 'users', priority: 'flag', size: 'coin', subitems: 'list-checks' };
export function addColumnMenu(g, bd, anchor) {
  const types = ['text', 'checkbox', 'dropdown', 'date_custom', 'drive_link', ...UNIQUE.filter((t) => !g.columns.some((c) => c.type === t))];
  popover(anchor, (close) => html`<div class="col gap4" style="min-width:220px">${types.map((t) => html`<button class="menu-item" onClick=${() => { close(); columnForm(g, bd, t); }}><${Icon} name=${TYPE_ICON[t]} size=${18}/>${COL_TYPES[t]}</button>`)}</div>`, { title: 'הוספת עמודה' });
}
function columnForm(g, bd, type) {
  const groups = bus.read('sunday.groups', bd.id);
  const st = { label: COL_TYPES[type], options: type === 'dropdown' ? [{ key: newId('o'), text: 'אפשרות 1', color: 'p:3' }] : [], groupIds: [g.id] };
  const Body = () => { const [f, setF] = useState(st); Object.assign(st, f);
    return html`<div class="col gap12"><${Field} label="שם"><input class="input" maxlength="40" value=${f.label} onInput=${(e) => setF({ ...f, label: e.target.value })}/></${Field}>
      ${type === 'dropdown' && html`<${Field} label="אפשרויות"><div class="col gap4">${f.options.map((o, i) => html`<div class="row gap8"><${ColorSwatchButton} value=${o.color} onPick=${(c) => setF({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, color: c } : x)) })}/>
        <input class="input grow" value=${o.text} onInput=${(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}/><${IconButton} small icon="x" label="הסרה" onClick=${() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}/></div>`)}
        <div><${Button} size="sm" kind="ghost" onClick=${() => setF({ ...f, options: [...f.options, { key: newId('o'), text: '', color: 'p:' + ((f.options.length % 16) + 1) }] })}>+ אפשרות</${Button}></div></div></${Field}>`}
      <${Field} label="להוסיף לקבוצות">${groups.map((x) => html`<label class="check-row"><${Checkbox} on=${f.groupIds.includes(x.id)} label=${x.name} onChange=${(v) => setF({ ...f, groupIds: v ? [...f.groupIds, x.id] : f.groupIds.filter((y) => y !== x.id) })}/><span class="t-label">${x.name}</span></label>`)}</${Field}></div>`; };
  sheet(`עמודה חדשה: ${COL_TYPES[type]}`, () => html`<${Body}/>`, { foot: (c) => html`<${Button} kind="primary" full onClick=${() => { if (act(() => bus.ask('sunday.addColumn', { actor: me(), groupId: g.id, type, label: st.label, options: st.options.filter((o) => o.text.trim()), groupIds: st.groupIds }))) { c(); toast('העמודה נוספה'); } }}>הוספה</${Button}>` });
}
/** Label editor (C10): rows with handle, swatch, name, ✕; "+ תווית"; scope; "סיום". */
export function openLabelEditor(g, kind) {
  const lead = isLead(g.boardId);
  const key = kind === 'priority' ? 'priorityLabels' : 'statusLabels';
  let labels = JSON.parse(JSON.stringify(g[key]));
  let scope = 'group';
  const counts = {};
  bus.read('sunday.items', g.id).forEach((it) => { const k = kind === 'priority' ? it.priority : it.status; counts[k] = (counts[k] || 0) + 1; });
  const Body = () => {
    const [l, setL] = useState(labels); labels = l;
    const [s, setS] = useState('group'); scope = s;
    const locked = (x) => kind === 'priority' ? !lead : x.isDefault && !lead;
    const del = async (i) => {
      const x = l[i]; if (l.length <= 1) return toast('אי אפשר למחוק את התווית האחרונה');
      if (x.key === 'done') return toast('אי אפשר למחוק את "בוצע"');
      if (counts[x.key] && !(await confirm({ title: 'מחיקת תווית', text: `${counts[x.key]} משימות יעברו ל-${l.filter((_, j) => j !== i)[0].text}. למחוק?`, ok: 'מחיקה', danger: true }))) return;
      setL(l.filter((_, j) => j !== i));
    };
    return html`<div class="col gap8"><div class="col gap4" data-drop-list="labels:1">${l.map((x, i) => html`<div class="row gap8" data-drag-item key=${x.key}>
      ${!(kind === 'priority' && !lead) && html`<span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'labels', listId: '1', onDrop: ({ fromIndex, toIndex }) => setL(moveIn(l, fromIndex, toIndex)) })}><${Icon} name="grip-vertical" size=${18}/></span>`}
      <button class="swatch tinted" style=${tintVars(x.color) + ';width:32px;height:32px;background:var(--tfl)'} disabled=${locked(x)} aria-label="צבע" onClick=${(e) => pickColor(e.currentTarget, { current: x.color, onPick: (c) => setL(l.map((y, j) => (j === i ? { ...y, color: c } : y))) })}/>
      <input class="input grow" style="min-height:40px" value=${x.text} disabled=${locked(x)} onInput=${(e) => setL(l.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}/>
      <${IconButton} small icon="x" label="מחיקה" disabled=${locked(x) || x.key === 'done'} onClick=${() => del(i)}/></div>`)}</div>
      ${!(kind === 'priority' && !lead) && html`<div><${Button} size="sm" kind="ghost" onClick=${() => setL([...l, { key: newId('l'), text: 'תווית חדשה', color: 'p:' + ((l.length % 16) + 1), isDefault: false }])}>+ תווית</${Button}></div>`}
      <div class="divider"/><${RadioRow} on=${s === 'group'} label="רק בקבוצה הזו" onClick=${() => setS('group')}/><${RadioRow} on=${s === 'all'} label="בכל הקבוצות" onClick=${() => setS('all')}/></div>`;
  };
  sheet(kind === 'priority' ? 'עריכת עדיפויות' : 'עריכת תוויות', () => html`<${Body}/>`, { foot: (c) => html`<${Button} kind="primary" full onClick=${() => { if (act(() => bus.ask('sunday.saveLabels', { actor: me(), groupId: g.id, kind, labels, scope })) !== undefined) c(); }}>סיום</${Button}>` });
}

const css = document.createElement('style');
css.textContent = `.kanban{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;align-items:flex-start}
.k-col{width:280px;flex:none;background:var(--bg-subtle);border-radius:var(--r-md);padding:8px}
.k-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;display:flex;flex-direction:column;gap:8px;cursor:pointer}
.cal-month{border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:var(--bg-surface)}
.cal-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.cal-dows{background:var(--bg-subtle);padding:6px 0}
.cal-week{position:relative;border-top:1px solid var(--border);min-height:96px}
.cal-cell{min-height:96px;padding:4px 6px;border-inline-start:1px solid var(--border)}
.cal-cell:first-child{border-inline-start:0}
.cal-cell.other{background:var(--bg-subtle);color:var(--text-muted)}
.cal-cell.today span{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--brand)}
.cal-bars{position:absolute;inset:28px 0 4px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:22px;gap:2px 0;pointer-events:none;grid-auto-flow:dense}
.cal-bar{pointer-events:auto;border:0;border-radius:6px;margin:0 3px;padding:0 6px;font-size:12px;font-weight:500;text-align:start;cursor:pointer;min-width:0;display:flex;align-items:center}
.dash-grid{display:grid;gap:16px}
@media (min-width:900px){.dash-grid{grid-template-columns:1fr 1fr}}`;
document.head.appendChild(css);
