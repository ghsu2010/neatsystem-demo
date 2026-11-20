// Notifications — the bell and emails for every system (13-notifications.txt).
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { check } from '../../core/errors.js';

const b = bus.system('notifications', { announces: [] });
const db = ns('notifications');

/** Every notification type (Notifications 4). email: default; locked: can't be turned off; digest: daily 20:00 */
export const TYPES = [
  { system: 'users', label: 'משתמשים', types: [
    ['users.account', 'החשבון שלך אושר / נדחה', { email: true, locked: true }],
    ['users.signup', 'בקשת הצטרפות חדשה'], ['users.changed', 'שינוי בצוות, בתפקיד או במצב בוגר'], ['users.picture', 'תמונת הפרופיל שלך הוסרה']] },
  { system: 'announcements', label: 'הודעות', types: [['announcements.new', 'הודעה חדשה בשבילך'], ['announcements.poll_closed', 'סקר שהצבעת בו נסגר']] },
  { system: 'coins', label: 'מטבעות', types: [['coins.changed', 'קיבלת מטבעות או שבוטלו (סיכום יומי ב-20:00)', { digest: true }]] },
  { system: 'store', label: 'חנות', types: [['store.request_state', 'בקשה שלך אושרה / נדחתה / בוטלה / נמסרה'], ['store.to_handle', 'בקשה חדשה לטיפול'],
    ['store.waiting', 'פרס צוות או הענקת תגית מחכים לאישור'], ['store.proposal', 'ההצעה שלך אושרה / נדחתה'], ['store.awarded', 'קיבלת תגית או פריט / תגית הוסרה']] },
  { system: 'attendance', label: 'נוכחות', types: [['attendance.meeting', 'פגישה נוספת / פגישה בוטלה'], ['attendance.freeze', 'השתמשנו בהקפאת רצף']] },
  { system: 'trainings', label: 'הכשרות', types: [['trainings.request', 'בקשה חדשה לאישור'], ['trainings.decision', 'הבקשה שלך אושרה / נדחתה'],
    ['trainings.undone', 'החלטה בוטלה'], ['trainings.reminder', 'תזכורת שבועית: בקשה מחכה'], ['trainings.reapproval', 'שינוי מהותי: צריך לשלוח שוב'],
    ['trainings.approver', 'מונית / הוסרת כמאשר/ת'], ['trainings.access', 'קיבלת / הוסרה גישה לעץ']] },
  { system: 'ranks', label: 'דרגות', types: [['ranks.rankup', 'עלייה בדרגה']] },
  { system: 'sunday', label: 'סאנדיי', types: [['sunday.assigned', 'שויכת למשימה'], ['sunday.deadline', 'תאריך יעד מתקרב / עבר'], ['sunday.mention', 'תייגו אותך בעדכון'],
    ['sunday.comment', 'עדכון חדש במשימה שלך'], ['sunday.left', 'חבר/ה עזב/ה משימה'], ['sunday.size', 'משימה חדשה מחכה לגודל'],
    ['sunday.coin_queue', 'משימה מחכה לאישור מטבעות'], ['sunday.coin_decision', 'מטבעות אושרו / נדחו'], ['sunday.inactive', 'למשתמש/ת לא פעיל/ה יש משימות פתוחות']] },
];
const TYPE_MAP = new Map(TYPES.flatMap((g) => g.types.map(([id, label, o = {}]) => [id, { id, label, system: g.system, ...o }])));

const list = () => db.get('list', []);
const prefs = () => db.get('prefs', {});
function emailOn(uid, type) {
  const t = TYPE_MAP.get(type) || {};
  if (t.locked) return true;
  const p = (prefs()[uid] || {})[type];
  return p === undefined ? !!t.email : p;
}
function sendEmail(to, subject, text, link) {
  db.update('outbox', [], (o) => { o.push({ id: newId('e'), to, subject: `[Neat Team] ${subject}`, text, link, at: now().toISOString(), footer: 'ניהול התראות מייל' }); if (o.length > 300) o.splice(0, o.length - 300); });
}

// ---------- offered to every system ----------
b.serve('notify', ({ system, uids, type, text, link, email }) => {
  const t = String(text || '').slice(0, 120);
  const at = now().toISOString();
  const add = uids.map((u) => ({ id: newId('n'), uid: u, system, type, text: t, link: link || '/home', at, read: false }));
  db.update('list', [], (l) => { l.push(...add); });
  uids.forEach((u) => {
    const user = bus.read('users.get', u);
    const to = user ? user.google_email : null;
    if (!to) return;
    if (email === 'force' || email === 'locked' || emailOn(u, type)) {
      if ((TYPE_MAP.get(type) || {}).digest) db.update('digest', {}, (d) => { (d[u] = d[u] || []).push(t); });
      else sendEmail(to, t, t, link);
    }
  });
});
b.serve('email', ({ to, subject, text }) => sendEmail(to, subject, text, '/'));
b.share('unreadCount', (uid) => list().filter((n) => n.uid === uid && !n.read).length);
b.share('list', (uid) => list().filter((n) => n.uid === uid).sort((a, c) => (c.at > a.at ? 1 : -1)));
b.share('types', () => TYPES);
b.share('emailOn', (uid, type) => emailOn(uid, type));
b.share('outbox', () => db.get('outbox', []));

b.serve('markRead', ({ actor, id }) => {
  actorFor(actor, { allowReadOnly: true, allowNoRole: true });
  db.update('list', [], (l) => { const n = l.find((x) => x.id === id); check(n && n.uid === actor); n.read = true; });
});
b.serve('markAllRead', ({ actor }) => {
  actorFor(actor, { allowReadOnly: true, allowNoRole: true });
  db.update('list', [], (l) => { l.forEach((n) => { if (n.uid === actor) n.read = true; }); });
});
b.serve('setEmailPref', ({ actor, type, on }) => {
  actorFor(actor, { allowReadOnly: true, allowNoRole: true });
  const t = TYPE_MAP.get(type); check(t && !t.locked);
  const p = prefs();
  const old = emailOn(actor, type);
  db.set('prefs', { ...p, [actor]: { ...(p[actor] || {}), [type]: !!on } });
  b.audit({ actor, action: 'setting', target: actor, field: 'email.' + type, old, new: !!on });
});

// ---------- housekeeping: 90-day cleanup, coin digest at 20:00 ----------
bus.on('clock.tick', ({ now: n }) => {
  const cutoff = new Date(n.getTime() - 90 * 86400000).toISOString();
  const l = list();
  if (l.some((x) => x.at < cutoff)) db.set('list', l.filter((x) => x.at >= cutoff));
  const today = `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}`;
  if (n.getHours() >= 20 && db.get('digest_day', null) !== today) {
    const d = db.get('digest', {});
    Object.entries(d).forEach(([u, lines]) => { const user = bus.read('users.get', u); if (user && lines.length) sendEmail(user.google_email, 'סיכום מטבעות יומי', lines.join('\n'), '/home'); });
    db.set('digest', {}); db.set('digest_day', today);
  }
});
bus.on('user.deleted', ({ uid }) => {
  db.set('list', list().filter((n) => n.uid !== uid));
  const p = { ...prefs() }; delete p[uid]; db.set('prefs', p);
});
b.serve('seedInstall', () => { db.set('list', []); db.set('prefs', {}); db.set('outbox', []); });
