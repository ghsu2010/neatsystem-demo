// Trainings UI: home (categories, rank strip, trees), tree view, milestone page, requests, progress,
// Home "next milestones" widget and the profile "הוספת הכשרה" (force check) action.
import { html, useState, useEffect, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addRoute, addWidget, addTabBadge, widget } from '../../core/registry.js';
import { Button, Icon, Chips, Seg, Card, EmptyState, Badge, Progress, Switch, Tabs, SearchInput, IconButton, Checkbox, ReadOnlyNote, cx } from '../../core/ui.js';
import { Avatar, PersonName } from '../../core/people.js';
import { act, toast, confirm, sheet, popover, promptText, actionSheet, isPhone } from '../../core/overlay.js';
import { RichView } from '../../core/richtext.js';
import { navigate, route } from '../../core/router.js';
import { fmtDate, relTime, byHe } from '../../core/format.js';
import { pastel } from '../../core/color.js';
import { media } from './index.js';
import { MsIcon, Node, layout, PanZoom, GEOM, STATE_LABEL } from './nodes.js';
import { openWizard, treeForm, nodeActions, requirementsSheet } from './editor.js';
import './manage.js';

const me = () => bus.read('users.currentId');
const A = () => bus.read('users.actor', me());
const W = (name, props) => { const C = widget(name); return C ? html`<${C} ...${props}/>` : null; };
const viewState = (uid, m, canTake) => (canTake ? bus.read('trainings.state', uid, m.id) : 'view');

/* ================= Trainings home ================= */
function TrainingsHome() {
  const uid = me();
  const q = route().query;
  const cats = bus.read('trainings.visibleCategories', uid);
  const catId = q.cat && cats.some((c) => c.id === q.cat) ? q.cat : cats[0] && cats[0].id;
  const tab = q.tab || 'trees';
  if (!catId) return html`<${EmptyState} title="אין כרגע הכשרות פתוחות"/>`;
  const c = bus.read('trainings.category', catId);
  const isApprover = bus.read('trainings.isApprover', uid, catId);
  const a = A();
  const canProgress = isApprover || (!a.alumni && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor));
  const pending = bus.read('trainings.requests', { catId, state: 'pending' }).filter((r) => r.uid !== uid).length;
  const go = (patch) => navigate('/trainings?' + new URLSearchParams({ cat: catId, tab, ...patch }).toString());
  const team = cats.filter((x) => x.kind === 'team'), special = cats.filter((x) => x.kind === 'special');
  const chips = [...team.map((x) => ({ value: x.id, label: x.name })), ...(special.length ? [{ head: 'הסמכות מיוחדות' }] : []), ...special.map((x) => ({ value: x.id, label: x.name }))];
  return html`<div class="col gap16">
    <h1 class="page-title" style="margin:0">הכשרות</h1>
    <${Chips} items=${chips} value=${catId} onChange=${(v) => go({ cat: v, tab: 'trees' })}/>
    ${(isApprover || canProgress) && html`<${Tabs} value=${tab} onChange=${(v) => go({ tab: v })} items=${[{ value: 'trees', label: 'עצים' }, ...(isApprover ? [{ value: 'requests', label: `בקשות (${pending})` }] : []), ...(canProgress ? [{ value: 'progress', label: 'התקדמות' }] : [])]}/>`}
    ${tab === 'requests' && isApprover ? html`<${Requests} catId=${catId}/>` : tab === 'progress' && canProgress ? html`<${ProgressView} catId=${catId}/>` : html`<${Trees} c=${c}/>`}
  </div>`;
}
function Trees({ c }) {
  const uid = me();
  const editor = bus.read('trainings.isEditor', uid, c.id);
  const list = bus.read('trainings.trees', c.id).filter((t) => bus.read('trainings.canView', uid, t.id));
  const takes = (t) => bus.read('trainings.canTake', uid, t.id);
  return html`<div class="col gap16">
    ${W('ranks.strip', { uid, catId: c.id })}
    ${list.length === 0 ? html`<${EmptyState} title="אין עדיין עצים בקטגוריה הזו" action=${editor && html`<${Button} kind="tinted" onClick=${() => treeForm(c.id, null)}>+ עץ חדש</${Button}>`}/>` : html`
    <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${list.map((t) => {
      const ms = bus.read('trainings.milestones', t.id);
      const appr = ms.filter((m) => bus.read('trainings.state', uid, m.id) === 'approved').length;
      const fresh = takes(t) && ms.some((m) => ['open'].includes(bus.read('trainings.state', uid, m.id)) && !bus.read('trainings.seen', uid, m.id));
      const p = pastel(t.color);
      return html`<${Card} key=${t.id} onClick=${() => navigate('/trainings/tree/' + t.id)}>
        <div class="row gap12"><span style=${`width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:${p.fill};color:${p.dark};flex:none`}><${MsIcon} name=${t.icon} size=${24}/></span>
          <div class="col gap4 grow" style="min-width:0"><span class="row gap4"><span class="t-title3 grow"><bdi>${t.name}</bdi></span>${fresh && html`<span class="dot-new" title="חדש"/>`}${t.hidden && html`<${Badge} text="מוסתר"/>`}</span>
          ${takes(t) ? html`<span class="t-foot sec num">${appr}/${ms.length}</span>` : html`<span class="t-foot sec">צפייה בלבד</span>`}</div></div>
        ${takes(t) && html`<div class="mt8"><${Progress} value=${appr} max=${ms.length}/></div>`}
      </${Card}>`;
    })}</div>
    ${editor && html`<div><${Button} kind="tinted" size="sm" onClick=${() => treeForm(c.id, null)}>+ עץ חדש</${Button}></div>`}`}
  </div>`;
}

