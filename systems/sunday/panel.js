// Sunday updates panel (C8) and the phone full item sheet (C6.3).
import { html, useState, useEffect, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { Icon, Button, Pill, Tabs, EmptyState, IconButton, cx } from '../../core/ui.js';
import { Avatar, PersonName } from '../../core/people.js';
import { act, toast, panel, sheet, promptText, confirm, popover } from '../../core/overlay.js';
import { pickPeople } from '../../core/pickers.js';
import { RichEditor, RichView, LinkText } from '../../core/richtext.js';
import { relTime } from '../../core/format.js';
import { groupNameVars } from '../../core/color.js';
import { me, lbl, canEdit, isLead, StatusCell, PriorityCell, DateCell, AssigneesCell, SizeCell, CustomCell, InlineText, DoneButton } from './cells.js';

function Header({ it, g, bd }) {
  const uid = me();
  const l = lbl(g.statusLabels, it.status);
  return html`<div class="col gap8" style="margin-bottom:12px">
    <span class="t-title3"><${InlineText} value=${it.name} disabled=${!bus.read('sunday.canRename', uid, it.id)} dbl=${false} onSave=${(v) => act(() => bus.ask('sunday.rename', { actor: uid, itemId: it.id, name: v }))}/></span>
    <div class="row gap8"><span class="t-foot w7 gname" style=${groupNameVars(g.color)}>${g.name}</span>${g.columns.some((c) => c.type === 'status') && html`<${StatusCell} it=${it} g=${g} bd=${bd}/>`}</div></div>`;
}
function Description({ it }) {
  const uid = me();
  const ed = canEdit(it);
  const [saved, setSaved] = useState(false);
  const t = useRef();
  if (!ed) return it.description ? html`<${RichView} value=${it.description}/>` : html`<p class="t-foot muted">אין תיאור</p>`;
  return html`<div class="col gap4"><${RichEditor} value=${it.description} placeholder="הוסיפו תיאור…" onChange=${(v) => { clearTimeout(t.current); t.current = setTimeout(() => { if (act(() => bus.ask('sunday.setDescription', { actor: uid, itemId: it.id, html: v })) !== undefined) { setSaved(true); setTimeout(() => setSaved(false), 1500); } }, 1000); }}/>
    <span class="t-foot sec" style=${`height:18px;opacity:${saved ? 1 : 0};transition:opacity var(--dur-base)`}>נשמר</span></div>`;
}
function Composer({ it, bd }) {
  const uid = me();
  const [v, setV] = useState('');
  const [mentions, setMentions] = useState([]);
  const ref = useRef();
  const mention = (anchor) => pickPeople(anchor, { title: 'תיוג', single: true, selected: [], relevantTeam: bd.team, candidates: (u) => bus.read('sunday.canSeeBoard', u.id, bd.id),
    onChange: (ids) => { if (!ids.length) return; const u = bus.read('users.get', ids[0]); setV((x) => x.replace(/@$/, '') + `@${u.name_he} `); setMentions((m) => [...new Set([...m, ids[0]])]); if (ref.current) ref.current.focus(); } });
  const post = () => { if (!v.trim()) return; const live = mentions.filter((m) => v.includes('@' + (bus.read('users.get', m) || {}).name_he)); if (act(() => bus.ask('sunday.comment', { actor: uid, itemId: it.id, text: v, mentions: live })) !== undefined) { setV(''); setMentions([]); } };
  return html`<div class="col gap8"><textarea ref=${ref} class="textarea" dir="auto" placeholder="כתבו עדכון… (@ לתיוג)" value=${v} style="min-height:80px"
      onInput=${(e) => { setV(e.target.value); if (e.target.value.endsWith('@')) mention(e.target); }} onKeyDown=${(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(); }}/>
    <div class="row"><${Button} size="sm" kind="ghost" icon="at-sign" onClick=${(e) => mention(e.currentTarget)}>תיוג</${Button}><span class="spacer"/><${Button} size="sm" kind="primary" disabled=${!v.trim()} onClick=${post}>פרסום</${Button}></div></div>`;
}
function Comment({ c, bd, hl }) {
  const uid = me();
  const [ed, setEd] = useState(false);
  const [v, setV] = useState(c.text);
  const ref = useRef();
  useEffect(() => { if (hl && ref.current) ref.current.scrollIntoView({ block: 'center' }); }, [hl]);
  const lead = isLead(bd.id);
  const ro = bus.read('users.actor', uid).readOnly;
  return html`<div ref=${ref} class="row top gap8" style=${`padding:8px;border-radius:var(--r-sm);${hl ? 'background:var(--brand-subtle)' : ''}`}>
    <${Avatar} uid=${c.author} size=${32}/><div class="col gap4 grow" style="min-width:0">
      <div class="row gap8"><${PersonName} uid=${c.author}/><span class="t-foot muted">${relTime(c.at)}${c.editedAt ? ' · נערך' : ''}</span><span class="spacer"/>
        ${!ro && (c.author === uid || lead) && html`<${IconButton} small icon="ellipsis" label="פעולות" onClick=${(e) => popover(e.currentTarget, (close) => html`<div class="col gap4" style="min-width:160px">
          ${c.author === uid && html`<button class="menu-item" onClick=${() => { close(); setEd(true); }}><${Icon} name="pencil" size=${18}/>עריכה</button>`}
          <button class="menu-item danger" onClick=${() => { close(); if (act(() => bus.ask('sunday.deleteComment', { actor: uid, commentId: c.id })) !== undefined) toast('העדכון נמחק', { undo: () => bus.ask('sunday.restoreComment', { actor: uid, commentId: c.id }) }); }}><${Icon} name="trash-2" size=${18}/>מחיקה</button></div>`)}/>`}</div>
      ${ed ? html`<textarea class="textarea" value=${v} onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { act(() => bus.ask('sunday.editComment', { actor: uid, commentId: c.id, text: v })); setEd(false); } if (e.key === 'Escape') { setV(c.text); setEd(false); } }}/>
        <div class="row"><${Button} size="xs" kind="primary" onClick=${() => { act(() => bus.ask('sunday.editComment', { actor: uid, commentId: c.id, text: v })); setEd(false); }}>שמירה</${Button}><${Button} size="xs" kind="ghost" onClick=${() => { setV(c.text); setEd(false); }}>ביטול</${Button}></div>`
      : html`<p class="t-body"><${LinkText} text=${c.text}/></p>`}</div></div>`;
}
function Files({ it }) {
  const uid = me();
  const ed = canEdit(it);
  const add = async () => {
    const url = await promptText({ title: '+ קישור', text: 'הדביקו קישור לקובץ ב-Google Drive (או כל קישור http/https).', label: 'קישור', multiline: false, max: 500 });
    if (!url) return;
    const name = await promptText({ title: 'שם הקובץ', label: 'שם', multiline: false, max: 80, value: '' });
    act(() => bus.ask('sunday.addFile', { actor: uid, itemId: it.id, name: name || url, url }));
  };
  return html`<div class="col gap8">${ed && html`<div><${Button} size="sm" kind="tinted" onClick=${add}>+ קישור</${Button}></div>`}
    ${(it.files || []).length === 0 ? html`<p class="t-foot muted">אין קבצים</p>` : html`<div class="list">${it.files.map((f) => html`<div class="lrow" key=${f.id}><${Icon} name="file" size=${20} cls="sec"/>
      <a class="grow t-label ell" href=${f.url} target="_blank" rel="noopener">${f.name}</a>
      ${ed && html`<${IconButton} small icon="trash-2" label="מחיקה" onClick=${() => { const r = act(() => bus.ask('sunday.removeFile', { actor: uid, itemId: it.id, fileId: f.id })); if (r) toast('הקישור נמחק', { undo: () => bus.ask('sunday.restoreFile', { actor: uid, itemId: it.id, file: r }) }); }}/>`}</div>`)}</div>`}</div>`;
}
function PanelBody({ id, commentId }) {
  const uid = me();
  const it = bus.read('sunday.item', id);
  const [tab, setTab] = useState(() => (commentId || (it && bus.read('sunday.unseen', uid, id)) ? 'updates' : 'desc'));
  useEffect(() => { if (tab === 'updates') bus.ask('sunday.markSeen', { actor: uid, itemId: id }); }, [tab, id]);
  if (!it || it.deletedAt) return html`<p class="t-foot sec">המשימה נמחקה</p>`;
  const g = bus.read('sunday.group', it.groupId); const bd = bus.read('sunday.board', g.boardId);
  const cs = bus.read('sunday.comments', id);
  const ro = !canEdit(it);
  return html`<div class="fade-swap" key=${id}><${Header} it=${it} g=${g} bd=${bd}/>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ value: 'desc', label: 'תיאור' }, { value: 'updates', label: `עדכונים${cs.length ? ` (${cs.length})` : ''}` }, { value: 'files', label: `קבצים${(it.files || []).length ? ` (${it.files.length})` : ''}` }]}/>
    <div style="padding-top:12px">
      ${tab === 'desc' && html`<${Description} it=${it}/>`}
      ${tab === 'updates' && html`<div class="col gap12">${!ro && html`<${Composer} it=${it} bd=${bd}/>`}
        ${cs.length === 0 ? html`<p class="t-foot muted">עוד אין עדכונים</p>` : cs.map((c) => html`<${Comment} key=${c.id} c=${c} bd=${bd} hl=${c.id === commentId}/>`)}</div>`}
      ${tab === 'files' && html`<${Files} it=${it}/>`}
    </div></div>`;
}
export function openPanel(id, commentId) {
  panel(id + (commentId || ''), 'עדכונים', () => html`<${PanelBody} id=${id} commentId=${commentId} key=${id}/>`);
}

