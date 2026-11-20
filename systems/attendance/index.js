// Attendance — meeting calendar, marks, streaks and Streak Freezes (08-attendance.txt).
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { dayKey, parseDay, addDaysKey, todayKey, daysBetween, fmtDate, uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check } from '../../core/errors.js';

const b = bus.system('attendance', { announces: ['attendance.paid', 'attendance.unpaid', 'streak.bonus', 'streak.bonus_reversed', 'freeze.used', 'freeze.returned'] });
const db = ns('attendance');

export const DEFAULTS = { coins_regular: 5, coins_extra: 10, streak_length: 5, freeze_cap: 3, edit_window_days: 30 };
const settings = () => ({ ...DEFAULTS, ...db.get('settings', {}) });
const schedule = () => db.get('schedule', { slots: [], seasonStart: null, seasonEnd: null });
const meetings = () => db.get('meetings', {});
const marks = () => db.get('marks', {});
const computed = () => db.get('computed', {});
export const DAY_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const actor = (uid) => bus.read('users.actor', uid);
const canAttend = (uid) => { const a = actor(uid); return !!a && a.teamMember; };
function inAudience(m, uid) {
  if (!canAttend(uid)) return false;
  if (!m.audience || m.audience.all) return true;
  return bus.read('users.matches', uid, m.audience, { includeAlumni: true });
}
const mTime = (m) => `${m.date}T${m.time}`;
const sorted = (list) => list.sort((a, c) => (mTime(a) < mTime(c) ? -1 : mTime(a) > mTime(c) ? 1 : a.id < c.id ? -1 : 1));
const isEveryone = (m) => !m.audience || !!m.audience.all;
const pub = (m) => ({ id: m.id, date: m.date, time: m.time, title: m.title, kind: m.kind, cancelled: !!m.cancelled, everyone: isEveryone(m), audience: m.audience || null, coins: m.coins, projected: !!m.projected });

// ---------- meeting generation (2.1): regular slots, 30 days ahead ----------
function generate() {
  const s = schedule();
  if (!s.seasonStart) return;
  const all = { ...meetings() };
  const horizon = addDaysKey(todayKey(), 30);
  const end = s.seasonEnd && s.seasonEnd < horizon ? s.seasonEnd : horizon;
  let changed = false;
  for (let k = s.seasonStart; k <= end; k = addDaysKey(k, 1)) {
    const dow = parseDay(k).getDay();
    s.slots.filter((sl) => sl.day === dow).forEach((sl) => {
      const id = `r-${sl.id}-${k}`;
      if (!all[id]) { all[id] = { id, date: k, time: sl.time, title: sl.title || '', kind: 'regular', slotId: sl.id, audience: null, coins: null, cancelled: false }; changed = true; }
    });
  }
  if (changed) db.set('meetings', all);
}
/** Projected regular occurrences beyond the generated horizon (for Countdown's meetings mode). */
function projected(fromKey, toKey) {
  const s = schedule(); const out = [];
  if (!s.seasonStart) return out;
  const start = addDaysKey(todayKey(), 31);
  for (let k = fromKey > start ? fromKey : start; k <= toKey && (!s.seasonEnd || k <= s.seasonEnd); k = addDaysKey(k, 1)) {
    const dow = parseDay(k).getDay();
    s.slots.filter((sl) => sl.day === dow).forEach((sl) => out.push({ id: `p-${sl.id}-${k}`, date: k, time: sl.time, title: sl.title || '', kind: 'regular', audience: null, cancelled: false, projected: true }));
  }
  return out;
}