/* ================= tree view (7.1) and editor (10.1) ================= */
function TreeView({ id }) {
  const uid = me();
  const t = bus.read('trainings.tree', id);
  const q = route().query;
  const [list, setList] = useState(false);
  if (!t || !bus.read('trainings.canView', uid, id)) return html`<${EmptyState} title="אין לך גישה לעץ הזה"/>`;
  const c = bus.read('trainings.category', t.catId);
  const editor = bus.read('trainings.isEditor', uid, c.id);
  const editing = editor && q.edit === '1';
  const takes = bus.read('trainings.canTake', uid, id);
  const ms = bus.read('trainings.milestones', id, { all: editing }).filter((m) => editing || m.status === 'published');
  const depths = bus.read('trainings.depths', id, editing);
  const L = layout(ms, depths);
  const st = (m) => (editing ? (m.status === 'draft' ? 'view' : 'view') : viewState(uid, m, takes));
  const open = ms.filter((m) => st(m) === 'open');
  const centerTarget = open.length ? { x: open.reduce((s, m) => s + L.pos[m.id].x, 0) / open.length, y: Math.min(...open.map((m) => L.pos[m.id].y)) } : null;
  const met = (rid) => takes && ['approved', 'submitted', 'rejected', 'needs_reapproval'].includes(bus.read('trainings.state', uid, rid));
  const tap = (m, e) => {
    if (editing) return nodeActions(m, e.currentTarget);
    preview(m, takes, e.currentTarget);
  };
  const lines = [], pills = [];
  ms.forEach((m) => (m.groups || []).forEach((g) => {
    const ids = g.ids.filter((x) => L.pos[x]);
    ids.forEach((rid) => { const a = L.pos[rid], b2 = L.pos[m.id]; const y1 = a.y + GEOM.NODE + 6, y2 = b2.y - 6; const x1 = a.x, x2 = b2.x; const mid = (y1 + y2) / 2;
      lines.push(html`<path d=${`M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`} fill="none" stroke=${met(rid) ? 'var(--blue-300)' : 'var(--border-strong)'} stroke-width="2" stroke-linecap="round"/>`); });
    if (g.mode === 'atleast' && ids.length) pills.push(html`<span class="req-pill" style=${`left:${L.pos[m.id].x}px;top:${L.pos[m.id].y - 18}px`}>${Math.min(g.n, ids.length)} מתוך ${ids.length}</span>`);
  }));
  const graph = html`<${PanZoom} width=${L.width} height=${L.height + 40} centerTarget=${centerTarget} key=${id + editing}>
    <svg width=${L.width} height=${L.height} style="position:absolute;inset:0;overflow:visible" aria-hidden="true">${lines}</svg>
    ${pills}
    ${ms.map((m) => html`<div key=${m.id} style=${`position:absolute;left:${L.pos[m.id].x - 52}px;top:${L.pos[m.id].y}px;width:104px;display:flex;justify-content:center`}>
      <${Node} m=${m} state=${st(m)} draft=${m.status === 'draft'} hidden=${m.status === 'hidden'} isNew=${takes && st(m) === 'open' && !bus.read('trainings.seen', uid, m.id)} onClick=${(e) => tap(m, e)}/></div>`)}
    ${editing && ms.map((m) => html`<button key=${'b' + m.id} class="add-branch" title="ענף חדש" aria-label=${'ענף חדש מתחת ל' + m.name} style=${`left:${L.pos[m.id].x}px;top:${L.pos[m.id].y + GEOM.NODE + 46}px`}
      onClick=${() => openWizard({ treeId: id, groups: [{ mode: 'all', n: 1, ids: [m.id] }] })}><${Icon} name="plus" size=${16}/></button>`)}
  </${PanZoom}>`;
  const listView = html`<div class="list">${Object.entries(ms.reduce((acc, m) => { const d = depths[m.id] || 0; (acc[d] = acc[d] || []).push(m); return acc; }, {})).map(([d, row]) => row.map((m) => html`
    <button class="lrow" key=${m.id} style=${`padding-inline-start:${16 + Number(d) * 24}px`} onClick=${(e) => tap(m, e)}>
      <${Node} m=${m} state=${st(m)} size=${40} label=${false}/><span class="col gap4 grow"><span class="t-label"><bdi>${m.name}</bdi></span><span class="t-foot sec">${STATE_LABEL[st(m)]}${m.status !== 'published' ? ` · ${m.status === 'draft' ? 'טיוטה' : 'מוסתר'}` : ''}</span></span></button>`))}</div>`;
  return html`<div class="col gap12">
    <div class="row wrap gap8"><${IconButton} icon="arrow-right" label="חזרה" onClick=${() => navigate('/trainings?cat=' + c.id)}/>
      <h1 class="t-title2 grow"><bdi>${t.name}</bdi></h1>
      <label class="row gap8 t-foot sec">רשימה <${Switch} on=${list} onChange=${setList} label="רשימה"/></label>
      ${editor && !editing && html`<${Button} size="sm" kind="tinted" icon="pencil" onClick=${() => navigate(`/trainings/tree/${id}?edit=1`)}>עריכה</${Button}>`}
      ${editing && html`<${Button} size="sm" kind="tinted" onClick=${() => openWizard({ treeId: id })}>+ אבן דרך</${Button}>
        <${Button} size="sm" kind="ghost" icon="settings-2" onClick=${() => treeForm(c.id, t)}>הגדרות עץ</${Button}>
        <${Button} size="sm" kind="primary" onClick=${() => navigate('/trainings/tree/' + id)}>סיום עריכה</${Button}>`}</div>
    ${t.desc && html`<p class="t-foot sec" dir="auto">${t.desc}</p>`}
    ${!takes && !editing && html`<${ReadOnlyNote} text="צפייה בלבד"/>`}
    ${ms.length === 0 ? html`<${EmptyState} title="אין עדיין אבני דרך בעץ הזה" action=${editing && html`<${Button} kind="tinted" onClick=${() => openWizard({ treeId: id })}>+ אבן דרך</${Button}>`}/>` : list ? listView : graph}
  </div>`;
}
function reqSummary(uid, m, takes) {
  return (m.groups || []).map((g) => {
    const ids = g.ids.filter((x) => { const y = bus.read('trainings.milestone', x); return y && y.status === 'published'; });
    const mets = ids.map((x) => takes && ['approved', 'submitted', 'rejected', 'needs_reapproval'].includes(bus.read('trainings.state', uid, x)));
    return { g, ids, mets, n: Math.min(g.n, ids.length), metCount: mets.filter(Boolean).length };
  }).filter((x) => x.ids.length);
}
function preview(m, takes, anchor) {
  const uid = me();
  const s = takes ? bus.read('trainings.state', uid, m.id) : 'view';
  const coins = m.coins ?? bus.read('trainings.settings').default_coins;
  const reqs = reqSummary(uid, m, takes);
  popover(anchor, (close) => html`<div class="col gap8" style="width:280px;max-width:100%">
    <div class="row gap8"><span class="t-title3 grow"><bdi>${m.name}</bdi></span>${s !== 'view' && html`<${Badge} text=${STATE_LABEL[s]}/>`}</div>
    ${m.desc && html`<p class="t-foot sec" dir="auto">${m.desc}</p>`}
    <span class="coin-chip sm" style="align-self:flex-start"><${Icon} name="coin" size=${14}/>${coins}</span>
    ${reqs.map((r) => html`<div class="t-foot">${r.g.mode === 'all' ? html`דרוש: כל אלה ${r.mets.map((x) => (x ? '✓' : '✗')).join(' ')}` : `לפחות ${r.n} מתוך ${r.ids.length}: ${r.metCount}/${r.n}`}
      <div class="col gap4 mt8">${r.ids.map((x, i) => html`<span class=${cx('row gap4', r.mets[i] ? 'successt' : 'sec')}><${Icon} name=${r.mets[i] ? 'check' : 'x'} size=${14}/><bdi>${bus.read('trainings.milestone', x).name}</bdi></span>`)}</div></div>`)}
    ${s !== 'locked' && html`<${Button} kind="primary" onClick=${() => { close(); navigate('/trainings/ms/' + m.id); }}>פתיחה</${Button}>`}
  </div>`, { title: m.name });
}

