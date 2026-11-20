// Trainings (הכשרות) — categories → trees → milestones, requirements, approvals, force checks (04-trainings.txt).
import { bus } from '../../core/bus.js';
import { ns, files } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId, byHe } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check, ALUMNI_RO } from '../../core/errors.js';
import { ALL_ICONS } from './icons.js';

const b = bus.system('trainings', { announces: ['milestone.approved', 'milestone.unapproved', 'milestone.force_checked', 'milestone.force_unchecked', 'milestone.needs_reapproval', 'category.created', 'category.deleted'] });
const db = ns('trainings');
export const media = files('trainings');
export const DEFAULTS = { default_coins: 20, reminder_days: 7 };
export const STATE_HE = { locked: 'נעול', open: 'פתוח', submitted: 'נשלחה בקשה', approved: 'מאושר', rejected: 'נדחה', needs_reapproval: 'דרוש אישור מחדש' };

const settings = () => ({ ...DEFAULTS, ...db.get('settings', {}) });
const cats = () => db.get('categories', []).filter((c) => !c.deleted);
const trees = () => db.get('trees', []).filter((t) => !t.deleted);
const mss = () => db.get('milestones', []).filter((m) => !m.deleted);
const status = () => db.get('status', {});
const requests = () => db.get('requests', []);
const actor = (id) => bus.read('users.actor', id);
const cat = (id) => cats().find((c) => c.id === id);
const tree = (id) => trees().find((t) => t.id === id);
const ms = (id) => mss().find((m) => m.id === id);
const catOfMs = (m) => { const t = tree(m.treeId); return t ? cat(t.catId) : null; };

// ---------- access (3) ----------
function learner(a) { return !!a && !a.isMentor && (a.teamMember || a.alumni); }
function takesCategory(a, c) {
  if (!learner(a)) return false;
  if (c.kind === 'team') return a.team === c.teamId;
  return !!c.access && bus.read('users.matches', a.id, c.access, { includeAlumni: true });
}
function canTake(a, t) {
  if (!learner(a)) return false;
  const c = cat(t.catId); if (!c) return false;
  if (takesCategory(a, c)) return true;
  return !!t.access && bus.read('users.matches', a.id, t.access, { includeAlumni: true });
}
const viewAll = (a) => !!a && !a.alumni && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor);
function canView(a, t) { return viewAll(a) || canTake(a, t); }
function isEditorOfCat(a, c) {
  if (!a || a.readOnly) return false;
  if (a.isMentor || a.isCaptain || a.isAdmin) return true;
  return a.isLead && c.kind === 'team' && c.teamId === a.team;
}
function approversOf(c) {
  const all = bus.read('users.list', { statuses: ['active'] }).map((u) => actor(u.id));
  return all.filter((a) => a.isMentor || a.isCaptain || a.isAdmin || (c.kind === 'team' && a.isLead && a.team === c.teamId) || (c.approvers || []).includes(a.id)).map((a) => a.id);
}
function isApprover(a, c) { return !!a && !a.readOnly && approversOf(c).includes(a.id); }
function notifyApprovers(c, type, text, link, exclude) {
  const follow = db.get('follow', {});
  const ids = approversOf(c).filter((id) => id !== exclude && (!actor(id).isMentor || !follow[id] || follow[id].includes(c.id)));
  b.notify(ids, type, text, link);
}

// ---------- states (6.2, 6.3) ----------
const visibleForMembers = (m) => m && m.status === 'published';
function rec(uid, msId) { return (status()[uid] || {})[msId] || null; }
function countsAsMet(uid, msId) { const r = rec(uid, msId); return !!r && (r.submittedEver || r.s === 'approved'); }
function groupsMet(uid, m) {
  return (m.groups || []).every((g) => {
    const vis = g.ids.filter((id) => visibleForMembers(ms(id)));
    if (!vis.length) return true;
    const met = vis.filter((id) => countsAsMet(uid, id)).length;
    return g.mode === 'all' ? met === vis.length : met >= Math.min(g.n, vis.length);
  });
}
function stateOf(uid, msId) {
  const m = ms(msId); if (!m) return null;
  const r = rec(uid, msId);
  if (r && r.s) return r.s;
  return groupsMet(uid, m) ? 'open' : 'locked';
}
function setRec(uid, msId, patch) {
  const all = status();
  const mine = { ...(all[uid] || {}) };
  if (patch === null) delete mine[msId]; else mine[msId] = { ...(mine[msId] || {}), ...patch };
  db.set('status', { ...all, [uid]: mine });
}
function depthMap(treeId, { editor = false } = {}) {
  const list = mss().filter((m) => m.treeId === treeId && (editor || m.status === 'published'));
  const ids = new Set(list.map((m) => m.id));
  const memo = {};
  const d = (m, seen = new Set()) => {
    if (memo[m.id] != null) return memo[m.id];
    if (seen.has(m.id)) return 0;
    seen.add(m.id);
    const reqs = (m.groups || []).flatMap((g) => g.ids).filter((x) => ids.has(x));
    const v = reqs.length ? 1 + Math.max(...reqs.map((x) => d(ms(x), seen))) : 0;
    memo[m.id] = v; return v;
  };
  list.forEach((m) => d(m));
  return memo;
}
function wouldLoop(msId, groups) {
  const reqs = (ms2) => (ms2 === msId ? groups : (ms(ms2) || {}).groups || []).flatMap((g) => g.ids);
  const stack = [...reqs(msId)]; const seen = new Set();
  while (stack.length) { const x = stack.pop(); if (x === msId) return true; if (seen.has(x)) continue; seen.add(x); stack.push(...reqs(x)); }
  return false;
}

