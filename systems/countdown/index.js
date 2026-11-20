// Countdown — event countdowns on Home (10-countdown.txt). Reads Attendance for "פגישות" mode.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId, dayKey, todayKey } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { check } from '../../core/errors.js';

const b = bus.system('countdown', { announces: [] });
const db = ns('countdown');
const events = () => db.get('events', []);
const order = (a, c) => (a.at < c.at ? -1 : a.at > c.at ? 1 : a.createdAt < c.createdAt ? -1 : 1);

/** Shown on Home: visible (shownFrom ≤ today) and not past the event day. */
b.share('upcoming', () => { const t = todayKey(); return events().filter((e) => (!e.showFrom || e.showFrom <= t) && dayKey(e.at) >= t).sort(order); });
b.share('all', () => events().slice().sort(order));
/** Meetings left: after now and before the event, not cancelled, audience = everyone (Countdown 3). */
b.share('meetingsLeft', (id) => {
  const e = events().find((x) => x.id === id); if (!e) return 0;
  const n = now(), at = new Date(e.at);
  return bus.read('attendance.calendar', todayKey(), dayKey(at)).filter((m) => !m.cancelled && m.everyone && new Date(`${m.date}T${m.time}`) > n && new Date(`${m.date}T${m.time}`) < at).length;
});
const editor = (id) => { const a = actorFor(id); check(a.isMentor || a.isAdmin); return a; };
b.share('canEdit', (id) => { const a = bus.read('users.actor', id); return !!a && (a.isMentor || a.isAdmin); });

b.serve('save', ({ actor, id, name, at, desc, showFrom }) => {
  editor(actor);
  name = (name || '').trim(); check(name.length >= 1 && name.length <= 40, 'שם עד 40 תווים');
  check(!desc || desc.length <= 140, 'תיאור עד 140 תווים');
  check(at && new Date(at) > now(), 'התאריך חייב להיות בעתיד');
  const list = events();
  if (id) {
    const e = list.find((x) => x.id === id); check(!!e);
    ['name', 'at', 'desc', 'showFrom'].forEach((k) => { const v = { name, at, desc: desc || '', showFrom: showFrom || null }[k]; if (e[k] !== v) b.audit({ actor, action: 'edit', target: id, field: k, old: e[k], new: v }); });
    Object.assign(e, { name, at, desc: desc || '', showFrom: showFrom || null });
    db.set('events', [...list]);
    return id;
  }
  const e = { id: newId('cd'), name, at, desc: desc || '', showFrom: showFrom || null, createdAt: now().toISOString(), createdBy: actor };
  db.set('events', [...list, e]);
  b.audit({ actor, action: 'create', target: e.id, field: 'name', new: name });
  return e.id;
});
b.serve('remove', ({ actor, id }) => {
  editor(actor);
  const e = events().find((x) => x.id === id); check(!!e);
  db.set('events', events().filter((x) => x.id !== id));
  b.audit({ actor, action: 'delete', target: id, field: 'name', old: e.name });
});
b.serve('seedInstall', () => db.set('events', []));
