// Trainings editors: tree settings, node action sheet, requirements editor, 4-step milestone wizard (10).
import { html, useState, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Button, Icon, Field, Seg, Switch, SwitchRow, IconButton, Chips, SearchInput, Checkbox, Badge, cx } from '../../core/ui.js';
import { act, toast, confirm, sheet, popover, actionSheet, closeTop } from '../../core/overlay.js';
import { pickPastel, SelectorField, MenuSelect } from '../../core/pickers.js';
import { RichEditor } from '../../core/richtext.js';
import { navigate } from '../../core/router.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { uid as newId } from '../../core/format.js';
import { pastel } from '../../core/color.js';
import { media } from './index.js';
import { MsIcon, Node } from './nodes.js';
import { ICON_GROUPS } from './icons.js';

const me = () => bus.read('users.currentId');

/* ---------- icon picker (search + group tabs + 48 px grid + upload) ---------- */
export function pickIcon(anchor, { current, onPick }) {
  const Body = ({ close }) => {
    const [q, setQ] = useState('');
    const [g, setG] = useState('all');
    const fileRef = useRef();
    const lib = bus.read('trainings.iconLibrary');
    const groups = [...ICON_GROUPS.map((x) => x.group), 'שהועלו'];
    const ql = q.trim().toLowerCase();
    const list = lib.filter((i) => (g === 'all' || i.group === g) && (!ql || i.kw.some((k) => k.toLowerCase().includes(ql))));
    return html`<div class="col gap8" style="width:340px;max-width:100%">
      <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש בעברית או באנגלית"/>
      <${Chips} items=${[{ value: 'all', label: 'הכל' }, ...groups.map((x) => ({ value: x, label: x }))]} value=${g} onChange=${setG}/>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,48px);gap:4px;max-height:300px;overflow:auto">${list.map((i) => html`<button type="button" class="icon-btn" style=${`width:48px;height:48px;border-radius:12px;${current === i.name ? 'background:var(--brand-subtle);color:var(--brand-text)' : ''}`}
        title=${i.kw.join(' · ')} aria-label=${i.kw[1] || i.name} onClick=${() => { close(); onPick(i.name); }}><${MsIcon} name=${i.name} size=${24}/></button>`)}</div>
      <${Button} size="sm" kind="tinted" icon="upload" onClick=${() => fileRef.current.click()}>העלאת אייקון</${Button}>
      <span class="t-foot muted">SVG או PNG, ריבועי, עד 200 KB. נצבע בצבע אחד.</span>
      <input ref=${fileRef} type="file" accept="image/svg+xml,image/png" class="hide" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const id = await bus.ask('trainings.uploadIcon', { actor: me(), file: f, name: f.name.replace(/\.\w+$/, '') }); close(); onPick(id); } catch (err) { toast(err.message || 'לא נשמר'); } }}/>
    </div>`;
  };
  popover(anchor, (close) => html`<${Body} close=${close}/>`, { title: 'אייקון', noAutofocus: true });
}

