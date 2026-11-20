// Sunday — boards and tasks (03-sunday.txt, sections C1–C22). Data + rules; UI lives in ui.js/panel.js/views.js.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId, todayKey, addDaysKey, dayKey, fmtShort } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check, deny, ALUMNI_RO } from '../../core/errors.js';

const b = bus.system('sunday', { announces: ['task.approved', 'task.unapproved'] });
const db = ns('sunday');
export const APP = { trash_days: 30, deadline_warning_days: 2 };
export const BASE_COLS = [['status', 'סטטוס'], ['assignees', 'אחראים'], ['date', 'תאריך'], ['priority', 'עדיפות'], ['size', 'גודל'], ['subitems', 'תת-משימות']];
export const UNIQUE = ['status', 'assignees', 'priority', 'size', 'subitems'];
export const COL_TYPES = { text: 'טקסט', checkbox: 'תיבת סימון', dropdown: 'רשימה נפתחת', date_custom: 'תאריך', drive_link: 'קישור לדרייב', status: 'סטטוס', assignees: 'אחראים', priority: 'עדיפות', size: 'גודל', subitems: 'תת-משימות' };
const defStatuses = () => [{ key: 'todo', text: 'לביצוע', color: 'fx:todo', isDefault: true }, { key: 'working', text: 'בעבודה', color: 'fx:working', isDefault: true }, { key: 'stuck', text: 'תקוע', color: 'fx:stuck', isDefault: true }, { key: 'done', text: 'בוצע', color: 'fx:done', isDefault: true }];
const defPriorities = () => [{ key: 'crit', text: 'קריטית', color: 'fx:crit', isDefault: true }, { key: 'high', text: 'גבוהה', color: 'fx:high', isDefault: true }, { key: 'med', text: 'בינונית', color: 'fx:med', isDefault: true }, { key: 'low', text: 'נמוכה', color: 'fx:low', isDefault: true }];

const boards = () => db.get('boards', []);
const groups = () => db.get('groups', []);
const items = () => db.get('items', []);
const comments = () => db.get('comments', []);
const live = (x) => !x.deletedAt;
const actor = (id) => bus.read('users.actor', id);
const board = (id) => boards().find((x) => x.id === id);
const group = (id) => groups().find((x) => x.id === id);
const item = (id) => items().find((x) => x.id === id);
const boardOfItem = (it) => { const g = group(it.groupId); return g && board(g.boardId); };
const save = (k, v) => db.set(k, v);
function mutate(key, id, fn) { db.update(key, [], (l) => { const x = l.find((y) => y.id === id); check(!!x, 'לא נמצא'); fn(x); }); }

// ---------- permissions (C16) ----------
export function isLeadPlus(a, bd) {
  if (!a || a.readOnly) return false;
  if (a.isCaptain || a.isAdmin || a.isMentor) return true;
  return !!bd.team && a.isLead && a.team === bd.team;
}
function canSeeBoard(a, bd) {
  if (!a || a.noRole || !live(bd)) return false;
  if (a.isCaptain || a.isAdmin || a.isMentor) return true;
  if (bd.team && a.isLead && a.team === bd.team) return true;
  return bus.read('users.matches', a.id, bd.access, { includeAlumni: true });
}
const assigned = (it, uid) => (it.assignments || []).some((x) => x.uid === uid);
function canSeeItem(a, it) { const bd = boardOfItem(it); return !!bd && (canSeeBoard(a, bd) || assigned(it, a.id) || (it.parentId && assigned(item(it.parentId) || {}, a.id))); }
function editor(actorId, it) {
  const a = actorFor(actorId, { allowReadOnly: true });
  if (a.readOnly) throw new AppError(ALUMNI_RO);
  check(canSeeItem(a, it));
  return a;
}
function boardMember(actorId, bd) {
  const a = actorFor(actorId, { allowReadOnly: true });
  if (a.readOnly) throw new AppError(ALUMNI_RO);
  check(canSeeBoard(a, bd));
  return a;
}
function leadPlusOf(actorId, bd) { const a = actorFor(actorId); check(isLeadPlus(a, bd)); return a; }
function boardLeads(bd, { mentorsFollow = true } = {}) {
  const set = db.get('settings', {});
  return bus.read('users.list', { statuses: ['active'] }).map((u) => actor(u.id)).filter((a) => {
    if (!isLeadPlus(a, bd)) return false;
    if (a.isMentor && mentorsFollow && bd.team) { const f = (set[a.id] || {}).follow; if (f && !f.includes(bd.team)) return false; }
    return true;
  }).map((a) => a.id);
}
function teamLead(bd) { return bd.team ? bus.read('users.leadOf', bd.team) : null; }
const inactive = (uid) => { const a = actor(uid); return !a || a.noRole || (a.alumni && a.readOnly); };

// ---------- helpers ----------
const doneKey = 'done';
const childrenOf = (id) => items().filter((x) => x.parentId === id && live(x));
function hasCol(g, type) { return g.columns.some((c) => c.type === type); }
function link(bdId, itemId, extra = '') { return `/sunday/board/${bdId}?item=${itemId}${extra}`; }
function audit(actorId, action, target, field, oldV, newV, reason) { b.audit({ actor: actorId, action, target, field, old: oldV, new: newV, reason }); }
function computeParent(parentId, by) {
  const p = item(parentId); if (!p) return;
  const kids = childrenOf(parentId);
  if (!kids.length) return;
  const s = kids.map((k) => k.status);
  let st;
  if (s.every((x) => x === doneKey)) st = doneKey;
  else if (s.some((x) => x === 'stuck')) st = 'stuck';
  else if (s.some((x) => x === 'working')) st = 'working';
  else if (s.every((x) => x === 'todo')) st = 'todo';
  else st = 'working';
  if (st !== p.status) applyStatus(p, st, by);
}
/** Central status change: Done → coin approval; leaving Done → reversal (C7.1, C15). */
function applyStatus(it, key, by) {
  const prev = it.status;
  if (prev === key) return;
  const bd = boardOfItem(it);
  mutate('items', it.id, (x) => { x.prevStatus = prev; x.status = key; });
  const cur = item(it.id);
  if (!cur.parentId) {
    if (key === doneKey && (cur.assignments || []).length) {
      mutate('items', it.id, (x) => { x.coin = { state: 'awaiting', doneAt: now().toISOString() }; });
      b.notify(boardLeads(bd).filter((u) => !assigned(cur, u)), 'sunday.coin_queue', `משימה מחכה לאישור מטבעות: ${cur.name}`, `/sunday/approvals?item=${cur.id}`);
    } else if (prev === doneKey) {
      const c = cur.coin || {};
      if (c.state === 'approved') (c.paid || []).forEach((u) => b.emit('task.unapproved', { uid: u, approvalId: c.approvalId, itemId: cur.id, by }));
      mutate('items', it.id, (x) => { x.coin = { state: 'none' }; });
    }
  }
  audit(by, 'status', it.id, 'status', prev, key);
  if (cur.parentId) computeParent(cur.parentId, by);
}

