// Sunday cells: one component per column type, used by the desktop table, phone cards, My Tasks and the full sheet.
// Pickers on single click/tap; text on double-click (desktop) — except the item name, renamed with a single click (C7).
import { html, useState, useRef, useEffect } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Icon, Pill, Checkbox, cx } from '../../core/ui.js';
import { AvatarStack, Avatar } from '../../core/people.js';
import { act, toast, popover, promptText, isPhone } from '../../core/overlay.js';
import { pickPill, pickDate, pickPeople, pickSize, SIZE_LABELS, SIZE_COINS } from '../../core/pickers.js';
import { fmtShort, todayKey } from '../../core/format.js';
import { tintVars } from '../../core/color.js';
import { openLabelEditor } from './views.js';

export const me = () => bus.read('users.currentId');
export const lbl = (list, key) => (list || []).find((l) => l.key === key);
const ask = (name, p, undoText, undo) => { const r = act(() => bus.ask('sunday.' + name, { actor: me(), ...p })); if (r !== undefined && undoText) toast(undoText, { undo }); return r; };
export const canEdit = (it) => bus.read('sunday.canEditItem', me(), it.id);
export const isLead = (bdId) => bus.read('sunday.isLeadPlus', me(), bdId);

/* ---------- Done button (C7.1) ---------- */
export function DoneButton({ it, g, size = 20 }) {
  const kids = !it.parentId && bus.read('sunday.subitems', it.id).length > 0;
  if (!g.columns.some((c) => c.type === 'status') || kids) return html`<span style=${`width:${size}px`}/>`;
  const done = it.status === 'done';
  const ed = canEdit(it);
  const prev = it.status;
  return html`<button type="button" class=${cx('done-btn', done && 'on')} style=${`width:${size}px;height:${size}px`} disabled=${!ed} aria-pressed=${done ? 'true' : 'false'}
    aria-label=${done ? 'בוצע — ביטול' : 'סימון כבוצע'} title=${ed ? undefined : 'אין לך הרשאה לפעולה הזו'}
    onClick=${(e) => { e.stopPropagation(); ask('toggleDone', { itemId: it.id }, done ? 'הוחזר' : 'סומן כבוצע', () => bus.ask('sunday.setStatus', { actor: me(), itemId: it.id, key: prev })); }}>
    ${done && html`<${Icon} name="check" size=${size - 6} stroke=${3}/>`}</button>`;
}
/* ---------- Status ---------- */
export function StatusCell({ it, g, bd, full }) {
  const l = lbl(g.statusLabels, it.status) || g.statusLabels[0];
  const kids = !it.parentId && bus.read('sunday.subitems', it.id).length > 0;
  const ed = canEdit(it) && !kids;
  const coinWait = !it.parentId && it.status === 'done' && it.coin && it.coin.state === 'awaiting';
  const open = (e) => {
    e.stopPropagation(); if (!ed) return;
    const prev = it.status;
    pickPill(e.currentTarget, { title: 'סטטוס', options: g.statusLabels, current: it.status,
      onPick: (k) => ask('setStatus', { itemId: it.id, key: k }, `הסטטוס שונה ל"${lbl(g.statusLabels, k).text}"`, () => bus.ask('sunday.setStatus', { actor: me(), itemId: it.id, key: prev })),
      footer: { label: 'עריכת תוויות', onClick: () => openLabelEditor(g, 'status') } });
  };
  return html`<button type="button" class=${cx('cell-btn', full && 'fill')} disabled=${!ed} onClick=${open} title=${kids ? 'נקבע לפי תתי-המשימות' : undefined}>
    <${Pill} text=${l ? l.text : ''} color=${l && l.color} cls=${full ? 'fill-pill' : ''}/></button>`;
}
/* ---------- Priority ---------- */
export function PriorityCell({ it, g, full }) {
  const l = lbl(g.priorityLabels, it.priority);
  const ed = canEdit(it);
  const lead = isLead(g.boardId);
  const open = (e) => { e.stopPropagation(); if (!ed) return; pickPill(e.currentTarget, { title: 'עדיפות', options: g.priorityLabels, current: it.priority,
    onPick: (k) => ask('setPriority', { itemId: it.id, key: k }), footer: lead && { label: 'עריכת תוויות', onClick: () => openLabelEditor(g, 'priority') } }); };
  return html`<button type="button" class=${cx('cell-btn', full && 'fill')} disabled=${!ed} onClick=${open}>
    ${l ? html`<${Pill} text=${l.text} color=${l.color} icon=${l.key === 'crit' ? 'flame' : null} cls=${full ? 'fill-pill' : ''}/>` : ed ? html`<span class="muted t-foot ph">+ עדיפות</span>` : html`<span class="muted">—</span>`}</button>`;
}
/* ---------- Date (+ range) ---------- */
export function DateCell({ it, chip }) {
  const ed = canEdit(it);
  const overdue = it.dateEnd && it.dateEnd < todayKey() && it.status !== 'done';
  const text = it.dateEnd ? (it.dateStart && it.dateStart !== it.dateEnd ? `${fmtShort(it.dateStart)}–${fmtShort(it.dateEnd)}` : fmtShort(it.dateEnd)) : null;
  const open = (e) => { e.stopPropagation(); if (!ed) return; const prev = { start: it.dateStart, end: it.dateEnd };
    pickDate(e.currentTarget, { start: it.dateStart || it.dateEnd, end: it.dateEnd, allowRange: true, clearable: true,
      onPick: (v) => ask('setDate', { itemId: it.id, start: v.start, end: v.end }, 'התאריך עודכן', () => bus.ask('sunday.setDate', { actor: me(), itemId: it.id, ...prev })),
      onClear: () => ask('setDate', { itemId: it.id, start: null, end: null }, 'התאריך נוקה', () => bus.ask('sunday.setDate', { actor: me(), itemId: it.id, ...prev })) }); };
  return html`<button type="button" class=${cx('cell-btn', chip && 'chip-cell')} disabled=${!ed} onClick=${open}>
    ${text ? html`<span class=${cx('t-foot num row gap4', overdue && 'dangert')} style="font-size:14px">${overdue && html`<${Icon} name="circle-alert" size=${14} label="באיחור"/>`}${text}</span>`
      : ed ? html`<span class="muted t-foot ph">+ תאריך</span>` : html`<span class="muted">—</span>`}</button>`;
}
/* ---------- Assignees (C7.2) ---------- */
export function AssigneesCell({ it, bd, size = 28, chip }) {
  const uid = me();
  const ed = canEdit(it);
  const lead = isLead(bd.id);
  const ids = (it.assignments || []).map((x) => x.uid);
  const prev = ids.slice();
  const set = (n) => ask('setAssignees', { itemId: it.id, uids: n }, 'האחראים עודכנו', () => bus.ask('sunday.setAssignees', { actor: me(), itemId: it.id, uids: prev }));
  const open = (e) => {
    e.stopPropagation(); if (!ed) return;
    if (lead) pickPeople(e.currentTarget, { title: 'אחראים', selected: ids, relevantTeam: bd.team, onChange: (n) => act(() => bus.ask('sunday.setAssignees', { actor: uid, itemId: it.id, uids: n })),
      candidates: (u) => bus.read('sunday.canSeeBoard', u.id, bd.id) && !bus.read('sunday.inactive', u.id) });
    else {
      const mine = (it.assignments || []).find((x) => x.uid === uid);
      popover(e.currentTarget, (close) => html`<div class="col gap4" style="min-width:220px">
        ${ids.map((u) => html`<div class="row gap8" style="padding:6px 8px"><${Avatar} uid=${u} size=${28} inactive=${bus.read('sunday.inactive', u)}/><span class="t-foot">${(bus.read('users.get', u) || { name_he: 'משתמש שנמחק' }).name_he}</span></div>`)}
        ${ids.length > 0 && html`<div class="menu-sep"/>`}
        ${!mine ? html`<button class="menu-item" onClick=${() => { close(); set([...ids, uid]); }}><${Icon} name="user-plus" size=${18}/>שייך אותי</button>`
          : mine.by === uid ? html`<button class="menu-item" onClick=${() => { close(); set(ids.filter((x) => x !== uid)); }}><${Icon} name="user-minus" size=${18}/>הסר אותי</button>` : null}
      </div>`, { title: 'אחראים' });
    }
  };
  return html`<button type="button" class=${cx('cell-btn', chip && 'chip-cell')} disabled=${!ed} onClick=${open} aria-label="אחראים">
    ${ids.length ? html`<${AvatarStack} uids=${ids} size=${size} inactive=${(u) => bus.read('sunday.inactive', u)}/>` : ed ? html`<span class="muted t-foot ph">+ אחראי</span>` : html`<span class="muted">—</span>`}</button>`;
}
/* ---------- Size + coin approval chip (C15) ---------- */
export function SizeCell({ it, bd, chip }) {
  const lead = isLead(bd.id);
  const amounts = bus.read('coins.taskAmounts');
  if (it.coin && it.coin.state === 'awaiting') return html`<span class="coin-chip sm" title="ממתין לאישור"><${Icon} name="hourglass" size=${14}/>ממתין לאישור</span>`;
  const open = (e) => { e.stopPropagation(); if (!lead) return; pickSize(e.currentTarget, { current: it.size, amounts, onPick: (s) => ask('setSize', { itemId: it.id, size: s }) }); };
  let inner;
  if (!it.size) inner = lead ? html`<span class="coin-chip sm" style="background:var(--bg-subtle);color:var(--text-secondary)">?</span>` : html`<span class="muted">—</span>`;
  else if (it.size === 'none') inner = html`<span class="t-foot sec">ללא</span>`;
  else inner = html`<span class="coin-chip sm" title=${`${SIZE_LABELS[it.size]} · ${amounts[it.size]}`}>${Array.from({ length: SIZE_COINS[it.size] }, () => html`<${Icon} name="coin" size=${12}/>`)}</span>`;
  return html`<button type="button" class=${cx('cell-btn', chip && 'chip-cell')} disabled=${!lead} onClick=${open} aria-label=${'גודל: ' + (SIZE_LABELS[it.size] || 'לא נקבע')} data-size-cell=${it.id}>${inner}</button>`;
}
/* ---------- Subitems count ---------- */
export function SubitemsCell({ it, onToggle, expanded, chip }) {
  const kids = bus.read('sunday.subitems', it.id);
  const ed = canEdit(it);
  if (!kids.length) return ed ? html`<button type="button" class=${cx('cell-btn', chip && 'chip-cell')} onClick=${(e) => { e.stopPropagation(); onToggle('add'); }} aria-label="הוספת תת-משימה">
    ${chip ? html`<span class="muted t-foot">+ תת-משימה</span>` : html`<${Icon} name="plus" size=${16} cls="muted"/>`}</button>` : html`<span class="muted">—</span>`;
  const done = kids.filter((k) => k.status === 'done').length;
  return html`<button type="button" class=${cx('cell-btn', chip && 'chip-cell')} onClick=${(e) => { e.stopPropagation(); onToggle(); }} aria-expanded=${expanded ? 'true' : 'false'}>
    <span class="row gap4 t-foot num" style="font-size:14px">${chip && html`<${Icon} name="list-checks" size=${14}/>`}${done}/${kids.length}<${Icon} name=${expanded ? 'chevron-up' : 'chevron-down'} size=${14}/></span></button>`;
}
/* ---------- custom columns ---------- */
export function CustomCell({ it, col }) {
  const ed = canEdit(it);
  const v = (it.values || {})[col.id];
  const set = (val) => ask('setValue', { itemId: it.id, colId: col.id, value: val });
  if (col.type === 'checkbox') return html`<span class="cell-btn"><${Checkbox} on=${!!v} disabled=${!ed} label=${col.label} onChange=${(x) => set(x)}/></span>`;
  if (col.type === 'dropdown') {
    const o = (col.options || []).find((x) => x.key === v);
    return html`<button type="button" class="cell-btn fill" disabled=${!ed} onClick=${(e) => { e.stopPropagation(); ed && pickPill(e.currentTarget, { title: col.label, options: col.options || [], current: v, onPick: set }); }}>
      ${o ? html`<${Pill} text=${o.text} color=${o.color} cls="fill-pill"/>` : ed ? html`<span class="muted t-foot ph">+</span>` : null}</button>`;
  }
  if (col.type === 'date_custom') return html`<button type="button" class="cell-btn" disabled=${!ed} onClick=${(e) => { e.stopPropagation(); ed && pickDate(e.currentTarget, { end: v, clearable: true, onPick: (x) => set(x.end), onClear: () => set(null) }); }}>
    ${v ? html`<span class="t-foot num" style="font-size:14px">${fmtShort(v)}</span>` : ed ? html`<span class="muted t-foot ph">+ תאריך</span>` : null}</button>`;
  if (col.type === 'drive_link') return html`<span class="cell-btn link-cell">${v && v.url ? html`<a href=${v.url} target="_blank" rel="noopener" class="t-foot ell" style="font-size:14px" onClick=${(e) => e.stopPropagation()}><${Icon} name="file" size=${14}/> ${v.name || 'קישור'}</a>` : null}
    ${ed && html`<button type="button" class="icon-btn sm hover-only" aria-label="עריכת קישור" onClick=${async (e) => { e.stopPropagation(); const u = await promptText({ title: col.label, label: 'קישור (http/https)', value: (v && v.url) || '', multiline: false, max: 500, min: 0 }); if (u !== null) set(u ? { url: u, name: (v && v.name) || 'קישור' } : null); }}><${Icon} name="pencil" size=${14}/></button>`}</span>`;
  return html`<${InlineText} value=${v || ''} disabled=${!ed} dbl=${true} onSave=${set} placeholder=${ed ? '+' : ''} cls="t-foot"/>`;
}
/** Text that turns into an input in place (Design 10.1). dbl: double-click on desktop. */
export function InlineText({ value, onSave, disabled, dbl = true, placeholder = '', cls = '', startEditing, onCancel, multiline }) {
  const [ed, setEd] = useState(!!startEditing);
  const [v, setV] = useState(value);
  const ref = useRef();
  useEffect(() => { if (ed && ref.current) { ref.current.focus(); ref.current.select(); } }, [ed]);
  useEffect(() => { if (!ed) setV(value); }, [value]);
  const commit = () => { setEd(false); if (v.trim() !== (value || '').trim() && v.trim()) onSave(v.trim()); else if (!v.trim()) { setV(value); onCancel && onCancel(); } };
  if (ed) return html`<input ref=${ref} class=${'inline-input ' + cls} value=${v} onInput=${(e) => setV(e.target.value)} onClick=${(e) => e.stopPropagation()}
    onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); setV(value); setEd(false); onCancel && onCancel(); } }} onBlur=${commit}/>`;
  const start = (e) => { if (disabled) return; e.stopPropagation(); setEd(true); };
  const trigger = isPhone() ? { onClick: start } : dbl ? { onDblClick: start } : { onClick: start };
  return html`<span class=${cx('inline-text', cls, !disabled && 'editable')} ...${trigger} title=${value}>${value || html`<span class="muted ph">${placeholder}</span>`}</span>`;
}
/* ---------- updates bubble (C8) ---------- */
export function Bubble({ it, onOpen }) {
  const n = bus.read('sunday.comments', it.id).length;
  const unseen = bus.read('sunday.unseen', me(), it.id);
  return html`<button type="button" class=${cx('bubble', !n && 'empty')} aria-label=${`עדכונים${n ? ` (${n})` : ''}`} onClick=${(e) => { e.stopPropagation(); onOpen(); }}>
    <${Icon} name="message-circle" size=${18}/>${n > 0 && html`<span class="t-cap num">${n}</span>`}${unseen && html`<span class="bubble-dot"/>`}</button>`;
}