/* ---------- full item sheet (phone) ---------- */
function FullSheet({ id, close }) {
  const uid = me();
  const it = bus.read('sunday.item', id);
  if (!it || it.deletedAt) return html`<p class="t-foot sec">המשימה נמחקה</p>`;
  const g = bus.read('sunday.group', it.groupId); const bd = bus.read('sunday.board', g.boardId);
  const kids = !it.parentId ? bus.read('sunday.subitems', id) : [];
  const row = (label, value) => html`<div class="lrow" style="min-height:52px"><span class="t-foot w5 sec" style="width:110px;flex:none;font-size:14px">${label}</span><span class="grow row" style="justify-content:flex-end">${value}</span></div>`;
  const cell = (c) => {
    switch (c.type) {
      case 'status': return html`<${StatusCell} it=${it} g=${g} bd=${bd}/>`;
      case 'assignees': return html`<${AssigneesCell} it=${it} bd=${bd} chip/>`;
      case 'date': return html`<${DateCell} it=${it} chip/>`;
      case 'priority': return html`<${PriorityCell} it=${it} g=${g}/>`;
      case 'size': return it.parentId ? null : html`<${SizeCell} it=${it} bd=${bd} chip/>`;
      case 'subitems': return null;
      default: return html`<${CustomCell} it=${it} col=${c}/>`;
    }
  };
  return html`<div class="col gap12">
    <div class="row gap8"><${DoneButton} it=${it} g=${g} size=${24}/><span class="t-title2 grow"><${InlineText} value=${it.name} disabled=${!bus.read('sunday.canRename', uid, id)} onSave=${(v) => act(() => bus.ask('sunday.rename', { actor: uid, itemId: id, name: v }))}/></span></div>
    <div class="list">${g.columns.filter((c) => c.type !== 'name' && c.type !== 'subitems' && !(it.parentId && c.type === 'size')).map((c) => row(c.label, cell(c)))}</div>
    ${!it.parentId && g.columns.some((c) => c.type === 'subitems') && html`<div class="col gap8"><span class="t-label">תת-משימות</span>
      <div class="list">${kids.map((k) => html`<button class="lrow" key=${k.id} onClick=${() => openFullSheet(k.id)}><${DoneButton} it=${k} g=${g}/><span class="t-label grow">${k.name}</span><${Pill} text=${(lbl(g.statusLabels, k.status) || {}).text} color=${(lbl(g.statusLabels, k.status) || {}).color}/></button>`)}
        ${canEdit(it) && html`<button class="lrow" onClick=${async () => { const n = await promptText({ title: '+ תת-משימה', label: 'שם', multiline: false, max: 200 }); if (n) act(() => bus.ask('sunday.createItem', { actor: uid, groupId: g.id, name: n, parentId: id })); }}><${Icon} name="plus" size=${18}/><span class="t-label brandt">תת-משימה</span></button>`}</div></div>`}
    <${Button} kind="tinted" icon="message-circle" onClick=${() => openPanel(id)}>תיאור ועדכונים</${Button}>
    ${bus.read('sunday.canDeleteItem', uid, id) && html`<${Button} kind="danger" icon="trash-2" onClick=${() => { if (act(() => bus.ask('sunday.deleteItem', { actor: uid, itemId: id })) !== undefined) { close(); toast('נמחק', { undo: () => bus.ask('sunday.restore', { actor: uid, kind: it.parentId ? 'subitem' : 'item', targetId: id }) }); } }}>מחיקה</${Button}>`}
  </div>`;
}
export function openFullSheet(id) {
  const it = bus.read('sunday.item', id); const g = it && bus.read('sunday.group', it.groupId);
  sheet(g ? g.name : '', (close) => html`<${FullSheet} id=${id} close=${close} key=${id}/>`, { full: true });
}
