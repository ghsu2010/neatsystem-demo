// Drag to reorder (Design 10.7 / 10.8): desktop via a handle, phone via long-press (400 ms).
// Lists:  <div data-drop-list="group:listId">  items: <div data-drag-item>
// Start a drag from a pointerdown: startDrag(e, {group, listId, onDrop, axis, longPress})
// onDrop({fromList, fromIndex, toList, toIndex}) — indexes are among the list's items without the dragged one.

let st = null;

export function startDrag(e, { group, listId, onDrop, axis = 'y', longPress = false, item }) {
  if (e.button > 0) return;
  const src = item || e.currentTarget.closest('[data-drag-item]');
  if (!src) return;
  const sx = e.clientX, sy = e.clientY;
  let timer = null;
  const pending = { cancelled: false };
  const begin = () => {
    if (pending.cancelled) return;
    const list = src.closest('[data-drop-list]');
    const items = [...list.querySelectorAll(':scope [data-drag-item]')].filter((x) => x.closest('[data-drop-list]') === list);
    const fromIndex = items.indexOf(src);
    const r = src.getBoundingClientRect();
    const ghost = src.cloneNode(true);
    ghost.classList.add('drag-ghost');
    Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px', margin: 0 });
    document.body.appendChild(ghost);
    const line = document.createElement('div');
    line.className = 'drop-line' + (axis === 'x' ? ' v' : '');
    document.body.appendChild(line);
    src.classList.add('dragging-src');
    if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(10);
    st = { group, fromList: listId, fromIndex, src, ghost, line, dx: sx - r.left, dy: sy - r.top, axis, onDrop, target: null };
    document.body.style.userSelect = 'none';
  };
  const move = (ev) => {
    if (!st) {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) {
        if (longPress) { cancel(); return; }
        begin();
      } else return;
    }
    if (!st) return;
    ev.preventDefault();
    st.ghost.style.left = ev.clientX - st.dx + 'px';
    st.ghost.style.top = ev.clientY - st.dy + 'px';
    findTarget(ev.clientX, ev.clientY);
    if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) window.scrollBy(0, 12);
  };
  const up = () => {
    cleanupListeners();
    if (!st) { clearTimeout(timer); return; }
    const s = st; st = null;
    s.ghost.remove(); s.line.remove(); s.src.classList.remove('dragging-src');
    document.body.style.userSelect = '';
    if (s.target) s.onDrop({ fromList: s.fromList, fromIndex: s.fromIndex, toList: s.target.list, toIndex: s.target.index });
  };
  const cancel = () => { pending.cancelled = true; clearTimeout(timer); cleanupListeners(); };
  const blockTouch = (ev) => { if (st) ev.preventDefault(); };
  const cleanupListeners = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    window.removeEventListener('touchmove', blockTouch);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('touchmove', blockTouch, { passive: false });
  if (longPress) timer = setTimeout(begin, 400);
}

function findTarget(x, y) {
  const lists = [...document.querySelectorAll(`[data-drop-list^="${st.group}:"]`)];
  let best = null, bestD = Infinity;
  for (const l of lists) {
    const r = l.getBoundingClientRect();
    const d = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? 0 : Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom)) + (x < r.left || x > r.right ? 1000 : 0);
    if (d < bestD) { bestD = d; best = l; }
  }
  if (!best || bestD > 120) { st.target = null; st.line.style.display = 'none'; return; }
  const listId = best.getAttribute('data-drop-list').slice(st.group.length + 1);
  const items = [...best.querySelectorAll('[data-drag-item]')].filter((it) => it.closest('[data-drop-list]') === best && it !== st.src);
  let index = items.length;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    const mid = st.axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
    const before = st.axis === 'x' ? x > mid : y < mid; // RTL: for x-axis, "before" = further right
    if (before) { index = i; break; }
  }
  st.target = { list: listId, index };
  const br = best.getBoundingClientRect();
  st.line.style.display = 'block';
  if (st.axis === 'x') {
    const ref = items[index] || items[items.length - 1];
    const rr = ref ? ref.getBoundingClientRect() : br;
    const xx = items[index] ? rr.right + 2 : rr.left - 2;
    Object.assign(st.line.style, { left: xx + 'px', top: rr.top + 'px', height: rr.height + 'px' });
  } else {
    let yy;
    if (items[index]) yy = items[index].getBoundingClientRect().top - 2;
    else if (items.length) yy = items[items.length - 1].getBoundingClientRect().bottom + 1;
    else yy = br.top + 4;
    Object.assign(st.line.style, { left: br.left + 'px', width: br.width + 'px', top: yy + 'px' });
  }
}
/** Move an element inside an array (helper for onDrop handlers). */
export function moveIn(arr, from, to) { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }
