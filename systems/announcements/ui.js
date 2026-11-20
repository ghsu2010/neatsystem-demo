// Announcements UI: Home card, composer (+ poll), poll voting/results, archive, management.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addRoute, addWidget } from '../../core/registry.js';
import { Button, Icon, Card, Field, SwitchRow, Badge, EmptyState, SearchInput, IconButton, Checkbox, Radio, Progress, cx } from '../../core/ui.js';
import { Avatar, PersonName } from '../../core/people.js';
import { act, toast, confirm, sheet, actionSheet } from '../../core/overlay.js';
import { DateField, SelectorField, selectorLabel, emptySelector } from '../../core/pickers.js';
import { relTime, todayKey, addDaysKey, fmtDate, uid as newId } from '../../core/format.js';
import { LinkText } from '../../core/richtext.js';
import { navigate } from '../../core/router.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { DEFAULTS } from './index.js';

const me = () => bus.read('users.currentId');

function Poll({ p }) {
  const uid = me();
  const r = bus.read('announcements.results', p.id, uid);
  const a = bus.read('users.actor', uid);
  const [sel, setSel] = useState(r.mine);
  const ro = a.readOnly;
  const total = r.counts ? Object.values(r.counts).reduce((s, n) => s + n, 0) : 0;
  const vote = (ids) => act(() => bus.ask('announcements.vote', { actor: uid, postId: p.id, optionIds: ids }));
  return html`<div class="subtle-box col gap8" style="margin-top:8px">
    <span class="t-label" dir="auto">${p.poll.question}</span>
    ${p.poll.options.map((o) => {
      const on = (r.closed || !p.poll.multiple ? r.mine : sel).includes(o.id);
      const n = r.counts ? r.counts[o.id] : 0;
      if (r.canSee && (r.closed || p.author === uid || a.isMentor) && (r.closed || r.mine.length || p.author === uid || a.isMentor)) {
        return html`<button class="col gap4" style="background:none;border:0;padding:4px 0;text-align:start;cursor:${r.who ? 'pointer' : 'default'};color:inherit" disabled=${!r.who && !(!r.closed && !ro)}
          onClick=${() => { if (!r.closed && !ro && !p.poll.multiple) vote([o.id]); else if (r.who) sheet(o.text, () => html`<div class="list">${r.who[o.id].length ? r.who[o.id].map((u) => html`<div class="lrow"><${Avatar} uid=${u} size=${32}/><${PersonName} uid=${u}/></div>`) : html`<div class="lrow t-foot sec">אף אחד</div>`}</div>`); }}>
          <span class="row gap8"><span class="grow t-foot" style="font-size:15px" dir="auto">${on ? html`<${Icon} name="check" size=${16} color="var(--brand-text)"/> ` : ''}${o.text}</span><span class="t-foot sec num">${n} · ${total ? Math.round((n / total) * 100) : 0}%</span></span>
          <${Progress} value=${n} max=${total || 1}/></button>`;
      }
      return html`<button class=${cx('menu-item')} style=${`border:1px solid ${on ? 'var(--brand)' : 'var(--border)'};background:var(--bg-surface)`} disabled=${ro || r.closed}
        title=${ro ? 'בוגרים במצב קריאה בלבד' : undefined}
        onClick=${() => { if (p.poll.multiple) setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id]); else vote([o.id]); }}>
        ${p.poll.multiple ? html`<${Checkbox} on=${sel.includes(o.id)} label=${o.text} onChange=${() => setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])}/>` : html`<${Radio} on=${on}/>`}
        <span class="grow" dir="auto">${o.text}</span></button>`;
    })}
    ${p.poll.multiple && !r.closed && !ro && html`<${Button} size="sm" kind="primary" disabled=${!sel.length || JSON.stringify(sel) === JSON.stringify(r.mine)} onClick=${() => vote(sel)}>הצבעה</${Button}>`}
    <div class="row between wrap"><span class="t-foot sec">${r.closed ? 'הסקר נסגר' : `${r.voters} הצביעו`}${p.poll.anonymous ? ' · אנונימי' : ''}${!r.closed ? ` · נסגר ב-${fmtDate(p.poll.closesAt)}` : ''}</span>
      ${!r.closed && p.author === uid && html`<${Button} size="xs" kind="ghost" onClick=${async () => { if (await confirm({ title: 'סגירת הסקר', text: 'כולם יראו את התוצאות.', ok: 'סגירת הסקר' })) act(() => bus.ask('announcements.closePoll', { actor: uid, postId: p.id })); }}>סגירת הסקר</${Button}>`}</div>
  </div>`;
}
function Post({ p, compact }) {
  const uid = me();
  const [more, setMore] = useState(false);
  const canEdit = bus.read('announcements.canEdit', uid, p.id);
  const a = bus.read('users.actor', uid);
  const long = p.text.length > 300;
  const audLabel = p.audience.all ? 'כולם' : selectorLabel(p.audience);
  const del = () => {
    const post = JSON.parse(JSON.stringify(p));
    const r = act(() => bus.ask('announcements.remove', { actor: uid, postId: p.id }));
    if (r) toast('ההודעה נמחקה', { undo: () => bus.ask('announcements.restore', { actor: uid, post }) });
  };
  return html`<article class="card" style="padding:0;overflow:hidden">
    <div class="row gap8" style=${`padding:12px 16px;${p.pinned ? 'background:var(--brand-subtle)' : ''}`}>
      <${Avatar} uid=${p.author} size=${32}/><div class="col gap4 grow" style="min-width:0"><${PersonName} uid=${p.author}/>
        <span class="row wrap gap4 t-foot sec"><span class="badge">${audLabel}${p.includeAlumni ? ' + בוגרים' : ''}</span>${relTime(p.createdAt)}${p.editedAt ? ' · נערך' : ''}</span></div>
      ${p.pinned && html`<${Icon} name="pin" size=${18} color="var(--brand-text)" label="נעוצה"/>`}
      ${(canEdit || ((a.isAdmin || a.isMentor) && p.pinned)) && html`<${IconButton} small icon="ellipsis" label="פעולות" onClick=${(e) => actionSheet('הודעה', [
        { icon: 'pencil', label: 'עריכה', hidden: !canEdit, onClick: () => compose(p) },
        { icon: 'pin-off', label: 'ביטול נעיצה', hidden: !p.pinned, onClick: () => act(() => bus.ask('announcements.unpin', { actor: uid, postId: p.id })) },
        { icon: 'trash-2', label: 'מחיקה', danger: true, hidden: !canEdit, onClick: del },
      ], e.currentTarget)}/>`}</div>
    <div style="padding:0 16px 16px">${p.text && html`<p class="t-body"><${LinkText} text=${long && !more ? p.text.slice(0, 300) + '…' : p.text}/></p>`}
      ${long && html`<button class="btn btn-link btn-sm" onClick=${() => setMore(!more)}>${more ? 'פחות' : 'קרא עוד'}</button>`}
      ${p.poll && html`<${Poll} p=${p}/>`}</div></article>`;
}
function HomeCard({ uid }) {
  const list = bus.read('announcements.forUser', uid);
  const can = bus.read('announcements.canPost', uid);
  return html`<section class="col gap12">
    <div class="row between"><h2 class="card-title">הודעות</h2>${can && html`<${Button} kind="tinted" size="sm" onClick=${() => compose(null)}>+ הודעה חדשה</${Button}>`}</div>
    ${list.length === 0 ? html`<div class="card"><p class="t-foot sec">אין הודעות כרגע</p></div>` : list.map((p) => html`<${Post} key=${p.id} p=${p}/>`)}
    <div><${Button} kind="link" size="sm" onClick=${() => navigate('/announcements/archive')}>ארכיון הודעות</${Button}></div></section>`;
}
addWidget('announcements.home', HomeCard);

function compose(p) {
  const uid = me();
  const a = bus.read('users.actor', uid);
  const s = bus.read('announcements.settings');
  const leadOnly = a.isLead && !(a.isCaptain || a.isAdmin || a.isMentor);
  const hasVotes = p && p.poll && bus.read('announcements.results', p.id, uid).voters > 0;
  const st = p ? JSON.parse(JSON.stringify({ text: p.text, audience: p.audience, expires: p.expires, pinned: p.pinned, includeAlumni: p.includeAlumni, emailAll: p.emailAll, poll: p.poll }))
    : { text: '', audience: leadOnly ? { ...emptySelector(), teams: [a.team] } : { ...emptySelector(), all: true }, expires: addDaysKey(todayKey(), s.default_days), pinned: false, includeAlumni: false, emailAll: false, poll: null };
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    const setPoll = (k) => (v) => setF({ ...f, poll: { ...f.poll, [k]: v } });
    const opts = f.poll ? f.poll.options : [];
    return html`<div class="col gap12">
      <${Field} label="הודעה" hint=${`${f.text.length}/2000`}><textarea class="textarea" maxlength="2000" dir="auto" style="min-height:120px" value=${f.text} onInput=${(e) => set('text')(e.target.value)}/></${Field}>
      <${Field} label="קהל">${leadOnly ? html`<div class="select-btn" style="cursor:default"><${Icon} name="users" size=${20} cls="sec"/>${selectorLabel(f.audience)}</div>` : html`<${SelectorField} value=${f.audience} onChange=${set('audience')} title="קהל"/>`}</${Field}>
      <${Field} label="תפוגה (עד 90 יום)"><${DateField} value=${f.expires} onChange=${(v) => v && set('expires')(v)} selectable=${(k) => k >= todayKey() && k <= addDaysKey(todayKey(), 90)}/></${Field}>
      <${SwitchRow} label="נעיצה" on=${f.pinned} onChange=${set('pinned')}/>
      ${!leadOnly && html`<${SwitchRow} label="כולל בוגרים" on=${f.includeAlumni} onChange=${set('includeAlumni')}/>`}
      <${SwitchRow} label="שלח גם במייל לכולם" on=${f.emailAll} onChange=${set('emailAll')}/>
      ${!f.poll ? html`<div><${Button} kind="tinted" size="sm" disabled=${!!p && !!p.poll} onClick=${() => set('poll')({ question: '', options: [{ id: newId('o'), text: '' }, { id: newId('o'), text: '' }], multiple: false, anonymous: false, closesAt: null })}>+ סקר</${Button}></div>`
      : html`<div class="card b col gap12"><div class="row between"><span class="t-title3">סקר</span>${!p && html`<${IconButton} small icon="x" label="הסרת הסקר" onClick=${() => set('poll')(null)}/>`}</div>
        <${Field} label="שאלה (עד 140)"><input class="input" maxlength="140" disabled=${!!p} value=${f.poll.question} onInput=${(e) => setPoll('question')(e.target.value)}/></${Field}>
        <div class="col gap4" data-drop-list="pollopts:1">${opts.map((o, i) => html`<div class="row gap8" data-drag-item key=${o.id}>
          ${!hasVotes && html`<span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'pollopts', listId: '1', onDrop: ({ fromIndex, toIndex }) => setPoll('options')(moveIn(opts, fromIndex, toIndex)) })}><${Icon} name="grip-vertical" size=${20}/></span>`}
          <input class="input grow" maxlength="60" disabled=${hasVotes} placeholder=${`אפשרות ${i + 1}`} value=${o.text} onInput=${(e) => setPoll('options')(opts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}/>
          ${!hasVotes && opts.length > 2 && html`<${IconButton} small icon="x" label="הסרה" onClick=${() => setPoll('options')(opts.filter((_, j) => j !== i))}/>`}</div>`)}</div>
        ${!hasVotes && opts.length < 30 && html`<div><${Button} kind="ghost" size="sm" onClick=${() => setPoll('options')([...opts, { id: newId('o'), text: '' }])}>+ אפשרות</${Button}></div>`}
        ${hasVotes && html`<span class="t-foot sec">אחרי ההצבעה הראשונה אי אפשר לשנות אפשרויות</span>`}
        <${SwitchRow} label="בחירה מרובה" on=${f.poll.multiple} disabled=${hasVotes} onChange=${setPoll('multiple')}/>
        <${SwitchRow} label="אנונימי" on=${f.poll.anonymous} disabled=${!!p} onChange=${setPoll('anonymous')}/>
        <${Field} label="סגירת הסקר (ברירת מחדל: תפוגת ההודעה)"><${DateField} value=${f.poll.closesAt} onChange=${setPoll('closesAt')} clearable selectable=${(k) => k >= todayKey() && k <= f.expires} placeholder=${fmtDate(f.expires)}/></${Field}></div>`}
    </div>`;
  };
  sheet(p ? 'עריכת הודעה' : 'הודעה חדשה', () => html`<${Body}/>`, {
    dirty: () => !p && !!(st.text || st.poll),
    foot: (c) => html`<${Button} kind="primary" full onClick=${() => {
      const r = p ? act(() => bus.ask('announcements.edit', { actor: uid, postId: p.id, fields: st })) : act(() => bus.ask('announcements.publish', { actor: uid, fields: st }));
      if (r !== undefined) { c(); toast(p ? 'נשמר' : 'פורסם'); }
    }}>${p ? 'שמירה' : 'פרסום'}</${Button}>`,
  });
}
function Archive() {
  const [q, setQ] = useState('');
  const list = bus.read('announcements.archive', me()).filter((p) => !q || p.text.includes(q) || (p.poll && p.poll.question.includes(q)));
  return html`<div class="col gap12"><h1 class="page-title" style="margin:0">ארכיון הודעות</h1><${SearchInput} value=${q} onInput=${setQ} placeholder="חיפוש בהודעות"/>
    ${list.length === 0 ? html`<${EmptyState} title="אין הודעות כרגע"/>` : list.map((p) => html`<div key=${p.id} class="col gap4">${p.expires < todayKey() && html`<span class="t-foot muted">פגה ב-${fmtDate(p.expires)}</span>`}<${Post} p=${p}/></div>`)}</div>`;
}
addRoute({ path: '/announcements/archive', tab: 'home', title: 'ארכיון הודעות', render: () => html`<${Archive}/>` });

