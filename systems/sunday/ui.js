// Sunday screens: board bar, My Tasks (C14), board table (C5) / phone cards (C6), groups (C12), subitems (C11).
import { html, useState, useEffect, useRef, useLayoutEffect } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addRoute, addWidget, addTabBadge, addManagement } from '../../core/registry.js';
import { Icon, Button, Seg, SearchInput, EmptyState, IconButton, Pill, Chips, CountBadge, ReadOnlyNote, Logo, cx } from '../../core/ui.js';
import { act, toast, confirm, actionSheet, popover, promptText, isPhone, sheet } from '../../core/overlay.js';
import { pickColor, MenuSelect } from '../../core/pickers.js';
import { navigate, route } from '../../core/router.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { groupNameVars, presetHex } from '../../core/color.js';
import { fmtShort, todayKey, addDaysKey } from '../../core/format.js';
import { me, lbl, canEdit, isLead, DoneButton, StatusCell, PriorityCell, DateCell, AssigneesCell, SizeCell, SubitemsCell, CustomCell, InlineText, Bubble } from './cells.js';
import { openPanel, openFullSheet } from './panel.js';
import { Kanban, CalendarView, Approvals, Trash, Dashboard, SundaySettings, boardSettings, newBoardDialog, filterBuilder, addColumnMenu, scopeDialog, deleteColumn } from './views.js';

const A = () => bus.read('users.actor', me());
export const WIDTH = { status: [96, 140], assignees: [88, 120], date: [96, 120], priority: [88, 120], size: [80, 90], subitems: [80, 90] };
const colW = (c) => WIDTH[c.type] || [92, 140];
const priorityRank = (g, it) => { const i = g.priorityLabels.findIndex((l) => l.key === it.priority); return i < 0 ? 999 : i; };

/* ---------- board bar (C4) ---------- */
function BoardBar({ active }) {
  const uid = me();
  const a = A();
  const list = bus.read('sunday.boards', uid);
  const lead = !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor);
  const queue = bus.read('sunday.queue', uid).filter((it) => it.coin.state === 'awaiting' && bus.read('sunday.canApprove', uid, it.id)).length;
  const tab = (key, label, path, extra) => html`<a class=${cx('text-tab', active === key && 'on')} href=${'#' + path} ...${extra || {}}>${label}</a>`;
  return html`<nav class="text-tabs" aria-label="לוחות" data-drop-list="boardbar:1" style="margin-bottom:16px">
    ${tab('mine', 'המשימות שלי', '/sunday')}
    ${list.map((bd) => html`<div data-drag-item key=${bd.id} style="display:flex" onPointerDown=${(e) => startDrag(e, { group: 'boardbar', listId: '1', axis: 'x', longPress: e.pointerType === 'touch', onDrop: ({ fromIndex, toIndex }) => act(() => bus.ask('sunday.reorderBoards', { actor: uid, ids: moveIn(list.map((x) => x.id), fromIndex - 0, toIndex) })) })}>
      ${tab(bd.id, bd.name, '/sunday/board/' + bd.id, { onClick: (e) => e.currentTarget.blur() })}</div>`)}
    ${lead && html`<button class="text-tab" onClick=${() => newBoardDialog()}>+ לוח</button>${tab('trash', 'פח', '/sunday/trash')}${tab('approvals', html`אישורי מטבעות (${queue})`, '/sunday/approvals')}`}
    ${(a.isAdmin || a.isMentor) && tab('dashboard', 'דשבורד', '/sunday/dashboard')}
  </nav>`;
}

