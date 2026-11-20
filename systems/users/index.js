// Users — system of record for who people are (01-users.txt).
// Owns: user records, teams and sub-teams, sign-up/approval, graduation, deletion, role limits.
import { bus } from '../../core/bus.js';
import { ns, files } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId, byHe, ageOn } from '../../core/format.js';
import { FIXED, tintVars, PRESETS, mix, fitText } from '../../core/color.js';
import { actorFor } from '../../core/guard.js';
import { AppError, deny, check, assertOnline } from '../../core/errors.js';

const b = bus.system('users', {
  announces: ['user.activated', 'user.updated', 'user.team_changed', 'user.role_changed', 'user.status_changed', 'user.deleted',
    'team.created', 'team.renamed', 'team.archived'],
});
const db = ns('users');
const pics = files('users');

// Deployment config: emails that become Mentors on first sign-in (Users 3.1). Empty in the demo.
export const FIRST_MENTOR_EMAILS = [];

export const ROLE_HE = { member: 'חבר צוות', lead: 'רש"צ', captain: 'קפטן', mentor: 'מנטור' };

const users = () => db.get('users', {});
const teams = () => db.get('teams', []);
const settings = () => db.get('settings', { leads_per_team: 1, captains: 2 });
const saveUsers = (u) => db.set('users', u);