// ---------- read APIs ----------
b.share('settings', () => settings());
b.share('categories', () => cats().slice().sort((a, c) => a.order - c.order));
b.share('category', (id) => cat(id) || null);
b.share('categoryForTeam', (teamId) => cats().find((c) => c.kind === 'team' && c.teamId === teamId) || null);
b.share('trees', (catId) => trees().filter((t) => t.catId === catId).sort((a, c) => a.order - c.order));
b.share('tree', (id) => tree(id) || null);
b.share('milestones', (treeId, opts = {}) => mss().filter((m) => m.treeId === treeId && (opts.all || m.status === 'published')).sort((a, c) => a.order - c.order));
b.share('categoryMilestones', (catId) => mss().filter((m) => { const t = tree(m.treeId); return t && t.catId === catId; }));
b.share('milestone', (id) => ms(id) || null);
b.share('state', (uid, msId) => stateOf(uid, msId));
b.share('record', (uid, msId) => rec(uid, msId));
b.share('isApproved', (uid, msId) => { const r = rec(uid, msId); return !!r && r.s === 'approved'; });
b.share('approvedCount', (uid) => Object.entries(status()[uid] || {}).filter(([id, r]) => r.s === 'approved' && ms(id)).length);
b.share('approvedIds', (uid) => Object.entries(status()[uid] || {}).filter(([id, r]) => r.s === 'approved' && ms(id)).map(([id]) => id));
b.share('depths', (treeId, editor) => depthMap(treeId, { editor }));
b.share('groupsMet', (uid, msId) => { const m = ms(msId); return m ? groupsMet(uid, m) : false; });
b.share('canTake', (uid, treeId) => { const t = tree(treeId); return !!t && canTake(actor(uid), t); });
b.share('canView', (uid, treeId) => { const t = tree(treeId); return !!t && !t.hidden && canView(actor(uid), t) || (!!t && t.hidden && isEditorOfCat(actor(uid), cat(t.catId))); });
b.share('canStudy', (uid) => { const a = actor(uid); return learner(a) && trees().some((t) => !t.hidden && canTake(a, t)); });
b.share('takesCategory', (uid, catId) => { const c = cat(catId); return !!c && takesCategory(actor(uid), c); });
b.share('isEditor', (uid, catId) => { const c = cat(catId); return !!c && isEditorOfCat(actor(uid), c); });
b.share('isApprover', (uid, catId) => { const c = cat(catId); return !!c && isApprover(actor(uid), c); });
b.share('approversOf', (catId) => { const c = cat(catId); return c ? approversOf(c) : []; });
b.share('visibleCategories', (uid) => {
  const a = actor(uid);
  return cats().filter((c) => isEditorOfCat(a, c) || trees().some((t) => t.catId === c.id && !t.hidden && canView(a, t)) || (c.kind === 'team' && a && c.teamId === a.team))
    .sort((x, y) => (x.kind === 'team' && a && x.teamId === a.team ? -1 : 0) - (y.kind === 'team' && a && y.teamId === a.team ? -1 : 0) || (x.kind === 'special') - (y.kind === 'special') || x.order - y.order);
});
/** Open milestones the user can submit, own team category first (NeatSystem 4). */
b.share('openMilestones', (uid) => {
  const a = actor(uid); if (!learner(a) || a.readOnly) return [];
  const own = (m) => { const c = catOfMs(m); return c && c.kind === 'team' && c.teamId === a.team ? 0 : 1; };
  return mss().filter((m) => m.status === 'published' && (() => { const t = tree(m.treeId); return t && !t.hidden && canTake(a, t); })() && ['open', 'rejected', 'needs_reapproval'].includes(stateOf(uid, m.id)))
    .sort((x, y) => own(x) - own(y) || x.order - y.order);
});
b.share('requests', (filter = {}) => requests().filter((r) => (!filter.catId || r.catId === filter.catId) && (!filter.uid || r.uid === filter.uid) && (!filter.msId || r.msId === filter.msId) && (!filter.state || r.state === filter.state)).slice().reverse());
b.share('request', (id) => requests().find((r) => r.id === id) || null);
b.share('pendingFor', (uid) => { const a = actor(uid); if (!a) return 0; return requests().filter((r) => r.state === 'pending' && r.uid !== uid && cat(r.catId) && isApprover(a, cat(r.catId))).length; });
b.share('progress', (uid, msId) => ((db.get('progress', {})[uid] || {})[msId]) || { ticks: [], answers: {} });
b.share('iconLibrary', () => [...ALL_ICONS, ...db.get('icons', []).map((i) => ({ name: 'upl:' + i.id, kw: [i.name], group: 'שהועלו', url: i.dataUrl }))]);
b.share('uploadedIcon', (id) => db.get('icons', []).find((i) => i.id === id) || null);
b.share('follow', (uid) => db.get('follow', {})[uid] || null);
b.share('seen', (uid, msId) => (db.get('seen', {})[uid] || []).includes(msId));
b.share('learners', (treeId) => {
  const t = tree(treeId); if (!t) return [];
  return bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => canTake(actor(u.id), t)).map((u) => u.id);
});
b.share('lookup', (catName, msName) => { const c = cats().find((x) => x.name === catName); if (!c) return null; const m = mss().find((x) => x.name === msName && tree(x.treeId) && tree(x.treeId).catId === c.id); return m ? m.id : null; });
b.share('wouldLoop', (msId, groups) => wouldLoop(msId, groups));