// ---------- streak recomputation (4, 4.1) ----------
function recompute(uid, by = 'system') {
  const a = actor(uid);
  if (!a || (a.alumni && a.readOnly)) return; // read-only alumni: streak frozen (E7)
  const L = settings().streak_length;
  const prev = computed()[uid] || { streak: 0, best: 0, used: [], bonuses: {} };
  const bought = (db.get('bought', {})[uid] || []).slice().sort();
  const mk = marks();
  const list = sorted(Object.values(meetings()).filter((m) => !m.cancelled && mk[m.id] && mk[m.id][uid] && inAudience(m, uid)));
  let streak = 0, best = prev.best || 0;
  const used = [];
  const bonuses = {};
  for (const m of list) {
    const r = mk[m.id][uid];
    if (r.v === 'present') {
      streak++;
      if (streak % L === 0) { const pb = (prev.bonuses || {})[m.id]; bonuses[m.id] = { id: (pb && pb.id) || newId('bonus'), streak }; }
    } else {
      const available = bought.filter((t) => t <= r.at).length - used.length;
      if (available > 0) used.push(m.id); else streak = 0;
    }
    best = Math.max(best, streak);
  }
  const prevB = prev.bonuses || {};
  Object.entries(bonuses).forEach(([k, x]) => { if (!prevB[k]) b.emit('streak.bonus', { uid, bonusId: x.id, streak: x.streak }); });
  Object.entries(prevB).forEach(([k, x]) => { if (!bonuses[k]) b.emit('streak.bonus_reversed', { uid, bonusId: x.id }); });
  used.filter((x) => !(prev.used || []).includes(x)).forEach((mid) => {
    b.emit('freeze.used', { uid, meetingId: mid });
    b.audit({ actor: by, action: 'freeze_used', target: uid, field: 'meeting', new: mid });
    b.notify([uid], 'attendance.freeze', 'השתמשנו בהקפאת רצף — הרצף שלך נשמר', '/attendance/me');
  });
  (prev.used || []).filter((x) => !used.includes(x)).forEach((mid) => { b.emit('freeze.returned', { uid, meetingId: mid }); b.audit({ actor: by, action: 'freeze_returned', target: uid, field: 'meeting', new: mid }); });
  const level = (n) => (n < 2 ? -1 : Math.min(4, Math.floor(n / 15)));
  const ack = db.get('flame_ack', {});
  if (level(streak) < (ack[uid] ?? -1)) db.set('flame_ack', { ...ack, [uid]: level(streak) });
  db.set('computed', { ...computed(), [uid]: { streak, best, used, bonuses, level: level(streak) } });
}
function recomputeAll(by) { bus.read('users.list', { statuses: ['active', 'alumni'] }).forEach((u) => recompute(u.id, by)); }

// ---------- read APIs ----------
b.share('settings', () => settings());
b.share('schedule', () => schedule());
b.share('calendar', (from, to) => {
  const f = from || '0000', t = to || '9999';
  const real = Object.values(meetings()).filter((m) => m.date >= f && m.date <= t);
  return sorted([...real, ...projected(f, t)]).map(pub);
});
b.share('meeting', (id) => { const m = meetings()[id]; return m ? pub(m) : null; });
b.share('todayMeeting', (uid) => {
  const k = todayKey();
  const m = sorted(Object.values(meetings()).filter((x) => x.date === k && !x.cancelled && inAudience(x, uid)))[0];
  return m ? { id: m.id, time: m.time, title: m.title } : null;
});
b.share('streak', (uid) => {
  const c = computed()[uid] || { streak: 0, best: 0, used: [] };
  const bought = (db.get('bought', {})[uid] || []).length;
  return { current: c.streak, best: c.best, freezes: Math.max(0, bought - (c.used || []).length) };
});
b.share('freezes', (uid) => { const c = computed()[uid] || { used: [] }; return Math.max(0, (db.get('bought', {})[uid] || []).length - (c.used || []).length); });
b.share('history', (uid) => {
  const mk = marks(); const c = computed()[uid] || { used: [] };
  return sorted(Object.values(meetings()).filter((m) => mk[m.id] && mk[m.id][uid])).reverse().map((m) => {
    const v = mk[m.id][uid].v;
    return { ...pub(m), value: v, freezeUsed: (c.used || []).includes(m.id), coins: v === 'present' && !m.cancelled ? meetingCoins(m) : 0 };
  });
});
b.share('marks', (meetingId) => marks()[meetingId] || {});
b.share('audience', (meetingId) => { const m = meetings()[meetingId]; if (!m) return []; return bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => inAudience(m, u.id)).map((u) => u.id); });
b.share('flameToastPending', (uid) => { const c = computed()[uid]; if (!c || c.level == null || c.level < 1) return false; return c.level > (db.get('flame_ack', {})[uid] ?? 0); });
b.share('canMark', (actorId, meetingId, uid) => { try { checkMark(actor(actorId), meetings()[meetingId], uid); return true; } catch { return false; } });
b.share('canEditCalendar', (actorId) => { const a = actor(actorId); return !!a && (a.isMentor || a.isAdmin || a.isCaptain); });
b.share('markable', (actorId) => { const a = actor(actorId); return !!a && !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor); });