// ---------- helpers ----------
function endYear(d = now()) { return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); }
export function gradeOf(u, at = now()) {
  if (!u) return null;
  if (u.status === 'alumni') return { n: null, label: 'בוגר/ת' };
  if (!u.graduation_year) return null;
  const g = 12 - (u.graduation_year - endYear(at));
  if (g > 12) return { n: 13, label: 'בוגר/ת' };
  if (g < 9) return { n: g, label: 'חטיבה' };
  return { n: g, label: { 9: 'ט\'', 10: 'י\'', 11: 'יא\'', 12: 'יב\'' }[g] };
}
function publicUser(u) {
  if (!u) return null;
  const { phone, ...rest } = u;
  return { ...rest, grade: gradeOf(u), age: u.date_of_birth ? ageOn(u.date_of_birth, now()) : null };
}
function actorInfo(u) {
  if (!u) return null;
  const alumni = u.status === 'alumni';
  const readOnly = alumni && !u.alumni_active;
  const role = alumni ? 'member' : u.role || null;
  const active = u.status === 'active';
  return {
    id: u.id, name: u.name_he, status: u.status, role,
    isMentor: active && role === 'mentor',
    isAdmin: active && !!u.is_admin,
    isCaptain: active && role === 'captain',
    isLead: active && role === 'lead',
    isMember: role === 'member' && (active || (alumni && u.alumni_active)),
    team: u.main_team || null, subTeams: u.sub_teams || [],
    noRole: active && !role,
    alumni, alumniActive: alumni && !!u.alumni_active, readOnly,
    // "has a team role": Member, Lead or Captain with a team (or an active alumnus) — earns coins, appears in lists
    teamMember: (active && ['member', 'lead', 'captain'].includes(role) && !!u.main_team) || (alumni && !!u.alumni_active),
    grade: gradeOf(u),
  };
}
const nameOk = (s) => /^[֐-׿\s\-'׳"]{2,40}$/.test((s || '').trim()) && (s || '').trim().length >= 2;
const dobOk = (d) => { if (!d) return false; const a = ageOn(d, now()); return a >= 10 && a <= 99; };
const phoneOk = (p) => !p || /^05\d-?\d{7}$/.test(p.replace(/\s/g, ''));
export { nameOk, dobOk, phoneOk };

function audit(actor, action, target, field, oldV, newV, reason) {
  b.audit({ actor, action, target, field, old: oldV, new: newV, reason });
}
function approvers() { return Object.values(users()).filter((u) => u.status === 'active' && (u.is_admin || u.role === 'mentor')).map((u) => u.id); }
function activeMentors() { return Object.values(users()).filter((u) => u.status === 'active' && u.role === 'mentor'); }
function canManage(a) { return a.isAdmin || a.isMentor; }

/** Does a user match a selector {all, users, teams, subteams, roles}? (people-search helper) */
function matches(uidOrUser, sel, { includeAlumni = false } = {}) {
  const u = typeof uidOrUser === 'string' ? users()[uidOrUser] : uidOrUser;
  if (!u) return false;
  if (u.status === 'pending') return false;
  if (u.status === 'alumni' && !includeAlumni && !(sel && (sel.users || []).includes(u.id))) return false;
  if (!sel) return true;
  if (sel.all) return u.status === 'active' ? true : includeAlumni;
  if ((sel.users || []).includes(u.id)) return true;
  if (u.main_team && (sel.teams || []).includes(u.main_team)) return true;
  if ((u.sub_teams || []).some((t) => (sel.subteams || []).includes(t))) return true;
  const a = actorInfo(u);
  const roles = sel.roles || [];
  if (roles.includes('admin') && a.isAdmin) return true;
  if (roles.includes(u.status === 'alumni' ? 'member' : u.role)) return true;
  return false;
}

// ---------- read APIs (Users "Shares") ----------
b.share('currentId', () => (db.get('session', null) || {}).uid || null);
b.share('current', () => publicUser(users()[(db.get('session', null) || {}).uid]));
b.share('session', () => db.get('session', null));
b.share('get', (id) => publicUser(users()[id]));
b.share('list', ({ statuses = ['active'], team } = {}) => Object.values(users())
  .filter((u) => statuses.includes(u.status) && (!team || u.main_team === team)).map(publicUser).sort((a, c) => byHe(a.name_he, c.name_he)));
b.share('actor', (id) => actorInfo(users()[id]));
b.share('phone', (viewerId, targetId) => {
  const v = actorInfo(users()[viewerId]); const t = users()[targetId];
  if (!v || !t) return null;
  if (viewerId === targetId || v.isLead || v.isCaptain || v.isAdmin || v.isMentor) return t.phone || '';
  return null;
});
b.share('teams', () => teams());
b.share('team', (id) => teams().find((t) => t.id === id) || null);
b.share('mainTeams', () => teams().filter((t) => t.kind === 'main' && !t.archived));
b.share('teamTint', (id) => {
  const t = teams().find((x) => x.id === id);
  if (!t) return tintVars('fx:slate');
  if (t.tint && t.tint.startsWith('fx:')) return tintVars(t.tint);
  return tintVars(t.tint || 'p:14');
});
b.share('teamIcon', (id) => (teams().find((t) => t.id === id) || {}).icon || null);
b.share('grade', (id) => gradeOf(users()[id]));
b.share('matches', (id, sel, opts) => matches(id, sel, opts));
b.share('resolve', (sel, opts) => Object.values(users()).filter((u) => matches(u, sel, opts)).map((u) => u.id));
b.share('search', ({ ids, teams: ts, subteams, roles, statuses = ['active'] } = {}) => Object.values(users())
  .filter((u) => statuses.includes(u.status) && (!ids || ids.includes(u.id)) && (!ts || ts.includes(u.main_team))
    && (!subteams || (u.sub_teams || []).some((s) => subteams.includes(s))) && (!roles || roles.includes(u.role)))
  .map((u) => u.id));
b.share('pictureUrl', (id) => { const u = users()[id]; if (!u || !u.picture) return null; return u.picture.startsWith('idb:') ? pics.url(u.picture.slice(4)) : u.picture; });
b.share('pendingCount', () => Object.values(users()).filter((u) => u.status === 'pending').length);
b.share('settings', () => settings());
b.share('leadOf', (teamId) => { const u = Object.values(users()).find((x) => x.status === 'active' && x.role === 'lead' && x.main_team === teamId); return u ? u.id : null; });
b.share('approvers', () => approvers());
b.share('roleLabel', (id) => { const u = users()[id]; if (!u) return ''; return ROLE_HE[u.role] || ''; });
b.share('canManage', (id) => { const a = actorInfo(users()[id]); return !!a && (a.isAdmin || a.isMentor); });

// ---------- sign-in (Google in production; "כניסה כ…" in the demo) ----------
function startSession(uidOrNull, google) {
  db.set('session', { uid: uidOrNull, google: google || null, at: now().toISOString() });
}
/** Google sign-in result. Existing account → session; first Mentor emails → Mentor; else welcome form. */
b.serve('signInGoogle', ({ email, google_name, device }) => {
  assertOnline();
  email = (email || '').trim().toLowerCase();
  if (!email) throw new AppError('ההתחברות נכשלה — נסו שוב');
  const u = Object.values(users()).find((x) => x.google_email === email);
  if (u) { startSession(u.id); audit(u.id, 'sign_in', u.id, 'device', null, device || 'web'); return { uid: u.id }; }
  if (FIRST_MENTOR_EMAILS.includes(email)) {
    const id = newId('u');
    const rec = blank(id, email, google_name);
    Object.assign(rec, { status: 'active', role: 'mentor', name_he: google_name, approved_at: now().toISOString() });
    saveUsers({ ...users(), [id]: rec });
    startSession(id); b.emit('user.activated', { uid: id }); audit(id, 'first_mentor', id);
    return { uid: id };
  }
  startSession(null, { email, google_name });
  return { uid: null };
});
b.serve('signInAs', ({ uid }) => { const u = users()[uid]; check(u); startSession(uid); audit(uid, 'sign_in', uid, 'device', null, 'demo'); return true; });
b.serve('signOut', () => { db.set('session', null); return true; });

function blank(id, email, google_name) {
  return {
    id, google_email: email, google_name: google_name || email, name_he: '', date_of_birth: null, phone: '', picture: null,
    status: 'pending', alumni_active: false, main_team: null, sub_teams: [], role: null, is_admin: false, graduation_year: null,
    favorite_feature: '', team_history: [], created_at: now().toISOString(), approved_at: null, approved_by: null, graduated_at: null,
  };
}
/** Welcome form (Users 3.2): creates the pending account. */
b.serve('submitWelcome', ({ name_he, date_of_birth }) => {
  assertOnline();
  const s = db.get('session', null);
  check(s && s.google && !s.uid);
  check(nameOk(name_he), 'שם מלא בעברית, 2–40 אותיות');
  check(dobOk(date_of_birth), 'הגיל חייב להיות בין 10 ל-99');
  const id = newId('u');
  const rec = blank(id, s.google.email, s.google.google_name);
  rec.name_he = name_he.trim(); rec.date_of_birth = date_of_birth;
  saveUsers({ ...users(), [id]: rec });
  startSession(id);
  audit(id, 'sign_up', id, null, null, rec.name_he);
  b.notify(approvers(), 'users.signup', `בקשת הצטרפות חדשה: ${rec.name_he}`, '/manage/home/users/approvals');
  return id;
});
b.serve('updatePending', ({ actor, name_he, date_of_birth }) => {
  assertOnline();
  const u = users()[actor]; check(u && u.status === 'pending');
  check(nameOk(name_he), 'שם מלא בעברית, 2–40 אותיות'); check(dobOk(date_of_birth), 'הגיל חייב להיות בין 10 ל-99');
  audit(actor, 'update_pending', actor, 'name/dob', `${u.name_he} ${u.date_of_birth}`, `${name_he} ${date_of_birth}`);
  u.name_he = name_he.trim(); u.date_of_birth = date_of_birth; saveUsers({ ...users() });
});

// ---------- approval (Users 3.3) ----------
function countRole(role, teamId, exceptId) {
  return Object.values(users()).filter((u) => u.status === 'active' && u.role === role && u.id !== exceptId && (!teamId || u.main_team === teamId));
}
/** Returns the holders that block promotion to role (lead per team / captains), or [] */
function limitHolders(role, teamId, exceptId) {
  const s = settings();
  if (role === 'lead') { const h = countRole('lead', teamId, exceptId); return h.length >= s.leads_per_team ? h : []; }
  if (role === 'captain') { const h = countRole('captain', null, exceptId); return h.length >= s.captains ? h : []; }
  return [];
}
b.share('limitHolders', (role, teamId, exceptId) => limitHolders(role, teamId, exceptId).map((u) => u.id));

b.serve('approve', ({ actor, uid, team, role, sub_teams = [], graduation_year, name_he, date_of_birth, swap }) => {
  const a = actorFor(actor);
  check(canManage(a));
  const u = users()[uid];
  if (!u) throw new AppError('הבקשה כבר טופלה');
  if (u.status !== 'pending') throw new AppError(`הבקשה כבר טופלה על ידי ${(users()[u.approved_by] || {}).name_he || 'מישהו אחר'}`);
  check(nameOk(name_he), 'שם מלא בעברית, 2–40 אותיות'); check(dobOk(date_of_birth), 'הגיל חייב להיות בין 10 ל-99');
  if (role === 'mentor') { check(a.isMentor); team = null; sub_teams = sub_teams || []; graduation_year = null; }
  else if (team) {
    role = role || 'member';
    check(['member', 'lead', 'captain'].includes(role));
    const y = endYear() - 1 + (now().getMonth() >= 8 ? 1 : 0);
    const cy = now().getFullYear();
    check(graduation_year >= cy && graduation_year <= cy + 6, 'שנת סיום לא תקינה');
    const blockers = limitHolders(role, team, uid);
    if (blockers.length && !swap) return { needSwap: blockers.map((x) => x.id) };
    blockers.forEach((x) => { const old = x.role; x.role = 'member'; audit(actor, 'role_swap', x.id, 'role', old, 'member'); b.emit('user.role_changed', { uid: x.id, role: 'member', is_admin: x.is_admin, old }); });
  } else { role = null; graduation_year = null; }
  Object.assign(u, {
    name_he: name_he.trim(), date_of_birth, main_team: team || null, sub_teams, role: role || null, graduation_year: graduation_year || null,
    status: 'active', approved_at: now().toISOString(), approved_by: actor,
  });
  if (team) u.team_history.push({ team, from: now().toISOString(), to: null });
  saveUsers({ ...users() });
  audit(actor, 'approve', uid, 'status', 'pending', 'active');
  b.notify([uid], 'users.account', 'החשבון שלך אושר', '/home', { email: 'locked' });
  b.emit('user.activated', { uid });
  if (team) b.emit('user.team_changed', { uid, old: null, team });
  b.emit('user.role_changed', { uid, role: u.role, is_admin: false, old: null });
  return { ok: true };
});
b.serve('reject', ({ actor, uid }) => {
  const a = actorFor(actor); check(canManage(a));
  const u = users()[uid];
  if (!u || u.status !== 'pending') throw new AppError('הבקשה כבר טופלה על ידי מישהו אחר');
  const all = { ...users() }; delete all[uid]; saveUsers(all);
  audit(actor, 'reject', uid, 'status', 'pending', null, u.google_email);
  b.ask('notifications.email', { to: u.google_email, subject: 'הבקשה נדחתה', text: 'הבקשה נדחתה' });
  return true;
});

// ---------- editing (Users 4.1, 4.2) ----------
/**
 * changes: {name_he, date_of_birth, phone, main_team ('' = none), sub_teams, role, is_admin, graduation_year, favorite_feature}
 * swap: confirm swapping out the current holder when a Lead/Captain limit is full.
 * Returns {needSwap:[ids]} or {needLeadConfirm:true} when a confirmation is needed.
 */
b.serve('update', ({ actor, uid, changes, swap, confirmLeadMove }) => {
  const a = actorFor(actor);
  const u = users()[uid]; check(u && u.status !== 'pending');
  const c = { ...changes };
  const keys = Object.keys(c);
  // favorite feature: lead+ of the user's team, Captains, Admins, Mentors (Users 2.1)
  if (keys.length === 1 && keys[0] === 'favorite_feature') {
    check(a.isMentor || a.isAdmin || a.isCaptain || (a.isLead && a.team === u.main_team));
    check((c.favorite_feature || '').length <= 80, 'עד 80 תווים');
    audit(actor, 'update', uid, 'favorite_feature', u.favorite_feature, c.favorite_feature);
    u.favorite_feature = c.favorite_feature; saveUsers({ ...users() }); b.emit('user.updated', { uid, fields: ['favorite_feature'] });
    return { ok: true };
  }
  if (keys.length === 1 && keys[0] === 'phone' && actor === uid) {
    check(phoneOk(c.phone), 'מספר נייד לא תקין');
    audit(actor, 'update', uid, 'phone', u.phone, c.phone); u.phone = c.phone; saveUsers({ ...users() });
    return { ok: true };
  }
  check(canManage(a));
  if (u.role === 'mentor' && u.status === 'active') check(a.isMentor); // only Mentors edit a Mentor's record
  if (uid === actor) check(!('role' in c) || c.role === u.role, 'אי אפשר לשנות את התפקיד של עצמך');
  if (uid === actor) check(!('is_admin' in c) || c.is_admin === u.is_admin, 'אי אפשר לשנות את התפקיד של עצמך');
  if ('is_admin' in c && c.is_admin !== u.is_admin) check(a.isMentor);
  if ('role' in c && c.role === 'mentor' && u.role !== 'mentor') check(a.isMentor);
  if ('name_he' in c) check(nameOk(c.name_he), 'שם מלא בעברית, 2–40 אותיות');
  if ('date_of_birth' in c) check(dobOk(c.date_of_birth), 'הגיל חייב להיות בין 10 ל-99');
  if ('phone' in c) check(phoneOk(c.phone), 'מספר נייד לא תקין');
  if ('favorite_feature' in c) check((c.favorite_feature || '').length <= 80, 'עד 80 תווים');
  // last mentor (E5)
  if (u.role === 'mentor' && 'role' in c && c.role !== 'mentor' && activeMentors().length <= 1) throw new AppError('חייב להישאר לפחות מנטור אחד');

  let newTeam = 'main_team' in c ? (c.main_team || null) : u.main_team;
  let newRole = 'role' in c ? (c.role || null) : u.role;
  if (u.status === 'active') {
    if (newRole === 'mentor') newTeam = null;
    if (!newTeam && newRole !== 'mentor') { newRole = null; c.is_admin = false; } // "ללא צוות" → no-role (4.2)
    if (newTeam && !newRole) newRole = 'member';
    if (newTeam && newRole !== 'mentor') {
      const gy = 'graduation_year' in c ? c.graduation_year : u.graduation_year;
      check(!!gy, 'חובה לבחור שנת סיום');
    }
    // the Lead moves team → becomes Member (needs confirmation)
    if (u.role === 'lead' && newTeam !== u.main_team && newRole === 'lead') {
      if (!confirmLeadMove) return { needLeadConfirm: true };
      newRole = 'member';
    }
    if ((newRole === 'lead' && (u.role !== 'lead' || newTeam !== u.main_team)) || (newRole === 'captain' && u.role !== 'captain')) {
      const blockers = limitHolders(newRole, newTeam, uid);
      if (blockers.length && !swap) return { needSwap: blockers.map((x) => x.id) };
      blockers.forEach((x) => { const old = x.role; x.role = 'member'; audit(actor, 'role_swap', x.id, 'role', old, 'member'); b.emit('user.role_changed', { uid: x.id, role: 'member', is_admin: x.is_admin, old }); });
    }
  }
  const before = { ...u };
  ['name_he', 'date_of_birth', 'phone', 'sub_teams', 'graduation_year', 'favorite_feature', 'is_admin'].forEach((k) => { if (k in c) u[k] = c[k]; });
  if (newRole === 'mentor') { u.graduation_year = null; }
  const teamChanged = newTeam !== before.main_team;
  if (teamChanged) {
    const open = u.team_history.find((h) => h.team === before.main_team && !h.to);
    if (open) open.to = now().toISOString();
    if (newTeam) u.team_history.push({ team: newTeam, from: now().toISOString(), to: null });
  }
  u.main_team = newTeam; u.role = newRole;
  saveUsers({ ...users() });
  ['name_he', 'date_of_birth', 'phone', 'sub_teams', 'graduation_year', 'favorite_feature', 'is_admin', 'main_team', 'role'].forEach((k) => {
    if (JSON.stringify(before[k]) !== JSON.stringify(u[k])) audit(actor, 'update', uid, k, before[k], u[k]);
  });
  const upd = ['name_he', 'date_of_birth', 'graduation_year', 'sub_teams', 'favorite_feature'].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(u[k]));
  if (upd.length) b.emit('user.updated', { uid, fields: upd });
  if (teamChanged) { b.emit('user.team_changed', { uid, old: before.main_team, team: newTeam }); }
  if (before.role !== u.role || before.is_admin !== u.is_admin) b.emit('user.role_changed', { uid, role: u.role, is_admin: u.is_admin, old: before.role });
  if (teamChanged || before.role !== u.role) b.notify([uid], 'users.changed', 'הצוות או התפקיד שלך עודכנו', '/profile/' + uid);
  return { ok: true };
});

