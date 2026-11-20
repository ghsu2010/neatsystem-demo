// Announcements & polls (11-announcements.txt).
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId, todayKey, addDaysKey } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check, ALUMNI_RO } from '../../core/errors.js';

const b = bus.system('announcements', { announces: ['announcement.published', 'poll.closed'] });
const db = ns('announcements');
export const DEFAULTS = { default_days: 7, max_pinned: 1 };
const settings = () => ({ ...DEFAULTS, ...db.get('settings', {}) });
const posts = () => db.get('posts', []);
const votes = () => db.get('votes', {});
const actor = (id) => bus.read('users.actor', id);
const canPost = (a) => !!a && !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor);
const isMod = (a) => !!a && (a.isAdmin || a.isMentor);

function inAudience(p, uid) {
  const u = bus.read('users.get', uid); if (!u) return false;
  if (u.status === 'alumni' && !p.includeAlumni) return false;
  return bus.read('users.matches', uid, p.audience, { includeAlumni: p.includeAlumni });
}
function audienceUsers(p) { return bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => inAudience(p, u.id)).map((u) => u.id); }
const pollClosed = (p) => !!p.poll && (!!p.poll.closedAt || (p.poll.closesAt && p.poll.closesAt < todayKey()));

/** Results visible: after closing to the audience; before closing to the author and Mentors (4). */
function results(p, viewer) {
  const v = votes()[p.id] || {};
  const a = actor(viewer);
  const closed = pollClosed(p);
  const canSee = closed || viewer === p.author || (a && a.isMentor);
  const counts = Object.fromEntries(p.poll.options.map((o) => [o.id, 0]));
  Object.values(v).forEach((ids) => ids.forEach((id) => { if (id in counts) counts[id]++; }));
  return {
    closed, canSee, voters: Object.keys(v).length, mine: v[viewer] || [],
    counts: canSee ? counts : null,
    who: canSee && !p.poll.anonymous ? Object.fromEntries(p.poll.options.map((o) => [o.id, Object.entries(v).filter(([, ids]) => ids.includes(o.id)).map(([u]) => u)])) : null,
  };
}

// ---------- read APIs ----------
b.share('forUser', (uid) => posts().filter((p) => p.expires >= todayKey() && inAudience(p, uid)).sort((a, c) => (c.pinned - a.pinned) || (c.createdAt > a.createdAt ? 1 : -1)));
b.share('archive', (uid) => posts().filter((p) => inAudience(p, uid) || p.author === uid).sort((a, c) => (c.createdAt > a.createdAt ? 1 : -1)));
b.share('all', () => posts().slice().sort((a, c) => (c.createdAt > a.createdAt ? 1 : -1)));
b.share('results', (id, viewer) => { const p = posts().find((x) => x.id === id); return p && p.poll ? results(p, viewer) : null; });
b.share('canPost', (uid) => canPost(actor(uid)));
b.share('canEdit', (uid, id) => { const a = actor(uid); const p = posts().find((x) => x.id === id); return !!p && !!a && !a.readOnly && (isMod(a) || (p.author === uid && p.expires >= todayKey())); });
b.share('settings', () => settings());
b.share('pollClosed', (id) => { const p = posts().find((x) => x.id === id); return !!p && pollClosed(p); });