// ---------- read APIs ----------
b.share('boards', (uid) => { const a = actor(uid); const order = db.get('board_order', {})[uid] || []; return boards().filter((bd) => canSeeBoard(a, bd)).sort((x, y) => { const i = order.indexOf(x.id), j = order.indexOf(y.id); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j) || (x.createdAt < y.createdAt ? -1 : 1); }); });
b.share('board', (id) => board(id) || null);
b.share('groups', (boardId) => groups().filter((g) => g.boardId === boardId && live(g)).sort((x, y) => x.order - y.order));
b.share('group', (id) => group(id) || null);
b.share('items', (groupId) => items().filter((x) => x.groupId === groupId && live(x) && !x.parentId).sort((x, y) => x.order - y.order));
b.share('subitems', (id) => childrenOf(id).sort((x, y) => x.order - y.order));
b.share('item', (id) => item(id) || null);
b.share('boardOfItem', (id) => { const it = item(id); return it ? boardOfItem(it) : null; });
b.share('canSeeBoard', (uid, id) => { const bd = board(id); return !!bd && canSeeBoard(actor(uid), bd); });
b.share('canSeeItem', (uid, id) => { const it = item(id); return !!it && canSeeItem(actor(uid), it); });
b.share('isLeadPlus', (uid, boardId) => { const bd = board(boardId); return !!bd && isLeadPlus(actor(uid), bd); });
b.share('canCreateBoard', (uid) => { const a = actor(uid); return !!a && !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor); });
b.share('comments', (itemId) => comments().filter((c) => c.itemId === itemId && live(c)).sort((x, y) => (y.at > x.at ? 1 : -1)));
b.share('unseen', (uid, itemId) => { const last = (db.get('seen', {})[uid] || {})[itemId] || ''; return comments().some((c) => c.itemId === itemId && live(c) && c.at > last && c.author !== uid); });
b.share('settings', (uid) => ({ autoAssign: true, follow: null, ...(db.get('settings', {})[uid] || {}) }));
b.share('prefs', (uid, boardId) => ({ groupOrder: [], pinned: [], collapsed: [], expanded: [], calendarHideEmpty: false, ...((db.get('prefs', {})[uid] || {})[boardId] || {}) }));
b.share('filters', (uid) => { const f = db.get('filters', {}); return f[uid] || [{ id: 'f-example', name: 'דחוף וחסום', statuses: ['stuck'], priorities: ['crit'], due: 'all', boards: [] }]; });
b.share('activeFilter', (uid) => db.get('active_filter', {})[uid] || null);
b.share('inactive', (uid) => inactive(uid));
b.share('canEditItem', (uid, id) => { const it = item(id); const a = actor(uid); return !!it && !!a && !a.readOnly && canSeeItem(a, it); });
b.share('canRename', (uid, id) => { const it = item(id); if (!it) return false; const a = actor(uid); const bd = boardOfItem(it); return isLeadPlus(a, bd) || (it.parentId && it.createdBy === uid && !a.readOnly); });
b.share('canDeleteItem', (uid, id) => { const it = item(id); if (!it) return false; const a = actor(uid); return !!a && !a.readOnly && (isLeadPlus(a, boardOfItem(it)) || it.createdBy === uid); });
b.share('canEditGroup', (uid, gid) => { const g = group(gid); if (!g) return false; const a = actor(uid); return !!a && !a.readOnly && (isLeadPlus(a, board(g.boardId)) || g.createdBy === uid); });
b.share('canApprove', (uid, id) => { const it = item(id); if (!it) return false; return isLeadPlus(actor(uid), boardOfItem(it)) && !assigned(it, uid); });
/** "My tasks" for Home: open items & subitems assigned to the user, due today or earlier (C2). */
b.share('my_tasks', (uid) => items().filter((it) => live(it) && assigned(it, uid) && it.status !== doneKey && it.dateEnd && it.dateEnd <= todayKey() && (() => { const g = group(it.groupId); const bd = g && board(g.boardId); return g && live(g) && bd && live(bd) && hasCol(g, 'assignees'); })())
  .map((it) => { const bd = boardOfItem(it); return { id: it.id, title: it.name, due: it.dateEnd, link: link(bd.id, it.parentId || it.id), status: it.status, groupId: it.groupId, overdue: it.dateEnd < todayKey() }; }));
