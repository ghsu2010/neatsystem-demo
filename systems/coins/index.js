// Coins (NeatCoins) — every balance and the ledger (06-coins.txt).
// Other systems never change balances: they announce events or ask Coins (Store) and Coins writes.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check } from '../../core/errors.js';

const b = bus.system('coins', { announces: ['coins.changed'] });
const db = ns('coins');

export const DEFAULTS = { task_small: 5, task_medium: 10, task_large: 25, task_huge: 50, streak_bonus: 20, max_single_award: 100, award_cap_lead: 100, award_cap_captain: 200 };
export const EARNING = ['milestone', 'sunday_task', 'attendance', 'streak_bonus', 'manual_award'];
export const TYPE_HE = { milestone: 'הכשרה', sunday_task: 'משימה', attendance: 'נוכחות', streak_bonus: 'בונוס רצף', manual_award: 'הענקה', purchase: 'רכישה', hold: 'שמירה', hold_release: 'שחרור שמירה', refund: 'החזר', reversal: 'ביטול' };

const ledger = () => db.get('ledger', []);
const settings = () => ({ ...DEFAULTS, ...db.get('settings', {}) });

function totals(uid) {
  let balance = 0, held = 0;
  for (const l of ledger()) {
    if (l.uid !== uid) continue;
    balance += l.amount || 0;
    if (l.type === 'hold' && l.holdState === 'open') held += l.hold;
  }
  return { balance, held, spendable: Math.max(0, balance - held) };
}
function canEarn(uid) { const a = bus.read('users.actor', uid); return !!a && a.teamMember; }
function write(line) {
  const l = { id: newId('c'), at: now().toISOString(), ...line };
  db.update('ledger', [], (arr) => { arr.push(l); });
  b.audit({ actor: l.by || 'system', action: 'coin_line', target: l.uid, field: l.type, old: null, new: l.amount, reason: l.desc });
  b.emit('coins.changed', { uid: l.uid, line: l });
  if (l.amount !== 0 && l.type !== 'hold' && l.type !== 'hold_release' && !l.silent) {
    const verb = l.amount > 0 ? `קיבלת ${l.amount} מטבעות` : `ירדו ${-l.amount} מטבעות`;
    b.notify([l.uid], 'coins.changed', `${verb}: ${l.desc}`, `/ledger/${l.uid}?line=${l.id}`);
  }
  return l;
}
/** Earning event from another system, with idempotency (Coins 2). */
function earn({ uid, type, amount, desc, key, by, source }) {
  if (ledger().some((l) => l.key === key)) return null; // duplicate (E1)
  if (!canEarn(uid)) { b.audit({ actor: 'system', action: 'event_ignored', target: uid, field: type, new: amount, reason: `${source}: לא יכול/ה לצבור מטבעות` }); return null; }
  if (!amount) return null;
  return write({ uid, type, amount, desc, key, by: by || 'system', source });
}
/** Reverse an earning line (clamped at spendable; held untouched; shortfall recorded — Coins 7). */
function reverse(lineId, by, reason) {
  const orig = ledger().find((l) => l.id === lineId);
  if (!orig || orig.reversedBy || !EARNING.includes(orig.type)) return null;
  const t = totals(orig.uid);
  const take = Math.min(orig.amount, t.spendable);
  const shortfall = orig.amount - take;
  const r = write({ uid: orig.uid, type: 'reversal', amount: -take, reverses: orig.id, reversedAmount: orig.amount, shortfall, desc: `ביטול: ${orig.desc}${reason ? ` (${reason})` : ''}`, by: by || 'system' });
  db.update('ledger', [], (arr) => { const o = arr.find((x) => x.id === orig.id); o.reversedBy = r.id; });
  return r;
}
function reverseByKey(key, by, reason) { const l = ledger().find((x) => x.key === key && !x.reversedBy); return l ? reverse(l.id, by, reason) : null; }

