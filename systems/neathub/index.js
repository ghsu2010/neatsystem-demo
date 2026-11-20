// NeatHub — the team's links page (12-neathub.txt).
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { uid as newId } from '../../core/format.js';
import { actorFor } from '../../core/guard.js';
import { check } from '../../core/errors.js';

const b = bus.system('neathub', { announces: [] });
const db = ns('neathub');
const cats = () => db.get('categories', []);
export const LINK_ICONS = ['link', 'folder', 'file-text', 'sheet', 'clipboard-list', 'package', 'globe', 'video', 'image', 'book-open', 'calendar', 'wrench', 'code', 'shopping-cart', 'users', 'graduation-cap', 'trophy', 'map'];

const actor = (id) => bus.read('users.actor', id);
const isMod = (a) => !!a && (a.isAdmin || a.isMentor);
const canEditCat = (a, c) => !!a && !a.readOnly && (isMod(a) || (!!c.editors && bus.read('users.matches', a.id, c.editors)));
const canView = (uid, c) => !c.visibleTo || c.visibleTo.all || bus.read('users.matches', uid, c.visibleTo, { includeAlumni: true }) || isMod(actor(uid));

b.share('categories', (uid) => cats().filter((c) => canView(uid, c)));
b.share('canEdit', (uid, catId) => { const c = cats().find((x) => x.id === catId); return !!c && canEditCat(actor(uid), c); });
b.share('isMod', (uid) => isMod(actor(uid)));
b.share('all', () => cats());

const okUrl = (u) => !u || /^https:\/\/[^\s]+$/.test(u);
function editCat(actorId, catId, fn, action, detail) {
  const a = actorFor(actorId);
  const list = cats(); const c = list.find((x) => x.id === catId); check(c && canEditCat(a, c));
  fn(c); db.set('categories', [...list]);
  b.audit({ actor: actorId, action, target: catId, ...detail });
}
b.serve('saveLink', ({ actor: id, catId, link }) => {
  const name = (link.name || '').trim(); check(name.length >= 1 && name.length <= 40, 'שם עד 40 תווים');
  check(okUrl(link.url), 'הקישור חייב להתחיל ב-https://');
  let lid = link.id;
  editCat(id, catId, (c) => {
    if (lid) { const l = c.links.find((x) => x.id === lid); check(!!l); Object.assign(l, { name, url: link.url || '', icon: link.icon || 'link' }); }
    else { lid = newId('l'); c.links.push({ id: lid, name, url: link.url || '', icon: link.icon || 'link' }); }
  }, link.id ? 'link_edit' : 'link_add', { field: 'link', new: `${name} ${link.url || ''}` });
  return lid;
});
b.serve('deleteLink', ({ actor: id, catId, linkId }) => {
  let removed, index;
  editCat(id, catId, (c) => { index = c.links.findIndex((x) => x.id === linkId); check(index >= 0); [removed] = c.links.splice(index, 1); }, 'link_delete', { field: 'link', old: linkId });
  return { removed, index };
});
b.serve('restoreLink', ({ actor: id, catId, link, index }) => editCat(id, catId, (c) => { if (!c.links.some((x) => x.id === link.id)) c.links.splice(index, 0, link); }, 'link_restore', { field: 'link', new: link.name }));
b.serve('reorderLinks', ({ actor: id, catId, ids }) => editCat(id, catId, (c) => { c.links = ids.map((x) => c.links.find((l) => l.id === x)).filter(Boolean); }, 'link_reorder', {}));

const mod = (id) => { const a = actorFor(id); check(isMod(a)); };
b.serve('saveCategory', ({ actor: id, cat }) => {
  mod(id);
  const name = (cat.name || '').trim(); check(name.length >= 1 && name.length <= 30, 'שם עד 30 תווים');
  const list = cats();
  if (cat.id) { const c = list.find((x) => x.id === cat.id); check(!!c); b.audit({ actor: id, action: 'category_edit', target: c.id, old: { name: c.name }, new: { name } }); Object.assign(c, { name, editors: cat.editors || null, visibleTo: cat.visibleTo || null }); db.set('categories', [...list]); return c.id; }
  const c = { id: newId('hc'), name, editors: cat.editors || null, visibleTo: cat.visibleTo || null, links: [] };
  db.set('categories', [...list, c]); b.audit({ actor: id, action: 'category_create', target: c.id, new: name });
  return c.id;
});
b.serve('deleteCategory', ({ actor: id, catId }) => { mod(id); const c = cats().find((x) => x.id === catId); check(!!c); db.set('categories', cats().filter((x) => x.id !== catId)); b.audit({ actor: id, action: 'category_delete', target: catId, old: c.name }); });
b.serve('reorderCategories', ({ actor: id, ids }) => { mod(id); db.set('categories', ids.map((x) => cats().find((c) => c.id === x)).filter(Boolean)); b.audit({ actor: id, action: 'category_reorder' }); });

b.serve('seedInstall', () => db.set('categories', [{ id: 'hc-general', name: 'כללי', editors: null, visibleTo: null, links: [
  { id: 'l-drive', name: 'דרייב הקבוצה', url: '', icon: 'folder' }, { id: 'l-inventory', name: 'רשימת מלאי', url: '', icon: 'package' },
  { id: 'l-certs', name: 'אתר הסמכות (old)', url: '', icon: 'graduation-cap' }, { id: 'l-tobi', name: 'Tobi', url: '', icon: 'globe' }] }]));