b.share('assignedTo', (uid) => items().filter((it) => live(it) && assigned(it, uid) && (() => { const g = group(it.groupId); const bd = g && board(g.boardId); return g && live(g) && bd && live(bd) && hasCol(g, 'assignees'); })()));
b.share('badge', (uid) => {
  const a = actor(uid); if (!a || a.readOnly) return 0;
  return items().filter((it) => live(it) && !it.parentId && (() => { const bd = boardOfItem(it); const g = group(it.groupId); if (!bd || !live(bd) || !g || !live(g) || !isLeadPlus(a, bd)) return false;
    const needSize = !it.size && it.sizeNeeded && hasCol(g, 'size');
    const needCoin = it.coin && it.coin.state === 'awaiting' && !assigned(it, uid);
    return needSize || needCoin; })()).length;
});
b.share('queue', (uid) => items().filter((it) => live(it) && !it.parentId && it.coin && ['awaiting', 'approved', 'rejected'].includes(it.coin.state) && (() => { const bd = boardOfItem(it); return bd && live(bd) && isLeadPlus(actor(uid), bd); })()));
b.share('trash', (uid) => {
  const a = actor(uid);
  const out = [];
  boards().filter((x) => x.deletedAt && isLeadPlus(a, x)).forEach((x) => out.push({ kind: 'board', id: x.id, name: x.name, boardId: x.id, deletedAt: x.deletedAt, deletedBy: x.deletedBy }));
  groups().filter((g) => g.deletedAt && board(g.boardId) && isLeadPlus(a, board(g.boardId))).forEach((g) => out.push({ kind: 'group', id: g.id, name: g.name, boardId: g.boardId, deletedAt: g.deletedAt, deletedBy: g.deletedBy }));
  items().filter((it) => it.deletedAt && !it.deletedWith && (() => { const g = group(it.groupId); return g && board(g.boardId) && isLeadPlus(a, board(g.boardId)); })()).forEach((it) => out.push({ kind: it.parentId ? 'subitem' : 'item', id: it.id, name: it.name, boardId: group(it.groupId).boardId, deletedAt: it.deletedAt, deletedBy: it.deletedBy }));
  db.get('trash_columns', []).forEach((c) => { const g = group(c.groupId); if (g && board(g.boardId) && isLeadPlus(a, board(g.boardId))) out.push({ kind: 'column', id: c.id, name: c.column.label, boardId: g.boardId, deletedAt: c.deletedAt, deletedBy: c.deletedBy, groupName: g.name }); });
  return out.sort((x, y) => (y.deletedAt > x.deletedAt ? 1 : -1));
});
b.share('allItems', () => items().filter(live));
b.share('appSettings', () => ({ ...APP, ...db.get('app_settings', {}) }));

// ---------- boards ----------
b.serve('createBoard', ({ actor: id, name, team }) => {
  const a = actorFor(id); check(a.isLead || a.isCaptain || a.isAdmin || a.isMentor);
  if (a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)) check(team === a.team, 'רש"צ יוצר/ת לוחות רק לצוות שלו/ה');
  name = (name || '').trim(); check(name.length >= 1 && name.length <= 60, 'חובה לתת שם');
  const access = team ? { all: false, users: [], teams: [team], subteams: [], roles: [] } : { all: true, users: [], teams: [], subteams: [], roles: [] };
  const bd = { id: newId('bd'), name, team: team || null, access, views: ['table', 'kanban', 'calendar'], createdBy: id, createdAt: now().toISOString(), deletedAt: null };
  save('boards', [...boards(), bd]);
  audit(id, 'board_create', bd.id, 'name', null, name);
  return bd.id;
});
b.serve('updateBoard', ({ actor: id, boardId, patch }) => {
  const bd = board(boardId); check(!!bd); const a = leadPlusOf(id, bd);
  if ('team' in patch && a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)) check(patch.team === a.team);
  if (patch.views) check(patch.views.length >= 1, 'לוח צריך לפחות תצוגה אחת');
  if ('name' in patch) { patch.name = (patch.name || '').trim(); check(patch.name.length >= 1, 'חובה לתת שם'); }
  mutate('boards', boardId, (x) => { Object.entries(patch).forEach(([k, v]) => { audit(id, 'board_update', boardId, k, x[k], v); x[k] = v; }); });
});
b.serve('deleteBoard', ({ actor: id, boardId }) => { const bd = board(boardId); check(!!bd); leadPlusOf(id, bd); mutate('boards', boardId, (x) => { x.deletedAt = now().toISOString(); x.deletedBy = id; }); audit(id, 'board_delete', boardId, 'name', bd.name, null); });
b.serve('reorderBoards', ({ actor: id, ids }) => { actorFor(id, { allowReadOnly: true }); db.update('board_order', {}, (o) => { o[id] = ids; }); });

// ---------- groups (C12) ----------
function newGroup(boardId, name, by, order, color) {
  const n = groups().filter((g) => g.boardId === boardId).length;
  return { id: newId('gr'), boardId, name, color: color || 'p:' + ((n % 16) + 1), order, createdBy: by, deletedAt: null,
    columns: [{ id: 'c-name', type: 'name', label: 'משימה' }, ...BASE_COLS.map(([t, l]) => ({ id: 'c-' + t, type: t, label: l }))], statusLabels: defStatuses(), priorityLabels: defPriorities() };
}
b.serve('createGroup', ({ actor: id, boardId, name }) => {
  const bd = board(boardId); check(!!bd); boardMember(id, bd);
  const min = Math.min(0, ...groups().filter((g) => g.boardId === boardId).map((g) => g.order));
  const g = newGroup(boardId, (name || 'קבוצה חדשה').trim().slice(0, 60), id, min - 1);
  save('groups', [...groups(), g]);
  audit(id, 'group_create', g.id, 'name', null, g.name);
  return g.id;
});
function groupEditor(id, g) { const a = actorFor(id, { allowReadOnly: true }); if (a.readOnly) throw new AppError(ALUMNI_RO); check(isLeadPlus(a, board(g.boardId)) || g.createdBy === id); return a; }
b.serve('updateGroup', ({ actor: id, groupId, patch }) => {
  const g = group(groupId); check(!!g); groupEditor(id, g);
  if ('name' in patch) { patch.name = (patch.name || '').trim(); check(patch.name.length >= 1, 'חובה לתת שם'); }
  mutate('groups', groupId, (x) => Object.entries(patch).forEach(([k, v]) => { if (['name', 'color'].includes(k)) { audit(id, 'group_update', groupId, k, x[k], v); x[k] = v; } }));
});
b.serve('deleteGroup', ({ actor: id, groupId }) => {
  const g = group(groupId); check(!!g); groupEditor(id, g);
  const t = now().toISOString();
  mutate('groups', groupId, (x) => { x.deletedAt = t; x.deletedBy = id; });
  audit(id, 'group_delete', groupId, 'name', g.name, null);
});
b.serve('setPrefs', ({ actor: id, boardId, patch }) => { actorFor(id, { allowReadOnly: true }); db.update('prefs', {}, (p) => { p[id] = p[id] || {}; p[id][boardId] = { ...(p[id][boardId] || {}), ...patch }; }); });

