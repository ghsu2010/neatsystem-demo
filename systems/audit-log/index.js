// Audit log — permanent record of every change in every system (14-audit-log.txt).
// Nobody (Mentors included) can edit or delete an entry. Admins and Mentors search it.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId } from '../../core/format.js';

const b = bus.system('audit-log', { announces: [] });
const db = ns('audit-log');
const entries = () => db.get('entries', []);

const short = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') { try { const s = JSON.stringify(v); return s.length > 160 ? s.slice(0, 157) + '…' : s; } catch { return String(v); } }
  const s = String(v); return s.length > 200 ? s.slice(0, 197) + '…' : s;
};
const nameOf = (id) => {
  if (!id) return null;
  if (id === 'system') return 'מערכת';
  try { const u = bus.read('users.get', id); return u ? u.name_he : null; } catch { return null; }
};

/** audit(actor, system, action, target, field, old value, new value, reason) */
b.serve('write', ({ actor, system, action, target, field, old, new: nv, reason }) => {
  const e = {
    id: newId('a'), at: now().toISOString(), actor: actor || 'system', actorName: nameOf(actor || 'system') || (actor ? 'מערכת' : 'מערכת'),
    system, action, target: target || null, targetName: typeof target === 'string' && target.startsWith('u') ? nameOf(target) : null,
    field: field || null, old: short(old), new: short(nv), reason: reason ? short(reason) : null,
  };
  db.update('entries', [], (l) => { l.push(e); });
});
/** Filtered views (Trainings per-member history, Ranks history) */
b.share('query', (f = {}) => entries().filter((e) => (!f.system || e.system === f.system) && (!f.target || e.target === f.target)
  && (!f.actor || e.actor === f.actor) && (!f.action || e.action === f.action) && (!f.match || f.match(e))).slice().reverse());
b.share('all', () => entries());

bus.on('user.deleted', ({ uid, shortId }) => {
  const label = `משתמש שנמחק #${shortId}`;
  db.update('entries', [], (l) => {
    l.forEach((e) => {
      if (e.actor === uid) e.actorName = label;
      if (e.target === uid) {
        e.targetName = label;
        if (['phone', 'google_email', 'email'].includes(e.field)) { e.old = e.old ? '—' : e.old; e.new = e.new ? '—' : e.new; }
        if (e.action === 'delete_user') e.old = label;
      }
    });
  });
});
b.serve('seedInstall', () => db.set('entries', []));
