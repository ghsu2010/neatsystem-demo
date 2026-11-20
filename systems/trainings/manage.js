// Trainings management (Trainings 12): categories, approvers, access, icon library, notifications follow, settings.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement } from '../../core/registry.js';
import { Button, Icon, Field, Card, IconButton, Badge, Checkbox, Chips, EmptyState } from '../../core/ui.js';
import { PersonName } from '../../core/people.js';
import { act, toast, confirm, promptText, actionSheet } from '../../core/overlay.js';
import { pickPeople, SelectorField } from '../../core/pickers.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { MsIcon } from './nodes.js';
import { pickIcon } from './editor.js';
import { DEFAULTS } from './index.js';

const me = () => bus.read('users.currentId');
const A = () => bus.read('users.actor', me());

function Categories() {
  const a = A();
  const all = bus.read('trainings.categories').filter((c) => a.isMentor || (c.kind === 'team' && c.teamId === a.team));
  return html`<div class="col gap12">${a.isMentor && html`<div><${Button} kind="tinted" size="sm" onClick=${async () => { const n = await promptText({ title: 'קטגוריה מיוחדת חדשה', label: 'שם (עד 30)', multiline: false, max: 30 }); if (n) act(() => bus.ask('trainings.createCategory', { actor: me(), name: n }), 'נוצרה'); }}>+ קטגוריה מיוחדת</${Button}></div>`}
    <div class="list" data-drop-list="tcats:1">${all.map((c) => html`<div class="lrow" data-drag-item key=${c.id}>
      ${a.isMentor && html`<span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'tcats', listId: '1', onDrop: ({ fromIndex, toIndex }) => act(() => bus.ask('trainings.reorderCategories', { actor: me(), ids: moveIn(all.map((x) => x.id), fromIndex, toIndex) })) })}><${Icon} name="grip-vertical" size=${20}/></span>`}
      <${MsIcon} name=${c.icon} size=${22}/><div class="col gap4 grow"><span class="t-label">${c.name}</span><span class="t-foot sec">${c.kind === 'team' ? `צוות · ${(bus.read('users.team', c.teamId) || {}).name || ''}` : 'הסמכה מיוחדת'} · ${bus.read('trainings.trees', c.id).length} עצים</span></div>
      ${a.isMentor && html`<${IconButton} small icon="ellipsis" label="פעולות" onClick=${(e) => actionSheet(c.name, [
        { icon: 'pencil', label: 'שינוי שם', onClick: async () => { const n = await promptText({ title: 'שינוי שם', value: c.name, multiline: false, max: 30 }); if (n) act(() => bus.ask('trainings.updateCategory', { actor: me(), catId: c.id, name: n })); } },
        { icon: 'shapes', label: 'אייקון', onClick: () => pickIcon(e.target, { current: c.icon, onPick: (v) => act(() => bus.ask('trainings.updateCategory', { actor: me(), catId: c.id, icon: v })) }) },
        { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: async () => { const n = bus.read('trainings.categoryMilestones', c.id).length; if (await confirm({ title: `מחיקת ${c.name}`, text: `${n} אבני דרך יימחקו. אפשר למחוק רק קטגוריה בלי אישורים.`, ok: 'מחיקה', danger: true })) act(() => bus.ask('trainings.deleteCategory', { actor: me(), catId: c.id }), 'נמחקה'); } },
      ], e.currentTarget)}/>`}</div>`)}</div></div>`;
}
function Approvers() {
  const a = A();
  const cats = bus.read('trainings.categories').filter((c) => a.isMentor || (c.kind === 'team' && c.teamId === a.team));
  return html`<div class="col gap12">${cats.map((c) => {
    const defaults = bus.read('trainings.approversOf', c.id).filter((u) => !(c.approvers || []).includes(u));
    return html`<${Card} border title=${c.name} key=${c.id}>
      <p class="t-foot sec">ברירת מחדל: מנטורים, קפטנים ואדמינים${c.kind === 'team' ? ' ורש"צ הצוות' : ''}</p>
      <div class="row wrap gap4 mt8">${defaults.map((u) => html`<span class="badge"><${PersonName} uid=${u} rank=${false} link=${false}/></span>`)}</div>
      <div class="field-label mt16">ממונים</div>
      <div class="row wrap gap4 mt8">${(c.approvers || []).map((u) => html`<span class="sel-chip"><${PersonName} uid=${u} rank=${false} link=${false}/></span>`)}
        <button class="chip" onClick=${(e) => pickPeople(e.currentTarget, { title: 'מאשרים', selected: c.approvers || [], onChange: (ids) => act(() => bus.ask('trainings.setApprovers', { actor: me(), catId: c.id, uids: ids })), candidates: (u) => u.status === 'active' })}>עריכה</button></div>
    </${Card}>`;
  })}</div>`;
}
function Access() {
  const a = A();
  const cats = bus.read('trainings.categories').filter((c) => bus.read('trainings.isEditor', me(), c.id));
  return html`<div class="col gap12">${cats.map((c) => html`<${Card} border title=${c.name} key=${c.id}>
    ${c.kind === 'special' && (a.isMentor || a.isCaptain || a.isAdmin) && html`<${Field} label="מי יכול/ה ללמוד את הקטגוריה"><${SelectorField} value=${c.access} allowAll=${false} title=${'גישה ל' + c.name} onChange=${(v) => act(() => bus.ask('trainings.setCategoryAccess', { actor: me(), catId: c.id, access: v }))}/></${Field}>`}
    ${bus.read('trainings.trees', c.id).map((t) => html`<div class="mt16"><${Field} label=${`גישה נוספת לעץ ${t.name}`}><${SelectorField} value=${t.access} allowAll=${false} title=${'גישה נוספת ל' + t.name} onChange=${(v) => act(() => bus.ask('trainings.setTreeAccess', { actor: me(), treeId: t.id, access: v }))}/></${Field}></div>`)}
  </${Card}>`)}</div>`;
}
function Icons() {
  const lib = bus.read('trainings.iconLibrary').filter((i) => i.group === 'שהועלו');
  if (!lib.length) return html`<${EmptyState} title="עוד לא הועלו אייקונים" text="רש״צים ומעלה מעלים אייקונים מתוך האשף" sticker=${false}/>`;
  return html`<div class="list">${lib.map((i) => html`<div class="lrow"><${MsIcon} name=${i.name} size=${28}/><span class="t-label grow">${i.kw[0]}</span>
    <${IconButton} small icon="trash-2" label="מחיקה" onClick=${async () => { if (await confirm({ title: 'מחיקת אייקון', text: 'אבני דרך שמשתמשות בו יחזרו לכוכב.', ok: 'מחיקה', danger: true })) act(() => bus.ask('trainings.deleteIcon', { actor: me(), iconId: i.name.slice(4) }), 'נמחק'); }}/></div>`)}</div>`;
}
function Follow() {
  const cats = bus.read('trainings.categories');
  const cur = bus.read('trainings.follow', me()) || cats.map((c) => c.id);
  return html`<div class="list">${cats.map((c) => html`<label class="lrow"><${Checkbox} on=${cur.includes(c.id)} label=${c.name} onChange=${(v) => act(() => bus.ask('trainings.setFollow', { actor: me(), catIds: v ? [...cur, c.id] : cur.filter((x) => x !== c.id) }))}/><span class="t-label">${c.name}</span></label>`)}
    <div class="lrow t-foot sec">התראות על בקשות מגיעות רק מהקטגוריות המסומנות. אפשר לפעול בכל הבקשות בכל מקרה.</div></div>`;
}
function Settings() {
  const s = bus.read('trainings.settings');
  const L = { default_coins: 'מטבעות ברירת מחדל לאבן דרך', reminder_days: 'ימים עד תזכורת על בקשה' };
  return html`<div class="card b col gap12">${Object.keys(DEFAULTS).map((k) => html`<${Field} label=${`${L[k]} (trainings.${k})`}><input class="input num" type="number" min="0" value=${s[k]}
    onChange=${(e) => act(() => bus.ask('trainings.setSettings', { actor: me(), patch: { [k]: Number(e.target.value) } }), 'נשמר')}/></${Field}>`)}</div>`;
}
const leadOfTeamCat = (a) => a.isLead && !!bus.read('trainings.categoryForTeam', a.team);
addManagement('trainings', 'הכשרות', [
  { id: 'categories', title: 'קטגוריות', icon: 'folder-tree', can: (a) => a.isMentor || leadOfTeamCat(a), render: () => html`<${Categories}/>` },
  { id: 'approvers', title: 'מאשרים', icon: 'user-check', can: (a) => a.isMentor || leadOfTeamCat(a), render: () => html`<${Approvers}/>` },
  { id: 'access', title: 'גישה', icon: 'key-round', can: (a) => !a.readOnly && (a.isMentor || a.isCaptain || a.isAdmin || leadOfTeamCat(a)), render: () => html`<${Access}/>` },
  { id: 'icons', title: 'ספריית אייקונים', icon: 'shapes', can: (a) => a.isMentor, render: () => html`<${Icons}/>` },
  { id: 'follow', title: 'מעקב התראות', icon: 'bell', can: (a) => a.isMentor, render: () => html`<${Follow}/>` },
  { id: 'settings', title: 'הגדרות', icon: 'settings', can: (a) => a.isMentor, render: () => html`<${Settings}/>` },
]);
