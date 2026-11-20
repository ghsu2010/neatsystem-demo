// Ranks (דרגות) — rank list, per-category ladders, computed ranks, rank-up history (05-ranks.txt).
// Reads Trainings and Users; changes neither.
import { bus } from '../../core/bus.js';
import { ns, files } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { check } from '../../core/errors.js';

const b = bus.system('ranks', { announces: ['rank.changed'] });
const db = ns('ranks');
export const badges = files('ranks');
export const GRADE_HE = { 9: 'ט\'', 10: 'י\'', 11: 'יא\'', 12: 'יב\'' };

const ranks = () => db.get('ranks', []).slice().sort((a, c) => a.order - c.order);
const ladders = () => db.get('ladders', {});
const computed = () => db.get('computed', {});
const actor = (id) => bus.read('users.actor', id);
const rankById = (id) => ranks().find((r) => r.id === id);
const badgeOf = (r) => (r ? { name: r.name, url: r.badge ? badges.url(r.badge) : null } : null);
const rule = (catId, rankId) => (ladders()[catId] || {})[rankId] || { ms: [], minGrade: null, mentorsOnly: false, notUsed: true };
const hasLadder = (catId) => !!ladders()[catId] && ranks().some((r) => !rule(catId, r.id).notUsed);
const liveMs = (ids) => ids.filter((id) => bus.read('trainings.milestone', id));

function ruleMet(uid, catId, r, a) {
  const ru = rule(catId, r.id);
  const okMs = liveMs(ru.ms).every((id) => bus.read('trainings.isApproved', uid, id));
  const g = a.grade && a.grade.n;
  const okGrade = !ru.minGrade || (g != null && g >= ru.minGrade && g <= 12);
  return { okMs, okGrade, ok: okMs && okGrade };
}
/** "כל דרגה דורשת את שלה ואת כל מה שלפניה" (Ranks 3) */
function compute(uid, catId) {
  const a = actor(uid);
  if (!a || !hasLadder(catId)) return null;
  const list = ranks().filter((r) => !rule(catId, r.id).notUsed);
  if (a.isMentor) { const mo = list.filter((r) => rule(catId, r.id).mentorsOnly); return mo.length ? mo[mo.length - 1].id : null; }
  if (a.noRole || (!a.teamMember && !a.alumni)) return null;
  let cur = null;
  for (const r of list) {
    if (rule(catId, r.id).mentorsOnly) break;
    if (ruleMet(uid, catId, r, a).ok) cur = r.id; else break;
  }
  return cur;
}
function nextInfo(uid, catId) {
  const a = actor(uid); if (!a || a.isMentor) return null;
  const list = ranks().filter((r) => !rule(catId, r.id).notUsed && !rule(catId, r.id).mentorsOnly);
  const cur = (computed()[uid] || {})[catId] ?? compute(uid, catId);
  const idx = cur ? list.findIndex((r) => r.id === cur) : -1;
  const next = list[idx + 1];
  if (!next) return { current: cur, next: null };
  // everything missing up to and including the next rank
  const missing = []; let gradeNeeded = null;
  list.slice(0, idx + 2).forEach((r) => { const ru = rule(catId, r.id); liveMs(ru.ms).forEach((id) => { if (!bus.read('trainings.isApproved', uid, id) && !missing.includes(id)) missing.push(id); });
    const g = a.grade && a.grade.n; if (ru.minGrade && !(g != null && g >= ru.minGrade && g <= 12)) gradeNeeded = Math.max(gradeNeeded || 0, ru.minGrade); });
  const req = liveMs(rule(catId, next.id).ms);
  return { current: cur, next: next.id, missing, gradeNeeded, have: req.filter((id) => bus.read('trainings.isApproved', uid, id)).length, need: req.length };
}
function recalc(uid, reason) {
  const a = actor(uid);
  if (!a || (a.alumni && a.readOnly)) return; // frozen (E7)
  const cats = bus.read('trainings.categories');
  const prev = computed()[uid] || {};
  const next = { ...prev };
  const order = (id) => (id ? ranks().findIndex((r) => r.id === id) : -1);
  cats.forEach((c) => {
    const n = compute(uid, c.id);
    const o = prev[c.id] ?? null;
    if (n === o) return;
    next[c.id] = n;
    const up = order(n) > order(o);
    db.update('history', [], (h) => { h.push({ id: newId('rh'), uid, catId: c.id, from: o, to: n, dir: up ? 'up' : 'down', at: now().toISOString(), reason }); });
    b.audit({ actor: 'system', action: up ? 'rank_up' : 'rank_down', target: uid, field: c.name, old: (rankById(o) || {}).name || null, new: (rankById(n) || {}).name || null, reason });
    b.emit('rank.changed', { uid, category: c.id, old: o, new: n, dir: up ? 'up' : 'down' });
    if (up && n && !a.isMentor) {
      const rn = rankById(n).name;
      db.update('celebrations', {}, (cel) => { cel[uid] = [...(cel[uid] || []).filter((x) => x.catId !== c.id), { id: newId('cel'), rankId: n, catId: c.id }]; });
      b.notify([uid], 'ranks.rankup', `עלית דרגה! עכשיו את/ה ${rn} ב${c.name}`, '/trainings?cat=' + c.id);
      const name = (bus.read('users.get', uid) || {}).name_he;
      const to = c.kind === 'team' ? [bus.read('users.leadOf', c.teamId)].filter(Boolean) : bus.read('trainings.approversOf', c.id);
      b.notify(to.filter((x) => x !== uid), 'ranks.rankup', `${name} עלה/תה ל${rn} ב${c.name}`, '/profile/' + uid);
    }
  });
  db.set('computed', { ...computed(), [uid]: next });
}
const everyone = () => bus.read('users.list', { statuses: ['active', 'alumni'] }).map((u) => u.id);
function recalcAll(reason) { everyone().forEach((u) => recalc(u, reason)); }

