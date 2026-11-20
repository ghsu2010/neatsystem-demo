// Store (NeatStore) — items, cosmetics, tags, purchases & requests, Streak Freeze sales,
// owned/equipped items, wishlists, awards and proposals (07-store.txt). Asks Coins to charge/hold.
import { bus } from '../../core/bus.js';
import { ns, files } from '../../core/storage.js';
import { now } from '../../core/clock.js';
import { uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { AppError, check, ALUMNI_RO } from '../../core/errors.js';
import { COSMETICS } from './cosmetics.js';

const b = bus.system('store', { announces: ['freeze.bought', 'item.awarded', 'purchase.changed'] });
const db = ns('store');
export const img = files('store');

export const SLOTS = [['banner', 'באנר'], ['frame', 'מסגרת'], ['nameColor', 'צבע שם'], ['nameplate', 'לוחית שם'], ['effect', 'אפקט פרופיל'], ['theme', 'ערכת נושא']];
export const SLOT_HE = Object.fromEntries(SLOTS);
export const STATE_HE = { requested: 'ממתין לאישור', approved: 'אושר', delivered: 'נמסר', rejected: 'נדחה', cancelled: 'בוטל', completed: 'הושלם', refunded: 'הוחזר' };

// ---------- cosmetics registry (code only; demo cosmetics are registered by core/demo) ----------
const registry = new Map(COSMETICS.map((c) => [c.id, c]));
b.serve('registerDemoCosmetics', (list) => { list.forEach((c) => registry.set(c.id, { ...c, demo: true })); });

const cfg = () => db.get('cosmetic_cfg', {});
const items = () => db.get('items', []);
const purchases = () => db.get('purchases', []);
const owned = () => db.get('owned', {});
const equippedAll = () => db.get('equipped', {});
const shown = () => db.get('shown_tags', {});
const wish = () => db.get('wishlist', {});
const collections = () => db.get('collections', []);
const freezeCfg = () => db.get('freeze', { price: 150 });

/** Unified item view: cosmetics (code + cfg), created items, the Streak Freeze. */
function allItems({ includeHidden = true } = {}) {
  const out = [];
  registry.forEach((c) => {
    const k = cfg()[c.id] || {};
    out.push({ id: c.id, type: 'cosmetic', slot: c.slot, name: c.name, desc: c.desc || '', def: c, demo: !!c.demo, price: k.price ?? c.defaultPrice ?? 100,
      visible: k.visible !== false, stock: k.stock ?? null, limit: 1, collection: k.collection || null, forSale: true, createdAt: c.createdAt || '2026-01-01' });
  });
  items().filter((i) => !i.deleted).forEach((i) => out.push({ ...i, visible: !i.hidden && i.approval === 'live' }));
  out.push({ id: 'freeze', type: 'freeze', name: 'הקפאת רצף', desc: 'שומרת על הרצף שלך כשמסמנים אותך "לא נוכח".', price: freezeCfg().price, visible: true, stock: null, forSale: true, createdAt: '2026-01-01' });
  return includeHidden ? out : out.filter((i) => i.visible);
}
const itemById = (id) => allItems().find((i) => i.id === id);
const actor = (id) => bus.read('users.actor', id);
const isManager = (a) => a && (a.isAdmin || a.isMentor);
function soldCount(id) { return purchases().filter((p) => p.itemId === id && ['completed', 'requested', 'approved', 'delivered'].includes(p.state)).length; }
function personCount(uid, id) { return purchases().filter((p) => p.uid === uid && p.itemId === id && ['completed', 'requested', 'approved', 'delivered'].includes(p.state)).length; }
const ownsItem = (uid, id) => (owned()[uid] || []).includes(id);

/** Resolved cosmetics for display (Design 8.4). */
function equipped(uid) {
  const e = equippedAll()[uid] || {};
  const r = {};
  Object.entries(e).forEach(([slot, id]) => { const c = registry.get(id); if (c && ownsItem(uid, id)) r[slot] = c.look; });
  return r;
}
function tagView(id) { const t = items().find((i) => i.id === id); return t ? { id: t.id, text: t.name, color: t.color } : null; }

// ---------- read APIs ----------
b.share('equipped', (uid) => equipped(uid));
b.share('equippedIds', (uid) => equippedAll()[uid] || {});
b.share('shownTags', (uid) => (shown()[uid] || []).filter((t) => ownsItem(uid, t)).map(tagView).filter(Boolean).slice(0, 3));
b.share('ownedTags', (uid) => (owned()[uid] || []).map(tagView).filter(Boolean));
b.share('ownedItems', (uid) => (owned()[uid] || []).map(itemById).filter(Boolean));
b.share('wishlist', (uid) => (wish()[uid] || []).map(itemById).filter(Boolean));
b.share('items', (opts) => allItems(opts));
b.share('item', (id) => itemById(id));
b.share('collections', () => collections());
b.share('purchases', (uid) => purchases().filter((p) => p.uid === uid).slice().reverse());
b.share('allPurchases', () => purchases().slice().reverse());
b.share('proposals', () => db.get('proposals', []));
b.share('cosmetic', (id) => registry.get(id) || null);
b.share('ownsItem', (uid, id) => ownsItem(uid, id));
b.share('soldCount', (id) => soldCount(id));
b.share('personCount', (uid, id) => personCount(uid, id));
b.share('canHandleRequest', (actorId, pid) => { const p = purchases().find((x) => x.id === pid); return !!p && canHandle(actor(actorId), p); });
b.share('requestsToHandle', (actorId) => { const a = actor(actorId); return purchases().filter((p) => p.state === 'requested' && canHandle(a, p)).length; });
b.share('waitingApproval', () => items().filter((i) => !i.deleted && (i.approval === 'pending' || i.pendingEdit)).length + db.get('proposals', []).filter((p) => p.state === 'pending').length);
b.share('isManager', (id) => isManager(actor(id)));
b.share('canPropose', (id) => { const a = actor(id); return !!a && !a.readOnly && (a.isLead || a.isCaptain); });

function canHandle(a, p) {
  if (!a || a.readOnly || a.id === p.uid) return false;
  if (a.isAdmin || a.isMentor) return true;
  const it = itemById(p.itemId);
  if (it && it.visibleTo) { if (a.isCaptain) return true; if (a.isLead && a.team === it.visibleTo) return true; }
  return false;
}
function approversFor(it) {
  const all = bus.read('users.list', { statuses: ['active'] }).map((u) => actor(u.id));
  return all.filter((a) => a.isAdmin || a.isMentor || (it.visibleTo && (a.isCaptain || (a.isLead && a.team === it.visibleTo)))).map((a) => a.id);
}
function buyer(actorId) {
  const a = actorFor(actorId, { allowReadOnly: true });
  if (a.readOnly) throw new AppError(ALUMNI_RO);
  check(a.teamMember, 'אין לך הרשאה לפעולה הזו');
  return a;
}
function canSee(a, it) { return it.visible && (!it.visibleTo || a.team === it.visibleTo); }
b.share('canSee', (uid, id) => { const a = actor(uid); const it = itemById(id); return !!a && !!it && canSee(a, it); });
function addOwned(uid, id) { const o = owned(); if (!(o[uid] || []).includes(id)) db.set('owned', { ...o, [uid]: [...(o[uid] || []), id] }); removeWish(uid, id); }
function removeWish(uid, id) { const w = wish(); if ((w[uid] || []).includes(id)) db.set('wishlist', { ...w, [uid]: w[uid].filter((x) => x !== id) }); }
function record(p) { db.update('purchases', [], (l) => { l.push(p); }); b.emit('purchase.changed', { purchase: p }); return p; }
function setState(pid, state, by, reason) {
  let p;
  db.update('purchases', [], (l) => { p = l.find((x) => x.id === pid); p.state = state; p.history.push({ state, by, at: now().toISOString(), reason: reason || null }); });
  b.audit({ actor: by, action: 'purchase_' + state, target: p.uid, field: p.itemId, new: state, reason });
  b.emit('purchase.changed', { purchase: p });
  return p;
}

// ---------- buying (5) ----------
b.serve('buy', ({ actor: actorId, itemId }) => {
  const a = buyer(actorId);
  const it = itemById(itemId); check(it && canSee(a, it) && it.forSale, 'הפריט לא זמין');
  check(!['prize', 'privilege'].includes(it.type), 'לפריט הזה שולחים בקשה');
  if (it.type === 'freeze') {
    const cap = bus.read('attendance.settings').freeze_cap;
    if (bus.read('attendance.freezes', actorId) >= cap) throw new AppError(`יש לך כבר ${cap} הקפאות`);
  } else check(!ownsItem(actorId, itemId), 'כבר בבעלותך');
  if (it.stock != null && soldCount(itemId) >= it.stock) throw new AppError('אזל');
  const lineId = bus.ask('coins.charge', { uid: actorId, amount: it.price, desc: it.name, ref: itemId, by: actorId });
  const p = record({ id: newId('pu'), uid: actorId, itemId, itemName: it.name, kind: 'digital', price: it.price, state: 'completed', lineId, at: now().toISOString(), history: [{ state: 'completed', by: actorId, at: now().toISOString() }] });
  b.audit({ actor: actorId, action: 'purchase', target: actorId, field: itemId, new: it.price });
  if (it.type === 'freeze') b.emit('freeze.bought', { uid: actorId, purchaseId: p.id });
  else addOwned(actorId, itemId);
  return p.id;
});
b.serve('request', ({ actor: actorId, itemId, note }) => {
  const a = buyer(actorId);
  const it = itemById(itemId); check(it && canSee(a, it) && it.forSale && ['prize', 'privilege'].includes(it.type), 'הפריט לא זמין');
  if (it.stock != null && soldCount(itemId) >= it.stock) throw new AppError('אזל');
  if (it.limit && personCount(actorId, itemId) >= it.limit) throw new AppError('הגעת למגבלה');
  const holdId = bus.ask('coins.hold', { uid: actorId, amount: it.price, desc: it.name, ref: itemId });
  const p = record({ id: newId('pu'), uid: actorId, itemId, itemName: it.name, kind: 'request', price: it.price, state: 'requested', note: (note || '').slice(0, 280), holdId, team: it.visibleTo || null, at: now().toISOString(), history: [{ state: 'requested', by: actorId, at: now().toISOString() }] });
  b.audit({ actor: actorId, action: 'request', target: actorId, field: itemId, new: it.price, reason: note });
  b.notify(approversFor(it).filter((x) => x !== actorId), 'store.to_handle', `בקשה חדשה: ${(bus.read('users.get', actorId) || {}).name_he} · ${it.name}`, `/manage/store/store/requests?id=${p.id}`);
  return p.id;
});
b.serve('cancelRequest', ({ actor: actorId, purchaseId }) => {
  actorFor(actorId, { allowReadOnly: true });
  const p = purchases().find((x) => x.id === purchaseId); check(p && p.uid === actorId);
  check(p.state === 'requested', 'אפשר לבטל רק בקשה שממתינה');
  bus.ask('coins.releaseHold', { holdId: p.holdId, by: actorId });
  setState(purchaseId, 'cancelled', actorId);
  b.notify([p.uid], 'store.request_state', `הבקשה בוטלה — ${p.itemName}`, '/store/purchases');
});
b.serve('decide', ({ actor: actorId, purchaseId, approve, reason }) => {
  const a = actorFor(actorId);
  const p = purchases().find((x) => x.id === purchaseId); check(p && canHandle(a, p));
  if (p.state !== 'requested') throw new AppError('הבקשה כבר טופלה');
  if (approve) {
    bus.ask('coins.convertHold', { holdId: p.holdId, by: actorId });
    setState(purchaseId, 'approved', actorId);
    b.notify([p.uid], 'store.request_state', `הבקשה אושרה — ${p.itemName}`, '/store/purchases');
  } else {
    reason = (reason || '').trim(); check(reason.length >= 3, 'חובה לכתוב סיבה');
    bus.ask('coins.releaseHold', { holdId: p.holdId, by: actorId });
    setState(purchaseId, 'rejected', actorId, reason);
    b.notify([p.uid], 'store.request_state', `הבקשה נדחתה — ${p.itemName}: ${reason}`, '/store/purchases');
  }
});
b.serve('deliver', ({ actor: actorId, purchaseId }) => {
  const a = actorFor(actorId);
  const p = purchases().find((x) => x.id === purchaseId); check(p && canHandle(a, p) && p.state === 'approved');
  setState(purchaseId, 'delivered', actorId);
  b.notify([p.uid], 'store.request_state', `סומן כנמסר — ${p.itemName}`, '/store/purchases');
});
b.serve('cancelApproved', ({ actor: actorId, purchaseId, reason }) => {
  const a = actorFor(actorId);
  const p = purchases().find((x) => x.id === purchaseId); check(p && canHandle(a, p) && p.state === 'approved');
  reason = (reason || '').trim(); check(reason.length >= 3, 'חובה לכתוב סיבה');
  bus.ask('coins.refund', { uid: p.uid, amount: p.price, desc: p.itemName, ref: p.id, by: actorId });
  setState(purchaseId, 'cancelled', actorId, reason);
  b.notify([p.uid], 'store.request_state', `הבקשה בוטלה — ${p.itemName}: ${reason}`, '/store/purchases');
});
/** Mentor refunds a digital purchase: item removed, Coins refunds (5.1). Freezes are not refundable. */
b.serve('refund', ({ actor: actorId, purchaseId }) => {
  const a = actorFor(actorId); check(a.isMentor);
  const p = purchases().find((x) => x.id === purchaseId); check(p && p.state === 'completed' && p.kind === 'digital' && p.itemId !== 'freeze', 'אי אפשר להחזיר את הרכישה הזו');
  if (p.price) bus.ask('coins.refund', { uid: p.uid, amount: p.price, desc: p.itemName, ref: p.id, by: actorId });
  removeOwned(p.uid, p.itemId);
  setState(purchaseId, 'refunded', actorId);
});
function removeOwned(uid, id) {
  const o = owned(); db.set('owned', { ...o, [uid]: (o[uid] || []).filter((x) => x !== id) });
  const e = equippedAll()[uid] || {}; const ne = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== id)); db.set('equipped', { ...equippedAll(), [uid]: ne });
  const s = shown()[uid] || []; if (s.includes(id)) db.set('shown_tags', { ...shown(), [uid]: s.filter((x) => x !== id) });
}