/* ---------- desktop table pieces ---------- */
function useWidth(ref) {
  const [w, setW] = useState(1200);
  useLayoutEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(ref.current); setW(ref.current.clientWidth); return () => ro.disconnect(); }, []);
  return w;
}
const template = (cols) => `6px 20px 32px minmax(260px,1fr) ${cols.map((c) => { const [mn, mx] = colW(c); return `minmax(${mn}px,${mx}px)`; }).join(' ')} 40px`;
export const minWidth = (cols) => 6 + 20 + 32 + 260 + cols.reduce((s, c) => s + colW(c)[0], 0) + 40;
function cellFor(c, it, g, bd, ctx) {
  switch (c.type) {
    case 'status': return html`<${StatusCell} it=${it} g=${g} bd=${bd} full/>`;
    case 'assignees': return html`<${AssigneesCell} it=${it} bd=${bd}/>`;
    case 'date': return html`<${DateCell} it=${it}/>`;
    case 'priority': return html`<${PriorityCell} it=${it} g=${g} full/>`;
    case 'size': return it.parentId ? html`<span/>` : html`<${SizeCell} it=${it} bd=${bd}/>`;
    case 'subitems': return it.parentId ? html`<span/>` : html`<${SubitemsCell} it=${it} expanded=${ctx.expanded} onToggle=${ctx.toggle}/>`;
    default: return html`<${CustomCell} it=${it} col=${c}/>`;
  }
}
function itemMenu(it, g, bd, anchor, ctx = {}) {
  const uid = me();
  const ed = canEdit(it);
  const groups = bus.read('sunday.groups', bd.id);
  actionSheet(it.name, [
    { icon: 'pencil', label: 'שינוי שם', hidden: !bus.read('sunday.canRename', uid, it.id), onClick: async () => { const n = await promptText({ title: 'שינוי שם', value: it.name, multiline: false, max: 200 }); if (n) act(() => bus.ask('sunday.rename', { actor: uid, itemId: it.id, name: n })); } },
    { icon: 'panel-left-open', label: 'פתיחת כל הפרטים', onClick: () => openFullSheet(it.id) },
    { icon: 'message-circle', label: 'תיאור ועדכונים', onClick: () => openPanel(it.id) },
    { icon: 'list-plus', label: 'הוספת תת-משימה', hidden: !ed || !!it.parentId || !g.columns.some((c) => c.type === 'subitems'), onClick: () => ctx.addSub && ctx.addSub() },
    { icon: 'folder-input', label: 'העברה לקבוצה', hidden: !ed || !!it.parentId || groups.length < 2, onClick: () => actionSheet('העברה לקבוצה', groups.filter((x) => x.id !== g.id).map((x) => ({ label: x.name, onClick: () => { const from = g.id, idx = it.order; if (act(() => bus.ask('sunday.moveItem', { actor: uid, itemId: it.id, toGroupId: x.id, toIndex: 0 })) !== undefined) toast(`הועבר ל${x.name}`, { undo: () => bus.ask('sunday.moveItem', { actor: uid, itemId: it.id, toGroupId: from, toIndex: idx }) }); } })), anchor) },
    { icon: 'copy', label: 'שיכפול', hidden: !ed || !!it.parentId, onClick: () => act(() => bus.ask('sunday.duplicateItem', { actor: uid, itemId: it.id }), 'שוכפל') },
    { icon: 'trash-2', label: 'מחיקה', danger: true, hidden: !bus.read('sunday.canDeleteItem', uid, it.id), onClick: () => { if (act(() => bus.ask('sunday.deleteItem', { actor: uid, itemId: it.id })) !== undefined) toast('נמחק', { undo: () => bus.ask('sunday.restore', { actor: uid, kind: it.parentId ? 'subitem' : 'item', targetId: it.id }) }); } },
  ], isPhone() ? null : anchor);
}
function NameCell({ it, g, bd, onOpenPanel, autoEdit }) {
  const uid = me();
  const canRename = bus.read('sunday.canRename', uid, it.id);
  const flag = !it.parentId && (it.priority === 'high' || it.priority === 'crit');
  return html`<div class="name-cell">
    <${InlineText} value=${it.name} disabled=${!canRename} dbl=${false} cls="t-name clamp2" startEditing=${autoEdit} onSave=${(v) => act(() => bus.ask('sunday.rename', { actor: uid, itemId: it.id, name: v }))}/>
    <${Bubble} it=${it} onOpen=${onOpenPanel}/></div>`;
}
function ItemRow({ it, g, bd, cols, prefs, hl, sub, autoEdit }) {
  const uid = me();
  const expanded = prefs.expanded.includes(it.id);
  const [adding, setAdding] = useState(false);
  const toggle = (mode) => {
    const next = expanded && mode !== 'add' ? prefs.expanded.filter((x) => x !== it.id) : [...new Set([...prefs.expanded, it.id])];
    bus.ask('sunday.setPrefs', { actor: uid, boardId: bd.id, patch: { expanded: next } });
    if (mode === 'add') setAdding(true);
  };
  const ref = useRef();
  useEffect(() => { if (hl && ref.current) { ref.current.scrollIntoView({ block: 'center' }); } }, [hl]);
  const kids = !sub ? bus.read('sunday.subitems', it.id) : [];
  const row = html`<div ref=${ref} class=${cx('t-row', sub && 'sub', hl && 'hl')} style=${`grid-template-columns:${template(cols)}`} data-drag-item=${!sub ? '' : undefined} data-item=${it.id}>
    <span class="gbar" style=${`background:${presetHex(g.color)}`}/>
    <span class="handle-cell">${!sub && canEdit(it) && html`<span class="drag-handle hover-only" onPointerDown=${(e) => startDrag(e, { group: 'items-' + bd.id, listId: g.id, item: ref.current, onDrop: ({ toList, toIndex }) => act(() => bus.ask('sunday.moveItem', { actor: uid, itemId: it.id, toGroupId: toList, toIndex })) })} aria-label="גרירה"><${Icon} name="grip-vertical" size=${16}/></span>`}</span>
    <span class="done-cell"><${DoneButton} it=${it} g=${g}/></span>
    <span class="c-name" style=${sub ? 'padding-inline-start:24px' : ''}><${NameCell} it=${it} g=${g} bd=${bd} onOpenPanel=${() => openPanel(it.id)} autoEdit=${autoEdit}/></span>
    ${cols.map((c) => html`<span class="c-cell" key=${c.id}>${cellFor(c, it, g, bd, { expanded, toggle })}</span>`)}
    <span class="c-cell"><button class="icon-btn sm hover-only" aria-label="פעולות" onClick=${(e) => itemMenu(it, g, bd, e.currentTarget, { addSub: () => toggle('add') })}><${Icon} name="ellipsis" size=${18}/></button></span>
  </div>`;
  if (sub) return row;
  const showKids = expanded && g.columns.some((c) => c.type === 'subitems');
  const subCols = cols;
  return html`<div class="item-wrap" data-drag-item key=${it.id}>${row}
    ${showKids && html`${kids.map((k) => html`<${ItemRow} key=${k.id} it=${k} g=${g} bd=${bd} cols=${subCols} prefs=${prefs} sub/>`)}
      ${canEdit(it) && html`<${NewRow} g=${g} parentId=${it.id} cols=${cols} sub autoOpen=${adding} onDone=${() => setAdding(false)}/>`}`}</div>`;
}
function NewRow({ g, parentId, cols, sub, autoOpen, onDone }) {
  const uid = me();
  const [open, setOpen] = useState(!!autoOpen);
  const [v, setV] = useState('');
  const ref = useRef();
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  const create = () => {
    if (!v.trim()) { setOpen(false); onDone && onDone(); return; }
    act(() => bus.ask('sunday.createItem', { actor: uid, groupId: g.id, name: v, parentId }));
    setV('');
  };
  return html`<div class=${cx('t-row new-row', sub && 'sub')} style=${`grid-template-columns:${template(cols)}`}>
    <span class="gbar" style=${`background:${presetHex(g.color)};opacity:.4`}/><span/><span/>
    <span class="c-name" style=${sub ? 'padding-inline-start:24px' : ''}>${open ? html`<input ref=${ref} class="inline-input t-name" value=${v} placeholder=${sub ? 'שם תת-המשימה' : 'שם המשימה'}
      onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setV(''); setOpen(false); onDone && onDone(); } }} onBlur=${() => { if (v.trim()) create(); setOpen(false); onDone && onDone(); }}/>`
      : html`<button class="btn btn-link btn-sm" style="min-height:36px" onClick=${() => setOpen(true)}>${sub ? '+ תת-משימה' : '+ משימה חדשה'}</button>`}</span></div>`;
}
function ColumnHeader({ g, bd, cols }) {
  const uid = me();
  const lead = isLead(bd.id);
  const menu = (c, el) => actionSheet(c.label, [
    { icon: 'pencil', label: 'שינוי שם', onClick: () => renameColumn(g, c) },
    { icon: 'copy', label: 'החלה על כל הקבוצות', onClick: () => act(() => bus.ask('sunday.copyColumnToAll', { actor: uid, groupId: g.id, colId: c.id }), 'הוחל על כל הקבוצות') },
    { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: () => deleteColumn(g, c) },
  ], el);
  return html`<div class="t-head" style=${`grid-template-columns:${template(cols)}`} data-drop-list=${`cols-${g.id}:${g.id}`}>
    <span/><span/><span/><span class="h-name">${(g.columns.find((c) => c.type === 'name') || {}).label || 'משימה'}</span>
    ${cols.map((c) => html`<span class="h-cell" data-drag-item key=${c.id} title=${c.label}
        onDblClick=${() => lead && renameColumn(g, c)}
        onPointerDown=${lead ? (e) => { if (e.target.closest('button')) return; startDrag(e, { group: 'cols-' + g.id, listId: g.id, axis: 'x', onDrop: async ({ toIndex }) => { const scope = await scopeDialog('הזזת עמודה'); if (scope) act(() => bus.ask('sunday.moveColumn', { actor: uid, groupId: g.id, colId: c.id, toIndex: toIndex + 1, scope })); } }); } : undefined}>
      <span class="ell">${c.label}</span>${lead && html`<button class="icon-btn sm hover-only h-menu" aria-label=${'אפשרויות ' + c.label} onClick=${(e) => menu(c, e.currentTarget)}><${Icon} name="ellipsis" size=${16}/></button>`}</span>`)}
    <span class="h-cell">${!A().readOnly && html`<button class="icon-btn sm" aria-label="הוספת עמודה" onClick=${(e) => addColumnMenu(g, bd, e.currentTarget)}><${Icon} name="plus" size=${18}/></button>`}</span>
  </div>`;
}
async function renameColumn(g, c) {
  const v = await promptText({ title: 'שינוי שם עמודה', value: c.label, multiline: false, max: 40 });
  if (!v) return;
  const scope = await scopeDialog('שינוי שם');
  if (scope) act(() => bus.ask('sunday.renameColumn', { actor: me(), groupId: g.id, colId: c.id, label: v, scope }));
}