function AllPosts() {
  const list = bus.read('announcements.all');
  return list.length === 0 ? html`<${EmptyState} title="אין הודעות כרגע" sticker=${false}/>` : html`<div class="col gap12">${list.map((p) => html`<div key=${p.id} class="col gap4">
    <span class="t-foot sec">תפוגה ${fmtDate(p.expires)}${p.expires < todayKey() ? ' (פגה)' : ''}</span><${Post} p=${p}/></div>`)}</div>`;
}
function Settings() {
  const s = bus.read('announcements.settings');
  return html`<div class="card b col gap12">
    <${Field} label="ימי תפוגה ברירת מחדל (announcements.default_days)"><input class="input num" type="number" min="1" max="90" value=${s.default_days} onChange=${(e) => act(() => bus.ask('announcements.setSettings', { actor: me(), patch: { default_days: Number(e.target.value) } }), 'נשמר')}/></${Field}>
    <${Field} label="מקסימום נעוצות לקהל (announcements.max_pinned)"><input class="input num" type="number" min="0" max="10" value=${s.max_pinned} onChange=${(e) => act(() => bus.ask('announcements.setSettings', { actor: me(), patch: { max_pinned: Number(e.target.value) } }), 'נשמר')}/></${Field}></div>`;
}
addManagement('announcements', 'הודעות', [
  { id: 'all', title: 'הודעות', icon: 'megaphone', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${AllPosts}/>` },
  { id: 'settings', title: 'הגדרות', icon: 'settings', can: (a) => a.isMentor, render: () => html`<${Settings}/>` },
]);