/* ---------- tree settings ---------- */
export function treeForm(catId, t) {
  const st = t ? { ...t } : { name: '', icon: 'star', color: 4, desc: '', access: null };
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const p = pastel(f.color);
    return html`<div class="col gap12">
      <${Field} label="שם העץ (עד 40)"><input class="input" maxlength="40" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })}/></${Field}>
      <div class="row gap12"><button class="icon-btn" style=${`width:56px;height:56px;background:${p.fill};color:${p.dark}`} aria-label="אייקון" onClick=${(e) => pickIcon(e.currentTarget, { current: f.icon, onPick: (v) => setF({ ...f, icon: v }) })}><${MsIcon} name=${f.icon} size=${26}/></button>
        <button class="swatch" style=${`width:40px;height:40px;background:${p.fill}`} aria-label="צבע" onClick=${(e) => pickPastel(e.currentTarget, { current: f.color, onPick: (v) => setF({ ...f, color: v }) })}/><span class="t-foot sec">צבע ברירת מחדל לאבני דרך</span></div>
      <${Field} label="תיאור (לא חובה, עד 280)"><textarea class="textarea" maxlength="280" value=${f.desc} onInput=${(e) => setF({ ...f, desc: e.target.value })}/></${Field}>
      <${Field} label="גישה נוספת לעץ"><${SelectorField} value=${f.access} allowAll=${false} onChange=${(v) => setF({ ...f, access: v })} title="מי עוד יכול/ה ללמוד את העץ"/></${Field}>
    </div>`;
  };
  sheet(t ? 'הגדרות עץ' : 'עץ חדש', () => html`<${Body}/>`, {
    foot: (c) => html`${t && html`<${Button} kind="secondary" onClick=${() => act(() => bus.ask('trainings.hideTree', { actor: me(), treeId: t.id, hidden: !t.hidden }), t.hidden ? 'העץ מוצג' : 'העץ הוסתר')}>${t.hidden ? 'הצגה' : 'הסתרה'}</${Button}>
      <${Button} kind="danger" onClick=${async () => {
        const n = bus.read('trainings.milestones', t.id, { all: true }).length;
        if (await confirm({ title: `מחיקת ${t.name}`, text: `${n} אבני דרך יימחקו. אפשר למחוק רק עץ שאין בו אישורים.`, ok: 'מחיקה', danger: true }) && act(() => bus.ask('trainings.deleteTree', { actor: me(), treeId: t.id })) !== undefined) { c(); navigate('/trainings?cat=' + catId); }
      }}>מחיקה</${Button}>`}
      <${Button} kind="primary" cls="grow" onClick=${() => { const id = act(() => bus.ask('trainings.saveTree', { actor: me(), catId, tree: st })); if (id) { c(); if (!t) navigate(`/trainings/tree/${id}?edit=1`); else toast('נשמר'); } }}>שמירה</${Button}>`,
  });
}

/* ---------- node actions in the tree editor ---------- */
export function nodeActions(m, anchor) {
  actionSheet(m.name, [
    { icon: 'pencil', label: 'עריכה', onClick: () => openWizard({ id: m.id }) },
    { icon: 'git-branch', label: 'דרישות', onClick: () => requirementsSheet(m) },
    { icon: 'palette', label: 'צבע', onClick: () => pickPastel(anchor, { current: m.color, onPick: (c) => act(() => bus.ask('trainings.setMilestoneFlags', { actor: me(), msId: m.id, color: c })) }) },
    { icon: m.status === 'hidden' ? 'eye' : 'eye-off', label: m.status === 'hidden' ? 'הצגה' : 'הסתרה', hidden: m.status === 'draft', onClick: () => act(() => bus.ask('trainings.setMilestoneFlags', { actor: me(), msId: m.id, status: m.status === 'hidden' ? 'published' : 'hidden' })) },
    { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: async () => {
      const dependents = bus.read('trainings.milestones', m.treeId, { all: true }).filter((x) => (x.groups || []).some((g) => g.ids.includes(m.id)));
      if (await confirm({ title: `מחיקת ${m.name}`, text: dependents.length ? `הדרישות של אלה יאבדו אותה: ${dependents.map((x) => x.name).join(', ')}` : 'אפשר למחוק רק אבן דרך שאף אחד לא שלח או קיבל.', ok: 'מחיקה', danger: true }))
        act(() => bus.ask('trainings.deleteMilestone', { actor: me(), msId: m.id }), 'נמחק');
    } },
  ], anchor);
}