// ---------- equip, shown tags, wishlist ----------
b.serve('equip', ({ actor: actorId, slot, itemId }) => {
  actorFor(actorId, { allowReadOnly: true });
  if (itemId) { const c = registry.get(itemId); check(c && c.slot === slot && ownsItem(actorId, itemId)); }
  const e = { ...(equippedAll()[actorId] || {}) };
  const old = e[slot] || null;
  if (itemId) e[slot] = itemId; else delete e[slot];
  db.set('equipped', { ...equippedAll(), [actorId]: e });
  b.audit({ actor: actorId, action: 'equip', target: actorId, field: slot, old, new: itemId });
});
b.serve('saveEquip', ({ actor: actorId, equip, tags }) => {
  actorFor(actorId, { allowReadOnly: true });
  Object.entries(equip).forEach(([slot, id]) => { if (id) { const c = registry.get(id); check(c && c.slot === slot && ownsItem(actorId, id)); } });
  check(tags.length <= 3 && tags.every((t) => ownsItem(actorId, t)), 'אפשר להציג עד 3 תגיות');
  db.set('equipped', { ...equippedAll(), [actorId]: Object.fromEntries(Object.entries(equip).filter(([, v]) => v)) });
  db.set('shown_tags', { ...shown(), [actorId]: tags });
  b.audit({ actor: actorId, action: 'equip_save', target: actorId, field: 'equipped', new: { equip, tags } });
});
b.serve('showTag', ({ actor: actorId, tagId }) => {
  actorFor(actorId, { allowReadOnly: true });
  check(ownsItem(actorId, tagId));
  const s = shown()[actorId] || [];
  if (s.includes(tagId)) return;
  check(s.length < 3, 'אפשר להציג עד 3 תגיות — הסירו אחת קודם');
  db.set('shown_tags', { ...shown(), [actorId]: [...s, tagId] });
});
b.serve('toggleWish', ({ actor: actorId, itemId }) => {
  actorFor(actorId, { allowReadOnly: true });
  check(!ownsItem(actorId, itemId), 'כבר בבעלותך');
  const w = wish()[actorId] || [];
  db.set('wishlist', { ...wish(), [actorId]: w.includes(itemId) ? w.filter((x) => x !== itemId) : [...w, itemId] });
});