// ---------- studying & requests (7, 8) ----------
b.serve('saveProgress', ({ actor: id, msId, ticks, answers }) => {
  const a = actorFor(id, { allowReadOnly: true }); if (a.readOnly) throw new AppError(ALUMNI_RO);
  const m = ms(msId); check(m && canTake(a, tree(m.treeId)));
  db.update('progress', {}, (p) => { p[id] = { ...(p[id] || {}), [msId]: { ticks: ticks || [], answers: answers || {} } }; });
});
b.serve('markSeen', ({ actor: id, msId }) => { db.update('seen', {}, (s) => { if (!(s[id] || []).includes(msId)) s[id] = [...(s[id] || []), msId]; }); });
b.serve('submit', ({ actor: id, msId }) => {
  const a = actorFor(id, { allowReadOnly: true }); if (a.readOnly) throw new AppError(ALUMNI_RO);
  const m = ms(msId); check(m && m.status === 'published', 'אבן הדרך לא זמינה');
  const t = tree(m.treeId); check(canTake(a, t) && !t.hidden, 'אין לך גישה לעץ הזה');
  const st = stateOf(id, msId);
  check(['open', 'rejected', 'needs_reapproval'].includes(st), st === 'locked' ? 'אבן הדרך נעולה' : 'כבר נשלחה בקשה');
  const pr = (db.get('progress', {})[id] || {})[msId] || { ticks: [], answers: {} };
  check((m.checklist || []).every((x) => pr.ticks.includes(x.id)), 'סמנו את כל התרגולים');
  check((m.exam || []).every((q) => (pr.answers[q.id] || '').trim()), 'ענו על כל השאלות');
  const c = cat(t.catId);
  const attempt = requests().filter((r) => r.uid === id && r.msId === msId).length + 1;
  const r = { id: newId('rq'), uid: id, msId, catId: c.id, treeId: t.id, attempt, ticks: pr.ticks, answers: pr.answers, at: now().toISOString(), state: 'pending', decidedBy: null, decidedAt: null, note: null, history: [] };
  db.update('requests', [], (l) => { l.push(r); });
  setRec(id, msId, { s: 'submitted', submittedEver: true, at: r.at, requestId: r.id });
  b.audit({ actor: id, action: 'request', target: id, field: msId, new: m.name });
  notifyApprovers(c, 'trainings.request', `בקשה חדשה: ${(bus.read('users.get', id) || {}).name_he} · ${m.name}`, `/trainings/requests?cat=${c.id}&req=${r.id}`, id);
  return r.id;
});
b.serve('decide', ({ actor: id, requestId, approve, note }) => {
  const a = actorFor(id);
  const r = requests().find((x) => x.id === requestId); check(!!r);
  const c = cat(r.catId); check(isApprover(a, c));
  check(r.uid !== id, 'אי אפשר לאשר בקשה של עצמך');
  if (r.state !== 'pending') throw new AppError(`כבר טופל על ידי ${(bus.read('users.get', r.decidedBy) || {}).name_he || 'מישהו אחר'}`);
  const m = ms(r.msId);
  if (!approve) { note = (note || '').trim(); check(note.length >= 2, 'חובה לכתוב הערה'); }
  db.update('requests', [], (l) => { const x = l.find((y) => y.id === requestId); Object.assign(x, { state: approve ? 'approved' : 'rejected', decidedBy: id, decidedAt: now().toISOString(), note: approve ? (note || null) : note }); x.history.push({ kind: approve ? 'approved' : 'rejected', by: id, at: now().toISOString(), note: note || null }); });
  setRec(r.uid, r.msId, { s: approve ? 'approved' : 'rejected', at: now().toISOString(), by: id, requestId, forced: false, note: approve ? null : note });
  b.audit({ actor: id, action: approve ? 'approve' : 'reject', target: r.uid, field: r.msId, new: m.name, reason: note });
  if (approve) b.emit('milestone.approved', { uid: r.uid, milestoneId: r.msId, requestId, coins: m.coins ?? settings().default_coins, name: m.name, approved_by: id });
  b.notify([r.uid], 'trainings.decision', approve ? `אושר: ${m.name}` : `נדחה: ${m.name} — ${note}`, `/trainings/ms/${r.msId}`);
});
b.serve('undo', ({ actor: id, requestId, note }) => {
  const a = actorFor(id);
  const r = requests().find((x) => x.id === requestId); check(r && (r.state === 'approved' || r.state === 'rejected') && !r.forced);
  check(r.decidedBy === id || a.isMentor, 'רק מי שהחליט/ה או מנטור/ית');
  note = (note || '').trim(); check(note.length >= 2, 'חובה לכתוב הערה');
  const was = r.state, decider = r.decidedBy;
  db.update('requests', [], (l) => { const x = l.find((y) => y.id === requestId); x.history.push({ kind: 'undone', by: id, at: now().toISOString(), note, was }); Object.assign(x, { state: 'pending', decidedBy: null, decidedAt: null, note: null }); });
  setRec(r.uid, r.msId, { s: 'submitted', by: null, forced: false });
  b.audit({ actor: id, action: 'undo', target: r.uid, field: r.msId, old: was, new: 'submitted', reason: note });
  if (was === 'approved') b.emit('milestone.unapproved', { uid: r.uid, milestoneId: r.msId, requestId, by: id });
  const m = ms(r.msId);
  b.notify([r.uid], 'trainings.undone', `ההחלטה על ${m.name} בוטלה: ${note}`, `/trainings/ms/${r.msId}`);
  if (decider && decider !== id) b.notify([decider], 'trainings.undone', `ההחלטה שלך על ${m.name} בוטלה: ${note}`, `/trainings/requests?cat=${r.catId}&req=${r.id}`);
});