/* ---------- requirement groups editor (shared by wizard step 4 and the action sheet) ---------- */
function GroupsEditor({ msId, treeId, groups, onChange }) {
  const all = bus.read('trainings.milestones', treeId, { all: true }).filter((x) => x.id !== msId);
  const [err, setErr] = useState(null);
  const update = (next) => {
    if (msId && bus.read('trainings.wouldLoop', msId, next)) { setErr('זה ייצור מעגל'); return; }
    setErr(null); onChange(next);
  };
  const pick = (gi, anchor) => {
    const Body = () => {
      const [q, setQ] = useState('');
      const g = groups[gi];
      const [sel, setSel] = useState(g.ids);
      const list = all.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
      return html`<div class="col gap8" style="width:320px;max-width:100%"><${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש אבני דרך"/>
        <div class="col gap4" style="max-height:320px;overflow:auto">${list.map((x) => html`<label class="check-row" style="min-height:40px"><${Checkbox} on=${sel.includes(x.id)} label=${x.name}
          onChange=${(v) => { const ns = v ? [...sel, x.id] : sel.filter((y) => y !== x.id); setSel(ns); update(groups.map((gg, j) => (j === gi ? { ...gg, ids: ns, n: Math.min(gg.n, Math.max(1, ns.length)) } : gg))); }}/><span class="t-foot" style="font-size:15px"><bdi>${x.name}</bdi></span></label>`)}</div></div>`;
    };
    popover(anchor, () => html`<${Body}/>`, { title: 'אבני דרך', noAutofocus: true });
  };
  return html`<div class="col gap8">
    ${groups.map((g, i) => html`<div class="card b col gap8" key=${g.id || i}>
      <div class="row gap8"><${Seg} small value=${g.mode} onChange=${(v) => update(groups.map((x, j) => (j === i ? { ...x, mode: v } : x)))} options=${[{ value: 'all', label: 'כולן' }, { value: 'atleast', label: 'לפחות' }]}/>
        ${g.mode === 'atleast' && html`<input class="input num" style="width:72px;min-height:36px;padding:6px" type="number" min="1" max=${Math.max(1, g.ids.length)} value=${g.n} onInput=${(e) => update(groups.map((x, j) => (j === i ? { ...x, n: Math.max(1, Math.min(Number(e.target.value) || 1, g.ids.length || 1)) } : x)))} aria-label="כמה"/>`}
        <span class="grow"/><${IconButton} small icon="x" label="הסרת קבוצה" onClick=${() => update(groups.filter((_, j) => j !== i))}/></div>
      <div class="row wrap gap4">${g.ids.map((id) => { const x = bus.read('trainings.milestone', id); return x && html`<span class="sel-chip"><bdi>${x.name}</bdi><button aria-label="הסרה" onClick=${() => update(groups.map((gg, j) => (j === i ? { ...gg, ids: gg.ids.filter((y) => y !== id) } : gg)))}><${Icon} name="x" size=${14}/></button></span>`; })}
        <button class="chip" onClick=${(e) => pick(i, e.currentTarget)}>+ אבני דרך</button></div></div>`)}
    ${err && html`<span class="field-error"><${Icon} name="circle-alert" size=${16}/>${err}</span>`}
    <div><${Button} size="sm" kind="tinted" onClick=${() => update([...groups, { id: newId('g'), mode: 'all', n: 1, ids: [] }])}>+ קבוצת דרישות</${Button}></div>
  </div>`;
}
export function requirementsSheet(m) {
  let groups = JSON.parse(JSON.stringify(m.groups || []));
  const Body = () => { const [g, setG] = useState(groups); groups = g; return html`<${GroupsEditor} msId=${m.id} treeId=${m.treeId} groups=${g} onChange=${setG}/>`; };
  sheet(`דרישות · ${m.name}`, () => html`<${Body}/>`, { foot: (c) => html`<${Button} kind="primary" full onClick=${() => { if (act(() => bus.ask('trainings.setRequirements', { actor: me(), msId: m.id, groups: groups.filter((g) => g.ids.length) })) !== undefined) { c(); toast('נשמר'); } }}>שמירה</${Button}>` });
}