/* ---------- phone card (C6.2) ---------- */
function ItemCard({ it, g, bd, prefs, where, hl }) {
  const uid = me();
  const expanded = prefs && prefs.expanded.includes(it.id);
  const [adding, setAdding] = useState(false);
  const has = (t) => g.columns.some((c) => c.type === t);
  const kids = !it.parentId ? bus.read('sunday.subitems', it.id) : [];
  const toggle = (mode) => { if (!prefs) return; const next = expanded && mode !== 'add' ? prefs.expanded.filter((x) => x !== it.id) : [...new Set([...prefs.expanded, it.id])]; bus.ask('sunday.setPrefs', { actor: uid, boardId: bd.id, patch: { expanded: next } }); if (mode === 'add') setAdding(true); };
  const flag = it.priority === 'high' || it.priority === 'crit' ? lbl(g.priorityLabels, it.priority) : null;
  const ref = useRef();
  useEffect(() => { if (hl && ref.current) ref.current.scrollIntoView({ block: 'center' }); }, [hl]);
  return html`<div class="card-wrap" data-drag-item>
    <div ref=${ref} class=${cx('i-card', hl && 'hl')} onClick=${(e) => itemMenu(it, g, bd, e.currentTarget, { addSub: () => toggle('add') })}
      onPointerDown=${!it.parentId && canEdit(it) && !where ? (e) => { if (e.target.closest('button,a,input')) return; startDrag(e, { group: 'items-' + bd.id, listId: g.id, longPress: true, item: e.currentTarget.parentElement, onDrop: ({ toList, toIndex }) => act(() => bus.ask('sunday.moveItem', { actor: uid, itemId: it.id, toGroupId: toList, toIndex })) }); } : undefined}>
      <span class="i-bar" style=${`background:${presetHex(g.color)}`}/>
      <span class="i-done"><${DoneButton} it=${it} g=${g} size=${24}/></span>
      <div class="col grow" style="gap:6px;min-width:0;padding:10px 8px 10px 0">
        ${where && html`<span class="t-foot sec ell">${where}</span>`}
        <div class="row gap4" style="align-items:flex-start">${flag && html`<span class="tinted" style=${`background:none;display:inline-flex;margin-top:3px;${''}`} title=${flag.text}><${Icon} name="flag" size=${16} color=${flag.key === 'crit' ? 'var(--danger)' : '#7B4DFF'}/></span>`}
          <span class="t-name clamp2 grow">${it.name}</span><${Bubble} it=${it} onOpen=${() => openPanel(it.id)}/></div>
        <div class="row wrap gap4" style="min-height:32px">
          ${has('status') && html`<${StatusCell} it=${it} g=${g} bd=${bd}/>`}
          ${has('date') && html`<${DateCell} it=${it} chip/>`}
          ${has('assignees') && html`<${AssigneesCell} it=${it} bd=${bd} size=${24} chip/>`}
          ${has('size') && !it.parentId && html`<${SizeCell} it=${it} bd=${bd} chip/>`}
          ${has('subitems') && !it.parentId && prefs && html`<${SubitemsCell} it=${it} chip expanded=${expanded} onToggle=${toggle}/>`}
        </div></div></div>
    ${expanded && kids.length + (adding ? 1 : 0) > 0 && html`<div class="col gap8" style="padding-inline-start:24px;margin-top:8px">${kids.map((k) => html`<${ItemCard} key=${k.id} it=${k} g=${g} bd=${bd} prefs=${prefs}/>`)}</div>`}
    ${expanded && canEdit(it) && html`<div style="padding-inline-start:24px"><${PhoneAdd} g=${g} parentId=${it.id} auto=${adding} onDone=${() => setAdding(false)}/></div>`}
  </div>`;
}
function PhoneAdd({ g, parentId, auto, onDone }) {
  const [v, setV] = useState('');
  const [open, setOpen] = useState(!!auto);
  const ref = useRef();
  useEffect(() => { if (auto) setOpen(true); }, [auto]);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  if (!open) return html`<button class="btn btn-link btn-sm" onClick=${() => setOpen(true)}>${parentId ? '+ תת-משימה' : '+ משימה חדשה'}</button>`;
  return html`<input ref=${ref} class="input" style="margin-top:8px" placeholder=${parentId ? 'שם תת-המשימה' : 'שם המשימה'} value=${v} onInput=${(e) => setV(e.target.value)}
    onKeyDown=${(e) => { if (e.key === 'Enter' && v.trim()) { act(() => bus.ask('sunday.createItem', { actor: me(), groupId: g.id, name: v, parentId })); setV(''); } if (e.key === 'Escape') { setOpen(false); onDone && onDone(); } }}
    onBlur=${() => { if (v.trim()) act(() => bus.ask('sunday.createItem', { actor: me(), groupId: g.id, name: v, parentId })); setV(''); setOpen(false); onDone && onDone(); }}/>`;
}

