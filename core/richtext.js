// Small rich-text editor (headings, bold, bullet/numbered lists, links) with sanitising,
// used by Sunday descriptions and Trainings text blocks.
import { html, useEffect, useRef } from './lib.js';
import { Icon } from './icons.js';
import { promptText } from './overlay.js';

const ALLOWED = new Set(['H2', 'H3', 'B', 'STRONG', 'UL', 'OL', 'LI', 'A', 'P', 'BR', 'DIV']);
export function sanitize(src) {
  const doc = new DOMParser().parseFromString(`<div>${src || ''}</div>`, 'text/html');
  const walk = (node) => {
    [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) { c.remove(); return; }
      walk(c);
      if (!ALLOWED.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
      [...c.attributes].forEach((a) => { if (!(c.tagName === 'A' && a.name === 'href')) c.removeAttribute(a.name); });
      if (c.tagName === 'A') {
        const h = c.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(h)) c.removeAttribute('href');
        c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer');
      }
    });
  };
  walk(doc.body.firstChild);
  return doc.body.firstChild.innerHTML;
}
export function plainText(src) { const d = document.createElement('div'); d.innerHTML = sanitize(src); return d.textContent || ''; }
export function RichView({ value, cls = '' }) {
  return html`<div class=${'rich t-body ' + cls} dir="auto" dangerouslySetInnerHTML=${{ __html: sanitize(value) }}/>`;
}
/** Linkify plain text (announcements): returns vnodes with clickable http(s) links, keeps line breaks. */
export function LinkText({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return html`<span class="prewrap" dir="auto">${parts.map((p, i) => (i % 2 ? html`<a href=${p} target="_blank" rel="noopener noreferrer"><bdi>${p}</bdi></a>` : p))}</span>`;
}
export function RichEditor({ value, onChange, placeholder = 'הוסיפו תיאור…', minHeight }) {
  const ref = useRef();
  const last = useRef(value);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== (value || '') && document.activeElement !== ref.current) { ref.current.innerHTML = sanitize(value); last.current = value; } }, [value]);
  const emit = () => { const v = sanitize(ref.current.innerHTML); if (v !== last.current) { last.current = v; onChange(v); } };
  const cmd = (c, arg) => { ref.current.focus(); document.execCommand(c, false, arg); emit(); };
  const link = async () => {
    const sel = window.getSelection(); const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    const url = await promptText({ title: 'קישור', label: 'כתובת (https://…)', multiline: false, max: 500 });
    if (!url || !/^https?:\/\//i.test(url)) return;
    ref.current.focus(); if (range) { sel.removeAllRanges(); sel.addRange(range); }
    document.execCommand('createLink', false, url); emit();
  };
  const B = (icon, label, fn) => html`<button type="button" aria-label=${label} title=${label} onMouseDown=${(e) => e.preventDefault()} onClick=${fn}><${Icon} name=${icon} size=${18}/></button>`;
  return html`<div>
    <div class="rt-toolbar">${B('heading-2', 'כותרת', () => cmd('formatBlock', 'H2'))}${B('heading-3', 'כותרת משנה', () => cmd('formatBlock', 'H3'))}
      ${B('bold', 'מודגש', () => cmd('bold'))}${B('list', 'רשימה', () => cmd('insertUnorderedList'))}${B('list-ordered', 'רשימה ממוספרת', () => cmd('insertOrderedList'))}${B('link', 'קישור', link)}</div>
    <div ref=${ref} class="rt-edit rich" contenteditable="true" dir="auto" data-ph=${placeholder} style=${minHeight ? `min-height:${minHeight}px` : ''}
      onInput=${emit} onBlur=${emit} dangerouslySetInnerHTML=${{ __html: sanitize(value) }}/>
  </div>`;
}
