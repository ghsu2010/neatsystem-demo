// Ranks UI: Trainings rank strip, profile ranks card, Home next-rank line, rank history, management.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addWidget } from '../../core/registry.js';
import { Button, Icon, Card, Progress, Switch, IconButton, Chips, SearchInput, Checkbox, Badge, EmptyState, Seg, cx } from '../../core/ui.js';
import { RankBadge, PersonName } from '../../core/people.js';
import { act, toast, confirm, sheet, promptText, popover } from '../../core/overlay.js';
import { navigate } from '../../core/router.js';
import { fmtDate } from '../../core/format.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { GRADE_HE } from './index.js';

const me = () => bus.read('users.currentId');
const rankName = (id) => (id ? (bus.read('ranks.ranks').find((r) => r.id === id) || {}).name : 'ללא דרגה');

function missingSheet(uid, catId) {
  const n = bus.read('ranks.next', uid, catId);
  sheet('מה חסר לדרגה הבאה', (close) => html`<div class="col gap8">
    ${n.gradeNeeded && html`<div class="subtle-box t-label">דרושה שכבה ${GRADE_HE[n.gradeNeeded]}</div>`}
    <div class="list">${n.missing.map((id) => { const m = bus.read('trainings.milestone', id); return m && html`<a class="lrow" href=${'#/trainings/ms/' + id} onClick=${close}><span class="t-label grow"><bdi>${m.name}</bdi></span><${Icon} name="chevron-left" size=${20} cls="chev"/></a>`; })}</div>
    ${!n.missing.length && !n.gradeNeeded && html`<p class="t-foot sec">אין מה להשלים</p>`}</div>`);
}
/** Rank strip at the top of a Trainings category (Ranks 5) */
addWidget('ranks.strip', ({ uid, catId }) => {
  const a = bus.read('users.actor', uid);
  if (!a || a.isMentor || !bus.read('ranks.hasLadder', catId) || !bus.read('trainings.takesCategory', uid, catId)) return null;
  const cur = bus.read('ranks.rank', uid, catId);
  const n = bus.read('ranks.next', uid, catId);
  const done = !n || !n.next;
  return html`<button class="card b row gap12" style="text-align:start;cursor:pointer;width:100%;color:inherit" onClick=${() => !done && missingSheet(uid, catId)}>
    ${cur ? html`<${RankBadge} badge=${bus.read('ranks.badge', cur)} size=${48}/>` : html`<span class="rank-badge" style="width:48px;height:48px;background:var(--bg-subtle);color:var(--text-muted)"><${Icon} name="minus" size=${20}/></span>`}
    <div class="col gap4 grow"><span class="t-title3">${rankName(cur)}</span>
      ${done ? html`<span class="t-foot sec">הדרגה הגבוהה ביותר בקטגוריה</span>` : html`<span class="t-foot sec">${n.missing.length ? `חסרות ${n.missing.length} הכשרות לדרגה הבאה` : ''}${n.missing.length && n.gradeNeeded ? ' · ' : ''}${n.gradeNeeded ? `דרושה שכבה ${GRADE_HE[n.gradeNeeded]}` : ''}</span>
        <${Progress} value=${n.have} max=${n.need || 1}/>`}</div>
    ${!done && html`<${Icon} name="chevron-left" size=${20} cls="chev"/>`}</button>`;
});
/** Profile ranks card: one row per category with a rank or progress (NeatSystem 5.1 #7) */
addWidget('ranks.profileCard', ({ uid }) => {
  const a = bus.read('users.actor', uid);
  const rows = bus.read('ranks.profileRows', uid).filter((r) => !a.isMentor || r.rankId);
  if (!rows.length) return null;
  return html`<${Card} title="דרגות" icon="award"><div class="col gap4">${rows.map((r) => html`<button class="lrow" style="padding-inline:0" onClick=${() => navigate('/trainings?cat=' + r.catId)}>
    ${r.rankId ? html`<${RankBadge} badge=${r.badge} size=${48}/>` : html`<span class="rank-badge" style="width:48px;height:48px;background:var(--bg-subtle);color:var(--text-muted)"><${Icon} name="minus" size=${20}/></span>`}
    <div class="col gap4 grow"><span class="t-label">${a.isMentor ? 'ניטמנטור' : rankName(r.rankId)}</span><span class="t-foot sec">${r.catName}</span></div>
    ${!a.isMentor && r.next && r.next.next && html`<span class="t-foot sec num">${r.next.have}/${r.next.need} הכשרות</span>`}</button>`)}</div></${Card}>`;
});
/** Home: "עוד N הכשרות ל<rank>" under the next-milestones card (team category) */
addWidget('ranks.homeLine', ({ uid }) => {
  const a = bus.read('users.actor', uid);
  const c = a && a.team && bus.read('trainings.categoryForTeam', a.team);
  if (!c || !bus.read('ranks.hasLadder', c.id)) return null;
  const cur = bus.read('ranks.rank', uid, c.id);
  const n = bus.read('ranks.next', uid, c.id);
  return html`<button class="row gap8" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;width:100%;text-align:start" onClick=${() => n && n.next && missingSheet(uid, c.id)}>
    ${cur && html`<${RankBadge} badge=${bus.read('ranks.badge', cur)} size=${24}/>`}
    <span class="t-foot sec grow">${!n || !n.next ? rankName(cur) : n.missing.length ? `עוד ${n.missing.length} הכשרות ל${rankName(n.next)}` : `דרושה שכבה ${GRADE_HE[n.gradeNeeded]} ל${rankName(n.next)}`}</span></button>`;
});
/** Rank history (from Trainings "התקדמות", Mentors and approvers) */
addWidget('ranks.historyLink', ({ catId }) => {
  const uid = me();
  const a = bus.read('users.actor', uid);
  if (!(a.isMentor || bus.read('trainings.isApprover', uid, catId))) return null;
  return html`<div><${Button} kind="link" size="sm" icon="history" onClick=${() => {
    const Body = () => {
      const [who, setWho] = useState(null);
      const learners = bus.read('users.list', { statuses: ['active', 'alumni'] }).filter((u) => bus.read('trainings.takesCategory', u.id, catId));
      const hist = who ? bus.read('ranks.history', who).filter((h) => h.catId === catId) : [];
      return html`<div class="col gap8"><${Chips} items=${learners.map((u) => ({ value: u.id, label: u.name_he }))} value=${who} onChange=${setWho}/>
        ${who && (hist.length ? html`<div class="list">${hist.map((h) => html`<div class="lrow"><${Icon} name=${h.dir === 'up' ? 'trending-up' : 'trending-down'} size=${18} color=${h.dir === 'up' ? 'var(--success)' : 'var(--text-muted)'}/>
          <div class="col gap4 grow"><span class="t-label">${rankName(h.from)} ← ${rankName(h.to)}</span><span class="t-foot sec">${fmtDate(h.at)} · ${h.reason}</span></div></div>`)}</div>` : html`<p class="t-foot sec">אין שינויים</p>`)}</div>`;
    };
    sheet('היסטוריית דרגות', () => html`<${Body}/>`);
  }}>היסטוריית דרגות</${Button}></div>`;
});