/* ---------- group (C12) ---------- */
function Group({ g, bd, prefs, items, cards, hl, newGroupId }) {
  const uid = me();
  const collapsed = prefs.collapsed.includes(g.id);
  const lead = isLead(bd.id);
  const canEditG = bus.read('sunday.canEditGroup', uid, g.id);
  const cols = g.columns.filter((c) => c.type !== 'name');
  const setP = (patch) => bus.ask('sunday.setPrefs', { actor: uid, boardId: bd.id, patch });
  const menu = (el) => actionSheet(g.name, [
    { icon: 'pin', label: prefs.pinned.includes(g.id) ? 'ביטול הצמדה' : 'הצמדה למעלה', onClick: () => setP({ pinned: prefs.pinned.includes(g.id) ? prefs.pinned.filter((x) => x !== g.id) : [...prefs.pinned, g.id] }) },
    { icon: 'chevrons-down-up', label: 'כיווץ הכל', onClick: () => setP({ collapsed: bus.read('sunday.groups', bd.id).map((x) => x.id) }) },
    { icon: 'columns-3', label: 'החלת עמודות על כל הקבוצות', hidden: !lead, onClick: async () => { if (await confirm({ title: 'החלת עמודות על כל הקבוצות', text: 'כל הקבוצות בלוח יקבלו את העמודות של הקבוצה הזו. ערכים של עמודות שיוסרו יימחקו.', ok: 'החלה' })) act(() => bus.ask('sunday.applyColumnsToAll', { actor: uid, groupId: g.id }), 'הוחל'); } },
    { icon: 'trash-2', label: 'מחיקת קבוצה', danger: true, hidden: !canEditG, onClick: async () => { if (await confirm({ title: `מחיקת ${g.name}`, text: `הקבוצה ו-${items.length} המשימות שבה יעברו לפח ל-30 יום.`, ok: 'מחיקה', danger: true })) act(() => bus.ask('sunday.deleteGroup', { actor: uid, groupId: g.id }), 'הקבוצה הועברה לפח'); } },
  ], el);
  const head = html`<div class=${cx('g-head', cards && 'phone')} style=${groupNameVars(g.color)}>
    ${!cards && html`<span class="drag-handle hover-only" onPointerDown=${(e) => startDrag(e, { group: 'groups-' + bd.id, listId: bd.id, onDrop: ({ fromIndex, toIndex }) => { const ids = bus.read('sunday.groups', bd.id).map((x) => x.id); const ord = orderGroups(bus.read('sunday.groups', bd.id), prefs).map((x) => x.id); setP({ groupOrder: moveIn(ord, fromIndex, toIndex) }); } })}><${Icon} name="grip-vertical" size=${16}/></span>`}
    ${cards && html`<span class="g-bar4" style=${`background:${presetHex(g.color)}`}/>`}
    <button class="icon-btn sm" aria-label=${collapsed ? 'הרחבה' : 'כיווץ'} onClick=${() => setP({ collapsed: collapsed ? prefs.collapsed.filter((x) => x !== g.id) : [...prefs.collapsed, g.id] })}><${Icon} name=${collapsed ? 'chevron-left' : 'chevron-down'} size=${18}/></button>
    <span class="g-name gname"><${InlineText} value=${g.name} disabled=${!canEditG} startEditing=${newGroupId === g.id} onSave=${(v) => act(() => bus.ask('sunday.updateGroup', { actor: uid, groupId: g.id, patch: { name: v } }))}/></span>
    <span class="t-foot sec num">${items.length}</span>
    ${prefs.pinned.includes(g.id) && html`<${Icon} name="pin" size=${14} cls="sec" label="מוצמד"/>`}
    <button class="g-dot" style=${`background:${presetHex(g.color)}`} aria-label="צבע הקבוצה" disabled=${!canEditG} onClick=${(e) => pickColor(e.currentTarget, { current: g.color, onPick: (c) => act(() => bus.ask('sunday.updateGroup', { actor: uid, groupId: g.id, patch: { color: c } })) })}/>
    <span class="spacer"/>
    <button class="icon-btn sm" aria-label="אפשרויות קבוצה" onClick=${(e) => menu(e.currentTarget)}><${Icon} name="ellipsis" size=${18}/></button>
  </div>`;
  if (collapsed) return html`<section class="group" data-drag-item>${head}</section>`;
  if (cards) return html`<section class="group" data-drag-item>${head}
    <div class="col gap8" data-drop-list=${`items-${bd.id}:${g.id}`}>${items.map((it) => html`<${ItemCard} key=${it.id} it=${it} g=${g} bd=${bd} prefs=${prefs} hl=${hl === it.id}/>`)}</div></section>`;
  return html`<section class="group" data-drag-item>${head}
    <div class="g-table"><${ColumnHeader} g=${g} bd=${bd} cols=${cols}/>
      <div data-drop-list=${`items-${bd.id}:${g.id}`}>${items.map((it) => html`<${ItemRow} key=${it.id} it=${it} g=${g} bd=${bd} cols=${cols} prefs=${prefs} hl=${hl === it.id}/>`)}</div>
      ${!A().readOnly && html`<${NewRow} g=${g} cols=${cols}/>`}</div></section>`;
}
function orderGroups(list, prefs) {
  const o = prefs.groupOrder || [];
  return list.slice().sort((x, y) => {
    const px = prefs.pinned.includes(x.id) ? 0 : 1, py = prefs.pinned.includes(y.id) ? 0 : 1;
    if (px !== py) return px - py;
    const i = o.indexOf(x.id), j = o.indexOf(y.id);
    if (i >= 0 || j >= 0) return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j);
    return x.order - y.order;
  });
}