const meetingCoins = (m) => (m.kind === 'extra' ? m.coins ?? settings().coins_extra : settings().coins_regular);
function checkMark(a, m, uid) {
  check(!!a && !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor));
  check(!!m, 'פגישה לא נמצאה');
  check(!m.cancelled, 'הפגישה בוטלה');
  check(m.date <= todayKey(), 'אי אפשר לסמן פגישה עתידית');
  check(uid !== a.id, 'אי אפשר לסמן את עצמך');
  check(inAudience(m, uid), 'לא בקהל של הפגישה');
  if (a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)) check((actor(uid) || {}).team === a.team);
  if (!a.isMentor) check(daysBetween(parseDay(m.date), now()) <= settings().edit_window_days, `אפשר לשנות עד ${settings().edit_window_days} ימים אחרי הפגישה`);
}

// ---------- marking (3) ----------
function setMark(actorId, meetingId, uid, value) {
  const a = actorFor(actorId);
  const m = meetings()[meetingId];
  checkMark(a, m, uid);
  const mk = marks();
  const cur = mk[meetingId] && mk[meetingId][uid] ? mk[meetingId][uid].v : null;
  if (cur === value) return;
  const pays = db.get('pays', {});
  const pk = `${meetingId}:${uid}`;
  if (cur === 'present' && pays[pk]) { b.emit('attendance.unpaid', { uid, payId: pays[pk], meetingId, by: actorId }); delete pays[pk]; }
  const row = { ...(mk[meetingId] || {}) };
  if (value) row[uid] = { v: value, at: now().toISOString(), by: actorId }; else delete row[uid];
  db.set('marks', { ...mk, [meetingId]: row });
  if (value === 'present') { const payId = `${pk}:${newId('p')}`; pays[pk] = payId; b.emit('attendance.paid', { uid, payId, meetingId, coins: meetingCoins(m), desc: `פגישה ${fmtDate(m.date)}${m.title ? ' · ' + m.title : ''}`, by: actorId }); }
  db.set('pays', pays);
  b.audit({ actor: actorId, action: 'mark', target: uid, field: meetingId, old: cur, new: value });
  recompute(uid, actorId);
}
b.serve('mark', ({ actor: actorId, meetingId, uid, value }) => setMark(actorId, meetingId, uid, value || null));
b.serve('markAll', ({ actor: actorId, meetingId, uids }) => {
  uids.forEach((u) => { const r = (marks()[meetingId] || {})[u]; if (!r) setMark(actorId, meetingId, u, 'present'); });
});

