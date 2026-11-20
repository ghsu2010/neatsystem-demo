// Colour data and helpers: the 16 group presets (Design 10.6), 16 milestone pastels (11.5),
// Sunday pill colours (8.2) and team tints (8.3). Pills are always tinted with dark same-hue text.

export const PRESETS = [
  ['ירוק', '#00A86B'], ['טורקיז', '#12A39A'], ['תכלת', '#2D9CDB'], ['כחול', '#4657FF'],
  ['סגול', '#7B4DFF'], ['סגול כהה', '#A23CD8'], ['ורוד', '#E0458F'], ['אדום', '#E2445C'],
  ['בורדו', '#C2185B'], ['ענבר', '#F5A623'], ['חרדל', '#C9A200'], ['ליים', '#7CB518'],
  ['חום', '#9C6B3F'], ['אפור', '#6B7280'], ['נייבי', '#2B3A67'], ['פטרול', '#0E7490'],
].map(([name, hex], i) => ({ i: i + 1, name, hex }));

export const PASTELS = [
  ['מנטה', '#CDEFE0', '#1E6B4A'], ['טורקיז', '#CBEEEC', '#12675F'], ['תכלת', '#D3E9F8', '#1F5F8B'], ['כחול', '#D8DEFF', '#2E3AA8'],
  ['לבנדר', '#E3DBFF', '#4B2BB8'], ['סגול', '#EED8F7', '#6E2390'], ['ורוד', '#F9D9E8', '#9A2A5E'], ['אדום', '#F9D6DC', '#9E2338'],
  ['אפרסק', '#FBE0D0', '#8F3F12'], ['שמש', '#FBEFC4', '#7A5A00'], ['לימון', '#F1F3C2', '#5E6400'], ['ליים', '#E2F2C8', '#3F6B12'],
  ['חול', '#F1E7D3', '#6B4F1D'], ['אבן', '#E4E1DC', '#57514A'], ['אפור', '#E3E6EC', '#3B404A'], ['נייבי', '#D6DCEA', '#2B3A67'],
].map(([name, fill, dark], i) => ({ i: i + 1, name, fill, dark }));

// Fixed tints from Design 8.2 / 8.3: [light bg, light fg, dark bg, dark fg]
export const FIXED = {
  todo: ['#E9EBF0', '#3B404A', '#252931', '#CACED6'],
  working: ['#FEF3D0', '#7A4D00', '#3A2E0A', '#FAC547'],
  stuck: ['#FDE7EA', '#A3142A', '#3D1219', '#FD7277'],
  done: ['#DCF5E5', '#05692F', '#0E2E1B', '#5FD37F'],
  low: ['#E9EBF0', '#3B404A', '#252931', '#CACED6'],
  med: ['#F3F4FF', '#20059D', '#16163A', '#A8B5FF'],
  high: ['#EEE9FF', '#4B2BB8', '#241A4D', '#C4B5FF'],
  crit: ['#FDE7EA', '#A3142A', '#3D1219', '#FD7277'],
  cad: ['#EEE9FF', '#4B2BB8', '#241A4D', '#C4B5FF'],
  build: ['#F3ECDD', '#6B4F1D', '#33291A', '#E2C99A'],
  software: ['#DDF5F1', '#0B6B5E', '#0E2E2A', '#6FD9C8'],
  slate: ['#E9EBF0', '#3B404A', '#252931', '#CACED6'],
};

function rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, t) { const A = rgb(a), B = rgb(b); return hex(...A.map((v, i) => v * t + B[i] * (1 - t))); }
function lum(h) { return rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Darken (toward black) or lighten (toward white) `c` until it reaches `ratio` against `bg`. */
export function fitText(c, bg, ratio = 4.5) {
  const toward = lum(bg) > 0.3 ? '#000000' : '#FFFFFF';
  let t = 1, out = c;
  while (contrast(out, bg) < ratio && t > 0) { t -= 0.05; out = mix(c, toward, t); }
  return out;
}

/** CSS variables for a tinted pill/badge from a fixed key ('fx:done') or preset ('p:7'). */
export function tintVars(color) {
  let q;
  if (!color) q = FIXED.slate;
  else if (color.startsWith('fx:')) q = FIXED[color.slice(3)] || FIXED.slate;
  else {
    const p = PRESETS[(parseInt(color.slice(2), 10) || 14) - 1].hex;
    const bl = mix(p, '#FFFFFF', 0.16), bd = mix(p, '#15181F', 0.3);
    q = [bl, fitText(p, bl, 5), bd, fitText(p, bd, 5)];
  }
  return `--tbl:${q[0]};--tfl:${q[1]};--tbd:${q[2]};--tfd:${q[3]}`;
}
export function presetHex(color) {
  if (!color) return PRESETS[13].hex;
  if (color.startsWith('p:')) return PRESETS[(parseInt(color.slice(2), 10) || 14) - 1].hex;
  const f = FIXED[color.slice(3)]; return f ? f[1] : PRESETS[13].hex;
}
/** Group name colour: preset if ≥4.5:1 on the background, else darker/lighter (Design 10.6). */
export function groupNameVars(color) {
  const p = presetHex(color);
  return `--gl:${fitText(p, '#FFFFFF')};--gd:${fitText(p, '#15181F')};--gbar:${p}`;
}
export function pastel(i) { return PASTELS[((i || 4) - 1) % 16]; }