/* ---------- board screen ---------- */
function Board({ id }) {
  const uid = me();
  const a = A();
  const q = route().query;
  const bd = bus.read('sunday.board', id);
  const box = useRef();
  const width = useWidth(box);
  const [view, setView] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState('manual');
  const [hl, setHl] = useState(q.item || null);
  const [newGroupId, setNewGroupId] = useState(null);
  useEffect(() => { if (q.item) { setHl(q.item); const t = setTimeout(() => setHl(null), 2000); if (q.size) setTimeout(() => { const el = document.querySelector(`[data-size-cell="${q.item}"]`); if (el) el.click(); }, 400); if (q.panel) openPanel(q.panel, q.comment); return () => clearTimeout(t); } }, [q.item, q.panel]);
  if (!bd || bd.deletedAt || !bus.read('sunday.canSeeBoard', uid, id)) return html`<div><${BoardBar} active=${id}/><${EmptyState} title="אין לך גישה ללוח הזה"/></div>`;
  const lead = isLead(id);
  const prefs = bus.read('sunday.prefs', uid, id);
  const v = view && bd.views.includes(view) ? view : bd.views[0];
  const groups = orderGroups(bus.read('sunday.groups', id), prefs);
  const person = q.person;
  const filterItems = (g) => {
    let list = bus.read('sunday.items', g.id);
    if (search.trim()) list = list.filter((it) => it.name.includes(search.trim()) || bus.read('sunday.subitems', it.id).some((k) => k.name.includes(search.trim())));
    if (person) list = list.filter((it) => it.assignments.some((x) => x.uid === person));
    if (sort === 'priority') list = list.slice().sort((x, y) => priorityRank(g, x) - priorityRank(g, y));
    if (sort === 'date') list = list.slice().sort((x, y) => (x.dateEnd || '9999').localeCompare(y.dateEnd || '9999'));
    return list;
  };
  const maxMin = Math.max(0, ...groups.map((g) => minWidth(g.columns.filter((c) => c.type !== 'name'))));
  const cards = isPhone() || width < maxMin;
  const any = groups.reduce((s, g) => s + filterItems(g).length, 0);
  const addGroup = () => { const gid = act(() => bus.ask('sunday.createGroup', { actor: uid, boardId: id })); if (gid) setNewGroupId(gid); };
  const sortMenu = (el) => actionSheet('מיון', [{ label: 'ידני', icon: sort === 'manual' ? 'check' : null, onClick: () => setSort('manual') }, { label: 'לפי עדיפות', icon: sort === 'priority' ? 'check' : null, onClick: () => setSort('priority') }, { label: 'לפי תאריך', icon: sort === 'date' ? 'check' : null, onClick: () => setSort('date') }], el);
  const VIEW_HE = { table: 'טבלה', kanban: 'קנבן', calendar: 'לוח שנה' };
  return html`<div ref=${box}>
    <${BoardBar} active=${id}/>
    <div class="row wrap gap8" style="margin-bottom:12px">
      <h1 class="t-title2" style="min-width:0"><${InlineText} value=${bd.name} disabled=${!lead} onSave=${(n) => act(() => bus.ask('sunday.updateBoard', { actor: uid, boardId: id, patch: { name: n } }))}/></h1>
      ${bd.views.length > 1 && html`<${Seg} small value=${v} onChange=${setView} options=${bd.views.map((x) => ({ value: x, label: VIEW_HE[x] }))}/>`}
      <span class="spacer"/>
      ${cards ? html`${searchOpen ? html`<div style="width:180px"><${SearchInput} value=${search} onInput=${setSearch} autofocus/></div>` : html`<${IconButton} icon="search" label="חיפוש" onClick=${() => setSearchOpen(true)}/>`}
          <${IconButton} icon="ellipsis" label="עוד" onClick=${(e) => actionSheet(bd.name, [{ icon: 'arrow-up-down', label: 'מיון', onClick: () => sortMenu(null) }, { icon: 'settings', label: 'הגדרות לוח', hidden: !lead, onClick: () => boardSettings(bd) }, { icon: 'plus', label: '+ קבוצה חדשה', hidden: a.readOnly, onClick: addGroup }], e.currentTarget)}/>`
        : html`<div style="width:220px"><${SearchInput} value=${search} onInput=${setSearch} placeholder="חיפוש משימה"/></div>
          <${Button} size="sm" kind="secondary" icon="arrow-up-down" onClick=${(e) => sortMenu(e.currentTarget)}>${{ manual: 'ידני', priority: 'עדיפות', date: 'תאריך' }[sort]}</${Button}>
          ${!a.readOnly && html`<${Button} size="sm" kind="primary" icon="plus" onClick=${addGroup}>קבוצה חדשה</${Button}>`}
          ${lead && html`<${IconButton} icon="settings" label="הגדרות לוח" onClick=${() => boardSettings(bd)}/>`}`}
    </div>
    ${a.readOnly && html`<div style="margin-bottom:12px"><${ReadOnlyNote}/></div>`}
    ${person && html`<div class="row gap8" style="margin-bottom:12px"><span class="badge brand">מסונן לפי ${(bus.read('users.get', person) || { name_he: 'משתמש/ת' }).name_he}</span><${Button} size="xs" kind="ghost" onClick=${() => navigate('/sunday/board/' + id)}>ניקוי</${Button}></div>`}
    ${groups.length === 0 ? html`<${EmptyState} title="הלוח ריק" action=${!a.readOnly && html`<${Button} kind="primary" onClick=${addGroup}>+ קבוצה ראשונה</${Button}>`}/>`
      : v === 'kanban' ? html`<${Kanban} bd=${bd} groups=${groups} filterItems=${filterItems}/>`
      : v === 'calendar' ? html`<${CalendarView} bd=${bd} groups=${groups} prefs=${prefs}/>`
      : search.trim() && !any ? html`<${EmptyState} title="לא נמצאו משימות" sticker=${false}/>`
      : html`<div class="col gap24" data-drop-list=${`groups-${id}:${id}`}>${groups.map((g) => html`<${Group} key=${g.id} g=${g} bd=${bd} prefs=${prefs} items=${filterItems(g)} cards=${cards} hl=${hl} newGroupId=${newGroupId}/>`)}</div>`}
    ${cards && !a.readOnly && v === 'table' && groups.length > 0 && html`<button class="fab" aria-label="משימה חדשה" onClick=${async () => {
      const g = groups.find((x) => !prefs.collapsed.includes(x.id)) || groups[0];
      const n = await promptText({ title: `משימה חדשה ב${g.name}`, label: 'שם המשימה', multiline: false, max: 200 });
      if (n) act(() => bus.ask('sunday.createItem', { actor: uid, groupId: g.id, name: n }));
    }}><${Icon} name="plus" size=${28}/></button>`}
  </div>`;
}