/* ================= milestone page (7.2) ================= */
function embed(url) {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const dr = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (dr) return `https://drive.google.com/file/d/${dr[1]}/preview`;
  return null;
}
export function Blocks({ blocks }) {
  return html`${(blocks || []).map((bl) => {
    if (bl.type === 'text') return html`<${RichView} key=${bl.id} value=${bl.html}/>`;
    if (bl.type === 'image') { const u = bl.file && media.url(bl.file); return html`<figure key=${bl.id} style="margin:0" class="col gap4">${u ? html`<img src=${u} alt=${bl.caption || ''} style="width:100%;border-radius:var(--r-md)"/>` : html`<div class="skel" style="height:200px"/>`}${bl.caption && html`<figcaption class="t-foot sec">${bl.caption}</figcaption>`}</figure>`; }
    if (bl.type === 'video') { const u = bl.file && media.url(bl.file); return html`<figure key=${bl.id} style="margin:0" class="col gap4">${u ? html`<video src=${u} controls playsinline style="width:100%;border-radius:var(--r-md)"/>` : html`<div class="skel" style="height:200px"/>`}${bl.caption && html`<figcaption class="t-foot sec">${bl.caption}</figcaption>`}</figure>`; }
    if (bl.type === 'videoLink') { const e = bl.url && embed(bl.url); return html`<figure key=${bl.id} style="margin:0" class="col gap4">${e ? html`<iframe src=${e} title=${bl.caption || 'סרטון'} style="width:100%;aspect-ratio:16/9;border:0;border-radius:var(--r-md)" allow="encrypted-media; picture-in-picture" allowfullscreen/>` : html`<a href=${bl.url} target="_blank" rel="noopener">${bl.url}</a>`}${bl.caption && html`<figcaption class="t-foot sec">${bl.caption}</figcaption>`}</figure>`; }
    return null;
  })}`;
}
function MilestonePage({ id }) {
  const uid = me();
  const m = bus.read('trainings.milestone', id);
  const t = m && bus.read('trainings.tree', m.treeId);
  const [pr, setPr] = useState(() => bus.read('trainings.progress', uid, id));
  const timer = useRef();
  useEffect(() => { if (m && bus.read('trainings.canTake', uid, m.treeId) && !A().readOnly) act(() => bus.ask('trainings.markSeen', { actor: uid, msId: id })); }, [id]);
  if (!m || !t || !bus.read('trainings.canView', uid, t.id)) return html`<${EmptyState} title="אין לך גישה לאבן הדרך הזו"/>`;
  const a = A();
  const takes = bus.read('trainings.canTake', uid, t.id);
  const editor = bus.read('trainings.isEditor', uid, t.catId);
  const s = takes ? bus.read('trainings.state', uid, id) : 'view';
  const rec = bus.read('trainings.record', uid, id);
  const interactive = takes && !a.readOnly && ['open', 'rejected', 'needs_reapproval'].includes(s);
  const save = (next) => { setPr(next); clearTimeout(timer.current); timer.current = setTimeout(() => act(() => bus.ask('trainings.saveProgress', { actor: uid, msId: id, ...next })), 400); };
  const allTicked = (m.checklist || []).every((x) => pr.ticks.includes(x.id));
  const allAnswered = (m.exam || []).every((q) => (pr.answers[q.id] || '').trim());
  const reqs = reqSummary(uid, m, takes);
  const lastReq = bus.read('trainings.requests', { uid, msId: id })[0];
  return html`<div class="col gap16" style="max-width:760px;padding-bottom:96px">
    <div class="row gap8"><${IconButton} icon="arrow-right" label="חזרה לעץ" onClick=${() => navigate('/trainings/tree/' + t.id)}/><span class="t-foot sec grow"><bdi>${t.name}</bdi></span>
      ${editor && html`<${Button} size="sm" kind="tinted" icon="pencil" onClick=${() => openWizard({ id })}>עריכה</${Button}>`}</div>
    ${s === 'rejected' && rec && rec.note && html`<div class="card" style="background:var(--danger-tint);box-shadow:none;color:var(--danger)"><span class="t-label">נדחה</span><p class="t-body">${rec.note}</p></div>`}
    ${s === 'needs_reapproval' && html`<div class="card" style="background:#FEF3D0;box-shadow:none;color:#7A4D00"><span class="t-label">דרוש אישור מחדש</span><p class="t-foot">היה שינוי מהותי באבן הדרך — עברו על התוכן ושלחו שוב.</p></div>`}
    <div class="row gap12"><span style=${`width:48px;height:48px;display:grid;place-items:center;border-radius:50%;background:${pastel(m.color).fill};color:${pastel(m.color).dark};flex:none`}><${MsIcon} name=${m.icon} size=${28}/></span>
      <h1 class="t-title1 grow"><bdi>${m.name}</bdi></h1>${s !== 'view' && html`<${Badge} text=${STATE_LABEL[s]}/>`}</div>
    ${m.desc && html`<p class="t-body" dir="auto">${m.desc}</p>`}
    ${reqs.length > 0 && html`<div class="subtle-box col gap8"><span class="t-label">דרישות</span>${reqs.map((r) => html`<div class="col gap4"><span class="t-foot sec">${r.g.mode === 'all' ? 'כולן' : `לפחות ${r.n}`}</span>
      ${r.ids.map((x, i) => html`<a class=${cx('row gap4 t-foot', r.mets[i] ? 'successt' : 'sec')} href=${'#/trainings/ms/' + x}><${Icon} name=${r.mets[i] ? 'circle-check' : 'circle'} size=${16}/><bdi>${bus.read('trainings.milestone', x).name}</bdi></a>`)}</div>`)}</div>`}
    <div class="col gap16" style="max-width:70ch"><${Blocks} blocks=${m.blocks}/></div>
    ${(m.checklist || []).length > 0 && html`<section class="col gap8"><h2 class="t-title3">תרגול</h2><div class="list">${m.checklist.map((x) => html`<label class="lrow" key=${x.id} style="cursor:${interactive ? 'pointer' : 'default'}">
      <${Checkbox} on=${pr.ticks.includes(x.id)} disabled=${!interactive} label=${x.text} onChange=${(v) => save({ ...pr, ticks: v ? [...pr.ticks, x.id] : pr.ticks.filter((y) => y !== x.id) })}/><span class="t-body" dir="auto">${x.text}</span></label>`)}</div></section>`}
    ${(m.exam || []).length > 0 && html`<section class="col gap8"><h2 class="t-title3">מבחן</h2>${m.exam.map((qq, i) => html`<div class="card b col gap8" key=${qq.id}><span class="t-label" dir="auto">${i + 1}. ${qq.text}</span>
      <textarea class="textarea" dir="auto" disabled=${!interactive} value=${pr.answers[qq.id] || ''} onInput=${(e) => save({ ...pr, answers: { ...pr.answers, [qq.id]: e.target.value } })}/></div>`)}</section>`}
    ${a.readOnly && html`<${ReadOnlyNote}/>`}
    ${takes && !a.readOnly && html`<div class="ms-bar">
      ${s === 'submitted' ? html`<span class="t-label">נשלח לאישור · ${fmtDate(lastReq ? lastReq.at : rec.at)}</span>`
      : s === 'approved' ? html`<span class="t-label successt row gap4"><${Icon} name="circle-check" size=${20}/>מאושר</span>`
      : s === 'locked' ? html`<span class="t-foot sec">אבן הדרך נעולה — השלימו קודם את הדרישות</span>`
      : html`<div class="col gap4 grow"><${Button} kind="primary" full disabled=${!allTicked || !allAnswered} onClick=${() => { clearTimeout(timer.current); bus.ask('trainings.saveProgress', { actor: uid, msId: id, ...pr }); if (act(() => bus.ask('trainings.submit', { actor: uid, msId: id }))) toast('נשלח לאישור'); }}>סיימתי</${Button}>
        ${!allTicked ? html`<span class="t-foot sec center">סמנו את כל התרגולים</span>` : !allAnswered ? html`<span class="t-foot sec center">ענו על כל השאלות</span>` : null}</div>`}</div>`}
  </div>`;
}