// ---------- read APIs ----------
b.share('balance', (uid) => totals(uid));
b.share('ledger', (uid, type) => ledger().filter((l) => l.uid === uid && (!type || l.type === type)).slice().reverse());
b.share('all', () => ledger().slice().reverse());
b.share('settings', () => settings());
b.share('taskAmounts', () => { const s = settings(); return { small: s.task_small, medium: s.task_medium, large: s.task_large, huge: s.task_huge }; });
b.share('canEarn', (uid) => canEarn(uid));
/** Coins earned in [from, to) — earning lines minus reversals of earning lines in the period (Coins 6). */
b.share('earned', (uid, from, to) => {
  const f = new Date(from).toISOString(), t = to ? new Date(to).toISOString() : '9999';
  let s = 0;
  for (const l of ledger()) {
    if (l.uid !== uid || l.at < f || l.at >= t) continue;
    if (EARNING.includes(l.type)) s += l.amount;
    else if (l.type === 'reversal') s -= l.reversedAmount || -l.amount;
  }
  return s;
});
function awardRule(a) {
  const s = settings();
  if (a.isAdmin || a.isMentor) return { cap: null };
  if (a.isCaptain) return { cap: s.award_cap_captain };
  if (a.isLead) return { cap: s.award_cap_lead, team: a.team };
  return null;
}
function usedThisMonth(actor) {
  const n = now(); const start = new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  return ledger().filter((l) => l.type === 'manual_award' && l.by === actor && l.at >= start && !l.reversedBy).reduce((s, l) => s + l.amount, 0);
}
b.share('awardAllowance', (actor) => {
  const a = bus.read('users.actor', actor); if (!a) return null;
  const r = awardRule(a); if (!r) return null;
  return { cap: r.cap, remaining: r.cap == null ? null : Math.max(0, r.cap - usedThisMonth(actor)), team: r.team || null, max: settings().max_single_award };
});
b.share('canAwardTo', (actor, target) => {
  const a = bus.read('users.actor', actor); if (!a || a.readOnly) return false;
  const r = awardRule(a); if (!r || actor === target) return false;
  if (!canEarn(target)) return false;
  if (r.team) { const t = bus.read('users.actor', target); return t && t.team === r.team; }
  return true;
});

// ---------- manual awards (Coins 4) ----------
b.serve('award', ({ actor, uids, amount, reason }) => {
  const a = actorFor(actor);
  const r = awardRule(a); check(!!r);
  const s = settings();
  amount = Number(amount);
  check(Number.isInteger(amount) && amount >= 1 && amount <= s.max_single_award, `סכום בין 1 ל-${s.max_single_award}`);
  reason = (reason || '').trim(); check(reason.length >= 3 && reason.length <= 140, 'סיבה: 3–140 תווים');
  check(uids.length > 0, 'בחרו לפחות אדם אחד');
  uids.forEach((u) => { check(u !== actor, 'אי אפשר להעניק לעצמך'); check(canEarn(u), 'אי אפשר להעניק למשתמש/ת הזה/ו'); if (r.team) check((bus.read('users.actor', u) || {}).team === r.team); });
  if (r.cap != null) {
    const remaining = r.cap - usedThisMonth(actor);
    if (amount * uids.length > remaining) throw new AppError(`נשארו לך ${Math.max(0, remaining)} מטבעות להענקה החודש`);
  }
  return uids.map((u) => write({ uid: u, type: 'manual_award', amount, desc: reason, by: actor, key: newId('award') }).id);
});
b.serve('reverse', ({ actor, lineId, reason }) => {
  const a = actorFor(actor); check(a.isAdmin || a.isMentor);
  reason = (reason || '').trim(); check(reason.length >= 3, 'חובה לכתוב סיבה');
  const l = ledger().find((x) => x.id === lineId);
  check(l && EARNING.includes(l.type), 'אפשר לבטל רק שורת צבירה'); check(!l.reversedBy, 'השורה כבר בוטלה');
  return reverse(lineId, actor, reason);
});
b.serve('setSettings', ({ actor, patch }) => {
  const a = actorFor(actor); check(a.isMentor);
  const s = db.get('settings', {});
  Object.entries(patch).forEach(([k, v]) => { check(k in DEFAULTS && Number.isInteger(v) && v >= 0 && v <= 100000, 'ערך לא תקין'); b.audit({ actor, action: 'setting', field: 'coins.' + k, old: settings()[k], new: v }); s[k] = v; });
  db.set('settings', { ...s });
});