/* ---------- My Tasks (C14) ---------- */
function MyTasks() {
  const uid = me();
  const a = A();
  const [showDone, setShowDone] = useState(false);
  const box = useRef();
  const width = useWidth(box);
  const filters = bus.read('sunday.filters', uid);
  const active = filters.find((f) => f.id === bus.read('sunday.activeFilter', uid));
  let list = bus.read('sunday.assignedTo', uid);
  const ctx = (it) => { const g = bus.read('sunday.group', it.groupId); const bd = bus.read('sunday.board', g.boardId); return { g, bd }; };
  const t = todayKey(), wk = addDaysKey(t, 7);
  const statusText = (it, g) => (lbl(g.statusLabels, it.status) || {}).text;
  if (active) list = list.filter((it) => { const { g, bd } = ctx(it);
    const s = !active.statuses.length || active.statuses.some((k) => k === it.status || k === statusText(it, g));
    const p = !active.priorities.length || active.priorities.some((k) => k === it.priority || k === (lbl(g.priorityLabels, it.priority) || {}).text);
    const d = active.due === 'all' || (active.due === 'overdue' ? it.dateEnd && it.dateEnd < t : it.dateEnd && it.dateEnd >= t && it.dateEnd <= wk);
    const bo = !active.boards.length || active.boards.includes(bd.id);
    return s && p && d && bo; });
  const filterIncludesDone = active && active.statuses.includes('done');
  const doneList = list.filter((it) => it.status === 'done');
  const shown = list.filter((it) => showDone || filterIncludesDone || it.status !== 'done').sort((x, y) => {
    const gx = ctx(x).g, gy = ctx(y).g;
    return priorityRank(gx, x) - priorityRank(gy, y) || (x.dateEnd || '9999').localeCompare(y.dateEnd || '9999');
  });
  const where = (it) => { const { g, bd } = ctx(it); const other = bd.team && bd.team !== a.team ? ' · מצוות אחר' : ''; const parent = it.parentId ? bus.read('sunday.item', it.parentId) : null;
    return `${bd.name} · ${g.name}${other}${parent ? ` · תת-משימה של ${parent.name}` : ''}`; };
  const cards = isPhone() || width < 860;
  const chipRow = html`<div class="row gap8" style="margin-bottom:12px;overflow-x:auto">
    ${filters.map((f) => html`<span class=${cx('chip', active && active.id === f.id && 'on')} style="padding-inline-end:4px">
      <button style="background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0" onClick=${() => bus.ask('sunday.setActiveFilter', { actor: uid, filterId: active && active.id === f.id ? null : f.id })}>${f.name}</button>
      <button class="icon-btn sm" style="width:24px;height:24px" aria-label=${'מחיקת ' + f.name} onClick=${() => { const r = act(() => bus.ask('sunday.deleteFilter', { actor: uid, filterId: f.id })); if (r) toast('הפילטר נמחק', { undo: () => bus.ask('sunday.restoreFilter', { actor: uid, filter: r }) }); }}><${Icon} name="x" size=${14}/></button></span>`)}
    <button class="chip" onClick=${() => filterBuilder()}>+ פילטר</button></div>`;
  let body;
  if (!list.length && !active) body = html`<div class="empty"><${Logo} kind="sticker" size=${96}/><div class="t-title3">אין לך משימות 🎉</div></div>`;
  else if (!shown.length && active && !doneList.length) body = html`<${EmptyState} title="אין משימות שמתאימות לפילטר" sticker=${false} action=${html`<${Button} kind="tinted" onClick=${() => bus.ask('sunday.setActiveFilter', { actor: uid, filterId: null })}>ניקוי פילטר</${Button}>`}/>`;
  else if (cards) body = html`<div class="col gap8">${shown.map((it) => { const { g, bd } = ctx(it); return html`<${ItemCard} key=${it.id} it=${it} g=${g} bd=${bd} prefs=${null} where=${where(it)}/>`; })}</div>`;
  else body = html`<div class="g-table"><div class="t-head mt-head"><span/><span class="h-name">משימה</span><span class="h-cell">סטטוס</span><span class="h-cell">תאריך</span><span class="h-cell">עדיפות</span><span class="h-cell">גודל</span><span/></div>
    ${shown.map((it) => { const { g, bd } = ctx(it); const has = (tt) => g.columns.some((c) => c.type === tt); return html`<div class="t-row mt-row" key=${it.id}>
      <span class="done-cell"><${DoneButton} it=${it} g=${g}/></span>
      <span class="c-name col" style="align-items:flex-start;gap:2px;padding-block:6px"><span class="t-foot sec ell" style="max-width:100%">${where(it)}</span><${NameCell} it=${it} g=${g} bd=${bd} onOpenPanel=${() => openPanel(it.id)}/></span>
      <span class="c-cell">${has('status') ? html`<${StatusCell} it=${it} g=${g} bd=${bd} full/>` : null}</span><span class="c-cell">${has('date') ? html`<${DateCell} it=${it}/>` : null}</span>
      <span class="c-cell">${has('priority') ? html`<${PriorityCell} it=${it} g=${g} full/>` : null}</span><span class="c-cell">${has('size') && !it.parentId ? html`<${SizeCell} it=${it} bd=${bd}/>` : null}</span>
      <span class="c-cell"><button class="icon-btn sm hover-only" aria-label="פעולות" onClick=${(e) => itemMenu(it, g, bd, e.currentTarget)}><${Icon} name="ellipsis" size=${18}/></button></span></div>`; })}</div>`;
  return html`<div ref=${box}>
    <${BoardBar} active="mine"/>
    <div class="row between" style="margin-bottom:12px"><h1 class="t-title2">המשימות שלי</h1><${IconButton} icon="settings" label="הגדרות סאנדיי" onClick=${() => sheet('הגדרות סאנדיי', () => html`<${SundaySettings}/>`)}/></div>
    ${chipRow}${body}
    ${!filterIncludesDone && doneList.length > 0 && html`<div class="mt16"><${Button} kind="link" size="sm" onClick=${() => setShowDone(!showDone)}>${showDone ? 'הסתרת משימות שהושלמו' : `הצג משימות שהושלמו (${doneList.length})`}</${Button}></div>`}
  </div>`;
}