/* ================= requests (14) ================= */
function Requests({ catId }) {
  const uid = me();
  const [sub, setSub] = useState('pending');
  const hl = route().query.req;
  const list = bus.read('trainings.requests', { catId }).filter((r) => r.uid !== uid && (sub === 'pending' ? r.state === 'pending' : r.state !== 'pending'));
  if (sub === 'pending') list.reverse();
  useEffect(() => { if (hl) { const r = bus.read('trainings.request', hl); if (r && r.state === 'pending') openRequest(hl); } }, [hl]);
  return html`<div class="col gap12"><${Seg} value=${sub} onChange=${setSub} options=${[{ value: 'pending', label: 'ממתינות' }, { value: 'done', label: 'הוכרעו' }]}/>
    ${list.length === 0 ? html`<${EmptyState} title="אין בקשות ממתינות" sticker=${false}/>` : html`<div class="list">${list.map((r) => {
      const m = bus.read('trainings.milestone', r.msId); const t = m && bus.read('trainings.tree', m.treeId);
      return html`<button class="lrow" key=${r.id} style=${hl === r.id ? 'background:var(--brand-subtle)' : ''} onClick=${() => openRequest(r.id)}>
        <${Avatar} uid=${r.uid} size=${40}/><div class="col gap4 grow" style="min-width:0"><${PersonName} uid=${r.uid}/><span class="t-foot sec"><bdi>${t ? t.name : ''}</bdi> · <bdi>${m ? m.name : 'אבן דרך שנמחקה'}</bdi> · ניסיון ${r.attempt}</span></div>
        ${sub === 'pending' ? html`<span class="t-foot sec">${relTime(r.at)}</span>` : html`<${Badge} kind=${r.state === 'approved' ? 'success' : 'danger'} text=${r.forced ? 'הוזן ידנית' : r.state === 'approved' ? 'מאושר' : 'נדחה'}/>`}</button>`;
    })}</div>`}</div>`;
}
function openRequest(id) {
  sheet('בקשה', (close) => html`<${RequestSheet} id=${id} close=${close}/>`, { wide: true });
}
function RequestSheet({ id, close }) {
  const uid = me();
  const a = A();
  const r = bus.read('trainings.request', id);
  if (!r) return html`<p>הבקשה לא נמצאה</p>`;
  const m = bus.read('trainings.milestone', r.msId) || { name: '', checklist: [], exam: [] };
  const prev = bus.read('trainings.requests', { uid: r.uid, msId: r.msId }).filter((x) => x.id !== r.id);
  return html`<div class="col gap12">
    <div class="row gap8"><${Avatar} uid=${r.uid} size=${40}/><div class="col gap4"><${PersonName} uid=${r.uid}/><span class="t-foot sec"><bdi>${m.name}</bdi> · ניסיון ${r.attempt} · ${relTime(r.at)}</span></div></div>
    ${(m.checklist || []).length > 0 && html`<div class="subtle-box col gap4"><span class="t-label">תרגול</span>${m.checklist.map((x) => html`<span class="row gap4 t-foot"><${Icon} name=${r.ticks.includes(x.id) ? 'square-check' : 'square'} size=${16}/>${x.text}</span>`)}</div>`}
    ${(m.exam || []).length > 0 && html`<div class="col gap8"><span class="t-label">תשובות</span>${m.exam.map((q, i) => html`<div class="card b"><p class="t-foot sec">${i + 1}. ${q.text}</p><p class="t-body prewrap" dir="auto">${r.answers[q.id] || '—'}</p></div>`)}</div>`}
    ${r.history.length > 0 && html`<div class="col gap4"><span class="t-label">היסטוריה</span>${r.history.map((h) => html`<span class="t-foot sec">${{ approved: 'אושר', rejected: 'נדחה', undone: 'ההחלטה בוטלה', forced: 'הוזן ידנית' }[h.kind]} · <${PersonName} uid=${h.by} rank=${false}/> · ${fmtDate(h.at)}${h.note ? ' · ' + h.note : ''}</span>`)}</div>`}
    ${prev.length > 0 && html`<div class="col gap4"><span class="t-label">ניסיונות קודמים</span>${prev.map((p) => html`<span class="t-foot sec">ניסיון ${p.attempt} · ${fmtDate(p.at)} · ${{ approved: 'מאושר', rejected: 'נדחה', pending: 'ממתין' }[p.state]}${p.note ? ' · ' + p.note : ''}</span>`)}</div>`}
    ${r.state === 'pending' ? html`<div class="row"><${Button} kind="primary" onClick=${() => { if (act(() => bus.ask('trainings.decide', { actor: uid, requestId: id, approve: true })) !== undefined) { toast('אושר'); close(); } }}>אישור</${Button}>
      <${Button} kind="secondary" onClick=${async () => { const n = await promptText({ title: 'דחייה', label: 'הערה (חובה)', min: 2, max: 500 }); if (n && act(() => bus.ask('trainings.decide', { actor: uid, requestId: id, approve: false, note: n })) !== undefined) { toast('נדחה'); close(); } }}>דחייה</${Button}></div>`
    : html`<div class="row wrap gap8"><span class="t-foot sec">${r.forced ? 'הוזן ידנית' : r.state === 'approved' ? 'מאושר' : 'נדחה'} · <${PersonName} uid=${r.decidedBy} rank=${false}/> · ${fmtDate(r.decidedAt)}</span>
      ${!r.forced && (r.decidedBy === uid || a.isMentor) && html`<${Button} size="sm" kind="secondary" onClick=${async () => { const n = await promptText({ title: 'ביטול ההחלטה', label: 'הערה (חובה)', min: 2, max: 500 }); if (n && act(() => bus.ask('trainings.undo', { actor: uid, requestId: id, note: n })) !== undefined) toast('ההחלטה בוטלה'); }}>ביטול ההחלטה</${Button}>`}</div>`}
  </div>`;
}