// ---------- Store requests (Coins 5). Processed synchronously → one at a time per user. ----------
function spender(uid) { const a = bus.read('users.actor', uid); check(a && a.teamMember && !a.readOnly, 'אין לך הרשאה לפעולה הזו'); }
b.serve('charge', ({ uid, amount, desc, ref, by }) => {
  spender(uid);
  check(Number.isInteger(amount) && amount >= 0);
  if (totals(uid).spendable < amount) throw new AppError('אין מספיק מטבעות');
  return write({ uid, type: 'purchase', amount: -amount, desc, ref, by: by || uid, silent: true }).id;
});
b.serve('hold', ({ uid, amount, desc, ref }) => {
  spender(uid);
  if (totals(uid).spendable < amount) throw new AppError('אין מספיק מטבעות');
  return write({ uid, type: 'hold', amount: 0, hold: amount, holdState: 'open', desc, ref, by: uid, silent: true }).id;
});
function closeHold(holdId, state) {
  let h;
  db.update('ledger', [], (arr) => { h = arr.find((x) => x.id === holdId); check(h && h.type === 'hold' && h.holdState === 'open', 'השמירה כבר טופלה'); h.holdState = state; });
  return h;
}
b.serve('convertHold', ({ holdId, by }) => { const h = closeHold(holdId, 'converted'); return write({ uid: h.uid, type: 'purchase', amount: -h.hold, desc: h.desc, ref: h.ref, hold: h.id, by: by || 'system', silent: true }).id; });
b.serve('releaseHold', ({ holdId, by }) => { const h = closeHold(holdId, 'released'); return write({ uid: h.uid, type: 'hold_release', amount: 0, hold: 0, desc: h.desc, ref: h.ref, by: by || 'system', silent: true }).id; });
b.serve('refund', ({ uid, amount, desc, ref, by }) => write({ uid, type: 'refund', amount, desc: `החזר: ${desc}`, ref, by: by || 'system' }).id);

// ---------- events (Coins "Listens to") ----------
bus.on('milestone.approved', ({ uid, requestId, coins, name, approved_by }) => earn({ uid, type: 'milestone', amount: coins, desc: name, key: `trainings:${requestId}:${uid}:approved`, by: approved_by, source: 'trainings' }));
bus.on('milestone.unapproved', ({ uid, requestId, by }) => reverseByKey(`trainings:${requestId}:${uid}:approved`, by, 'האישור בוטל'));
bus.on('task.approved', ({ uid, approvalId, size, title, approved_by }) => {
  const amt = { small: 'task_small', medium: 'task_medium', large: 'task_large', huge: 'task_huge' }[size];
  if (!amt) return;
  earn({ uid, type: 'sunday_task', amount: settings()[amt], desc: title, key: `sunday:${approvalId}:${uid}:approved`, by: approved_by, source: 'sunday' });
});
bus.on('task.unapproved', ({ uid, approvalId, by }) => reverseByKey(`sunday:${approvalId}:${uid}:approved`, by, 'המשימה יצאה מ"בוצע"'));
bus.on('attendance.paid', ({ uid, payId, coins, desc, by }) => earn({ uid, type: 'attendance', amount: coins, desc, key: `attendance:${payId}:${uid}:paid`, by, source: 'attendance' }));
bus.on('attendance.unpaid', ({ uid, payId, by }) => reverseByKey(`attendance:${payId}:${uid}:paid`, by, 'הנוכחות שונתה'));
bus.on('streak.bonus', ({ uid, bonusId, streak }) => earn({ uid, type: 'streak_bonus', amount: settings().streak_bonus, desc: `בונוס רצף ${streak}`, key: `streak:${bonusId}:${uid}`, source: 'attendance' }));
bus.on('streak.bonus_reversed', ({ uid, bonusId }) => reverseByKey(`streak:${bonusId}:${uid}`, 'system', 'הרצף השתנה'));
bus.on('user.deleted', ({ uid }) => db.set('ledger', ledger().filter((l) => l.uid !== uid)));

b.serve('seedInstall', () => { db.set('ledger', []); db.set('settings', { ...DEFAULTS }); });