/* ---------- content blocks ---------- */
function BlockEditor({ blocks, onChange }) {
  const [busy, setBusy] = useState(null);
  const add = (i, type) => { const n = [...blocks]; n.splice(i, 0, { id: newId('bl'), type, html: '', file: null, caption: '', url: '' }); onChange(n); };
  const set = (i, patch) => onChange(blocks.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const upload = async (i, f, kind) => {
    const okType = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) : ['video/mp4', 'video/webm', 'video/quicktime'].includes(f.type);
    if (!okType) return toast(kind === 'image' ? 'JPG, PNG או WebP' : 'MP4, WebM או MOV');
    if (f.size > (kind === 'image' ? 10 : 200) * 1024 * 1024) return toast(kind === 'image' ? 'עד 10 MB' : 'עד 200 MB');
    setBusy(blocks[i].id);
    try { const id = await media.put(f); set(i, { file: id }); }
    catch { toast('ההעלאה נכשלה — נסה שוב'); }
    setBusy(null);
  };
  const Plus = ({ i }) => html`<div class="row" style="justify-content:center"><button class="chip" onClick=${(e) => actionSheet('הוספת בלוק', [
    { icon: 'type', label: 'טקסט', onClick: () => add(i, 'text') }, { icon: 'image', label: 'תמונה', onClick: () => add(i, 'image') },
    { icon: 'video', label: 'סרטון (קובץ)', onClick: () => add(i, 'video') }, { icon: 'youtube', label: 'סרטון (קישור)', onClick: () => add(i, 'videoLink') }], e.currentTarget)}>
    <${Icon} name="plus" size=${16}/></button></div>`;
  return html`<div class="col gap8" data-drop-list="blocks:1"><${Plus} i=${0}/>
    ${blocks.map((bl, i) => html`<div key=${bl.id} data-drag-item class="col gap8"><div class="card b col gap8">
      <div class="row gap8"><span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'blocks', listId: '1', onDrop: ({ fromIndex, toIndex }) => onChange(moveIn(blocks, fromIndex, toIndex)) })}><${Icon} name="grip-vertical" size=${20}/></span>
        <span class="t-foot sec grow">${{ text: 'טקסט', image: 'תמונה', video: 'סרטון (קובץ)', videoLink: 'סרטון (קישור)' }[bl.type]}</span>
        <${IconButton} small icon="ellipsis" label="פעולות" onClick=${(e) => actionSheet('בלוק', [{ icon: 'copy', label: 'שכפול', onClick: () => { const n = [...blocks]; n.splice(i + 1, 0, { ...bl, id: newId('bl') }); onChange(n); } }, { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: () => onChange(blocks.filter((_, j) => j !== i)) }], e.currentTarget)}/></div>
      ${bl.type === 'text' && html`<${RichEditor} value=${bl.html} onChange=${(v) => set(i, { html: v })} placeholder="כתבו כאן…"/>`}
      ${(bl.type === 'image' || bl.type === 'video') && html`<div class="row gap8"><label class="btn btn-tinted btn-sm">${busy === bl.id ? html`<span class="spinner"/>` : html`<${Icon} name="upload" size=${18}/>`}${bl.file ? 'החלפת קובץ' : 'העלאה'}
          <input type="file" class="hide" accept=${bl.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm,video/quicktime'} onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) upload(i, f, bl.type); }}/></label>
        ${bl.file && html`<span class="t-foot successt row gap4"><${Icon} name="check" size=${16}/>הועלה</span>`}</div>`}
      ${bl.type === 'videoLink' && html`<input class="input" dir="ltr" placeholder="https://youtube.com/… או קישור ל-Google Drive" value=${bl.url} onInput=${(e) => set(i, { url: e.target.value.trim() })}/>`}
      ${bl.type !== 'text' && html`<input class="input" placeholder="כיתוב (לא חובה)" value=${bl.caption} onInput=${(e) => set(i, { caption: e.target.value })}/>`}
    </div><${Plus} i=${i + 1}/></div>`)}</div>`;
}