// ---------- writes ----------
function validate(f, a, existing) {
  const text = (f.text || '').trim();
  check(text.length <= 2000, 'עד 2000 תווים');
  check(text.length >= 1 || f.poll, 'כתבו הודעה או הוסיפו סקר');
  const max = addDaysKey(todayKey(), 90);
  check(f.expires >= todayKey() && f.expires <= max, 'תאריך תפוגה עד 90 יום מהיום');
  if (f.poll) {
    const q = (f.poll.question || '').trim();
    check(q.length >= 1 && q.length <= 140, 'שאלה עד 140 תווים');
    const opts = f.poll.options.map((o) => ({ ...o, text: (o.text || '').trim() })).filter((o) => o.text);
    check(opts.length >= 2 && opts.length <= 30, 'בין 2 ל-30 אפשרויות');
    check(opts.every((o) => o.text.length <= 60), 'אפשרות עד 60 תווים');
    if (f.poll.closesAt) check(f.poll.closesAt <= f.expires, 'הסקר נסגר לפני שההודעה פגה');
    f.poll = { ...f.poll, question: q, options: opts.map((o) => ({ id: o.id || newId('o'), text: o.text })), closesAt: f.poll.closesAt || f.expires };
  }
  // Leads post to their own team only (fixed)
  if (a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor)) f.audience = { all: false, users: [], teams: [a.team], subteams: [], roles: [] };
  check(f.audience && (f.audience.all || ['users', 'teams', 'subteams', 'roles'].some((k) => (f.audience[k] || []).length)), 'בחרו קהל');
  f.text = text;
  return f;
}
function overlaps(p, q) { const s = new Set(audienceUsers(p)); return audienceUsers(q).some((u) => s.has(u)); }
function applyPin(p, by) {
  const max = settings().max_pinned;
  const others = posts().filter((x) => x.id !== p.id && x.pinned && x.expires >= todayKey() && overlaps(x, p)).sort((a, c) => (a.createdAt < c.createdAt ? -1 : 1));
  const excess = others.length - (max - 1);
  others.slice(0, Math.max(0, excess)).forEach((x) => {
    db.update('posts', [], (l) => { l.find((y) => y.id === x.id).pinned = false; });
    b.audit({ actor: by, action: 'unpin', target: x.id, reason: 'נעיצה חדשה' });
    if (x.author !== by) b.notify([x.author], 'announcements.new', 'ההודעה שנעצת כבר לא נעוצה — נעצו הודעה חדשה', '/home');
  });
}
b.serve('publish', ({ actor: id, fields }) => {
  const a = actorFor(id); check(canPost(a));
  const f = validate({ ...fields }, a);
  const p = { id: newId('an'), author: id, text: f.text, audience: f.audience, includeAlumni: !!f.includeAlumni, expires: f.expires, pinned: !!f.pinned, emailAll: !!f.emailAll,
    createdAt: now().toISOString(), editedAt: null, poll: f.poll ? { ...f.poll, multiple: !!f.poll.multiple, anonymous: !!f.poll.anonymous, closedAt: null } : null };
  db.update('posts', [], (l) => { l.push(p); });
  if (p.pinned) applyPin(p, id);
  b.audit({ actor: id, action: 'publish', target: p.id, field: 'text', new: p.text || p.poll.question });
  const aud = audienceUsers(p).filter((u) => u !== id);
  b.notify(aud, 'announcements.new', `הודעה חדשה מ${(bus.read('users.get', id) || {}).name_he}: ${(p.text || p.poll.question).slice(0, 80)}`, '/home', p.emailAll ? { email: 'force' } : {});
  b.emit('announcement.published', { id: p.id, audience: aud });
  return p.id;
});
b.serve('edit', ({ actor: id, postId, fields }) => {
  const a = actorFor(id);
  const p = posts().find((x) => x.id === postId); check(!!p);
  check(isMod(a) || (p.author === id && p.expires >= todayKey()));
  const f = validate({ ...p, ...fields, poll: fields.poll === undefined ? p.poll : fields.poll }, actor(p.author) || a);
  const hasVotes = Object.keys(votes()[p.id] || {}).length > 0;
  if (p.poll && f.poll) {
    check(f.poll.question === p.poll.question, 'אי אפשר לשנות את השאלה אחרי פרסום');
    if (hasVotes) check(JSON.stringify(f.poll.options.map((o) => o.text)) === JSON.stringify(p.poll.options.map((o) => o.text)), 'אי אפשר לשנות אפשרויות אחרי ההצבעה הראשונה');
  }
  db.update('posts', [], (l) => {
    const x = l.find((y) => y.id === postId);
    ['text', 'audience', 'includeAlumni', 'expires', 'pinned', 'emailAll'].forEach((k) => { if (JSON.stringify(x[k]) !== JSON.stringify(f[k])) b.audit({ actor: id, action: 'edit', target: postId, field: k, old: x[k], new: f[k] }); x[k] = f[k]; });
    if (x.poll && f.poll) x.poll = { ...x.poll, options: f.poll.options, closesAt: f.poll.closesAt, multiple: !!f.poll.multiple, anonymous: x.poll.anonymous };
    else if (!x.poll && f.poll) x.poll = { ...f.poll, closedAt: null };
    x.editedAt = now().toISOString();
  });
  const np = posts().find((x) => x.id === postId);
  if (np.pinned && !p.pinned) applyPin(np, id);
});
b.serve('remove', ({ actor: id, postId }) => {
  const a = actorFor(id);
  const p = posts().find((x) => x.id === postId); check(!!p);
  check(isMod(a) || (p.author === id && p.expires >= todayKey()));
  db.set('posts', posts().filter((x) => x.id !== postId));
  const v = { ...votes() }; delete v[postId]; db.set('votes', v);
  b.audit({ actor: id, action: 'delete', target: postId, old: p.text || (p.poll && p.poll.question) });
  return p;
});
b.serve('restore', ({ actor: id, post, pollVotes }) => {
  const a = actorFor(id); check(isMod(a) || post.author === id);
  db.update('posts', [], (l) => { if (!l.some((x) => x.id === post.id)) l.push(post); });
  if (pollVotes) db.set('votes', { ...votes(), [post.id]: pollVotes });
  b.audit({ actor: id, action: 'restore', target: post.id });
});
b.serve('unpin', ({ actor: id, postId }) => {
  const a = actorFor(id);
  const p = posts().find((x) => x.id === postId); check(p && (isMod(a) || p.author === id));
  db.update('posts', [], (l) => { l.find((y) => y.id === postId).pinned = false; });
  b.audit({ actor: id, action: 'unpin', target: postId });
});
b.serve('vote', ({ actor: id, postId, optionIds }) => {
  const a = actorFor(id, { allowReadOnly: true });
  if (a.readOnly) throw new AppError(ALUMNI_RO);
  const p = posts().find((x) => x.id === postId); check(p && p.poll);
  check(inAudience(p, id), 'הסקר לא מיועד לך');
  check(!pollClosed(p), 'הסקר נסגר');
  check(optionIds.length >= 1 && (p.poll.multiple || optionIds.length === 1));
  check(optionIds.every((o) => p.poll.options.some((x) => x.id === o)));
  const v = votes();
  db.set('votes', { ...v, [postId]: { ...(v[postId] || {}), [id]: optionIds } });
  b.audit({ actor: id, action: 'vote', target: postId, field: 'poll', new: p.poll.anonymous ? '(אנונימי)' : optionIds.join(',') });
});
function closePoll(p, by) {
  db.update('posts', [], (l) => { const x = l.find((y) => y.id === p.id); x.poll.closedAt = now().toISOString(); x.poll.notified = true; });
  const voters = Object.keys(votes()[p.id] || {});
  b.notify(voters, 'announcements.poll_closed', `תוצאות הסקר: ${p.poll.question}`, '/home');
  b.emit('poll.closed', { id: p.id, voters });
  b.audit({ actor: by || 'system', action: 'poll_closed', target: p.id, field: 'poll', new: p.poll.question });
}
b.serve('closePoll', ({ actor: id, postId }) => {
  actorFor(id);
  const p = posts().find((x) => x.id === postId); check(p && p.poll && p.author === id, 'רק מי שפרסם/ה סוגר/ת את הסקר');
  check(!pollClosed(p), 'הסקר כבר נסגר');
  closePoll(p, id);
});
b.serve('setSettings', ({ actor: id, patch }) => {
  const a = actorFor(id); check(a.isMentor);
  const s = db.get('settings', {});
  Object.entries(patch).forEach(([k, v]) => { check(k in DEFAULTS && Number.isInteger(v) && v >= 0 && v <= 90, 'ערך לא תקין'); b.audit({ actor: id, action: 'setting', field: 'announcements.' + k, old: settings()[k], new: v }); s[k] = v; });
  db.set('settings', { ...s });
});
// polls closing by date
bus.on('clock.tick', () => { posts().filter((p) => p.poll && !p.poll.notified && pollClosed(p)).forEach((p) => closePoll(p, null)); });
bus.on('user.deleted', ({ uid }) => {
  const mine = posts().filter((p) => p.author === uid).map((p) => p.id);
  db.set('posts', posts().filter((p) => p.author !== uid));
  const v = { ...votes() }; mine.forEach((id) => delete v[id]); Object.keys(v).forEach((k) => { if (v[k][uid]) { v[k] = { ...v[k] }; delete v[k][uid]; } }); db.set('votes', v);
});
b.serve('seedInstall', () => { db.set('posts', []); db.set('votes', {}); db.set('settings', { ...DEFAULTS }); });