// ---------- awards & proposals (6) ----------
function award(by, uid, itemId, reason, proposalId) {
  const it = itemById(itemId); check(it && (it.type === 'tag' || it.type === 'cosmetic'), 'אפשר להעניק רק תגית או פריט קוסמטי');
  check(!ownsItem(uid, itemId), 'כבר בבעלות המשתמש/ת');
  addOwned(uid, itemId);
  record({ id: newId('pu'), uid, itemId, itemName: it.name, kind: 'award', price: 0, state: 'completed', reason, by, proposalId: proposalId || null, at: now().toISOString(), history: [{ state: 'completed', by, at: now().toISOString(), reason }] });
  b.audit({ actor: by, action: 'award', target: uid, field: itemId, new: it.name, reason });
  b.emit('item.awarded', { uid, itemId, by });
  b.notify([uid], 'store.awarded', `קיבלת ${it.type === 'tag' ? 'תגית' : 'פריט'}: ${it.name}`, it.type === 'tag' ? '/store/my-items?slot=tags' : `/store/my-items?slot=${it.slot}`);
}
b.serve('award', ({ actor: actorId, uid, itemId, reason }) => {
  const a = actorFor(actorId); check(isManager(a));
  reason = (reason || '').trim(); check(reason.length >= 3 && reason.length <= 140, 'סיבה: 3–140 תווים');
  check(actor(uid) && !actor(uid).noRole);
  award(actorId, uid, itemId, reason);
});
b.serve('proposeTag', ({ actor: actorId, uid, tagId, newTag, reason }) => {
  const a = actorFor(actorId); check(a.isCaptain || a.isLead);
  if (a.isLead && !a.isCaptain) check((actor(uid) || {}).team === a.team, 'רש"צ מציע/ה רק לחברי הצוות שלו/ה');
  reason = (reason || '').trim(); check(reason.length >= 3 && reason.length <= 140, 'סיבה: 3–140 תווים');
  if (newTag) { check(newTag.text && newTag.text.trim().length >= 1 && newTag.text.trim().length <= 24, 'תגית עד 24 תווים'); }
  else check(items().some((i) => i.id === tagId && i.type === 'tag'));
  const p = { id: newId('pr'), kind: 'tag_award', proposer: actorId, uid, tagId: tagId || null, newTag: newTag || null, reason, state: 'pending', at: now().toISOString() };
  db.update('proposals', [], (l) => { l.push(p); });
  b.audit({ actor: actorId, action: 'propose_tag', target: uid, field: tagId || 'new', new: newTag ? newTag.text : tagId, reason });
  b.notify(mentors(), 'store.waiting', `הצעה להענקת תגית ל${(bus.read('users.get', uid) || {}).name_he}`, '/manage/store/store/waiting');
  return p.id;
});
b.serve('decideProposal', ({ actor: actorId, proposalId, approve, reason }) => {
  const a = actorFor(actorId); check(a.isMentor);
  const p = (db.get('proposals', [])).find((x) => x.id === proposalId); check(p && p.state === 'pending', 'ההצעה כבר טופלה');
  if (approve) {
    let tagId = p.tagId;
    if (!tagId) tagId = createItem(actorId, { type: 'tag', name: p.newTag.text.trim(), color: p.newTag.color, price: 0, forSale: false, approval: 'live' });
    award(actorId, p.uid, tagId, p.reason, p.id);
  }
  db.update('proposals', [], (l) => { const x = l.find((y) => y.id === proposalId); x.state = approve ? 'approved' : 'rejected'; x.decidedBy = actorId; x.decisionReason = reason || null; });
  b.audit({ actor: actorId, action: approve ? 'proposal_approved' : 'proposal_rejected', target: p.uid, field: proposalId, reason });
  b.notify([p.proposer], 'store.proposal', `ההצעה שלך ${approve ? 'אושרה' : 'נדחתה'}: תגית ל${(bus.read('users.get', p.uid) || {}).name_he}`, '/store');
});
b.serve('removeTag', ({ actor: actorId, uid, tagId }) => {
  const a = actorFor(actorId); check(a.isMentor);
  check(ownsItem(uid, tagId));
  const bought = purchases().find((p) => p.uid === uid && p.itemId === tagId && p.kind === 'digital' && p.state === 'completed');
  if (bought && bought.price) { bus.ask('coins.refund', { uid, amount: bought.price, desc: bought.itemName, ref: bought.id, by: actorId }); setState(bought.id, 'refunded', actorId); }
  removeOwned(uid, tagId);
  b.audit({ actor: actorId, action: 'remove_tag', target: uid, field: tagId });
  b.notify([uid], 'store.awarded', `תגית הוסרה ממך: ${(tagView(tagId) || {}).text}`, '/profile/' + uid);
});
const mentors = () => bus.read('users.list', { statuses: ['active'] }).filter((u) => u.role === 'mentor').map((u) => u.id);

