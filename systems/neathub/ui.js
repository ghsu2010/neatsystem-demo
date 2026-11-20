// NeatHub UI: the links page (Design 7.8) and management of categories.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addRoute } from '../../core/registry.js';
import { Button, Icon, SearchInput, Field, EmptyState, IconButton, cx } from '../../core/ui.js';
import { act, toast, confirm, sheet, actionSheet, isPhone } from '../../core/overlay.js';
import { SelectorField, selectorLabel } from '../../core/pickers.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { LINK_ICONS } from './index.js';

const me = () => bus.read('users.currentId');
function linkForm(catId, link) {
  const st = link ? { ...link } : { name: '', url: '', icon: 'link' };
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const fav = (() => { try { return f.url ? new URL(f.url).origin + '/favicon.ico' : null; } catch { return null; } })();
    return html`<div class="col gap12">
      <${Field} label="שם"><input class="input" maxlength="40" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
      <${Field} label="כתובת (https://…)" error=${f.url && !/^https:\/\//.test(f.url) ? 'הקישור חייב להתחיל ב-https://' : null}><input class="input" dir="ltr" value=${f.url} onInput=${(e) => setF({ ...f, url: e.target.value.trim() })}/></${Field}>
      <${Field} label="אייקון"><div class="row wrap gap4">${LINK_ICONS.map((i) => html`<button class=${cx('icon-btn', f.icon === i && 'on')} style=${f.icon === i ? 'background:var(--brand-subtle);color:var(--brand-text)' : ''} aria-label=${i} onClick=${() => setF({ ...f, icon: i })}><${Icon} name=${i}/></button>`)}
        ${fav && html`<button class="icon-btn" style=${f.icon === 'favicon' ? 'background:var(--brand-subtle)' : ''} aria-label="האייקון של האתר" title="האייקון של האתר" onClick=${() => setF({ ...f, icon: 'favicon' })}><img src=${fav} width="20" height="20" alt="" onError=${(e) => { e.target.style.display = 'none'; }}/></button>`}</div></${Field}></div>`;
  };
  sheet(link ? 'עריכת קישור' : 'קישור חדש', () => html`<${Body}/>`, {
    foot: (c) => html`<${Button} kind="primary" full onClick=${() => { if (act(() => bus.ask('neathub.saveLink', { actor: me(), catId, link: st })) !== undefined) { c(); toast('נשמר'); } }}>שמירה</${Button}>`,
  });
}
function LinkTile({ cat, l, editing }) {
  const has = !!l.url;
  const icon = l.icon === 'favicon' && has ? html`<img src=${new URL(l.url).origin + '/favicon.ico'} width="24" height="24" alt=""/>` : html`<${Icon} name=${l.icon === 'favicon' ? 'link' : l.icon || 'link'} size=${24}/>`;
  const del = () => { const r = act(() => bus.ask('neathub.deleteLink', { actor: me(), catId: cat.id, linkId: l.id })); if (r) toast(`${l.name} נמחק`, { undo: () => bus.ask('neathub.restoreLink', { actor: me(), catId: cat.id, link: r.removed, index: r.index }) }); };
  const open = (e) => {
    if (editing) return actionSheet(l.name, [{ icon: 'pencil', label: 'עריכה', onClick: () => linkForm(cat.id, l) }, { icon: 'external-link', label: 'פתיחה', hidden: !has, onClick: () => window.open(l.url, '_blank', 'noopener') }, { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: del }], e.currentTarget);
    if (has) window.open(l.url, '_blank', 'noopener');
  };
  return html`<div class="hub-tile" data-drag-item onPointerDown=${editing ? (e) => startDrag(e, { group: 'hub-' + cat.id, listId: cat.id, longPress: e.pointerType === 'touch', onDrop: ({ fromIndex, toIndex }) => act(() => bus.ask('neathub.reorderLinks', { actor: me(), catId: cat.id, ids: moveIn(cat.links.map((x) => x.id), fromIndex, toIndex) })) }) : undefined}>
    <button class="hub-btn" onClick=${open} aria-disabled=${!has && !editing} style=${!has && !editing ? 'cursor:default' : ''}>${icon}<span class="t-cap clamp2" style="text-align:center">${l.name}</span>
      ${!has && html`<span class="t-cap muted">לא הוגדר קישור</span>`}</button>
    ${!has && !editing && bus.read('neathub.canEdit', me(), cat.id) && html`<button class="icon-btn sm" style="position:absolute;top:2px;inset-inline-end:2px" aria-label="הגדרת קישור" onClick=${() => linkForm(cat.id, l)}><${Icon} name="pencil" size=${16}/></button>`}
  </div>`;
}
function Hub() {
  const uid = me();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const cats = bus.read('neathub.categories', uid);
  const ql = q.trim().toLowerCase();
  const shown = cats.map((c) => ({ ...c, shownLinks: c.links.filter((l) => !ql || l.name.toLowerCase().includes(ql)) })).filter((c) => c.shownLinks.length || (editing === c.id));
  return html`<div class="col gap16">
    <h1 class="page-title" style="margin:0">NeatHub</h1>
    <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש קישורים"/>
    ${shown.length === 0 ? html`<${EmptyState} title="אין קישורים עדיין"/>` : shown.map((c) => {
      const can = bus.read('neathub.canEdit', uid, c.id);
      const ed = editing === c.id;
      return html`<section key=${c.id} class="col gap8"><div class="row gap8"><h2 class="group-head grow" style="margin:0">${c.name}</h2>
        ${can && html`<${Button} size="xs" kind=${ed ? 'primary' : 'tinted'} onClick=${() => setEditing(ed ? null : c.id)}>${ed ? 'סיום' : 'עריכה'}</${Button}>`}</div>
        <div class="hub-grid" data-drop-list=${`hub-${c.id}:${c.id}`}>${(ed ? c.links : c.shownLinks).map((l) => html`<${LinkTile} key=${l.id} cat=${c} l=${l} editing=${ed}/>`)}
          ${ed && html`<button class="hub-btn" style="border-style:dashed" onClick=${() => linkForm(c.id, null)}><${Icon} name="plus" size=${24}/><span class="t-cap">הוספת קישור</span></button>`}</div>
        ${ed && html`<span class="t-foot muted">${isPhone() ? 'לחיצה ארוכה וגרירה לשינוי סדר' : 'גררו כדי לשנות סדר'}</span>`}</section>`;
    })}</div>`;
}
addRoute({ path: '/neathub', tab: 'neathub', title: 'NeatHub', render: () => html`<${Hub}/>` });