// ---------- columns (C9) ----------
function scopeGroups(g, scope) { return scope === 'all' ? groups().filter((x) => x.boardId === g.boardId && live(x)) : [g]; }
b.serve('addColumn', ({ actor: id, groupId, type, label, options, groupIds }) => {
  const g = group(groupId); check(!!g); boardMember(id, board(g.boardId));
  check(type in COL_TYPES, 'סוג לא תקין');
  label = (label || COL_TYPES[type]).trim().slice(0, 40);
  const colId = UNIQUE.includes(type) ? 'c-' + type : newId('c');
  const targets = (groupIds && groupIds.length ? groupIds : [groupId]).map(group).filter((x) => x && x.boardId === g.boardId);
  db.update('groups', [], (l) => targets.forEach((t) => {
    const x = l.find((y) => y.id === t.id);
    if (UNIQUE.includes(type) && x.columns.some((c) => c.type === type)) return;
    x.columns.push({ id: colId, type, label, options: type === 'dropdown' ? (options || []).map((o) => ({ key: o.key || newId('o'), text: o.text, color: o.color || 'p:14' })) : undefined });
    if (UNIQUE.includes(type)) db.update('items', [], (il) => il.forEach((it) => { if (it.groupId === x.id) clearColumnValue(it, type, colId); }));
  }));
  audit(id, 'column_add', groupId, type, null, label);
  return colId;
});
function clearColumnValue(it, type, colId) {
  if (type === 'status') { it.status = 'todo'; it.prevStatus = null; }
  else if (type === 'assignees') it.assignments = [];
  else if (type === 'priority') it.priority = null;
  else if (type === 'size') { it.size = null; }
  else if (type === 'date') { it.dateStart = null; it.dateEnd = null; }
  else delete (it.values || {})[colId];
}
b.serve('renameColumn', ({ actor: id, groupId, colId, label, scope }) => {
  const g = group(groupId); check(!!g); leadPlusOf(id, board(g.boardId));
  label = (label || '').trim(); check(label.length >= 1 && label.length <= 40, 'שם עד 40 תווים');
  db.update('groups', [], (l) => scopeGroups(g, scope).forEach((t) => { const c = l.find((y) => y.id === t.id).columns.find((x) => x.id === colId); if (c) { audit(id, 'column_rename', t.id, colId, c.label, label); c.label = label; } }));
});
b.serve('moveColumn', ({ actor: id, groupId, colId, toIndex, scope }) => {
  const g = group(groupId); check(!!g); leadPlusOf(id, board(g.boardId));
  check(colId !== 'c-name' && toIndex >= 1);
  db.update('groups', [], (l) => scopeGroups(g, scope).forEach((t) => {
    const x = l.find((y) => y.id === t.id); const i = x.columns.findIndex((c) => c.id === colId); if (i < 0) return;
    const [c] = x.columns.splice(i, 1); x.columns.splice(Math.min(Math.max(1, toIndex), x.columns.length), 0, c);
  }));
  audit(id, 'column_move', groupId, colId, null, toIndex);
});
b.serve('deleteColumn', ({ actor: id, groupId, colId, scope }) => {
  const g = group(groupId); check(!!g); leadPlusOf(id, board(g.boardId)); check(colId !== 'c-name');
  const t = now().toISOString();
  db.update('groups', [], (l) => scopeGroups(g, scope).forEach((tg) => {
    const x = l.find((y) => y.id === tg.id); const c = x.columns.find((y) => y.id === colId); if (!c) return;
    x.columns = x.columns.filter((y) => y.id !== colId);
    db.update('trash_columns', [], (tc) => { tc.push({ id: newId('tc'), groupId: x.id, column: c, deletedAt: t, deletedBy: id }); });
    db.update('items', [], (il) => il.forEach((it) => { if (it.groupId === x.id) clearColumnValue(it, c.type, c.id); }));
    audit(id, 'column_delete', x.id, c.type, c.label, null);
  }));
});
/** "החלה על כל הקבוצות": copy one column (same id) into every group of the board that lacks it. */
b.serve('copyColumnToAll', ({ actor: id, groupId, colId }) => {
  const g = group(groupId); check(!!g); leadPlusOf(id, board(g.boardId));
  const c = g.columns.find((x) => x.id === colId); check(!!c);
  db.update('groups', [], (l) => l.filter((x) => x.boardId === g.boardId && live(x) && x.id !== g.id).forEach((x) => {
    if (x.columns.some((y) => y.id === colId || (UNIQUE.includes(c.type) && y.type === c.type))) return;
    x.columns.push(JSON.parse(JSON.stringify(c)));
  }));
  audit(id, 'column_copy_all', groupId, c.label);
});
/** Group ⋯ → "החלת עמודות על כל הקבוצות": every group gets this group's column set and order. */
b.serve('applyColumnsToAll', ({ actor: id, groupId }) => {
  const g = group(groupId); check(!!g); leadPlusOf(id, board(g.boardId));
  db.update('groups', [], (l) => l.filter((x) => x.boardId === g.boardId && live(x) && x.id !== g.id).forEach((x) => {
    const removed = x.columns.filter((c) => !g.columns.some((y) => y.id === c.id));
    x.columns = g.columns.map((c) => x.columns.find((y) => y.id === c.id) || JSON.parse(JSON.stringify(c)));
    removed.forEach((c) => db.update('items', [], (il) => il.forEach((it) => { if (it.groupId === x.id) clearColumnValue(it, c.type, c.id); })));
  }));
  audit(id, 'columns_apply_all', groupId, 'columns');
});
b.serve('saveLabels', ({ actor: id, groupId, kind, labels, scope }) => {
  const g = group(groupId); check(!!g);
  const a = boardMember(id, board(g.boardId));
  const lead = isLeadPlus(a, board(g.boardId));
  const key = kind === 'priority' ? 'priorityLabels' : 'statusLabels';
  if (kind === 'priority') check(lead, 'רק רש"צ ומעלה עורכים עדיפויות');
  check(labels.length >= 1, 'אי אפשר למחוק את התווית האחרונה');
  const cur = g[key];
  if (!lead) cur.filter((x) => x.isDefault).forEach((d) => { const n = labels.find((y) => y.key === d.key); check(n && n.text === d.text && n.color === d.color, 'רק רש"צ ומעלה משנים את הסטטוסים הקבועים'); });
  if (kind === 'status') check(labels.some((x) => x.key === doneKey), 'אי אפשר למחוק את "בוצע"');
  const clean = labels.map((x) => ({ key: x.key || newId('l'), text: (x.text || '').trim().slice(0, 30) || 'תווית', color: x.color || 'p:14', isDefault: !!x.isDefault }));
  db.update('groups', [], (l) => scopeGroups(g, scope).forEach((tg) => {
    const x = l.find((y) => y.id === tg.id);
    const removed = x[key].filter((o) => !clean.some((n) => n.key === o.key)).map((o) => o.key);
    x[key] = clean;
    if (removed.length) db.update('items', [], (il) => il.forEach((it) => { if (it.groupId === x.id) { if (kind === 'priority' && removed.includes(it.priority)) it.priority = clean[0].key; if (kind === 'status' && removed.includes(it.status)) it.status = clean[0].key; } }));
  }));
  audit(id, 'labels', groupId, kind, cur.map((x) => x.text).join(','), clean.map((x) => x.text).join(','));
});