// ---------- alumni (4.3, 4.4) ----------
b.serve('graduate', ({ actor, year, uids }) => {
  const a = actorFor(actor); check(canManage(a));
  const done = [];
  uids.forEach((id) => {
    const u = users()[id];
    if (!u || u.status !== 'active' || u.graduation_year !== year || u.role === 'mentor') return;
    const before = { role: u.role, is_admin: u.is_admin };
    Object.assign(u, { status: 'alumni', alumni_active: false, role: 'member', is_admin: false, graduated_at: now().toISOString() });
    const open = u.team_history.find((h) => !h.to); if (open) open.to = now().toISOString();
    done.push(id);
    audit(actor, 'graduate', id, 'status', 'active', 'alumni');
    if (before.role !== 'member' || before.is_admin) b.emit('user.role_changed', { uid: id, role: 'member', is_admin: false, old: before.role });
  });
  saveUsers({ ...users() });
  audit(actor, 'graduation_run', null, 'year', null, String(year), `${done.length} בוגרים`);
  done.forEach((id) => b.emit('user.status_changed', { uid: id, status: 'alumni', alumni_active: false }));
  return done.length;
});
b.serve('setAlumniMode', ({ actor, uid, on }) => {
  const a = actorFor(actor); check(a.isMentor);
  const u = users()[uid]; check(u && u.status === 'alumni');
  if (!!u.alumni_active === !!on) return true;
  u.alumni_active = !!on; saveUsers({ ...users() });
  audit(actor, 'alumni_mode', uid, 'alumni_active', !on, !!on);
  b.notify([uid], 'users.changed', on ? 'מצב בוגר: פעיל' : 'מצב בוגר: קריאה בלבד', '/profile/' + uid);
  b.emit('user.status_changed', { uid, status: 'alumni', alumni_active: !!on });
  return true;
});
b.serve('returnToActive', ({ actor, uid, team, graduation_year }) => {
  const a = actorFor(actor); check(a.isMentor);
  const u = users()[uid]; check(u && u.status === 'alumni');
  check(!!team && !!graduation_year, 'חובה לבחור צוות ושנת סיום');
  const old = u.main_team;
  Object.assign(u, { status: 'active', alumni_active: false, main_team: team, role: 'member', graduation_year, graduated_at: null });
  u.team_history.push({ team, from: now().toISOString(), to: null });
  saveUsers({ ...users() });
  audit(actor, 'return_to_active', uid, 'status', 'alumni', 'active');
  b.emit('user.status_changed', { uid, status: 'active', alumni_active: false });
  b.emit('user.team_changed', { uid, old, team });
  return true;
});