// ---------- read APIs ----------
b.share('ranks', () => ranks().map((r) => ({ ...r, badgeUrl: r.badge ? badges.url(r.badge) : null })));
b.share('ladder', (catId) => ladders()[catId] || null);
b.share('rule', (catId, rankId) => rule(catId, rankId));
b.share('hasLadder', (catId) => hasLadder(catId));
b.share('rank', (uid, catId) => (computed()[uid] || {})[catId] ?? null);
b.share('badge', (rankId) => badgeOf(rankById(rankId)));
b.share('teamRankBadge', (uid) => {
  const a = actor(uid); if (!a) return null;
  let catId = null;
  if (a.isMentor) { const c = bus.read('trainings.categories').find((x) => hasLadder(x.id)); catId = c && c.id; }
  else if (a.team) { const c = bus.read('trainings.categoryForTeam', a.team); catId = c && c.id; }
  if (!catId) return null;
  return badgeOf(rankById((computed()[uid] || {})[catId]));
});
b.share('next', (uid, catId) => nextInfo(uid, catId));
b.share('profileRows', (uid) => {
  const a = actor(uid); if (!a) return [];
  const own = a.team && bus.read('trainings.categoryForTeam', a.team);
  return bus.read('trainings.categories').filter((c) => hasLadder(c.id)).map((c) => {
    const rid = (computed()[uid] || {})[c.id] ?? null;
    const n = nextInfo(uid, c.id);
    const anyProgress = bus.read('trainings.categoryMilestones', c.id).some((m) => bus.read('trainings.isApproved', uid, m.id));
    return { catId: c.id, catName: c.name, rankId: rid, badge: badgeOf(rankById(rid)), next: n, own: own && own.id === c.id, show: !!rid || anyProgress };
  }).filter((r) => r.show || a.isMentor).sort((x, y) => (y.own ? 1 : 0) - (x.own ? 1 : 0));
});
b.share('pendingCelebration', (uid) => {
  const c = (db.get('celebrations', {})[uid] || [])[0]; if (!c) return null;
  const r = rankById(c.rankId); const cat = bus.read('trainings.category', c.catId);
  if (!r || !cat) return null;
  return { id: c.id, rankName: r.name, categoryName: cat.name, badge: badgeOf(r) };
});
b.share('history', (uid) => db.get('history', []).filter((h) => h.uid === uid).slice().reverse());
b.share('canEditLadder', (uid, catId) => { const a = actor(uid); const c = bus.read('trainings.category', catId); return !!a && !!c && !a.readOnly && (a.isMentor || (a.isLead && c.kind === 'team' && c.teamId === a.team)); });