// ---------- force check (9) ----------
b.serve('forceCheck', ({ actor: id, uid, msIds }) => {
  const a = actorFor(id);
  check(uid !== id, 'אי אפשר להוסיף הכשרה לעצמך');
  check(learner(actor(uid)), 'אפשר להוסיף הכשרות רק לחברי צוות');
  msIds.forEach((msId) => {
    const m = ms(msId); check(!!m);
    const c = catOfMs(m); check(isApprover(a, c));
    const prev = rec(uid, msId);
    if (prev && prev.s === 'approved') return;
    const pending = requests().find((r) => r.uid === uid && r.msId === msId && r.state === 'pending');
    if (pending) db.update('requests', [], (l) => { const x = l.find((y) => y.id === pending.id); Object.assign(x, { state: 'approved', forced: true, decidedBy: id, decidedAt: now().toISOString() }); x.history.push({ kind: 'forced', by: id, at: now().toISOString() }); });
    setRec(uid, msId, { s: 'approved', forced: true, forcedPrev: pending ? { ...prev, s: 'approved_closed' } : prev, at: now().toISOString(), by: id, submittedEver: prev ? !!prev.submittedEver : false });
    b.audit({ actor: id, action: 'force_check', target: uid, field: msId, new: m.name, reason: 'הוזן ידנית' });
    b.emit('milestone.force_checked', { uid, milestoneId: msId, by: id });
  });
});
b.serve('forceUncheck', ({ actor: id, uid, msId }) => {
  const a = actorFor(id);
  const m = ms(msId); check(!!m && isApprover(a, catOfMs(m)));
  const r = rec(uid, msId); check(r && r.forced, 'לא הוזן ידנית');
  const prev = r.forcedPrev;
  if (!prev || prev.s === 'approved_closed') setRec(uid, msId, null); else { setRec(uid, msId, null); setRec(uid, msId, { ...prev, forced: false, forcedPrev: null }); }
  b.audit({ actor: id, action: 'force_uncheck', target: uid, field: msId, old: 'approved', new: prev && prev.s !== 'approved_closed' ? prev.s : null, reason: 'הוזן ידנית — בוטל' });
  b.emit('milestone.force_unchecked', { uid, milestoneId: msId, by: id });
});