// ---------- calendar (2) ----------
function calendarActor(id) { const a = actorFor(id); check(a.isMentor || a.isAdmin || a.isCaptain); return a; }
b.serve('saveSchedule', ({ actor: id, slots, seasonStart, seasonEnd }) => {
  calendarActor(id);
  slots.forEach((s) => { check(s.day >= 0 && s.day <= 6 && /^\d\d:\d\d$/.test(s.time), 'שעה לא תקינה'); s.id = s.id || newId('s'); s.title = (s.title || '').slice(0, 40); });
  check(seasonStart && seasonEnd && seasonStart <= seasonEnd, 'טווח עונה לא תקין');
  const old = schedule();
  // future, unmarked regular meetings are regenerated; past and marked ones stay
  const mk = marks(); const t = todayKey();
  const all = { ...meetings() };
  Object.values(all).forEach((m) => { if (m.kind === 'regular' && m.date > t && !(mk[m.id] && Object.keys(mk[m.id]).length)) delete all[m.id]; });
  db.set('meetings', all);
  db.set('schedule', { slots, seasonStart, seasonEnd });
  b.audit({ actor: id, action: 'schedule', field: 'slots', old: old.slots.map((s) => `${DAY_HE[s.day]} ${s.time}`).join(', '), new: slots.map((s) => `${DAY_HE[s.day]} ${s.time}`).join(', ') });
  generate();
});
b.serve('cancelMeeting', ({ actor: id, meetingId }) => {
  calendarActor(id);
  const m = meetings()[meetingId]; check(m && !m.cancelled);
  const pays = db.get('pays', {});
  Object.keys(pays).filter((k) => k.startsWith(meetingId + ':')).forEach((k) => { b.emit('attendance.unpaid', { uid: k.split(':')[1], payId: pays[k], meetingId, by: id }); delete pays[k]; });
  db.set('pays', pays);
  db.set('meetings', { ...meetings(), [meetingId]: { ...m, cancelled: true } });
  b.audit({ actor: id, action: 'cancel_meeting', target: meetingId, field: 'date', new: m.date });
  const aud = bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => inAudience(m, u.id)).map((u) => u.id);
  b.notify(aud, 'attendance.meeting', `הפגישה ב-${fmtDate(m.date)} בוטלה`, '/attendance/me');
  Object.keys(marks()[meetingId] || {}).forEach((u) => recompute(u, id));
});
b.serve('addMeeting', ({ actor: id, date, time, title, audience, coins }) => {
  calendarActor(id);
  title = (title || '').trim(); check(title.length >= 1 && title.length <= 40, 'חובה לכתוב כותרת');
  check(/^\d{4}-\d\d-\d\d$/.test(date) && /^\d\d:\d\d$/.test(time), 'תאריך או שעה לא תקינים');
  coins = coins == null || coins === '' ? settings().coins_extra : Number(coins);
  check(Number.isInteger(coins) && coins >= 0, 'מספר מטבעות לא תקין');
  const m = { id: newId('x'), date, time, title, kind: 'extra', audience: audience && !audience.all ? audience : null, coins, cancelled: false, createdBy: id };
  db.set('meetings', { ...meetings(), [m.id]: m });
  b.audit({ actor: id, action: 'extra_meeting', target: m.id, field: 'date', new: `${date} ${time} ${title}` });
  const aud = bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => inAudience(m, u.id)).map((u) => u.id);
  b.notify(aud, 'attendance.meeting', `פגישה נוספת: ${title} · ${fmtDate(date)} ${time}`, '/attendance/me');
  return m.id;
});
b.serve('setSettings', ({ actor: id, patch }) => {
  const a = actorFor(id); check(a.isMentor);
  const s = db.get('settings', {});
  Object.entries(patch).forEach(([k, v]) => { check(k in DEFAULTS && Number.isInteger(v) && v >= 0, 'ערך לא תקין'); b.audit({ actor: id, action: 'setting', field: 'attendance.' + k, old: settings()[k], new: v }); s[k] = v; });
  db.set('settings', { ...s });
  if ('streak_length' in patch) recomputeAll(id);
});
b.serve('ackFlameToast', ({ actor: id }) => { const c = computed()[id]; if (c) db.set('flame_ack', { ...db.get('flame_ack', {}), [id]: c.level }); });

// ---------- events ----------
bus.on('freeze.bought', ({ uid }) => {
  db.update('bought', {}, (x) => { (x[uid] = x[uid] || []).push(now().toISOString()); });
  b.audit({ actor: uid, action: 'freeze_added', target: uid, field: 'freezes', new: bus.read('attendance.freezes', uid) });
  recompute(uid);
});
bus.on('user.deleted', ({ uid }) => {
  const mk = { ...marks() }; Object.keys(mk).forEach((k) => { if (mk[k][uid]) { mk[k] = { ...mk[k] }; delete mk[k][uid]; } }); db.set('marks', mk);
  const c = { ...computed() }; delete c[uid]; db.set('computed', c);
  const bo = { ...db.get('bought', {}) }; delete bo[uid]; db.set('bought', bo);
  const p = { ...db.get('pays', {}) }; Object.keys(p).forEach((k) => { if (k.split(':')[1] === uid) delete p[k]; }); db.set('pays', p);
});
bus.on('user.team_changed', ({ uid }) => recompute(uid));
bus.on('user.status_changed', ({ uid }) => recompute(uid));
bus.on('clock.tick', () => generate());

b.serve('seedInstall', () => {
  db.set('schedule', { slots: [{ id: 'mon', day: 1, time: '17:00', title: '' }, { id: 'wed', day: 3, time: '17:00', title: '' }], seasonStart: '2026-08-02', seasonEnd: '2027-06-30' });
  db.set('meetings', {}); db.set('marks', {}); db.set('computed', {}); db.set('bought', {}); db.set('pays', {}); db.set('settings', { ...DEFAULTS });
  generate();
});
b.serve('generate', () => generate());
