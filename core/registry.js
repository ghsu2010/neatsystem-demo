// UI registry: where each system plugs in its own screens. Data never passes through here —
// only routes, management sections, tab badges and widgets (components a system offers for
// another system's screen, e.g. Countdown's Home card shown by NeatSystem's Home).
const routes = [];
const management = new Map(); // system -> {system, title, sections:[...]}
const tabBadges = new Map();  // tab -> [fn(uid) => n]
const widgets = new Map();

/**
 * addRoute({ path: '/sunday/board/:id', tab: 'sunday', title: 'סאנדיי' | (params)=>string,
 *            render: (params, query) => vnode, wide, access: 'tab' | 'any' })
 */
export function addRoute(r) {
  const segs = r.path.split('/').filter(Boolean);
  routes.push({ ...r, segs });
}
export function matchRoute(parts) {
  for (const r of routes) {
    if (r.segs.length !== parts.length) continue;
    const params = {};
    let ok = true;
    r.segs.forEach((s, i) => { if (s.startsWith(':')) params[s.slice(1)] = parts[i]; else if (s !== parts[i]) ok = false; });
    if (ok) return { route: r, params };
  }
  return null;
}
/** sections: [{ id, title, icon, can(uid)→bool, badge?(uid)→n, render(uid) }] */
export function addManagement(system, title, sections) { management.set(system, { system, title, sections }); }
export function getManagement(system) { return management.get(system); }
export function addTabBadge(tab, fn) { if (!tabBadges.has(tab)) tabBadges.set(tab, []); tabBadges.get(tab).push(fn); }
export function tabBadge(tab, uid) {
  let n = 0;
  for (const fn of tabBadges.get(tab) || []) { try { n += fn(uid) || 0; } catch (e) { console.warn(e); } }
  return n;
}
export function addWidget(name, comp) { widgets.set(name, comp); }
export function widget(name) { return widgets.get(name) || null; }