// ---------- content editing (4, 10) ----------
function editorFor(id, c) { const a = actorFor(id); check(isEditorOfCat(a, c)); return a; }
const hasAnyApproval = (msIds) => Object.values(status()).some((u) => msIds.some((id) => u[id] && (u[id].s === 'approved' || u[id].forced)));
const anyActivity = (msId) => Object.values(status()).some((u) => u[msId]);
b.serve('saveTree', ({ actor: id, catId, tree: t }) => {
  const c = cat(catId || (t.id && tree(t.id).catId)); check(!!c); editorFor(id, c);
  const name = (t.name || '').trim(); check(name.length >= 1 && name.length <= 40, 'שם עד 40 תווים');
  check(!t.desc || t.desc.length <= 280, 'תיאור עד 280 תווים');
  const list = db.get('trees', []);
  if (t.id) {
    const x = list.find((y) => y.id === t.id); check(!!x);
    if (JSON.stringify(x.access || null) !== JSON.stringify(t.access || null)) notifyAccessChange(x, t.access);
    b.audit({ actor: id, action: 'tree_edit', target: t.id, old: x.name, new: name });
    Object.assign(x, { name, icon: t.icon || x.icon, color: t.color || x.color, desc: t.desc || '', access: t.access === undefined ? x.access : t.access });
    db.set('trees', [...list]); return x.id;
  }
  const n = { id: newId('tr'), catId: c.id, name, icon: t.icon || 'star', color: t.color || 4, desc: t.desc || '', access: t.access || null, order: list.filter((x) => x.catId === c.id).length, hidden: false };
  db.set('trees', [...list, n]);
  b.audit({ actor: id, action: 'tree_create', target: n.id, new: name });
  return n.id;
});
function notifyAccessChange(t, next) {
  const before = new Set(bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => t.access && bus.read('users.matches', u.id, t.access, { includeAlumni: true })).map((u) => u.id));
  const after = new Set(bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => next && bus.read('users.matches', u.id, next, { includeAlumni: true })).map((u) => u.id));
  const added = [...after].filter((x) => !before.has(x)), removed = [...before].filter((x) => !after.has(x));
  b.notify(added, 'trainings.access', `קיבלת גישה לעץ ${t.name}`, `/trainings/tree/${t.id}`);
  b.notify(removed, 'trainings.access', `הגישה שלך לעץ ${t.name} הוסרה`, '/trainings');
}
b.serve('setTreeAccess', ({ actor: id, treeId, access }) => {
  const t = tree(treeId); check(!!t); editorFor(id, cat(t.catId));
  notifyAccessChange(t, access);
  db.update('trees', [], (l) => { l.find((x) => x.id === treeId).access = access; });
  b.audit({ actor: id, action: 'tree_access', target: treeId, new: access });
});
b.serve('hideTree', ({ actor: id, treeId, hidden }) => {
  const t = tree(treeId); check(!!t); editorFor(id, cat(t.catId));
  db.update('trees', [], (l) => { l.find((x) => x.id === treeId).hidden = !!hidden; });
  b.audit({ actor: id, action: hidden ? 'tree_hide' : 'tree_show', target: treeId });
});
b.serve('deleteTree', ({ actor: id, treeId }) => {
  const t = tree(treeId); check(!!t); editorFor(id, cat(t.catId));
  const ids = mss().filter((m) => m.treeId === treeId).map((m) => m.id);
  check(!hasAnyApproval(ids), 'יש בעץ אישורים — אפשר רק להסתיר אותו');
  db.update('trees', [], (l) => { l.find((x) => x.id === treeId).deleted = true; });
  db.update('milestones', [], (l) => l.forEach((m) => { if (m.treeId === treeId) m.deleted = true; }));
  b.audit({ actor: id, action: 'tree_delete', target: treeId, old: t.name });
});
b.serve('reorderTrees', ({ actor: id, catId, ids }) => { editorFor(id, cat(catId)); db.update('trees', [], (l) => ids.forEach((tid, i) => { const x = l.find((y) => y.id === tid); if (x) x.order = i; })); });