function Categories() {
  const list = bus.read('neathub.all');
  const edit = (c) => {
    const st = c ? { ...c } : { name: '', editors: null, visibleTo: null };
    const Body = () => {
      const [f, setF] = useState(st); Object.assign(st, f);
      return html`<div class="col gap12"><${Field} label="שם"><input class="input" maxlength="30" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
        <${Field} label="עורכים (מלבד אדמינים ומנטורים)"><${SelectorField} value=${f.editors} allowAll=${false} onChange=${(v) => setF({ ...f, editors: v })} title="עורכים"/></${Field}>
        <${Field} label="גלוי ל"><${SelectorField} value=${f.visibleTo || { all: true }} onChange=${(v) => setF({ ...f, visibleTo: v })} title="גלוי ל"/></${Field}></div>`;
    };
    sheet(c ? 'עריכת קטגוריה' : 'קטגוריה חדשה', () => html`<${Body}/>`, { foot: (cl) => html`<${Button} kind="primary" full onClick=${() => { if (act(() => bus.ask('neathub.saveCategory', { actor: me(), cat: st }))) { cl(); toast('נשמר'); } }}>שמירה</${Button}>` });
  };
  return html`<div class="col gap12"><div><${Button} kind="tinted" size="sm" onClick=${() => edit(null)}>+ קטגוריה</${Button}></div>
    <div class="list" data-drop-list="hubcats:1">${list.map((c) => html`<div class="lrow" data-drag-item key=${c.id}>
      <span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'hubcats', listId: '1', onDrop: ({ fromIndex, toIndex }) => act(() => bus.ask('neathub.reorderCategories', { actor: me(), ids: moveIn(list.map((x) => x.id), fromIndex, toIndex) })) })}><${Icon} name="grip-vertical" size=${20}/></span>
      <div class="col gap4 grow"><span class="t-label">${c.name}</span><span class="t-foot sec">${c.links.length} קישורים · עורכים: ${c.editors ? selectorLabel(c.editors) : 'אדמינים ומנטורים'} · גלוי ל: ${c.visibleTo ? selectorLabel(c.visibleTo) : 'כולם'}</span></div>
      <${IconButton} small icon="pencil" label="עריכה" onClick=${() => edit(c)}/>
      <${IconButton} small icon="trash-2" label="מחיקה" onClick=${async () => { if (await confirm({ title: `מחיקת ${c.name}`, text: `הקטגוריה ו-${c.links.length} הקישורים שלה יימחקו.`, ok: 'מחיקה', danger: true })) act(() => bus.ask('neathub.deleteCategory', { actor: me(), catId: c.id }), 'נמחק'); }}/></div>`)}</div></div>`;
}
addManagement('neathub', 'NeatHub', [{ id: 'categories', title: 'ניהול קטגוריות', icon: 'folder-tree', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Categories}/>` }]);

const css = document.createElement('style');
css.textContent = `.hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media (min-width:768px){.hub-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
.hub-tile{position:relative}
.hub-btn{width:100%;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 6px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;color:var(--text)}
.hub-btn:hover{background:var(--bg-subtle)}`;
document.head.appendChild(css);