/* ================= progress (14) ================= */
const STATE_ICON = { locked: ['lock', 'var(--text-muted)'], open: ['circle', 'var(--brand-text)'], submitted: ['hourglass', '#9D6300'], approved: ['circle-check', 'var(--success)'], rejected: ['circle-x', 'var(--danger)'], needs_reapproval: ['refresh-cw', '#9D6300'] };
function ProgressView({ catId }) {
  const uid = me();
  const trees = bus.read('trainings.trees', catId);
  const [treeId, setTree] = useState(trees[0] && trees[0].id);
  const [q, setQ] = useState('');
  if (!treeId) return html`<${EmptyState} title="אין עדיין עצים בקטגוריה הזו" sticker=${false}/>`;
  const ms = bus.read('trainings.milestones', treeId);
  const people = bus.read('trainings.learners', treeId).filter((u) => { const x = bus.read('users.get', u); return x && (!q || x.name_he.includes(q)); })
    .sort((x, y) => byHe(bus.read('users.get', x).name_he, bus.read('users.get', y).name_he));
  const cell = (u, m) => { const s = bus.read('trainings.state', u, m.id); const [ic, col] = STATE_ICON[s]; const forced = (bus.read('trainings.record', u, m.id) || {}).forced;
    return html`<button class="icon-btn sm" title=${`${m.name}: ${STATE_LABEL[s]}${forced ? ' (הוזן ידנית)' : ''}`} aria-label=${`${m.name}: ${STATE_LABEL[s]}`} onClick=${() => historySheet(u, m.id)}><${Icon} name=${ic} size=${18} color=${col}/></button>`; };
  return html`<div class="col gap12">
    <div class="row wrap gap8">${trees.length > 1 && html`<${Chips} items=${trees.map((t) => ({ value: t.id, label: t.name }))} value=${treeId} onChange=${setTree}/>`}</div>
    <${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש לפי שם"/>
    ${W('ranks.historyLink', { catId })}
    ${isPhone() ? html`<div class="col gap8">${people.map((u) => html`<div class="card b"><${PersonName} uid=${u}/><div class="row wrap gap4 mt8">${ms.map((m) => cell(u, m))}</div></div>`)}</div>`
    : html`<div class="table-wrap"><table class="table"><thead><tr><th>שם</th>${ms.map((m) => html`<th title=${m.name} style="padding:6px"><span style=${`color:${pastel(m.color).dark}`}><${MsIcon} name=${m.icon} size=${18}/></span></th>`)}</tr></thead>
      <tbody>${people.map((u) => html`<tr><td style="white-space:nowrap"><${PersonName} uid=${u}/></td>${ms.map((m) => html`<td style="padding:2px;text-align:center">${cell(u, m)}</td>`)}</tr>`)}</tbody></table></div>`}
    <div class="row wrap gap12 t-foot sec">${Object.entries(STATE_ICON).map(([k, [ic, col]]) => html`<span class="row gap4"><${Icon} name=${ic} size=${14} color=${col}/>${STATE_LABEL[k]}</span>`)}</div>
  </div>`;
}
function historySheet(u, msId) {
  sheet('היסטוריה', () => {
    const uid = me();
    const a = A();
    const m = bus.read('trainings.milestone', msId);
    const c = bus.read('trainings.category', bus.read('trainings.tree', m.treeId).catId);
    const approver = bus.read('trainings.isApprover', uid, c.id);
    const s = bus.read('trainings.state', u, msId);
    const rec = bus.read('trainings.record', u, msId);
    const reqs = bus.read('trainings.requests', { uid: u, msId });
    const audit = approver || a.isMentor ? bus.read('audit-log.query', { system: 'trainings', target: u }).filter((e) => e.field === msId) : [];
    return html`<div class="col gap12"><div class="row gap8"><${PersonName} uid=${u}/><span class="t-foot sec grow">· <bdi>${m.name}</bdi></span><${Badge} text=${STATE_LABEL[s]}/></div>
      ${reqs.map((r) => html`<div class="card b col gap4"><span class="t-label">ניסיון ${r.attempt} · ${fmtDate(r.at)}</span>
        <span class="t-foot sec">${r.forced ? 'הוזן ידנית' : { pending: 'ממתין', approved: 'מאושר', rejected: 'נדחה' }[r.state]}${r.note ? ' · ' + r.note : ''}</span>
        ${r.history.map((h) => html`<span class="t-foot muted">${{ approved: 'אושר', rejected: 'נדחה', undone: 'בוטל', forced: 'הוזן ידנית' }[h.kind]} · ${fmtDate(h.at)}${h.note ? ' · ' + h.note : ''}</span>`)}
        ${approver && !r.forced && r.state !== 'pending' && (r.decidedBy === uid || a.isMentor) && html`<div><${Button} size="xs" kind="secondary" onClick=${async () => { const n = await promptText({ title: 'ביטול ההחלטה', label: 'הערה (חובה)', min: 2 }); if (n) act(() => bus.ask('trainings.undo', { actor: uid, requestId: r.id, note: n }), 'ההחלטה בוטלה'); }}>ביטול ההחלטה</${Button}></div>`}</div>`)}
      ${audit.filter((e) => e.action.startsWith('force')).map((e) => html`<span class="t-foot sec">${e.action === 'force_check' ? 'הוזן ידנית' : 'הוזן ידנית — בוטל'} · ${e.actorName} · ${fmtDate(e.at)}</span>`)}
      ${approver && u !== uid && html`<div class="row">${s !== 'approved' && html`<${Button} size="sm" kind="tinted" onClick=${() => act(() => bus.ask('trainings.forceCheck', { actor: uid, uid: u, msIds: [msId] }), 'סומן כהושלם')}>סימון כהושלם</${Button}>`}
        ${rec && rec.forced && html`<${Button} size="sm" kind="ghost" onClick=${() => act(() => bus.ask('trainings.forceUncheck', { actor: uid, uid: u, msId }), 'בוטל')}>ביטול</${Button}>`}</div>`}
    </div>`;
  });
}