/* ---------- management ---------- */
function RankList() {
  const list = bus.read('ranks.ranks');
  return html`<div class="col gap12">
    <div class="list" data-drop-list="ranks:1">${list.map((r) => html`<div class="lrow" data-drag-item key=${r.id}>
      <span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'ranks', listId: '1', onDrop: ({ fromIndex, toIndex }) => act(() => bus.ask('ranks.reorderRanks', { actor: me(), ids: moveIn(list.map((x) => x.id), fromIndex, toIndex) })) })}><${Icon} name="grip-vertical" size=${20}/></span>
      <${RankBadge} badge=${{ name: r.name, url: r.badgeUrl }} size=${40}/><span class="t-label grow">${r.name}</span>
      <label class="btn btn-ghost btn-xs"><${Icon} name="upload" size=${16}/>תג<input type="file" class="hide" accept="image/png,image/svg+xml" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await bus.ask('ranks.setBadge', { actor: me(), rankId: r.id, file: f }); toast('התג עודכן'); } catch (err) { toast(err.message); } }}/></label>
      <${IconButton} small icon="pencil" label="שינוי שם" onClick=${async () => { const n = await promptText({ title: 'שינוי שם', value: r.name, multiline: false, max: 20 }); if (n) act(() => bus.ask('ranks.saveRank', { actor: me(), rankId: r.id, name: n })); }}/>
      <${IconButton} small icon="trash-2" label="מחיקה" onClick=${async () => { if (await confirm({ title: `מחיקת ${r.name}`, text: 'הדרגה תוסר מכל הסולמות. מי שמחזיק/ה בה ירד/תרד לדרגה הגבוהה שמתחת שהוא/היא עדיין עומד/ת בה.', ok: 'מחיקה', danger: true })) act(() => bus.ask('ranks.deleteRank', { actor: me(), rankId: r.id }), 'נמחקה'); }}/></div>`)}</div>
    <div><${Button} kind="tinted" size="sm" onClick=${async () => { const n = await promptText({ title: '+ דרגה', label: 'שם (עד 20)', multiline: false, max: 20 }); if (n) act(() => bus.ask('ranks.saveRank', { actor: me(), name: n }), 'נוספה'); }}>+ דרגה</${Button}></div>
    <p class="t-foot sec">עד שמעלים תג, מוצג עיגול עם האות הראשונה של הדרגה. PNG או SVG שקוף, ריבועי, עד 300 KB.</p></div>`;
}
function msPicker(anchor, catId, selected, onChange) {
  const Body = () => {
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(selected);
    const trees = bus.read('trainings.trees', catId);
    return html`<div class="col gap8" style="width:340px;max-width:100%"><${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש הכשרות"/>
      <div class="col gap8" style="max-height:340px;overflow:auto">${trees.map((t) => { const ms = bus.read('trainings.milestones', t.id, { all: true }).filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())); return ms.length ? html`<div><div class="group-head" style="margin:4px">${t.name}</div>
        ${ms.map((m) => html`<label class="check-row" style="min-height:40px"><${Checkbox} on=${sel.includes(m.id)} label=${m.name} onChange=${(v) => { const n = v ? [...sel, m.id] : sel.filter((x) => x !== m.id); setSel(n); onChange(n); }}/><span class="t-foot" style="font-size:15px"><bdi>${m.name}</bdi></span></label>`)}</div>` : null; })}</div></div>`;
  };
  popover(anchor, () => html`<${Body}/>`, { title: '+ הכשרות', noAutofocus: true });
}
function Ladders() {
  const uid = me();
  const cats = bus.read('trainings.categories').filter((c) => bus.read('ranks.canEditLadder', uid, c.id));
  const [catId, setCat] = useState(cats[0] && cats[0].id);
  if (!catId) return html`<${EmptyState} title="אין סולמות שאפשר לערוך" sticker=${false}/>`;
  const ranks = bus.read('ranks.ranks');
  const set = (rankId, patch) => act(() => bus.ask('ranks.setRule', { actor: uid, catId, rankId, patch }));
  return html`<div class="col gap12"><${Chips} items=${cats.map((c) => ({ value: c.id, label: c.name }))} value=${catId} onChange=${setCat}/>
    <p class="t-foot sec">כל דרגה דורשת את שלה ואת כל מה שלפניה. כל שינוי נשמר מיד ומחשב מחדש את הדרגות.</p>
    ${ranks.map((r) => { const ru = bus.read('ranks.rule', catId, r.id); return html`<div class="card b col gap8" key=${r.id} style=${ru.notUsed ? 'opacity:.6' : ''}>
      <div class="row gap8"><${RankBadge} badge=${{ name: r.name, url: r.badgeUrl }} size=${40}/><span class="t-title3 grow">${r.name}</span></div>
      <div class="row wrap gap16"><label class="row gap8 t-foot">מנטורים בלבד <${Switch} on=${ru.mentorsOnly} label="מנטורים בלבד" onChange=${(v) => set(r.id, { mentorsOnly: v })}/></label>
        <label class="row gap8 t-foot">לא בשימוש <${Switch} on=${ru.notUsed} label="לא בשימוש" onChange=${(v) => set(r.id, { notUsed: v })}/></label></div>
      ${!ru.mentorsOnly && !ru.notUsed && html`<div class="row gap8 wrap"><span class="t-foot sec">שכבה מינימלית</span>
        <${Seg} small value=${ru.minGrade || 0} onChange=${(v) => set(r.id, { minGrade: v || null })} options=${[{ value: 0, label: 'ללא' }, { value: 9, label: 'ט\'' }, { value: 10, label: 'י\'' }, { value: 11, label: 'יא\'' }, { value: 12, label: 'יב\'' }]}/></div>
        <div class="row wrap gap4">${ru.ms.map((id) => { const m = bus.read('trainings.milestone', id); if (!m) return null; const t = bus.read('trainings.tree', m.treeId);
          return html`<span class="sel-chip"><bdi>${t.name} · ${m.name}</bdi><button aria-label="הסרה" onClick=${() => set(r.id, { ms: ru.ms.filter((x) => x !== id) })}><${Icon} name="x" size=${14}/></button></span>`; })}
          <button class="chip" onClick=${(e) => msPicker(e.currentTarget, catId, ru.ms, (n) => set(r.id, { ms: n }))}>+ הכשרות</button></div>`}
    </div>`; })}</div>`;
}
addManagement('ranks', 'דרגות', [
  { id: 'list', title: 'דרגות', icon: 'award', can: (a) => a.isMentor, render: () => html`<${RankList}/>` },
  { id: 'ladders', title: 'סולם דרגות', icon: 'list-ordered', can: (a) => a.isMentor || (a.isLead && !!bus.read('trainings.categoryForTeam', a.team)), render: () => html`<${Ladders}/>` },
]);