function cleanMs(m, t) {
  const name = (m.name || '').trim(); check(name.length >= 1 && name.length <= 60, 'שם עד 60 תווים');
  const desc = (m.desc || '').trim();
  check(desc.length <= 280, 'תיאור קצר עד 280 תווים');
  if (m.status === 'published' && !m.seeded) check(desc.length >= 1, 'חובה לכתוב תיאור קצר');
  check(!!m.icon, 'בחרו אייקון');
  const groups = (m.groups || []).map((g) => ({ id: g.id || newId('g'), mode: g.mode === 'atleast' ? 'atleast' : 'all', n: Math.max(1, Math.min(g.n || 1, g.ids.length || 1)), ids: g.ids.filter((x) => { const y = ms(x); return y && y.treeId === t.id && x !== m.id; }) })).filter((g) => g.ids.length);
  if (m.coins != null && m.coins !== '') check(Number.isInteger(Number(m.coins)) && Number(m.coins) >= 0, 'מטבעות לא תקינים');
  return { name, desc, icon: m.icon, color: m.color || t.color, blocks: m.blocks || [], checklist: (m.checklist || []).filter((x) => x.text && x.text.trim()), exam: (m.exam || []).filter((x) => x.text && x.text.trim()),
    coins: m.coins == null || m.coins === '' ? null : Number(m.coins), groups, status: m.status || 'draft' };
}
b.serve('saveMilestone', ({ actor: id, treeId, milestone: m, major }) => {
  const t = tree(treeId || (m.id && ms(m.id).treeId)); check(!!t); editorFor(id, cat(t.catId));
  const list = db.get('milestones', []);
  if (m.id) {
    const x = list.find((y) => y.id === m.id); check(!!x);
    const f = cleanMs({ ...x, ...m, seeded: x.seeded }, t);
    if (wouldLoop(x.id, f.groups)) throw new AppError('זה ייצור מעגל');
    Object.keys(f).forEach((k) => { if (JSON.stringify(x[k]) !== JSON.stringify(f[k])) b.audit({ actor: id, action: 'milestone_edit', target: x.id, field: k, old: k === 'blocks' ? '…' : x[k], new: k === 'blocks' ? '…' : f[k] }); });
    Object.assign(x, f);
    db.set('milestones', [...list]);
    if (major) majorChange(id, x);
    return x.id;
  }
  const f = cleanMs(m, t);
  const n = { id: newId('ms'), treeId: t.id, ...f, order: list.filter((y) => y.treeId === t.id).length, createdAt: now().toISOString(), createdBy: id };
  if (wouldLoop(n.id, n.groups)) throw new AppError('זה ייצור מעגל');
  db.set('milestones', [...list, n]);
  b.audit({ actor: id, action: 'milestone_create', target: n.id, new: n.name });
  return n.id;
});
function majorChange(by, m) {
  const affected = [];
  const all = status();
  Object.entries(all).forEach(([uid, recs]) => { const r = recs[m.id]; if (r && r.s === 'approved') { affected.push(uid); recs[m.id] = { ...r, s: 'needs_reapproval', forced: false }; } });
  db.set('status', { ...all });
  b.audit({ actor: by, action: 'major_change', target: m.id, new: m.name, reason: `${affected.length} חברים` });
  b.notify(affected, 'trainings.reapproval', `שינוי מהותי ב${m.name}: צריך לשלוח שוב`, `/trainings/ms/${m.id}`);
  b.emit('milestone.needs_reapproval', { milestoneId: m.id, uids: affected });
}
b.serve('setRequirements', ({ actor: id, msId, groups }) => {
  const m = ms(msId); check(!!m); const t = tree(m.treeId); editorFor(id, cat(t.catId));
  const f = cleanMs({ ...m, groups, seeded: true }, t);
  if (wouldLoop(msId, f.groups)) throw new AppError('זה ייצור מעגל');
  db.update('milestones', [], (l) => { l.find((x) => x.id === msId).groups = f.groups; });
  b.audit({ actor: id, action: 'requirements', target: msId, new: f.groups.map((g) => `${g.mode === 'all' ? 'כולן' : 'לפחות ' + g.n}: ${g.ids.length}`).join(' · ') });
});
b.serve('setMilestoneFlags', ({ actor: id, msId, color, status: st }) => {
  const m = ms(msId); check(!!m); editorFor(id, cat(tree(m.treeId).catId));
  db.update('milestones', [], (l) => { const x = l.find((y) => y.id === msId); if (color) x.color = color; if (st) { check(['draft', 'published', 'hidden'].includes(st)); x.status = st; } });
  b.audit({ actor: id, action: 'milestone_flags', target: msId, new: { color, status: st } });
});
b.serve('deleteMilestone', ({ actor: id, msId }) => {
  const m = ms(msId); check(!!m); editorFor(id, cat(tree(m.treeId).catId));
  check(!anyActivity(msId), 'מישהו כבר שלח או קיבל את אבן הדרך — אפשר רק להסתיר');
  db.update('milestones', [], (l) => { l.find((x) => x.id === msId).deleted = true; l.forEach((x) => { (x.groups || []).forEach((g) => { g.ids = g.ids.filter((y) => y !== msId); }); x.groups = (x.groups || []).filter((g) => g.ids.length); }); });
  b.audit({ actor: id, action: 'milestone_delete', target: msId, old: m.name });
});

