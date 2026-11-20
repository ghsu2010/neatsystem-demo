// Audit log viewer (Home → ניהול → "יומן פעולות", Admins and Mentors): newest first, 100 per page,
// filters by system, actor, target user, action, date range; free-text search; export to CSV.
import { html, useState } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement } from '../../core/registry.js';
import { Button, SearchInput, Field } from '../../core/ui.js';
import { MenuSelect, DateField } from '../../core/pickers.js';
import { fmtDateTime } from '../../core/format.js';

const SYSTEM_HE = { users: 'משתמשים', neatsystem: 'NeatSystem', sunday: 'סאנדיי', trainings: 'הכשרות', ranks: 'דרגות', coins: 'מטבעות', store: 'חנות',
  attendance: 'נוכחות', leaderboard: 'טבלת מובילים', countdown: 'ספירה לאחור', announcements: 'הודעות', neathub: 'NeatHub', notifications: 'התראות', 'audit-log': 'יומן פעולות' };

function Viewer() {
  const all = bus.read('audit-log.all');
  const [f, setF] = useState({ system: '', actor: '', target: '', action: '', from: null, to: null, q: '' });
  const [page, setPage] = useState(0);
  const set = (k) => (v) => { setF({ ...f, [k]: v }); setPage(0); };
  const actors = [...new Map(all.map((e) => [e.actor, e.actorName])).entries()];
  const targets = [...new Map(all.filter((e) => e.targetName).map((e) => [e.target, e.targetName])).entries()];
  const actions = [...new Set(all.map((e) => e.action))].sort();
  const q = f.q.trim().toLowerCase();
  const rows = all.filter((e) => (!f.system || e.system === f.system) && (!f.actor || e.actor === f.actor) && (!f.target || e.target === f.target)
    && (!f.action || e.action === f.action) && (!f.from || e.at.slice(0, 10) >= f.from) && (!f.to || e.at.slice(0, 10) <= f.to)
    && (!q || [e.actorName, e.targetName, e.action, e.field, e.old, e.new, e.reason, e.system].some((x) => x && String(x).toLowerCase().includes(q)))).slice().reverse();
  const shown = rows.slice(page * 100, page * 100 + 100);
  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['זמן', 'מבצע/ת', 'מערכת', 'פעולה', 'יעד', 'שדה', 'ערך קודם', 'ערך חדש', 'סיבה'].map(esc).join(',')]
      .concat(rows.map((e) => [e.at, e.actorName, SYSTEM_HE[e.system] || e.system, e.action, e.targetName || e.target, e.field, e.old, e.new, e.reason].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit-log.csv'; a.click();
  };
  const opt = (pairs, all = 'הכל') => [{ value: '', label: all }, ...pairs];
  return html`<div class="col gap12">
    <${SearchInput} value=${f.q} onInput=${set('q')} placeholder="חיפוש חופשי"/>
    <div class="row wrap gap8">
      <div style="min-width:150px"><${MenuSelect} value=${f.system} placeholder="מערכת" options=${opt(Object.entries(SYSTEM_HE).map(([v, l]) => ({ value: v, label: l })), 'כל המערכות')} onChange=${set('system')}/></div>
      <div style="min-width:150px"><${MenuSelect} value=${f.actor} placeholder="מבצע/ת" options=${opt(actors.map(([v, l]) => ({ value: v, label: l })), 'כל המבצעים')} onChange=${set('actor')}/></div>
      <div style="min-width:150px"><${MenuSelect} value=${f.target} placeholder="משתמש/ת" options=${opt(targets.map(([v, l]) => ({ value: v, label: l })), 'כל המשתמשים')} onChange=${set('target')}/></div>
      <div style="min-width:150px"><${MenuSelect} value=${f.action} placeholder="פעולה" options=${opt(actions.map((a) => ({ value: a, label: a })), 'כל הפעולות')} onChange=${set('action')}/></div>
      <div style="min-width:150px"><${DateField} value=${f.from} onChange=${set('from')} placeholder="מתאריך" clearable/></div>
      <div style="min-width:150px"><${DateField} value=${f.to} onChange=${set('to')} placeholder="עד תאריך" clearable/></div>
      <${Button} kind="secondary" icon="download" onClick=${csv}>ייצוא ל-CSV</${Button}>
    </div>
    <div class="t-foot sec num">${rows.length} רשומות</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>זמן</th><th>מבצע/ת</th><th>מערכת</th><th>פעולה</th><th>יעד</th><th>שדה</th><th>שינוי</th><th>סיבה</th></tr></thead>
      <tbody>${shown.map((e) => html`<tr key=${e.id}><td class="t-foot num" style="white-space:nowrap">${fmtDateTime(e.at)}</td><td class="t-foot">${e.actorName}</td>
        <td class="t-foot">${SYSTEM_HE[e.system] || e.system}</td><td class="t-foot"><bdi>${e.action}</bdi></td><td class="t-foot">${e.targetName || ''}</td>
        <td class="t-foot"><bdi>${e.field || ''}</bdi></td><td class="t-foot" style="max-width:260px;overflow-wrap:anywhere"><bdi>${e.old ?? ''}</bdi>${(e.old != null || e.new != null) ? ' → ' : ''}<bdi>${e.new ?? ''}</bdi></td>
        <td class="t-foot">${e.reason || ''}</td></tr>`)}</tbody></table></div>
    <div class="row"><${Button} size="sm" kind="secondary" disabled=${page === 0} onClick=${() => setPage(page - 1)}>הקודם</${Button}>
      <span class="t-foot sec num">עמוד ${page + 1} מתוך ${Math.max(1, Math.ceil(rows.length / 100))}</span>
      <${Button} size="sm" kind="secondary" disabled=${(page + 1) * 100 >= rows.length} onClick=${() => setPage(page + 1)}>הבא</${Button}></div>
  </div>`;
}
addManagement('audit-log', 'יומן פעולות', [
  { id: 'log', title: 'יומן פעולות', icon: 'scroll-text', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Viewer}/>` },
]);