// ---------- items (C7, C11) ----------
b.serve('createItem', ({ actor: id, groupId, name, parentId }) => {
  const g = group(groupId); check(g && live(g)); const bd = board(g.boardId);
  let a;
  if (parentId) { const p = item(parentId); check(p); a = editor(id, p); } else a = boardMember(id, bd);
  name = (name || '').trim(); check(name.length >= 1 && name.length <= 200, 'חובה לתת שם');
  const lead = isLeadPlus(a, bd);
  const siblings = items().filter((x) => x.groupId === groupId && x.parentId === (parentId || null) && live(x));
  const it = { id: newId('it'), groupId, parentId: parentId || null, name, createdBy: id, createdAt: now().toISOString(), order: siblings.length ? Math.max(...siblings.map((x) => x.order)) + 1 : 0,
    assignments: [], status: 'todo', prevStatus: null, priority: null, dateStart: null, dateEnd: null, size: null, sizeSetBy: null, sizeNeeded: !parentId && !lead, coin: { state: 'none' }, values: {}, description: '', files: [], deletedAt: null };
  if (parentId) it.assignments = (item(parentId).assignments || []).map((x) => ({ ...x, at: now().toISOString() }));
  else if (bus.read('sunday.settings', id).autoAssign && hasCol(g, 'assignees') && !a.isMentor) it.assignments = [{ uid: id, by: id, at: now().toISOString() }];
  save('items', [...items(), it]);
  audit(id, parentId ? 'subitem_create' : 'item_create', it.id, 'name', null, name);
  if (!parentId && !lead && hasCol(g, 'size')) b.notify(boardLeads(bd), 'sunday.size', `משימה חדשה מחכה לגודל: ${name}`, link(bd.id, it.id, '&size=1'));
  if (parentId) computeParent(parentId, id);
  return it.id;
});
b.serve('rename', ({ actor: id, itemId, name }) => {
  const it = item(itemId); check(it); const a = editor(id, it);
  check(isLeadPlus(a, boardOfItem(it)) || (it.parentId && it.createdBy === id), 'רק רש"צ ומעלה משנים שם');
  name = (name || '').trim(); check(name.length >= 1, 'חובה לתת שם');
  audit(id, 'rename', itemId, 'name', it.name, name);
  mutate('items', itemId, (x) => { x.name = name; });
});
b.serve('setStatus', ({ actor: id, itemId, key }) => {
  const it = item(itemId); check(it); editor(id, it);
  const g = group(it.groupId); check(hasCol(g, 'status'));
  check(it.parentId || !childrenOf(itemId).length, 'נקבע לפי תתי-המשימות');
  check(g.statusLabels.some((l) => l.key === key));
  applyStatus(it, key, id);
});
b.serve('toggleDone', ({ actor: id, itemId }) => {
  const it = item(itemId); check(it); editor(id, it);
  check(it.parentId || !childrenOf(itemId).length, 'נקבע לפי תתי-המשימות');
  const back = it.prevStatus && it.prevStatus !== doneKey ? it.prevStatus : 'todo';
  applyStatus(it, it.status === doneKey ? back : doneKey, id);
});
b.serve('setPriority', ({ actor: id, itemId, key }) => { const it = item(itemId); check(it); editor(id, it); audit(id, 'priority', itemId, 'priority', it.priority, key); mutate('items', itemId, (x) => { x.priority = key; }); });
b.serve('setDate', ({ actor: id, itemId, start, end }) => {
  const it = item(itemId); check(it); editor(id, it);
  audit(id, 'date', itemId, 'date', `${it.dateStart || ''}–${it.dateEnd || ''}`, `${start || ''}–${end || ''}`);
  mutate('items', itemId, (x) => { x.dateStart = start || null; x.dateEnd = end || null; });
  db.update('deadline_notified', {}, (d) => { delete d[itemId]; });
});
b.serve('setValue', ({ actor: id, itemId, colId, value }) => {
  const it = item(itemId); check(it); editor(id, it);
  const c = group(it.groupId).columns.find((x) => x.id === colId); check(c && !UNIQUE.includes(c.type) && c.type !== 'name' && c.type !== 'date');
  if (c.type === 'drive_link' && value) check(/^https?:\/\//.test(value.url || ''), 'קישור חייב להתחיל ב-http');
  audit(id, 'value', itemId, c.label, (it.values || {})[colId], value);
  mutate('items', itemId, (x) => { x.values = { ...(x.values || {}), [colId]: value }; });
});
b.serve('setSize', ({ actor: id, itemId, size }) => {
  const it = item(itemId); check(it && !it.parentId); leadPlusOf(id, boardOfItem(it));
  check(['small', 'medium', 'large', 'huge', 'none'].includes(size));
  audit(id, 'size', itemId, 'size', it.size, size);
  mutate('items', itemId, (x) => { x.size = size; x.sizeSetBy = id; x.sizeNeeded = false; });
});
b.serve('setAssignees', ({ actor: id, itemId, uids }) => {
  const it = item(itemId); check(it); const a = editor(id, it); const bd = boardOfItem(it);
  const lead = isLeadPlus(a, bd);
  const before = (it.assignments || []).map((x) => x.uid);
  const added = uids.filter((u) => !before.includes(u)), removed = before.filter((u) => !uids.includes(u));
  if (!lead) {
    check(added.every((u) => u === id) && removed.every((u) => u === id), 'אפשר לשייך רק את עצמך');
    if (removed.includes(id)) { const asg = it.assignments.find((x) => x.uid === id); check(asg && asg.by === id, 'רק רש"צ ומעלה יכולים להסיר אותך מהמשימה'); }
  } else added.forEach((u) => check(!inactive(u), 'אי אפשר לשייך משתמש/ת לא פעיל/ה'));
  mutate('items', itemId, (x) => { x.assignments = [...x.assignments.filter((y) => uids.includes(y.uid)), ...added.map((u) => ({ uid: u, by: id, at: now().toISOString() }))]; });
  audit(id, 'assignees', itemId, 'assignees', before, uids);
  b.notify(added.filter((u) => u !== id), 'sunday.assigned', `שויכת למשימה: ${it.name}`, link(bd.id, it.parentId || it.id));
  if (!lead && removed.includes(id)) { const tl = teamLead(bd); if (tl && tl !== id) b.notify([tl], 'sunday.left', `${(bus.read('users.get', id) || {}).name_he} עזב/ה משימה: ${it.name}`, link(bd.id, it.parentId || it.id)); }
  const cur = item(itemId);
  if (!cur.parentId && cur.status === doneKey && cur.coin.state === 'none' && cur.assignments.length) applyStatusCoinOnly(cur);
});
function applyStatusCoinOnly(it) { mutate('items', it.id, (x) => { x.coin = { state: 'awaiting', doneAt: now().toISOString() }; }); }
b.serve('moveItem', ({ actor: id, itemId, toGroupId, toIndex }) => {
  const it = item(itemId); check(it && !it.parentId); editor(id, it);
  const tg = group(toGroupId); check(tg && tg.boardId === group(it.groupId).boardId);
  const fromGroup = group(it.groupId);
  const list = items().filter((x) => x.groupId === toGroupId && !x.parentId && live(x) && x.id !== itemId).sort((x, y) => x.order - y.order);
  list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, it);
  db.update('items', [], (l) => {
    list.forEach((x, i) => { l.find((y) => y.id === x.id).order = i; });
    const x = l.find((y) => y.id === itemId);
    if (x.groupId !== toGroupId) {
      // status kept by label name, else first label; values of missing columns kept hidden (C12)
      const label = (fromGroup.statusLabels.find((s) => s.key === x.status) || {}).text;
      const same = tg.statusLabels.find((s) => s.text === label || s.key === x.status);
      x.status = same ? same.key : tg.statusLabels[0].key;
      const pl = (fromGroup.priorityLabels.find((s) => s.key === x.priority) || {}).text;
      const sp = tg.priorityLabels.find((s) => s.text === pl || s.key === x.priority);
      if (x.priority) x.priority = sp ? sp.key : x.priority;
      x.groupId = toGroupId;
      l.filter((y) => y.parentId === itemId).forEach((y) => { y.groupId = toGroupId; });
    }
  });
  audit(id, 'move', itemId, 'group', fromGroup.name, tg.name);
});
b.serve('duplicateItem', ({ actor: id, itemId }) => {
  const it = item(itemId); check(it && !it.parentId); editor(id, it);
  const copy = { ...JSON.parse(JSON.stringify(it)), id: newId('it'), name: it.name + ' (עותק)', createdBy: id, createdAt: now().toISOString(), order: it.order + 0.5, coin: { state: 'none' }, status: it.status === doneKey ? 'todo' : it.status };
  const kids = childrenOf(itemId).map((k) => ({ ...JSON.parse(JSON.stringify(k)), id: newId('it'), parentId: copy.id, createdBy: id }));
  save('items', [...items(), copy, ...kids]);
  audit(id, 'duplicate', copy.id, 'from', itemId, copy.name);
  return copy.id;
});
b.serve('deleteItem', ({ actor: id, itemId }) => {
  const it = item(itemId); check(it); const a = editor(id, it);
  check(isLeadPlus(a, boardOfItem(it)) || it.createdBy === id, 'אפשר למחוק רק משימות שיצרת');
  const t = now().toISOString();
  db.update('items', [], (l) => { const x = l.find((y) => y.id === itemId); x.deletedAt = t; x.deletedBy = id; l.forEach((y) => { if (y.parentId === itemId && !y.deletedAt) { y.deletedAt = t; y.deletedBy = id; y.deletedWith = itemId; } }); });
  audit(id, 'item_delete', itemId, 'name', it.name, null);
  if (it.parentId) computeParent(it.parentId, id);
});
b.serve('restore', ({ actor: id, kind, targetId }) => {
  const a = actorFor(id);
  if (kind === 'board') { const bd = board(targetId); check(bd && isLeadPlus(a, bd)); mutate('boards', targetId, (x) => { x.deletedAt = null; }); }
  else if (kind === 'group') { const g = group(targetId); check(g && isLeadPlus(a, board(g.boardId))); mutate('groups', targetId, (x) => { x.deletedAt = null; }); }
  else if (kind === 'item' || kind === 'subitem') {
    const it = item(targetId); check(it);
    if (id !== it.deletedBy || !(isLeadPlus(a, boardOfItem(it)) || it.createdBy === id)) check(isLeadPlus(a, boardOfItem(it)));
    db.update('items', [], (l) => l.forEach((y) => { if (y.id === targetId || y.deletedWith === targetId) { y.deletedAt = null; y.deletedWith = null; } }));
    if (it.parentId) computeParent(it.parentId, id);
  } else if (kind === 'column') {
    const tc = db.get('trash_columns', []).find((x) => x.id === targetId); check(tc); const g = group(tc.groupId); check(isLeadPlus(a, board(g.boardId)));
    if (UNIQUE.includes(tc.column.type) && hasCol(g, tc.column.type)) throw new AppError('העמודה כבר קיימת בקבוצה');
    mutate('groups', g.id, (x) => { x.columns.push(tc.column); });
    db.set('trash_columns', db.get('trash_columns', []).filter((x) => x.id !== targetId));
  }
  audit(id, 'restore', targetId, kind);
});

