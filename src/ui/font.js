// Tiny 5×7 bitmap font so all text stays on the pixel grid.
const GLYPHS = {
  '0': '0E 11 13 15 19 11 0E', '1': '04 0C 04 04 04 04 0E', '2': '0E 11 01 02 04 08 1F',
  '3': '1F 02 04 02 01 11 0E', '4': '02 06 0A 12 1F 02 02', '5': '1F 10 1E 01 01 11 0E',
  '6': '06 08 10 1E 11 11 0E', '7': '1F 01 02 04 08 08 08', '8': '0E 11 11 0E 11 11 0E',
  '9': '0E 11 11 0F 01 02 0C',
  A: '0E 11 11 1F 11 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E',
  D: '1C 12 11 11 11 12 1C', E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10',
  G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11', I: '0E 04 04 04 04 04 0E',
  J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11', N: '11 11 19 15 13 11 11', O: '0E 11 11 11 11 11 0E',
  P: '1E 11 11 1E 10 10 10', Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11',
  S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04', U: '11 11 11 11 11 11 0E',
  V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
  Y: '11 11 11 0A 04 04 04', Z: '1F 01 02 04 08 10 1F',
  ' ': '00 00 00 00 00 00 00', '!': '04 04 04 04 04 00 04', '.': '00 00 00 00 00 0C 0C',
  ':': '00 0C 0C 00 0C 0C 00', '-': '00 00 00 1F 00 00 00', '+': '00 04 04 1F 04 04 00',
  '/': '01 01 02 04 08 10 10', '%': '18 19 02 04 08 13 03', '?': '0E 11 01 02 04 00 04',
  "'": '04 04 08 00 00 00 00', ',': '00 00 00 00 0C 04 08', '<': '02 04 08 10 08 04 02',
  '>': '08 04 02 01 02 04 08', '(': '02 04 08 08 08 04 02', ')': '08 04 02 02 02 04 08',
  '=': '00 00 1F 00 1F 00 00', '*': '00 15 0E 1F 0E 15 00',
};
const ROWS = {};
for (const [ch, s] of Object.entries(GLYPHS)) ROWS[ch] = s.split(' ').map((h) => parseInt(h, 16));

export const CHAR_W = 6; // 5 px + 1 px spacing
export const CHAR_H = 7;

export function textWidth(str, scale = 1) {
  return Math.max(0, str.length * CHAR_W * scale - scale);
}

function drawRaw(ctx, str, x, y, color, scale) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const raw of str.toUpperCase()) {
    const rows = ROWS[raw] || ROWS['?'];
    for (let r = 0; r < 7; r++) {
      const bits = rows[r];
      if (!bits) continue;
      for (let c = 0; c < 5; c++) {
        if (bits & (1 << (4 - c))) ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
      }
    }
    cx += CHAR_W * scale;
  }
}

// opts: { scale, color, shadow, align: 'left'|'center'|'right', outline }
export function drawText(ctx, str, x, y, opts = {}) {
  const scale = opts.scale || 1;
  const color = opts.color || '#ffffff';
  const w = textWidth(str, scale);
  let sx = x;
  if (opts.align === 'center') sx = x - w / 2;
  else if (opts.align === 'right') sx = x - w;
  sx = Math.round(sx);
  if (opts.outline) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      drawRaw(ctx, str, sx + ox * scale, y + oy * scale, opts.outline, scale);
    }
  } else if (opts.shadow) {
    drawRaw(ctx, str, sx + scale, y + scale, opts.shadow, scale);
  }
  drawRaw(ctx, str, sx, y, color, scale);
  return w;
}