/* ================= widgets ================= */
addWidget('trainings.homeNext', ({ uid }) => {
  const list = bus.read('trainings.openMilestones', uid).slice(0, 3);
  if (!list.length) return html`<p class="t-foot sec">אין כרגע הכשרות פתוחות</p>`;
  return html`<div class="list" style="margin-bottom:12px">${list.map((m) => { const t = bus.read('trainings.tree', m.treeId); return html`<a class="lrow" href=${'#/trainings/ms/' + m.id} key=${m.id}>
    <${Node} m=${m} state=${bus.read('trainings.state', uid, m.id)} size=${40} label=${false}/><span class="col gap4 grow"><span class="t-label"><bdi>${m.name}</bdi></span><span class="t-foot sec"><bdi>${t.name}</bdi></span></span>
    <${Icon} name="chevron-left" size=${20} cls="chev"/></a>`; })}</div>`;
});
addWidget('trainings.profileAction', ({ viewer, target }) => {
  const cats = bus.read('trainings.categories').filter((c) => bus.read('trainings.isApprover', viewer, c.id));
  const t = bus.read('users.actor', target);
  if (!cats.length || !t || t.isMentor || !(t.teamMember || t.alumni) || viewer === target) return null;
  return html`<${Button} kind="tinted" size="sm" icon="circle-check" onClick=${() => forceSheet(viewer, target, cats)}>הוספת הכשרה</${Button}>`;
});
function forceSheet(viewer, target, cats) {
  const Body = ({ close }) => {
    const [catId, setCat] = useState(cats[0].id);
    const trees = bus.read('trainings.trees', catId);
    const [treeId, setTree] = useState(trees[0] && trees[0].id);
    const [sel, setSel] = useState([]);
    const tid = trees.some((t) => t.id === treeId) ? treeId : trees[0] && trees[0].id;
    const ms = tid ? bus.read('trainings.milestones', tid) : [];
    return html`<div class="col gap12">
      <${Chips} items=${cats.map((c) => ({ value: c.id, label: c.name }))} value=${catId} onChange=${(v) => { setCat(v); setSel([]); }}/>
      ${trees.length > 1 && html`<${Chips} items=${trees.map((t) => ({ value: t.id, label: t.name }))} value=${tid} onChange=${(v) => { setTree(v); setSel([]); }}/>`}
      <div class="list" style="max-height:50vh;overflow:auto">${ms.map((m) => { const done = bus.read('trainings.state', target, m.id) === 'approved'; return html`<label class="lrow" style="min-height:48px">
        <${Checkbox} on=${done || sel.includes(m.id)} disabled=${done} label=${m.name} onChange=${(v) => setSel(v ? [...sel, m.id] : sel.filter((x) => x !== m.id))}/><span class="t-label grow"><bdi>${m.name}</bdi></span>${done && html`<span class="t-foot sec">מאושר</span>`}</label>`; })}</div>
      <${Button} kind="primary" disabled=${!sel.length} onClick=${() => { if (act(() => bus.ask('trainings.forceCheck', { actor: viewer, uid: target, msIds: sel })) !== undefined) { toast(`נוספו ${sel.length} הכשרות`); close(); } }}>הוספה (${sel.length})</${Button}></div>`;
  };
  sheet('הוספת הכשרה', (close) => html`<${Body} close=${close}/>`);
}