/* ---------- Home "My tasks" card (NeatSystem 4 #3) ---------- */
addWidget('sunday.homeTasks', ({ uid }) => {
  const list = bus.read('sunday.my_tasks', uid).sort((x, y) => (y.overdue - x.overdue) || x.due.localeCompare(y.due)).slice(0, 5);
  const a = bus.read('users.actor', uid);
  return html`<div class="col gap4">${list.length === 0 ? html`<p class="t-foot sec">אין משימות להיום 🎉</p>` : html`<div class="list" style="border:0">${list.map((t) => {
    const it = bus.read('sunday.item', t.id); const g = bus.read('sunday.group', it.groupId);
    const l = lbl(g.statusLabels, it.status);
    return html`<div class="lrow" key=${t.id} style="padding-inline:0">${!a.readOnly ? html`<${DoneButton} it=${it} g=${g}/>` : null}
      <a class="col gap4 grow" href=${'#' + t.link} style="min-width:0;color:inherit;text-decoration:none"><span class="t-label clamp2">${t.title}</span>
        <span class=${cx('t-foot row gap4', t.overdue ? 'dangert' : 'sec')}>${t.overdue && html`<${Icon} name="circle-alert" size=${14}/>`}${fmtShort(t.due)}</span></a>
      ${l && html`<${Pill} text=${l.text} color=${l.color}/>`}</div>`; })}</div>`}
    <div><${Button} kind="link" size="sm" onClick=${() => navigate('/sunday')}>לכל המשימות שלי</${Button}></div></div>`;
});
addWidget('sunday.settingsLink', () => null);
addTabBadge('sunday', (uid) => bus.read('sunday.badge', uid));