// ---------- coin approval (C15) ----------
b.serve('approveCoins', ({ actor: id, itemId, size }) => {
  const it = item(itemId); check(it && !it.parentId); const bd = boardOfItem(it); leadPlusOf(id, bd);
  check(!assigned(it, id), 'אי אפשר לאשר מטבעות למשימה שאת/ה משויך/ת אליה');
  check(it.status === doneKey && ['awaiting', 'rejected'].includes(it.coin.state), 'המשימה כבר הוכרעה');
  const sz = size || it.size; check(['small', 'medium', 'large', 'huge', 'none'].includes(sz), 'בחרו גודל');
  if (size && size !== it.size) mutate('items', itemId, (x) => { x.size = size; x.sizeSetBy = id; x.sizeNeeded = false; });
  const approvalId = newId('ap');
  const paid = sz === 'none' ? [] : it.assignments.map((x) => x.uid);
  mutate('items', itemId, (x) => { x.coin = { ...x.coin, state: 'approved', decidedBy: id, decidedAt: now().toISOString(), approvalId, paid, size: sz, note: null }; });
  paid.forEach((u) => b.emit('task.approved', { uid: u, approvalId, itemId, title: it.name, size: sz, approved_by: id }));
  audit(id, 'coins_approve', itemId, 'size', null, sz);
  b.notify(it.assignments.map((x) => x.uid), 'sunday.coin_decision', sz === 'none' ? `המשימה אושרה (ללא מטבעות): ${it.name}` : `המטבעות אושרו: ${it.name}`, link(bd.id, itemId));
});
b.serve('rejectCoins', ({ actor: id, itemId, note }) => {
  const it = item(itemId); check(it && !it.parentId); const bd = boardOfItem(it); leadPlusOf(id, bd);
  check(!assigned(it, id), 'אי אפשר להכריע במשימה שאת/ה משויך/ת אליה');
  note = (note || '').trim(); check(note.length >= 2, 'חובה לכתוב הערה');
  const c = it.coin;
  if (c.state === 'approved') (c.paid || []).forEach((u) => b.emit('task.unapproved', { uid: u, approvalId: c.approvalId, itemId, by: id }));
  mutate('items', itemId, (x) => { x.coin = { ...x.coin, state: 'rejected', decidedBy: id, decidedAt: now().toISOString(), note, paid: [] }; });
  audit(id, 'coins_reject', itemId, 'coin', c.state, 'rejected', note);
  b.notify(it.assignments.map((x) => x.uid), 'sunday.coin_decision', `המטבעות נדחו: ${it.name} — ${note}`, link(bd.id, itemId));
});
b.serve('undoCoinDecision', ({ actor: id, itemId, prev }) => {
  const it = item(itemId); check(it); leadPlusOf(id, boardOfItem(it));
  const c = it.coin;
  if (c.state === 'approved') (c.paid || []).forEach((u) => b.emit('task.unapproved', { uid: u, approvalId: c.approvalId, itemId, by: id }));
  mutate('items', itemId, (x) => { x.coin = { state: 'awaiting', doneAt: c.doneAt }; });
  audit(id, 'coins_undo', itemId, 'coin', c.state, 'awaiting');
});