// ---------- deletion (4.5) ----------
b.serve('deleteUser', ({ actor, uid, confirmName }) => {
  const a = actorFor(actor); check(a.isMentor);
  const u = users()[uid]; check(!!u);
  check(uid !== actor, 'אי אפשר למחוק את עצמך');
  check(confirmName === u.name_he, 'השם לא תואם');
  if (u.role === 'mentor' && u.status === 'active' && activeMentors().length <= 1) throw new AppError('חייב להישאר לפחות מנטור אחד');
  audit(actor, 'delete_user', uid, 'name', u.name_he, null);
  const all = { ...users() }; delete all[uid]; saveUsers(all);
  if (u.picture && u.picture.startsWith('idb:')) pics.del(u.picture.slice(4));
  b.emit('user.deleted', { uid, shortId: uid.slice(-4) });
  return true;
});

// ---------- pictures (NeatSystem 5.2; stored in Users) ----------
b.serve('setPicture', async ({ actor, blob }) => {
  actorFor(actor, { allowReadOnly: true, allowNoRole: true });
  check(['image/jpeg', 'image/png', 'image/webp'].includes(blob.type), 'אפשר להעלות JPG, PNG או WebP');
  check(blob.size <= 5 * 1024 * 1024, 'עד 5 MB');
  const square = await cropSquare(blob, 512);
  const u = users()[actor];
  const id = await pics.put(square);
  if (u.picture && u.picture.startsWith('idb:')) pics.del(u.picture.slice(4));
  u.picture = 'idb:' + id; saveUsers({ ...users() });
  audit(actor, 'update', actor, 'picture', null, 'upload');
  b.emit('user.updated', { uid: actor, fields: ['picture'] });
  return true;
});
b.serve('revertPicture', ({ actor }) => {
  actorFor(actor, { allowReadOnly: true, allowNoRole: true });
  const u = users()[actor];
  if (u.picture && u.picture.startsWith('idb:')) pics.del(u.picture.slice(4));
  u.picture = u.google_picture || null; saveUsers({ ...users() });
  audit(actor, 'update', actor, 'picture', 'upload', 'google');
  b.emit('user.updated', { uid: actor, fields: ['picture'] });
});
b.serve('removePicture', ({ actor, uid }) => {
  const a = actorFor(actor); check(canManage(a));
  const u = users()[uid]; check(u && u.picture && u.picture.startsWith('idb:'));
  pics.del(u.picture.slice(4)); u.picture = u.google_picture || null; saveUsers({ ...users() });
  audit(actor, 'remove_picture', uid, 'picture', 'upload', null);
  b.notify([uid], 'users.picture', 'תמונת הפרופיל שלך הוסרה על ידי הנהלה', '/profile/' + uid);
  b.emit('user.updated', { uid, fields: ['picture'] });
});
async function cropSquare(blob, size) {
  const img = await createImageBitmap(blob);
  const s = Math.min(img.width, img.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((res) => c.toBlob(res, 'image/webp', 0.9));
}

// ---------- teams (Users 6, Mentors only) ----------
b.serve('createTeam', ({ actor, kind, name, tint, icon }) => {
  const a = actorFor(actor); check(a.isMentor);
  name = (name || '').trim(); check(name.length >= 2 && name.length <= 30, 'שם בין 2 ל-30 תווים');
  check(!teams().some((t) => t.name === name && !t.archived), 'כבר יש צוות בשם הזה');
  const t = { id: newId('t'), kind, name, tint: tint || 'p:' + ((teams().length % 16) + 1), icon: kind === 'main' ? icon || 'users' : null, archived: false };
  db.set('teams', [...teams(), t]);
  audit(actor, 'team_create', t.id, 'name', null, name);
  b.emit('team.created', { team: t });
  return t.id;
});
b.serve('updateTeam', ({ actor, id, name, tint, icon }) => {
  const a = actorFor(actor); check(a.isMentor);
  const t = teams().find((x) => x.id === id); check(!!t);
  if (name != null) { name = name.trim(); check(name.length >= 2 && name.length <= 30, 'שם בין 2 ל-30 תווים'); audit(actor, 'team_rename', id, 'name', t.name, name); t.name = name; }
  if (tint) { audit(actor, 'team_tint', id, 'tint', t.tint, tint); t.tint = tint; }
  if (icon) { audit(actor, 'team_icon', id, 'icon', t.icon, icon); t.icon = icon; }
  db.set('teams', [...teams()]);
  if (name != null) b.emit('team.renamed', { team: t });
});
b.serve('archiveTeam', ({ actor, id }) => {
  const a = actorFor(actor); check(a.isMentor);
  const t = teams().find((x) => x.id === id); check(!!t);
  const members = Object.values(users()).filter((u) => u.status === 'active' && (u.main_team === id || (u.sub_teams || []).includes(id)));
  check(members.length === 0, 'אפשר לארכב רק צוות שאין בו אף אחד פעיל');
  t.archived = true; db.set('teams', [...teams()]);
  audit(actor, 'team_archive', id, 'archived', false, true);
  b.emit('team.archived', { team: t });
});
b.serve('setSettings', ({ actor, patch }) => {
  const a = actorFor(actor); check(a.isMentor);
  const s = settings();
  Object.entries(patch).forEach(([k, v]) => { check(Number.isInteger(v) && v >= 0 && v <= 20, 'ערך לא תקין'); audit(actor, 'setting', null, 'limits.' + k, s[k], v); s[k] = v; });
  db.set('settings', { ...s });
});

// ---------- school-year rollover (1 September) → grades change ----------
bus.on('clock.tick', () => {
  const ey = endYear();
  const last = db.get('school_end_year', null);
  if (last === null) { db.set('school_end_year', ey); return; }
  if (last !== ey) {
    db.set('school_end_year', ey);
    Object.values(users()).filter((u) => u.status === 'active' && u.graduation_year).forEach((u) => b.emit('user.updated', { uid: u.id, fields: ['grade'] }));
    audit('system', 'school_year', null, 'end_year', last, ey);
  }
});

// ---------- install seed (Users 6) ----------
export function seedInstall() {
  db.set('teams', [
    { id: 'team-cad', kind: 'main', name: 'שרטוט', tint: 'fx:cad', icon: 'cog', archived: false },
    { id: 'team-build', kind: 'main', name: 'בנייה', tint: 'fx:build', icon: 'glasses', archived: false },
    { id: 'team-software', kind: 'main', name: 'תוכנה', tint: 'fx:software', icon: 'circuit-board', archived: false },
    { id: 'sub-media', kind: 'sub', name: 'מדיה', tint: 'p:7', icon: null, archived: false },
    { id: 'sub-finance', kind: 'sub', name: 'פיננסי', tint: 'p:1', icon: null, archived: false },
    { id: 'sub-community', kind: 'sub', name: 'קהילה/התנדבויות', tint: 'p:3', icon: null, archived: false },
    { id: 'sub-awards', kind: 'sub', name: 'פרסים ושופטים', tint: 'p:10', icon: null, archived: false },
  ]);
  db.set('settings', { leads_per_team: 1, captains: 2 });
  db.set('users', {});
  db.set('school_end_year', endYear());
}
/** Demo only: insert a user record as-is (used by core/demo/seed.js). */
b.serve('demoInsert', (rec) => {
  const r = { ...blank(rec.id, rec.google_email, rec.google_name), ...rec };
  saveUsers({ ...users(), [r.id]: r });
  if (r.status === 'active' || r.status === 'alumni') {
    b.emit('user.activated', { uid: r.id });
    if (r.main_team) b.emit('user.team_changed', { uid: r.id, old: null, team: r.main_team });
  }
  return r.id;
});

b.serve('seedInstall', seedInstall);
export const usersApi = { gradeOf, endYear };