addRoute({ path: '/trainings', tab: 'trainings', title: 'הכשרות', render: () => html`<${TrainingsHome}/>` });
addRoute({ path: '/trainings/requests', tab: 'trainings', title: 'בקשות', render: (p, q) => { navigate(`/trainings?cat=${q.cat || ''}&tab=requests${q.req ? '&req=' + q.req : ''}`, { replace: true }); return null; } });
addRoute({ path: '/trainings/tree/:id', tab: 'trainings', title: 'הכשרות', render: (p) => html`<${TreeView} id=${p.id} key=${p.id}/>` });
addRoute({ path: '/trainings/ms/:id', tab: 'trainings', title: 'אבן דרך', render: (p) => html`<${MilestonePage} id=${p.id} key=${p.id}/>` });
addTabBadge('trainings', (uid) => bus.read('trainings.pendingFor', uid));

const css = document.createElement('style');
css.textContent = `.ms-bar{position:fixed;bottom:0;inset-inline:0;z-index:20;background:var(--bg-surface);border-top:1px solid var(--border);padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;gap:12px}
@media (max-width:767px){.ms-bar{bottom:calc(64px + env(safe-area-inset-bottom));padding-bottom:12px}}
@media (min-width:768px){.ms-bar{inset-inline-start:var(--side-w,248px)}}`;
document.head.appendChild(css);