// ---------- updates panel (C8) ----------
b.serve('setDescription', ({ actor: id, itemId, html: h }) => { const it = item(itemId); check(it); editor(id, it); mutate('items', itemId, (x) => { x.description = h; }); audit(id, 'description', itemId, 'description', null, '…'); });
b.serve('addFile', ({ actor: id, itemId, name, url }) => {
  const it = item(itemId); check(it); editor(id, it);
  check(/^https?:\/\//.test(url || ''), 'קישור חייב להתחיל ב-http'); name = (name || url).trim().slice(0, 80);
  const f = { id: newId('f'), name, url, by: id };
  mutate('items', itemId, (x) => { x.files = [...(x.files || []), f]; }); audit(id, 'file_add', itemId, 'files', null, url);
  return f.id;
});
b.serve('removeFile', ({ actor: id, itemId, fileId }) => { const it = item(itemId); check(it); editor(id, it); let f; mutate('items', itemId, (x) => { f = x.files.find((y) => y.id === fileId); x.files = x.files.filter((y) => y.id !== fileId); }); audit(id, 'file_remove', itemId, 'files', f && f.url, null); return f; });
b.serve('restoreFile', ({ actor: id, itemId, file }) => { const it = item(itemId); check(it); editor(id, it); mutate('items', itemId, (x) => { if (!x.files.some((y) => y.id === file.id)) x.files.push(file); }); });
b.serve('comment', ({ actor: id, itemId, text, mentions }) => {
  const it = item(itemId); check(it); editor(id, it); const bd = boardOfItem(it);
  text = (text || '').trim(); check(text.length >= 1 && text.length <= 4000, 'כתבו משהו');
  const c = { id: newId('cm'), itemId, author: id, text, mentions: mentions || [], at: now().toISOString(), editedAt: null, deletedAt: null };
  save('comments', [...comments(), c]);
  audit(id, 'comment', itemId, 'comment', null, text.slice(0, 80));
  const lnk = link(bd.id, it.parentId || it.id, `&panel=${it.id}&comment=${c.id}`);
  b.notify((mentions || []).filter((u) => u !== id), 'sunday.mention', `${(bus.read('users.get', id) || {}).name_he} תייג/ה אותך: ${it.name}`, lnk);
  b.notify(it.assignments.map((x) => x.uid).filter((u) => u !== id && !(mentions || []).includes(u)), 'sunday.comment', `עדכון חדש ב${it.name}`, lnk);
  db.update('seen', {}, (s) => { s[id] = { ...(s[id] || {}), [itemId]: c.at }; });
  return c.id;
});
b.serve('editComment', ({ actor: id, commentId, text }) => {
  const c = comments().find((x) => x.id === commentId); check(c && c.author === id); editor(id, item(c.itemId));
  text = (text || '').trim(); check(text.length >= 1, 'כתבו משהו');
  mutate('comments', commentId, (x) => { audit(id, 'comment_edit', c.itemId, 'comment', x.text.slice(0, 80), text.slice(0, 80)); x.text = text; x.editedAt = now().toISOString(); });
});
b.serve('deleteComment', ({ actor: id, commentId }) => {
  const c = comments().find((x) => x.id === commentId); check(c); const a = editor(id, item(c.itemId));
  check(c.author === id || isLeadPlus(a, boardOfItem(item(c.itemId))));
  mutate('comments', commentId, (x) => { x.deletedAt = now().toISOString(); }); audit(id, 'comment_delete', c.itemId, 'comment', c.text.slice(0, 80), null);
});
b.serve('restoreComment', ({ actor: id, commentId }) => { const c = comments().find((x) => x.id === commentId); check(c); mutate('comments', commentId, (x) => { x.deletedAt = null; }); });
b.serve('markSeen', ({ actor: id, itemId }) => { db.update('seen', {}, (s) => { s[id] = { ...(s[id] || {}), [itemId]: now().toISOString() }; }); });

// ---------- personal settings, filters ----------
b.serve('setSettings', ({ actor: id, patch }) => { actorFor(id, { allowReadOnly: true }); db.update('settings', {}, (s) => { s[id] = { ...(s[id] || {}), ...patch }; }); audit(id, 'setting', id, Object.keys(patch).join(','), null, patch); });
b.serve('saveFilter', ({ actor: id, filter }) => {
  actorFor(id, { allowReadOnly: true });
  const name = (filter.name || '').trim(); check(name.length >= 1 && name.length <= 30, 'חובה לתת שם');
  const list = bus.read('sunday.filters', id).filter((f) => f.id !== filter.id);
  const f = { id: filter.id || newId('flt'), name, statuses: filter.statuses || [], priorities: filter.priorities || [], due: filter.due || 'all', boards: filter.boards || [] };
  db.update('filters', {}, (x) => { x[id] = [...list, f]; });
  db.update('active_filter', {}, (x) => { x[id] = f.id; });
  return f.id;
});
b.serve('deleteFilter', ({ actor: id, filterId }) => { const list = bus.read('sunday.filters', id); const f = list.find((x) => x.id === filterId); db.update('filters', {}, (x) => { x[id] = list.filter((y) => y.id !== filterId); }); db.update('active_filter', {}, (x) => { if (x[id] === filterId) x[id] = null; }); return f; });
b.serve('restoreFilter', ({ actor: id, filter }) => { db.update('filters', {}, (x) => { x[id] = [...bus.read('sunday.filters', id), filter]; }); });
b.serve('setActiveFilter', ({ actor: id, filterId }) => db.update('active_filter', {}, (x) => { x[id] = filterId; }));

// ---------- clock: deadlines, inactive users, trash purge (C17, C18, C16) ----------
function scanInactive() {
  const notified = db.get('inactive_notified', {});
  const open = items().filter((it) => live(it) && it.status !== doneKey);
  const byUser = {};
  open.forEach((it) => it.assignments.forEach((x) => { if (inactive(x.uid)) (byUser[x.uid] = byUser[x.uid] || new Set()).add(boardOfItem(it)); }));
  Object.entries(byUser).forEach(([u, bds]) => {
    if (notified[u]) return;
    bds.forEach((bd) => { if (bd) b.notify(boardLeads(bd), 'sunday.inactive', `ל${(bus.read('users.get', u) || { name_he: 'משתמש/ת' }).name_he} (לא פעיל/ה) יש משימות פתוחות`, `/sunday/board/${bd.id}?person=${u}`); });
    notified[u] = true;
  });
  Object.keys(notified).forEach((u) => { if (!inactive(u)) delete notified[u]; });
  db.set('inactive_notified', { ...notified });
}
bus.on('clock.tick', () => {
  const s = bus.read('sunday.appSettings');
  const t = todayKey(), warn = addDaysKey(t, s.deadline_warning_days);
  const dn = db.get('deadline_notified', {});
  let changed = false;
  items().filter((it) => live(it) && it.dateEnd && it.status !== doneKey && it.assignments.length).forEach((it) => {
    const bd = boardOfItem(it); if (!bd || !live(bd)) return;
    const rec = dn[it.id] || {};
    const to = [...it.assignments.map((x) => x.uid), teamLead(bd)].filter(Boolean);
    if (it.dateEnd < t && !rec.passed) { b.notify([...new Set(to)], 'sunday.deadline', `תאריך היעד עבר: ${it.name}`, link(bd.id, it.parentId || it.id)); rec.passed = true; changed = true; }
    else if (it.dateEnd >= t && it.dateEnd <= warn && !rec.warn) { b.notify([...new Set(to)], 'sunday.deadline', `תאריך יעד ב-${fmtShort(it.dateEnd)}: ${it.name}`, link(bd.id, it.parentId || it.id)); rec.warn = true; changed = true; }
    dn[it.id] = rec;
  });
  if (changed) db.set('deadline_notified', { ...dn });
  // purge trash older than sunday.trash_days
  const cutoff = new Date(now().getTime() - s.trash_days * 86400000).toISOString();
  if (items().some((x) => x.deletedAt && x.deletedAt < cutoff)) save('items', items().filter((x) => !(x.deletedAt && x.deletedAt < cutoff)));
  if (groups().some((x) => x.deletedAt && x.deletedAt < cutoff)) save('groups', groups().filter((x) => !(x.deletedAt && x.deletedAt < cutoff)));
  if (boards().some((x) => x.deletedAt && x.deletedAt < cutoff)) save('boards', boards().filter((x) => !(x.deletedAt && x.deletedAt < cutoff)));
  const tc = db.get('trash_columns', []); if (tc.some((x) => x.deletedAt < cutoff)) save('trash_columns', tc.filter((x) => x.deletedAt >= cutoff));
});
bus.on('user.status_changed', () => scanInactive());
bus.on('user.role_changed', () => scanInactive());
bus.on('user.deleted', ({ uid }) => {
  save('comments', comments().filter((c) => c.author !== uid));
  ['filters', 'active_filter', 'settings', 'prefs', 'board_order', 'seen'].forEach((k) => db.update(k, {}, (o) => { delete o[uid]; }));
  // assignments/creator stay as anonymous traces ("משתמש שנמחק")
});
b.serve('seedInstall', () => { ['boards', 'groups', 'items', 'comments', 'trash_columns'].forEach((k) => save(k, [])); ['seen', 'filters', 'active_filter', 'settings', 'prefs', 'board_order', 'deadline_notified', 'inactive_notified'].forEach((k) => save(k, {})); });