// ---------- writes ----------
b.serve('ackCelebration', ({ actor: id, id: celId }) => db.update('celebrations', {}, (c) => { c[id] = (c[id] || []).filter((x) => x.id !== celId); }));
const mentor = (id) => { const a = actorFor(id); check(a.isMentor); };
b.serve('saveRank', ({ actor: id, rankId, name }) => {
  mentor(id); name = (name || '').trim(); check(name.length >= 1 && name.length <= 20, 'שם עד 20 תווים');
  if (rankId) { db.update('ranks', [], (l) => { const r = l.find((x) => x.id === rankId); b.audit({ actor: id, action: 'rank_rename', target: rankId, old: r.name, new: name }); r.name = name; }); return rankId; }
  const r = { id: newId('rk'), name, badge: null, order: ranks().length };
  db.update('ranks', [], (l) => { l.push(r); });
  b.audit({ actor: id, action: 'rank_add', target: r.id, new: name });
  return r.id;
});
b.serve('reorderRanks', ({ actor: id, ids }) => { mentor(id); db.update('ranks', [], (l) => ids.forEach((rid, i) => { l.find((x) => x.id === rid).order = i; })); b.audit({ actor: id, action: 'rank_reorder', new: ids.map((x) => rankById(x).name).join(' · ') }); recalcAll('סדר הדרגות השתנה'); });
b.serve('deleteRank', ({ actor: id, rankId }) => {
  mentor(id);
  const r = rankById(rankId); check(!!r);
  db.set('ranks', db.get('ranks', []).filter((x) => x.id !== rankId));
  db.update('ladders', {}, (L) => Object.values(L).forEach((lad) => { delete lad[rankId]; }));
  db.update('computed', {}, (C) => Object.values(C).forEach((m) => Object.keys(m).forEach((k) => { if (m[k] === rankId) m[k] = null; })));
  b.audit({ actor: id, action: 'rank_delete', target: rankId, old: r.name });
  recalcAll(`הדרגה ${r.name} נמחקה`);
});
b.serve('setBadge', async ({ actor: id, rankId, file }) => {
  mentor(id);
  check(['image/png', 'image/svg+xml'].includes(file.type), 'PNG או SVG'); check(file.size <= 300 * 1024, 'עד 300 KB');
  const fid = await badges.put(file);
  db.update('ranks', [], (l) => { const r = l.find((x) => x.id === rankId); if (r.badge) badges.del(r.badge); r.badge = fid; });
  b.audit({ actor: id, action: 'rank_badge', target: rankId, new: file.name });
});
b.serve('setRule', ({ actor: id, catId, rankId, patch }) => {
  const a = actorFor(id);
  const c = bus.read('trainings.category', catId); check(!!c);
  check(a.isMentor || (a.isLead && c.kind === 'team' && c.teamId === a.team));
  if (patch.ms) patch.ms = patch.ms.filter((m) => { const x = bus.read('trainings.milestone', m); return x && bus.read('trainings.tree', x.treeId).catId === catId; });
  if ('minGrade' in patch) check(patch.minGrade == null || [9, 10, 11, 12].includes(patch.minGrade));
  db.update('ladders', {}, (L) => {
    const lad = L[catId] || Object.fromEntries(ranks().map((r) => [r.id, { ms: [], minGrade: null, mentorsOnly: false, notUsed: true }]));
    lad[rankId] = { ...(lad[rankId] || { ms: [], minGrade: null, mentorsOnly: false, notUsed: true }), ...patch };
    L[catId] = lad;
  });
  b.audit({ actor: id, action: 'rule_change', target: catId, field: (rankById(rankId) || {}).name, new: patch });
  recalcAll(`כלל הדרגה ${(rankById(rankId) || {}).name} ב${c.name} השתנה`);
});

// ---------- events → recalculation (Ranks 4) ----------
['milestone.approved', 'milestone.unapproved', 'milestone.force_checked', 'milestone.force_unchecked'].forEach((ev) => bus.on(ev, ({ uid }) => recalc(uid, ev.replace('milestone.', ''))));
bus.on('milestone.needs_reapproval', ({ uids }) => (uids || []).forEach((u) => recalc(u, 'needs_reapproval')));
bus.on('user.updated', ({ uid, fields }) => { if ((fields || []).some((f) => f === 'graduation_year' || f === 'grade')) recalc(uid, 'שכבה'); });
bus.on('user.team_changed', ({ uid }) => recalc(uid, 'צוות'));
bus.on('user.role_changed', ({ uid }) => recalc(uid, 'תפקיד'));
bus.on('user.status_changed', ({ uid }) => recalc(uid, 'סטטוס'));
bus.on('user.activated', ({ uid }) => recalc(uid, 'הצטרפות'));
bus.on('category.deleted', ({ categoryId }) => db.update('ladders', {}, (L) => { delete L[categoryId]; }));
bus.on('user.deleted', ({ uid }) => {
  ['computed', 'celebrations'].forEach((k) => db.update(k, {}, (o) => { delete o[uid]; }));
  db.set('history', db.get('history', []).filter((h) => h.uid !== uid));
});