/* ---------- the wizard ---------- */
const STEPS = ['שם, אייקון וצבע', 'תיאור קצר', 'תוכן', 'דרישות, תרגול, מבחן ומטבעות'];
/** openWizard({id}) edits; openWizard({treeId, groups}) creates. */
export function openWizard({ id, treeId, groups }) {
  const existing = id ? bus.read('trainings.milestone', id) : null;
  const tree = bus.read('trainings.tree', existing ? existing.treeId : treeId);
  const def = bus.read('trainings.settings').default_coins;
  const st = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', icon: 'star', color: tree.color, desc: '', blocks: [], checklist: [], exam: [], coins: '', groups: groups || [], status: 'draft' };
  st.useChecklist = st.checklist.length > 0; st.useExam = st.exam.length > 0;
  const initial = JSON.stringify(st);
  let step = 0;
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const [s, setS] = useState(0); step = s;
    const set = (k) => (v) => setF({ ...f, [k]: v });
    const p = pastel(f.color);
    const tabs = existing;
    const listEd = (key, label, addLabel) => html`<div class="col gap4">${f[key].map((x, i) => html`<div class="row gap8" key=${x.id}><input class="input grow" placeholder=${label + ' ' + (i + 1)} value=${x.text} onInput=${(e) => set(key)(f[key].map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}/>
      <${IconButton} small icon="x" label="הסרה" onClick=${() => set(key)(f[key].filter((_, j) => j !== i))}/></div>`)}
      <div><${Button} size="sm" kind="ghost" onClick=${() => set(key)([...f[key], { id: newId('x'), text: '' }])}>${addLabel}</${Button}></div></div>`;
    return html`<div class="col gap16">
      ${tabs ? html`<div class="text-tabs">${STEPS.map((t, i) => html`<button class=${cx('text-tab', s === i && 'on')} onClick=${() => setS(i)}>${t}</button>`)}</div>`
        : html`<div class="row gap8" style="justify-content:center">${STEPS.map((_, i) => html`<span style=${`width:${i === s ? 24 : 8}px;height:8px;border-radius:4px;background:${i <= s ? 'var(--brand)' : 'var(--border-strong)'};transition:width var(--dur-base)`}/>`)}</div>
          <h3 class="t-title3 center">${STEPS[s]}</h3>`}
      ${s === 0 && html`<div class="col gap12">
        <${Field} label="שם (עד 60)"><input class="input" maxlength="60" value=${f.name} onInput=${(e) => set('name')(e.target.value)}/></${Field}>
        <div class="row gap12 wrap"><${Field} label="אייקון"><button class="select-btn" style="width:auto" onClick=${(e) => pickIcon(e.currentTarget, { current: f.icon, onPick: set('icon') })}><${MsIcon} name=${f.icon} size=${24}/>בחירת אייקון</button></${Field}>
          <${Field} label="צבע"><button class="select-btn" style="width:auto" onClick=${(e) => pickPastel(e.currentTarget, { current: f.color, onPick: set('color') })}><span style=${`width:24px;height:24px;border-radius:6px;background:${p.fill};border:1px solid ${p.dark}`}/>${p.name}</button></${Field}></div>
        <div class="row gap24" style="justify-content:center;padding:16px"><${Node} m=${{ ...f, name: f.name || 'אבן דרך' }} state="open"/><${Node} m=${{ ...f, name: 'מאושר' }} state="approved"/></div></div>`}
      ${s === 1 && html`<${Field} label="תיאור קצר" hint=${`${f.desc.length}/280`}><textarea class="textarea" maxlength="280" value=${f.desc} onInput=${(e) => set('desc')(e.target.value)}/></${Field}>`}
      ${s === 2 && html`<div class="col gap8"><span class="t-foot sec">לא חובה. אפשר לשלב טקסט, תמונות וסרטונים.</span><${BlockEditor} blocks=${f.blocks} onChange=${set('blocks')}/></div>`}
      ${s === 3 && html`<div class="col gap16">
        <div class="col gap8"><span class="t-label">דרישות</span><${GroupsEditor} msId=${existing && existing.id} treeId=${tree.id} groups=${f.groups} onChange=${set('groups')}/></div>
        <${SwitchRow} label="רשימת תרגול" on=${f.useChecklist} onChange=${(v) => setF({ ...f, useChecklist: v, checklist: v && !f.checklist.length ? [{ id: newId('x'), text: '' }] : f.checklist })}/>
        ${f.useChecklist && listEd('checklist', 'תרגיל', '+ תרגיל')}
        <${SwitchRow} label="מבחן" on=${f.useExam} onChange=${(v) => setF({ ...f, useExam: v, exam: v && !f.exam.length ? [{ id: newId('x'), text: '' }] : f.exam })}/>
        ${f.useExam && listEd('exam', 'שאלה', '+ שאלה')}
        <${Field} label="מטבעות"><input class="input num" type="number" min="0" placeholder=${String(def)} value=${f.coins ?? ''} onInput=${(e) => set('coins')(e.target.value)}/></${Field}></div>`}
      ${!tabs && html`<div class="row"><${Button} kind="secondary" disabled=${s === 0} icon="arrow-right" onClick=${() => setS(s - 1)}>הקודם</${Button}><span class="spacer"/>
        ${s < 3 ? html`<${Button} kind="primary" iconEnd="arrow-left" disabled=${(s === 0 && !f.name.trim()) || (s === 1 && !f.desc.trim())} onClick=${() => setS(s + 1)}>הבא</${Button}>`
        : html`<${Button} kind="primary" disabled=${!f.name.trim() || !f.desc.trim()} onClick=${() => save('published')}>פרסום</${Button}>`}</div>`}
    </div>`;
  };
  const payload = (status) => ({ ...st, checklist: st.useChecklist ? st.checklist : [], exam: st.useExam ? st.exam : [], status: status || st.status });
  const save = (status, major) => {
    const r = act(() => bus.ask('trainings.saveMilestone', { actor: me(), treeId: tree.id, milestone: payload(status), major }));
    if (r) { close(); toast(status === 'draft' ? 'הטיוטה נשמרה' : major ? 'נשמר — כולם יתבקשו לשלוח שוב' : 'נשמר'); }
  };
  const close = sheet(existing ? `עריכה · ${existing.name}` : 'אבן דרך חדשה', () => html`<${Body}/>`, {
    full: true, wide: true,
    dirty: () => JSON.stringify(st) !== initial,
    // ✕ asks to save a draft if anything was entered (Trainings 10.2)
    onDirtyClose: async (closeIt) => {
      const keep = await confirm({ title: 'לשמור טיוטה?', text: 'מה שכתבת יישמר כטיוטה שאפשר להמשיך מאוחר יותר.', ok: 'שמירת טיוטה', cancel: 'יציאה בלי לשמור' });
      if (keep && st.name.trim()) save('draft'); else closeIt();
    },
    foot: () => html`<${Button} kind="ghost" onClick=${() => save('draft')} disabled=${!st.name.trim()}>שמירת טיוטה</${Button}><span class="spacer"/>
      ${existing && html`<${Button} kind="secondary" onClick=${async () => { if (await confirm({ title: 'שינוי מהותי', text: 'כל מי שאבן הדרך אושרה לו/ה יתבקש/תתבקש לשלוח שוב. מטבעות שכבר שולמו נשארים.', ok: 'שינוי מהותי' })) save(existing.status === 'draft' ? 'published' : existing.status, true); }}>שינוי מהותי</${Button}>
        <${Button} kind="primary" onClick=${() => save(existing.status === 'draft' ? 'published' : existing.status)}>שמירה</${Button}>`}`,
  });
}