// ---------- management (8) ----------
function createItem(by, f) {
  const it = { id: newId('it'), type: f.type, name: f.name, desc: f.desc || '', image: f.image || null, color: f.color || null, price: f.price ?? 0, stock: f.stock ?? null,
    limit: f.limit ?? null, visibleTo: f.visibleTo || null, forSale: f.forSale !== false, collection: f.collection || null, hidden: false, approval: f.approval || 'live',
    createdBy: by, createdAt: now().toISOString(), deleted: false };
  db.update('items', [], (l) => { l.push(it); });
  b.audit({ actor: by, action: 'item_create', target: it.id, field: 'name', new: it.name });
  return it.id;
}
function validate(f) {
  check(['tag', 'prize', 'privilege'].includes(f.type));
  const max = f.type === 'tag' ? 24 : 40;
  check(f.name && f.name.trim().length >= 1 && f.name.trim().length <= max, `שם עד ${max} תווים`);
  check(!f.desc || f.desc.length <= 300, 'תיאור עד 300 תווים');
  check(Number.isInteger(f.price) && f.price >= 0, 'מחיר לא תקין');
  check(f.stock == null || (Number.isInteger(f.stock) && f.stock >= 0), 'מלאי לא תקין');
}
b.serve('saveItem', ({ actor: actorId, id, fields }) => {
  const a = actorFor(actorId);
  const f = { ...fields, name: (fields.name || '').trim() };
  validate(f);
  const teamReward = !!f.visibleTo;
  if (!isManager(a)) {
    check(teamReward && (a.isCaptain || (a.isLead && a.team === f.visibleTo)), 'אין לך הרשאה לפעולה הזו');
  }
  if (!id) {
    const newId_ = createItem(actorId, { ...f, approval: isManager(a) ? 'live' : 'pending' });
    if (!isManager(a)) b.notify(mentors(), 'store.waiting', `פרס צוות מחכה לאישור: ${f.name}`, '/manage/store/store/waiting');
    return newId_;
  }
  const cur = items().find((i) => i.id === id); check(cur && !cur.deleted);
  if (!isManager(a)) {
    check(cur.visibleTo && (a.isCaptain || (a.isLead && a.team === cur.visibleTo)));
    // edits of a live team reward go back to approval; the old version stays live (6)
    db.update('items', [], (l) => { const x = l.find((y) => y.id === id); if (x.approval === 'live') x.pendingEdit = { ...f, by: actorId }; else Object.assign(x, f); });
    b.notify(mentors(), 'store.waiting', `עריכת פרס צוות מחכה לאישור: ${f.name}`, '/manage/store/store/waiting');
    b.audit({ actor: actorId, action: 'item_edit_proposed', target: id, new: f.name });
    return id;
  }
  db.update('items', [], (l) => { const x = l.find((y) => y.id === id); Object.entries(f).forEach(([k, v]) => { if (JSON.stringify(x[k]) !== JSON.stringify(v)) b.audit({ actor: actorId, action: 'item_edit', target: id, field: k, old: x[k], new: v }); x[k] = v; }); });
  return id;
});
b.serve('decideItem', ({ actor: actorId, id, approve, price, reason }) => {
  const a = actorFor(actorId); check(a.isMentor);
  db.update('items', [], (l) => {
    const x = l.find((y) => y.id === id); check(!!x);
    if (x.pendingEdit) { if (approve) { const { by, ...f } = x.pendingEdit; Object.assign(x, f); if (price != null) x.price = price; } x.pendingEdit = null; }
    else { x.approval = approve ? 'live' : 'rejected'; if (approve && price != null) x.price = price; }
    b.audit({ actor: actorId, action: approve ? 'item_approved' : 'item_rejected', target: id, new: x.name, reason });
    b.notify([x.createdBy], 'store.proposal', `ההצעה שלך ${approve ? 'אושרה' : 'נדחתה'}: ${x.name}`, '/store');
  });
});
b.serve('setItemFlags', ({ actor: actorId, id, hidden }) => {
  const a = actorFor(actorId); check(isManager(a));
  db.update('items', [], (l) => { const x = l.find((y) => y.id === id); check(!!x); b.audit({ actor: actorId, action: 'item_hidden', target: id, old: x.hidden, new: hidden }); x.hidden = hidden; });
});
b.serve('deleteItem', ({ actor: actorId, id }) => {
  const a = actorFor(actorId); check(isManager(a));
  check(!purchases().some((p) => p.itemId === id), 'אפשר למחוק רק פריט שאף אחד לא קנה או קיבל — אפשר להסתיר אותו');
  db.update('items', [], (l) => { const x = l.find((y) => y.id === id); x.deleted = true; });
  b.audit({ actor: actorId, action: 'item_delete', target: id });
});
b.serve('setCosmetic', ({ actor: actorId, id, patch }) => {
  const a = actorFor(actorId); check(isManager(a)); check(registry.has(id));
  const allowed = ['price', 'visible', 'stock', 'collection'];
  Object.keys(patch).forEach((k) => check(allowed.includes(k)));
  if ('price' in patch) check(Number.isInteger(patch.price) && patch.price >= 0, 'מחיר לא תקין');
  const c = cfg();
  b.audit({ actor: actorId, action: 'cosmetic_cfg', target: id, field: Object.keys(patch).join(','), old: c[id] || null, new: patch });
  db.set('cosmetic_cfg', { ...c, [id]: { ...(c[id] || {}), ...patch } });
});
b.serve('setFreezePrice', ({ actor: actorId, price }) => {
  const a = actorFor(actorId); check(isManager(a)); check(Number.isInteger(price) && price >= 0, 'מחיר לא תקין');
  b.audit({ actor: actorId, action: 'price', target: 'freeze', old: freezeCfg().price, new: price });
  db.set('freeze', { price });
});
b.serve('saveCollections', ({ actor: actorId, list }) => {
  const a = actorFor(actorId); check(isManager(a));
  const ids = new Set(list.map((c) => c.id));
  // deleting a collection moves its items to "עוד"
  collections().filter((c) => !ids.has(c.id)).forEach((c) => {
    db.update('items', [], (l) => l.forEach((i) => { if (i.collection === c.id) i.collection = null; }));
    const k = cfg(); Object.keys(k).forEach((cid) => { if (k[cid].collection === c.id) k[cid].collection = null; }); db.set('cosmetic_cfg', { ...k });
  });
  db.set('collections', list.map((c) => ({ id: c.id || newId('col'), name: c.name.trim().slice(0, 30) })));
  b.audit({ actor: actorId, action: 'collections', new: list.map((c) => c.name).join(', ') });
});
b.serve('setItemCollection', ({ actor: actorId, id, collection }) => {
  const a = actorFor(actorId); check(isManager(a));
  if (registry.has(id)) return bus.ask('store.setCosmetic', { actor: actorId, id, patch: { collection } });
  db.update('items', [], (l) => { const x = l.find((y) => y.id === id); check(!!x); x.collection = collection; });
  b.audit({ actor: actorId, action: 'item_collection', target: id, new: collection });
});

// ---------- user deleted: erase purchases, owned, wishlist, requests; reserved stock returns (E8) ----------
bus.on('user.deleted', ({ uid }) => {
  db.set('purchases', purchases().filter((p) => p.uid !== uid));
  ['owned', 'equipped', 'shown_tags', 'wishlist'].forEach((k) => { const o = { ...db.get(k, {}) }; delete o[uid]; db.set(k, o); });
  db.set('proposals', db.get('proposals', []).filter((p) => p.uid !== uid && p.proposer !== uid));
});

b.serve('seedInstall', () => {
  ['items', 'purchases', 'collections', 'proposals'].forEach((k) => db.set(k, []));
  ['owned', 'equipped', 'shown_tags', 'wishlist', 'cosmetic_cfg'].forEach((k) => db.set(k, {}));
  db.set('freeze', { price: 150 });
});