// ---------- install seed (Ranks 9) ----------
const SEED = {
  'בנייה': [['ברגים', 'אומים', 'חומרים', 'לקיחת מידות', 'מקדחים', 'זוויות', 'מפתחות', 'ניטים'], ['מקדחה', 'מברגה', 'מסור ידני', 'שופין', 'ניטר', 'רצועת שיוף'], ['מקדחת עמוד', 'משייף חשמלי', 'ניטר פנאומטי', 'דיסק ידני', 'ג\'יגסו', 'מסור שולחן'], ['דרמל (שיוף)', 'דרמל (חיתוך)', 'מולטי-טול', 'מסור סרט', 'גריינדר'], ['מנועים', 'תמסורות', 'דיסק שולחן (משונן)'], ['ZK'], []],
  'תוכנה': [['🐕 Dog 🐕', 'Java basics', 'OOPs', 'Git', 'Cool For The Summer'], ['Pheonix', 'אלקטרוניקה 101', 'הלחמה', 'הרובוט הראשון שלי'], ['SOLID', 'Clean Code', 'Conventions', 'Design Patterns'], ['Command Based', 'Command Compositions', 'Unit testing'], ['אוטומציות', 'How java runs?', 'Autonomous Routines'], ['PIDF', 'Vision', 'Code Reviewing'], ['Swerve']],
  'שרטוט': [['Basic entities', 'Basic planes', 'Advanced entities', 'Smart dimension', 'Extrude boss', 'Edit sketch & Features', 'Sketch on face', 'Relations', 'Selected contours', 'Extrude Cut'], ['From - property manager', 'Directions - property manager', 'Revolve', 'Fillete & Chamfer', 'Convert', 'Thin features', 'Basic Mates', 'Advanced Mates', 'ניווט', 'Fixed & Float', 'Insert Component', 'Mirror feature'], ['Shell', 'Configurations', 'Plane creation', 'Loft & swept', 'Patterns', '3D Printing', 'Plastics Types'], ['2D blocks', 'Bodies - combine, save, delete, split', 'Alignment with sketch', 'Measure', 'Tolerances', 'Inserts', 'Mechanics', 'Electronics', 'Equations', 'תמסורות'], ['Drawing', 'Gears', 'Pulleys & Belts', 'Strong Model', 'Master Sketch'], ['Fully Master Assembly'], []],
  'CNC': [['שרטוט בסיסי', 'Setup תוכנתי', 'קביעת Feature', 'קביעת Operation'], ['איפוס', 'קיבוע חלק', 'בדיקת g-code', 'הפעלת מכונה'], ['אירועי בטיחות', 'תחזוקת מכונה'], ['שחזור הרצה שנכשלה'], [], [], []],
};
b.serve('seedInstall', () => {
  const names = ['ניט', 'ניטר', 'ניטולוג', 'ניטפרו', 'ניטפריים', 'ניטאליט', 'ניטמאסטר', 'ניטמנטור'];
  const rs = names.map((n, i) => ({ id: 'rk-' + (i + 1), name: n, badge: null, order: i }));
  db.set('ranks', rs);
  const grades = { 4: 10, 5: 11, 6: 12 };
  const L = {};
  bus.read('trainings.categories').forEach((c) => {
    const spec = SEED[c.name]; if (!spec) return;
    L[c.id] = {};
    rs.forEach((r, i) => {
      if (i === 7) L[c.id][r.id] = { ms: [], minGrade: null, mentorsOnly: true, notUsed: false };
      else L[c.id][r.id] = { ms: spec[i].map((n) => bus.read('trainings.lookup', c.name, n)).filter(Boolean), minGrade: grades[i] || null, mentorsOnly: false, notUsed: false };
    });
  });
  db.set('ladders', L); db.set('computed', {}); db.set('history', []); db.set('celebrations', {});
});
