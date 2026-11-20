// Leaderboard — coin leaderboards and their periods (09-leaderboard.txt). Reads Coins and Users only.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { byHe, parseDay, startOfDay } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { check } from '../../core/errors.js';

const b = bus.system('leaderboard', { announces: ['leaderboard.reset'] });
const db = ns('leaderboard');
const boards = () => db.get('boards', {});
export const SCHEDULE_HE = { weekly: 'שבועי', monthly: 'חודשי', season: 'עונה', custom: 'תאריך מותאם' };

/** Natural start of the period containing `d` (weekly/monthly). */
function naturalStart(type, d) {
  const x = startOfDay(d);
  if (type === 'weekly') { x.setDate(x.getDate() - x.getDay()); return x; }
  if (type === 'monthly') return new Date(x.getFullYear(), x.getMonth(), 1);
  return x;
}
function periodEnd(bd) {
  const s = bd.schedule, start = new Date(bd.periodStart);
  if (s.type === 'weekly') { const e = naturalStart('weekly', start); e.setDate(e.getDate() + 7); return e; }
  if (s.type === 'monthly') { const e = naturalStart('monthly', start); return new Date(e.getFullYear(), e.getMonth() + 1, 1); }
  if (s.type === 'season') { const e = parseDay(s.end); e.setDate(e.getDate() + 1); return e > start ? e : new Date(start.getTime() + (s.lengthDays || 30) * 86400000); }
  const e = parseDay(s.customEnd); e.setDate(e.getDate() + 1);
  return e > start ? e : new Date(start.getTime() + (s.lengthDays || 30) * 86400000);
}
function members(bd) {
  return bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => {
    if (!bus.read('coins.canEarn', u.id)) return false;
    return !bd.team || u.main_team === bd.team;
  });
}
/** Dense ranking; zero scores after everyone else, alphabetically, no place (Leaderboard 2). */
function standings(id, from, to) {
  const bd = boards()[id]; if (!bd) return [];
  const start = from || bd.periodStart;
  const rows = members(bd).map((u) => ({ uid: u.id, name: u.name_he, team: u.main_team, score: bus.read('coins.earned', u.id, start, to || null) }));
  const pos = rows.filter((r) => r.score > 0).sort((a, c) => c.score - a.score || byHe(a.name, c.name));
  let place = 0, last = null;
  pos.forEach((r) => { if (r.score !== last) { place++; last = r.score; } r.place = place; });
  const zero = rows.filter((r) => r.score <= 0).sort((a, c) => byHe(a.name, c.name)).map((r) => ({ ...r, place: null }));
  return [...pos, ...zero];
}
function reset(id, by) {
  const bd = boards()[id];
  const end = by ? now() : periodEnd(bd);
  const top3 = standings(id, bd.periodStart, end).filter((r) => r.place && r.place <= 3).map((r) => ({ uid: r.uid, name: r.name, score: r.score, place: r.place }));
  const rec = { start: bd.periodStart, end: end.toISOString(), top3 };
  const s = bd.schedule;
  let next = end;
  if (!by && (s.type === 'weekly' || s.type === 'monthly')) next = naturalStart(s.type, end);
  const nb = { ...bd, periodStart: next.toISOString(), history: [...(bd.history || []), rec] };
  if (s.type === 'custom' || s.type === 'season') nb.schedule = { ...s, lengthDays: Math.max(1, Math.round((end - new Date(bd.periodStart)) / 86400000)) };
  db.set('boards', { ...boards(), [id]: nb });
  b.emit('leaderboard.reset', { board: id, period: rec, top3 });
  b.audit({ actor: by || 'system', action: 'reset', target: id, field: 'period', old: bd.periodStart, new: nb.periodStart });
}
function newBoard(team) {
  const n = now();
  return { id: team || 'all', team: team || null, on: true, schedule: { type: 'monthly' }, periodStart: naturalStart('monthly', n).toISOString(), history: [] };
}

// ---------- read APIs ----------
b.share('boards', () => Object.values(boards()).filter((bd) => !bd.team || (bus.read('users.team', bd.team) && !bus.read('users.team', bd.team).archived)));
b.share('board', (id) => boards()[id] || null);
b.share('standings', (id) => standings(id));
b.share('periodEnd', (id) => { const bd = boards()[id]; return bd ? periodEnd(bd).toISOString() : null; });
b.share('place', (uid) => {
  const u = bus.read('users.get', uid); if (!u || !u.main_team) return null;
  const bd = boards()[u.main_team]; if (!bd || !bd.on) return null;
  const r = standings(u.main_team).find((x) => x.uid === uid);
  return r && r.place && r.place <= 3 ? r.place : null;
});

// ---------- management (Captains, Admins, Mentors) ----------
const editor = (id) => { const a = actorFor(id); check(a.isCaptain || a.isAdmin || a.isMentor); return a; };
b.serve('setBoard', ({ actor, id, on, schedule }) => {
  editor(actor);
  const bd = boards()[id]; check(!!bd);
  const nb = { ...bd };
  if (on !== undefined) { b.audit({ actor, action: 'board_on', target: id, old: bd.on, new: on }); nb.on = !!on; }
  if (schedule) {
    check(['weekly', 'monthly', 'season', 'custom'].includes(schedule.type));
    if (schedule.type === 'season') check(schedule.start && schedule.end && schedule.start < schedule.end, 'טווח עונה לא תקין');
    if (schedule.type === 'custom') check(!!schedule.customEnd, 'בחרו תאריך');
    b.audit({ actor, action: 'board_schedule', target: id, old: bd.schedule, new: schedule });
    nb.schedule = schedule;
    if (schedule.type === 'season' && schedule.start && new Date(nb.periodStart) < parseDay(schedule.start) && parseDay(schedule.start) <= now()) nb.periodStart = parseDay(schedule.start).toISOString();
  }
  db.set('boards', { ...boards(), [id]: nb });
});
b.serve('resetNow', ({ actor, id }) => { editor(actor); reset(id, actor); });

// ---------- automatic resets on the clock ----------
bus.on('clock.tick', () => {
  Object.keys(boards()).forEach((id) => {
    const bd = boards()[id];
    // demo clock moved backwards: restart the current period at its natural start
    if (new Date(bd.periodStart) > now()) db.set('boards', { ...boards(), [id]: { ...bd, periodStart: naturalStart(bd.schedule.type === 'weekly' ? 'weekly' : 'monthly', now()).toISOString() } });
    let guard = 0;
    while (guard++ < 60 && now() >= periodEnd(boards()[id])) reset(id, null);
  });
});
bus.on('team.created', ({ team }) => { if (team.kind === 'main' && !boards()[team.id]) db.set('boards', { ...boards(), [team.id]: newBoard(team.id) }); });

b.serve('seedInstall', () => {
  const bs = { all: newBoard(null) };
  bus.read('users.mainTeams').forEach((t) => { bs[t.id] = newBoard(t.id); });
  db.set('boards', bs);
});
