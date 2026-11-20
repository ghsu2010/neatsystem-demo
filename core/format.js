// Hebrew formatting helpers (NeatSystem 1.3, Design 9.1): he-IL, 24-hour, dd.mm.yyyy, week starts Sunday.
import { now } from './clock.js';

export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HE_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const pad = (n) => String(n).padStart(2, '0');
export const uid = (p = '') => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);

/** 'YYYY-MM-DD' in local time */
export function dayKey(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function todayKey() { return dayKey(now()); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addDaysKey(k, n) { return dayKey(addDays(parseDay(k), n)); }
export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }

export function fmtDate(d) { if (!d) return ''; d = typeof d === 'string' && d.length === 10 ? parseDay(d) : new Date(d); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; }
export function fmtShort(d) { if (!d) return ''; d = typeof d === 'string' && d.length === 10 ? parseDay(d) : new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; }
export function fmtTime(d) { d = new Date(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtDateTime(d) { return `${fmtDate(d)} ${fmtTime(d)}`; }
/** "יום שני, 23 בנובמבר" */
export function fmtLongDay(d) { d = typeof d === 'string' && d.length === 10 ? parseDay(d) : new Date(d); return `יום ${HE_DAYS[d.getDay()]}, ${d.getDate()} ב${HE_MONTHS[d.getMonth()]}`; }
/** "יום שלישי, 14.11" */
export function fmtDayShort(d) { d = typeof d === 'string' && d.length === 10 ? parseDay(d) : new Date(d); return `יום ${HE_DAYS[d.getDay()]}, ${fmtShort(d)}`; }

export function relTime(d) {
  const diff = (now() - new Date(d)) / 1000;
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) { const m = Math.floor(diff / 60); return m === 1 ? 'לפני דקה' : `לפני ${m} דק׳`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`; }
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return fmtDate(d);
}

export function ageOn(dob, at = now()) {
  const b = parseDay(dob); let a = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) a--;
  return a;
}

export const GRADE_LABEL = { 9: 'ט\'', 10: 'י\'', 11: 'יא\'', 12: 'יב\'' };
export function plural(n, one, many) { return n === 1 ? one : many.replace('{n}', n); }
export function tpl(s, vars) { return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')); }
export const byHe = (a, b) => a.localeCompare(b, 'he');
