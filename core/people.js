// Shared person display (avatar with frame, styled name, 16 px team rank badge).
// Reads other systems only through the bus: Users (people), Store (equipped cosmetics), Ranks (badge).
import { html } from './lib.js';
import { bus } from './bus.js';
import { Icon } from './icons.js';
import { cx } from './ui.js';
import { navigate } from './router.js';

export function safeRead(name, ...args) {
  try { return bus.has(name) ? bus.read(name, ...args) : null; } catch (e) { console.warn(name, e); return null; }
}
export function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p[0][0] || '') + (p[1] ? p[1][0] : '');
}

/** Avatar 24/32/40/64/88/96 with fallback initials on the team tint; frame only when asked and ≥ 32. */
export function Avatar({ uid, size = 32, frame = false, inactive, onClick, ring }) {
  const u = safeRead('users.get', uid);
  const pic = u && safeRead('users.pictureUrl', uid);
  const tint = u ? safeRead('users.teamTint', u.main_team) : null;
  const eq = frame && size >= 32 && u ? safeRead('store.equipped', uid) : null;
  const fs = Math.max(11, Math.round(size * 0.38));
  const style = `width:${size}px;height:${size}px;font-size:${fs}px;${ring ? `box-shadow:0 0 0 4px var(--bg-surface);` : ''}`;
  return html`<span class=${cx('avatar', inactive && 'inactive', onClick && 'tap')} style=${style} onClick=${onClick}
    title=${inactive ? 'לא פעיל/ה' : undefined} role=${onClick ? 'button' : undefined} aria-label=${u ? u.name_he : 'משתמש שנמחק'}>
    <span class="av-in tinted" style=${tint || ''}>${pic ? html`<img src=${pic} alt="" width=${size} height=${size}/>` : u ? initials(u.name_he) : html`<${Icon} name="user-x" size=${Math.round(size * 0.5)}/>`}</span>
    ${eq && eq.frame ? html`<span class="frame" style=${`background:${eq.frame.ring}`}/>` : null}
  </span>`;
}

/** 16/24/48 px rank badge (Design 11.2). badge = {name, url} */
export function RankBadge({ badge, size = 16 }) {
  if (!badge) return null;
  return html`<span class="rank-badge" style=${`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px`} title=${badge.name} aria-label=${badge.name}>
    ${badge.url ? html`<img src=${badge.url} alt=""/>` : badge.name.trim()[0]}</span>`;
}
export function TeamRankBadge({ uid, size = 16 }) {
  return html`<${RankBadge} badge=${safeRead('ranks.teamRankBadge', uid)} size=${size}/>`;
}

/**
 * Person name. Shows "משתמש שנמחק" for deleted users (Users E6).
 * opts: rank (16 px team rank badge), color (equipped name colour), link (tap → profile)
 */
export function PersonName({ uid, rank = true, color = false, link = true, cls, plain }) {
  const u = safeRead('users.get', uid);
  if (!u) return html`<span class=${cx('muted', cls)}>משתמש שנמחק</span>`;
  const eq = color ? safeRead('store.equipped', uid) : null;
  const nameStyle = eq && eq.nameColor ? eq.nameColor.style : '';
  const inner = html`<span class=${cx('pn-text', eq && eq.nameColor && eq.nameColor.cls)} style=${nameStyle}><bdi>${u.name_he}</bdi></span>
    ${rank && !plain ? html`<${TeamRankBadge} uid=${uid}/>` : null}
    ${u.status === 'alumni' && !plain ? html`<span class="badge" style="height:18px;padding:0 6px">בוגר/ת</span>` : null}`;
  if (!link) return html`<span class=${cx('person-name', cls)} style="cursor:default">${inner}</span>`;
  return html`<button type="button" class=${cx('person-name', cls)} onClick=${(e) => { e.stopPropagation(); navigate('/profile/' + uid); }}>${inner}</button>`;
}
export function PersonRow({ uid, sub, end, size = 32, frame = false, onClick }) {
  return html`<div class="row gap12 grow" style="min-width:0">
    <${Avatar} uid=${uid} size=${size} frame=${frame} onClick=${onClick || (() => navigate('/profile/' + uid))}/>
    <div class="col gap4 grow" style="min-width:0"><${PersonName} uid=${uid}/>${sub && html`<span class="t-foot sec">${sub}</span>`}</div>${end}</div>`;
}
export function AvatarStack({ uids, size = 28, max = 3, inactive = () => false }) {
  const shown = uids.slice(0, max);
  return html`<span class="avatar-stack">${shown.map((id) => html`<${Avatar} key=${id} uid=${id} size=${size} inactive=${inactive(id)}/>`)}
    ${uids.length > max ? html`<span class="more-n">+${uids.length - max}</span>` : null}</span>`;
}
/** Team badge in the team tint (Design 8.3). */
export function TeamBadge({ teamId }) {
  const t = teamId && safeRead('users.team', teamId);
  if (!t) return null;
  return html`<span class="badge tinted" style=${safeRead('users.teamTint', teamId)}>${t.name}</span>`;
}