// ---------- categories, approvers, access, icons, follow, settings (12) ----------
const mentor = (id) => { const a = actorFor(id); check(a.isMentor); return a; };
b.serve('createCategory', ({ actor: id, name, icon }) => {
  mentor(id);
  name = (name || '').trim(); check(name.length >= 1 && name.length <= 30, 'שם עד 30 תווים');
  const c = { id: newId('cat'), name, icon: icon || 'star', kind: 'special', teamId: null, access: null, order: cats().length, approvers: [] };
  db.set('categories', [...db.get('categories', []), c]);
  b.audit({ actor: id, action: 'category_create', target: c.id, new: name });
  b.emit('category.created', { category: c });
  return c.id;
});
b.serve('updateCategory', ({ actor: id, catId, name, icon }) => {
  mentor(id);
  db.update('categories', [], (l) => { const c = l.find((x) => x.id === catId); check(!!c); if (name) { check(name.trim().length <= 30, 'שם עד 30 תווים'); b.audit({ actor: id, action: 'category_rename', target: catId, old: c.name, new: name.trim() }); c.name = name.trim(); } if (icon) c.icon = icon; });
});
b.serve('deleteCategory', ({ actor: id, catId }) => {
  mentor(id);
  const ids = mss().filter((m) => { const t = tree(m.treeId); return t && t.catId === catId; }).map((m) => m.id);
  check(!hasAnyApproval(ids), 'יש בקטגוריה אישורים — אפשר רק להסתיר את העצים שלה');
  db.update('categories', [], (l) => { l.find((x) => x.id === catId).deleted = true; });
  b.audit({ actor: id, action: 'category_delete', target: catId });
  b.emit('category.deleted', { categoryId: catId });
});
b.serve('reorderCategories', ({ actor: id, ids }) => { mentor(id); db.update('categories', [], (l) => ids.forEach((cid, i) => { const x = l.find((y) => y.id === cid); if (x) x.order = i; })); });
b.serve('setCategoryAccess', ({ actor: id, catId, access }) => {
  const a = actorFor(id); check(a.isMentor || a.isCaptain || a.isAdmin);
  const c = cat(catId); check(c && c.kind === 'special');
  db.update('categories', [], (l) => { l.find((x) => x.id === catId).access = access; });
  b.audit({ actor: id, action: 'category_access', target: catId, new: access });
});
b.serve('setApprovers', ({ actor: id, catId, uids }) => {
  const a = actorFor(id); const c = cat(catId); check(!!c);
  check(a.isMentor || (a.isLead && c.kind === 'team' && c.teamId === a.team));
  const before = c.approvers || [];
  db.update('categories', [], (l) => { l.find((x) => x.id === catId).approvers = uids; });
  b.audit({ actor: id, action: 'approvers', target: catId, old: before, new: uids });
  b.notify(uids.filter((u) => !before.includes(u)), 'trainings.approver', `מונית לאישור בקשות ב${c.name}`, `/trainings/requests?cat=${catId}`);
  b.notify(before.filter((u) => !uids.includes(u)), 'trainings.approver', `הוסרת מאישור בקשות ב${c.name}`, '/trainings');
});
b.serve('setFollow', ({ actor: id, catIds }) => { mentor(id); db.update('follow', {}, (f) => { f[id] = catIds; }); b.audit({ actor: id, action: 'follow', target: id, new: catIds }); });
b.serve('uploadIcon', async ({ actor: id, file, name }) => {
  const a = actorFor(id); check(a.isLead || a.isCaptain || a.isAdmin || a.isMentor);
  check(['image/svg+xml', 'image/png'].includes(file.type), 'SVG או PNG בלבד'); check(file.size <= 200 * 1024, 'עד 200 KB');
  const dataUrl = await recolor(file);
  const ic = { id: newId('ic'), name: (name || file.name).slice(0, 30), dataUrl, by: id };
  db.update('icons', [], (l) => { l.push(ic); });
  b.audit({ actor: id, action: 'icon_upload', target: ic.id, new: ic.name });
  return 'upl:' + ic.id;
});
async function recolor(file) {
  const bmp = await createImageBitmap(file);
  const s = 96, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d'); const k = Math.min(s / bmp.width, s / bmp.height);
  ctx.drawImage(bmp, (s - bmp.width * k) / 2, (s - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s); // one colour; tinted with CSS mask
  return c.toDataURL('image/png');
}
b.serve('deleteIcon', ({ actor: id, iconId }) => {
  mentor(id);
  db.set('icons', db.get('icons', []).filter((i) => i.id !== iconId));
  db.update('milestones', [], (l) => l.forEach((m) => { if (m.icon === 'upl:' + iconId) m.icon = 'star'; }));
  b.audit({ actor: id, action: 'icon_delete', target: iconId });
});
b.serve('setSettings', ({ actor: id, patch }) => {
  mentor(id);
  const s = db.get('settings', {});
  Object.entries(patch).forEach(([k, v]) => { check(k in DEFAULTS && Number.isInteger(v) && v >= 0, 'ערך לא תקין'); b.audit({ actor: id, action: 'setting', field: 'trainings.' + k, old: settings()[k], new: v }); s[k] = v; });
  db.set('settings', { ...s });
});

// ---------- events ----------
bus.on('team.created', ({ team }) => {
  if (team.kind !== 'main' || cats().some((c) => c.teamId === team.id)) return;
  const c = { id: newId('cat'), name: team.name, icon: team.icon || 'users', kind: 'team', teamId: team.id, access: null, order: cats().length, approvers: [] };
  db.set('categories', [...db.get('categories', []), c]);
  b.emit('category.created', { category: c });
});
bus.on('team.renamed', ({ team }) => db.update('categories', [], (l) => { const c = l.find((x) => x.teamId === team.id); if (c) c.name = team.name; }));
bus.on('user.deleted', ({ uid }) => {
  ['status', 'progress', 'seen', 'follow'].forEach((k) => { const o = { ...db.get(k, {}) }; delete o[uid]; db.set(k, o); });
  db.set('requests', requests().filter((r) => r.uid !== uid).map((r) => (r.decidedBy === uid ? { ...r, decidedBy: null } : r)));
  db.update('categories', [], (l) => l.forEach((c) => { c.approvers = (c.approvers || []).filter((x) => x !== uid); }));
});
// weekly reminders (8)
bus.on('clock.tick', ({ now: n }) => {
  const days = settings().reminder_days; if (!days) return;
  const due = requests().filter((r) => r.state === 'pending' && (n - new Date(r.remindedAt || r.at)) / 86400000 >= days);
  if (!due.length) return;
  db.update('requests', [], (l) => due.forEach((d) => { l.find((x) => x.id === d.id).remindedAt = n.toISOString(); }));
  due.forEach((r) => { const c = cat(r.catId); const m = ms(r.msId); if (c && m) notifyApprovers(c, 'trainings.reminder', `תזכורת: ${(bus.read('users.get', r.uid) || {}).name_he} מחכה לאישור ${m.name}`, `/trainings/requests?cat=${c.id}&req=${r.id}`); });
});

// ---------- install seed (11) ----------
export const SEED_TRAININGS = {
  'בנייה': ['ברגים', 'אומים', 'חומרים', 'לקיחת מידות', 'מקדחים', 'זוויות', 'מפתחות', 'ניטים', 'מקדחה', 'מברגה', 'מסור ידני', 'שופין', 'ניטר', 'רצועת שיוף', 'מקדחת עמוד', 'משייף חשמלי', 'ניטר פנאומטי', 'דיסק ידני', 'ג\'יגסו', 'מסור שולחן', 'דרמל (שיוף)', 'דרמל (חיתוך)', 'מולטי-טול', 'מסור סרט', 'גריינדר', 'מנועים', 'תמסורות', 'דיסק שולחן (משונן)', 'ZK'],
  'תוכנה': ['🐕 Dog 🐕', 'Java basics', 'OOPs', 'Git', 'Cool For The Summer', 'Pheonix', 'אלקטרוניקה 101', 'הלחמה', 'הרובוט הראשון שלי', 'SOLID', 'Clean Code', 'Conventions', 'Design Patterns', 'Command Based', 'Command Compositions', 'Unit testing', 'אוטומציות', 'How java runs?', 'Autonomous Routines', 'PIDF', 'Vision', 'Code Reviewing', 'Swerve'],
  'שרטוט': ['Basic entities', 'Basic planes', 'Advanced entities', 'Smart dimension', 'Extrude boss', 'Edit sketch & Features', 'Sketch on face', 'Relations', 'Selected contours', 'Extrude Cut', 'From - property manager', 'Directions - property manager', 'Revolve', 'Fillete & Chamfer', 'Convert', 'Thin features', 'Basic Mates', 'Advanced Mates', 'ניווט', 'Fixed & Float', 'Insert Component', 'Mirror feature', 'Shell', 'Configurations', 'Plane creation', 'Loft & swept', 'Patterns', '3D Printing', 'Plastics Types', '2D blocks', 'Bodies - combine, save, delete, split', 'Alignment with sketch', 'Measure', 'Tolerances', 'Inserts', 'Mechanics', 'Electronics', 'Equations', 'תמסורות', 'Drawing', 'Gears', 'Pulleys & Belts', 'Strong Model', 'Master Sketch', 'Fully Master Assembly'],
  'CNC': ['שרטוט בסיסי', 'Setup תוכנתי', 'קביעת Feature', 'קביעת Operation', 'איפוס', 'קיבוע חלק', 'בדיקת g-code', 'הפעלת מכונה', 'אירועי בטיחות', 'תחזוקת מכונה', 'שחזור הרצה שנכשלה'],
};
b.serve('seedInstall', () => {
  const teams = bus.read('users.mainTeams');
  const colors = { 'בנייה': 13, 'תוכנה': 2, 'שרטוט': 5, 'CNC': 16 };
  const categories = [], treeList = [], msList = [];
  const add = (name, kind, teamId, icon, order) => {
    const c = { id: 'cat-' + (teamId || 'cnc'), name, icon, kind, teamId, access: null, order, approvers: [] };
    const t = { id: 'tree-' + (teamId || 'cnc'), catId: c.id, name, icon, color: colors[name], desc: '', access: null, order: 0, hidden: false };
    categories.push(c); treeList.push(t);
    SEED_TRAININGS[name].forEach((n, i) => msList.push({ id: `ms-${(teamId || 'cnc').replace('team-', '')}-${i + 1}`, treeId: t.id, name: n, icon: 'star', color: t.color, desc: '', blocks: [], checklist: [], exam: [], coins: null, groups: [], status: 'published', order: i, seeded: true, createdAt: now().toISOString(), createdBy: 'system' }));
  };
  ['team-build', 'team-software', 'team-cad'].forEach((tid, i) => { const t = teams.find((x) => x.id === tid); if (t) add(t.name, 'team', t.id, t.icon, i); });
  add('CNC', 'special', null, 'factory', 10);
  db.set('categories', categories); db.set('trees', treeList); db.set('milestones', msList);
  ['status', 'progress', 'seen', 'follow'].forEach((k) => db.set(k, {}));
  db.set('requests', []); db.set('icons', []); db.set('settings', { ...DEFAULTS });
});