addRoute({ path: '/sunday', tab: 'sunday', title: 'סאנדיי', wide: true, render: () => html`<${MyTasks}/>` });
addRoute({ path: '/sunday/board/:id', tab: 'sunday', title: 'סאנדיי', wide: true, render: (p) => html`<${Board} id=${p.id} key=${p.id}/>` });
addRoute({ path: '/sunday/approvals', tab: 'sunday', title: 'אישורי מטבעות', wide: true, render: () => html`<div><${BoardBar} active="approvals"/><${Approvals}/></div>` });
addRoute({ path: '/sunday/trash', tab: 'sunday', title: 'פח', wide: true, render: () => html`<div><${BoardBar} active="trash"/><${Trash}/></div>` });
addRoute({ path: '/sunday/dashboard', tab: 'sunday', title: 'דשבורד', wide: true, guard: (a) => a.isAdmin || a.isMentor, render: () => html`<div><${BoardBar} active="dashboard"/><${Dashboard}/></div>` });
addManagement('sunday', 'סאנדיי', [
  { id: 'approvals', title: 'אישורי מטבעות', icon: 'coin', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), render: () => html`<${Approvals}/>` },
  { id: 'trash', title: 'פח', icon: 'trash-2', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), render: () => html`<${Trash}/>` },
  { id: 'dashboard', title: 'דשבורד', icon: 'chart-column', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Dashboard}/>` },
  { id: 'settings', title: 'הגדרות סאנדיי', icon: 'settings', can: (a) => !a.noRole, render: () => html`<div class="card b"><${SundaySettings}/></div>` },
]);

const css = document.createElement('style');
css.textContent = `
.group{min-width:0}
.g-head{display:flex;align-items:center;gap:6px;height:48px;position:relative}
.g-head.phone{padding-inline-start:8px}
.g-bar4{position:absolute;inset-inline-start:0;top:10px;bottom:10px;width:4px;border-radius:2px}
.g-name{font-size:18px;line-height:24px;font-weight:700;min-width:0}
.g-dot{width:14px;height:14px;border-radius:50%;border:0;cursor:pointer;flex:none;padding:0}
.g-dot:disabled{cursor:default}
.g-table{border:1px solid var(--border);border-radius:var(--r-md);overflow:clip;background:var(--bg-surface)}
.t-head,.t-row{display:grid;align-items:stretch;min-width:0}
.t-head{position:sticky;top:56px;z-index:4;background:var(--bg-subtle);height:40px;border-bottom:1px solid var(--border)}
.t-head > *{display:flex;align-items:center;min-width:0;border-inline-start:1px solid var(--border)}
.t-head > :nth-child(-n+3){border-inline-start:0}
.h-name{padding:0 8px;font-size:14px;font-weight:500;color:var(--text-secondary)}
.h-cell{justify-content:center;font-size:14px;font-weight:500;color:var(--text-secondary);padding:0 4px;gap:2px;position:relative}
.h-cell .h-menu{position:absolute;inset-inline-end:0}
.t-row{min-height:44px;border-bottom:1px solid var(--border);background:var(--bg-surface)}
.t-row > *{display:flex;align-items:center;min-width:0;border-inline-start:1px solid var(--border)}
.t-row > :nth-child(-n+3){border-inline-start:0}
.t-row.sub{background:var(--bg-subtle)}
.t-row.hl{background:var(--brand-subtle)}
.t-row:hover .hover-only,.t-head:hover .hover-only,.h-cell:hover .hover-only{opacity:1}
.hover-only{opacity:0;transition:opacity var(--dur-fast)}
@media (hover:none){.hover-only{opacity:1}}
.gbar{align-self:stretch}
.handle-cell,.done-cell{justify-content:center}
.c-name{padding:0 8px}
.name-cell{display:flex;align-items:center;gap:6px;width:100%;min-width:0}
.t-name{font-size:16px;line-height:22px;font-weight:500;color:var(--text)}
.name-cell .inline-text{flex:1;min-width:0}
.inline-text.editable{cursor:text}
.c-cell{justify-content:center;padding:0}
.cell-btn{width:100%;height:100%;min-height:36px;display:flex;align-items:center;justify-content:center;background:none;border:0;padding:4px;cursor:pointer;color:inherit;font:inherit;min-width:0}
.cell-btn:disabled{cursor:default}
.cell-btn.fill{padding:4px 8px}
.cell-btn .fill-pill{width:100%;justify-content:center;height:28px;border-radius:6px}
.cell-btn.chip-cell{width:auto;height:32px;min-height:32px;border-radius:999px;border:1px solid var(--border);padding:0 10px}
.cell-btn:not(.chip-cell) .ph{opacity:0}
.t-row:hover .cell-btn .ph{opacity:1}
@media (hover:none){.cell-btn .ph{opacity:1}}
.link-cell{gap:4px;padding:0 6px}
.done-btn{border-radius:50%;border:1.5px solid var(--border-strong);background:var(--bg-surface);display:grid;place-items:center;cursor:pointer;padding:0;color:#fff;position:relative}
.done-btn::after{content:'';position:absolute;inset:-12px}
.done-btn.on{background:var(--success);border-color:var(--success)}
.done-btn:disabled{cursor:default;opacity:.6}
.bubble{display:inline-flex;align-items:center;gap:2px;background:none;border:0;color:var(--text-secondary);cursor:pointer;position:relative;flex:none;min-height:32px;padding:0 4px}
.bubble.empty{opacity:0}
.t-row:hover .bubble.empty,.i-card .bubble.empty{opacity:1}
.bubble-dot{position:absolute;top:4px;inset-inline-end:0;width:6px;height:6px;border-radius:50%;background:var(--brand)}
.new-row{min-height:40px}
.i-card{display:flex;align-items:stretch;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;cursor:pointer;min-width:0}
.i-card.hl{background:var(--brand-subtle)}
.i-bar{width:4px;flex:none}
.i-done{width:28px;flex:none;display:flex;align-items:flex-start;justify-content:center;padding-top:12px;margin-inline-start:6px}
.i-card .cell-btn{width:auto;height:32px;min-height:32px;flex:none;padding:0 2px}
.i-card .cell-btn.chip-cell{padding:0 10px}
.fab{position:fixed;bottom:calc(80px + env(safe-area-inset-bottom));inset-inline-start:16px;width:56px;height:56px;border-radius:50%;border:0;background:var(--brand);color:#fff;box-shadow:var(--shadow-lg);display:grid;place-items:center;z-index:25;cursor:pointer}
.mt-head,.mt-row{grid-template-columns:32px minmax(260px,1fr) minmax(96px,140px) minmax(96px,120px) minmax(88px,120px) minmax(80px,90px) 40px}
`;
document.head.appendChild(css);
