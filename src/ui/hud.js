import { PAL, W, MAX_LIVES, POWERUP_SEGMENTS } from '../config.js';
import { drawText, textWidth } from './font.js';
import { pixelLine } from '../gfx.js';

export const HUD_BUTTONS = {
  pause: { x: 452, y: 2, w: 26, h: 20 },
  power: { x: 414, y: 2, w: 34, h: 30 },
};

export function inRect(p, r) { return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; }

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
function heart(ctx, x, y, full) {
  HEART.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch !== '#') return;
    const edge = ry === 0 || rx === 0 || rx === 6 || ry === 5 || (ry === 4 && (rx === 2 || rx === 4)) || (ry === 3 && (rx === 1 || rx === 5));
    ctx.fillStyle = full ? (rx === 1 && ry === 1 ? PAL.white : PAL.red2) : (edge ? PAL.grey3 : PAL.navy);
    ctx.fillRect(x + rx, y + ry, 1, 1);
  }));
}

function shoeIcon(ctx, x, y, lit) {
  const c = lit ? PAL.red2 : PAL.grey3, sole = lit ? PAL.white : PAL.grey2;
  ctx.fillStyle = c; ctx.fillRect(x + 3, y + 2, 5, 4); ctx.fillRect(x + 5, y + 4, 7, 3);
  ctx.fillStyle = sole; ctx.fillRect(x + 3, y + 7, 10, 1);
  ctx.fillStyle = lit ? PAL.yellow : PAL.grey2; ctx.fillRect(x + 6, y + 3, 1, 1); ctx.fillRect(x + 8, y + 5, 1, 1);
  ctx.fillStyle = lit ? PAL.cyan : PAL.navy2;
  ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y + 4, 4, 1); ctx.fillRect(x - 1, y + 6, 3, 1);
}

export function drawHUD(ctx, g, t) {
  // lives
  for (let i = 0; i < Math.max(g.lives, 3) && i < MAX_LIVES; i++) heart(ctx, 5 + i * 9, 5, i < g.lives);
  // wave + remaining
  const p = g.params;
  drawText(ctx, `WAVE ${g.wave}${p && p.endless ? ' ENDLESS' : ''}`, 5, 15, { color: PAL.white, shadow: PAL.black });
  const left = g.queue.length + (g.zombie ? 1 : 0);
  drawText(ctx, `ZOMBIES ${left}`, 5, 25, { color: PAL.grey1, shadow: PAL.black });

  // score
  drawText(ctx, `SCORE ${g.score}`, W / 2, 4, { color: PAL.yellow, shadow: PAL.black, align: 'center' });

  // wind
  const w = g.wind;
  const y = 15;
  if (Math.abs(w) < 0.05) {
    drawText(ctx, 'WIND CALM', W / 2, y, { color: PAL.grey1, shadow: PAL.black, align: 'center' });
  } else {
    const label = `WIND ${Math.abs(w).toFixed(1)}`;
    const lw = textWidth(label);
    const len = Math.round(Math.abs(w) * 4) + 4;
    const total = lw + 4 + len + 3;
    const x0 = Math.round(W / 2 - total / 2);
    drawText(ctx, label, x0, y, { color: PAL.cyan, shadow: PAL.black });
    const ax0 = x0 + lw + 4, ay = y + 3;
    const s = Math.sign(w);
    const from = s > 0 ? ax0 : ax0 + len, to = s > 0 ? ax0 + len : ax0;
    pixelLine(ctx, from, ay + 1, to, ay + 1, PAL.black);
    pixelLine(ctx, from, ay, to, ay, PAL.cyan);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(to - s * 1, ay - 1, 1, 3); ctx.fillRect(to - s * 2, ay - 2, 1, 5);
  }
  // streak
  if (g.streakMult() > 1) {
    const blink = g.streakFlash > 0 && Math.floor(t * 16) % 2;
    drawText(ctx, `STREAK X${g.streakMult().toFixed(1)}`, W / 2, 26, { color: blink ? PAL.white : PAL.gold, shadow: PAL.black, align: 'center' });
  }

  // power-up icon + meter
  const pb = HUD_BUTTONS.power;
  const ix = pb.x + 9, iy = pb.y + 4;
  const glow = g.charged && Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = g.charged ? (glow ? PAL.yellow : PAL.gold) : PAL.navy2;
  ctx.fillRect(ix - 4, iy - 2, 20, 14);
  ctx.fillStyle = PAL.black; ctx.fillRect(ix - 3, iy - 1, 18, 12);
  shoeIcon(ctx, ix + 1, iy + 1, g.charged);
  for (let i = 0; i < POWERUP_SEGMENTS; i++) {
    const filled = g.charged || i < g.meter;
    ctx.fillStyle = PAL.black; ctx.fillRect(ix - 4 + i * 7, iy + 13, 6, 4);
    ctx.fillStyle = filled ? (g.charged ? PAL.yellow : PAL.cyan) : PAL.navy2;
    ctx.fillRect(ix - 3 + i * 7, iy + 14, 4, 2);
  }
  if (g.charged) {
    drawText(ctx, g.touchUsed ? 'TAP!' : 'S', pb.x - 2, iy + 2, { color: glow ? PAL.yellow : PAL.white, shadow: PAL.black, align: 'right' });
    if (!g.rocket && !g.speedster && g.zombie) {
      const msg = g.touchUsed ? 'SPEEDSTER READY!  TAP THE SHOE' : 'SPEEDSTER READY!  PRESS S';
      drawText(ctx, msg, W / 2, 38, { color: glow ? PAL.cyan : PAL.white, outline: PAL.black, align: 'center' });
    }
  } else if (g.meter > 0) {
    drawText(ctx, `${g.meter}/${POWERUP_SEGMENTS}`, pb.x - 2, iy + 2, { color: PAL.grey1, shadow: PAL.black, align: 'right' });
  }

  // pause button
  const ps = HUD_BUTTONS.pause;
  ctx.fillStyle = PAL.black; ctx.fillRect(ps.x + 6, ps.y + 3, 14, 13);
  ctx.fillStyle = PAL.grey1; ctx.fillRect(ps.x + 9, ps.y + 5, 3, 9); ctx.fillRect(ps.x + 14, ps.y + 5, 3, 9);
}

export function drawBanner(ctx, g, t) {
  if (g.bannerT <= 0) return;
  const age = g.bannerTotal - g.bannerT;
  const yIn = Math.min(1, age / 0.25);
  const y = Math.round(-30 + yIn * 120);
  drawText(ctx, `WAVE ${g.wave}`, W / 2, y, { scale: 3, color: PAL.yellow, outline: PAL.plumD, align: 'center' });
  if (g.bannerSub) {
    const blink = Math.floor(t * 6) % 2;
    drawText(ctx, g.bannerSub, W / 2, y + 28, { scale: 1, color: blink ? PAL.white : PAL.gold, outline: PAL.black, align: 'center' });
  }
}

export function drawOffscreenRocket(ctx, sx, sy) {
  if (sy >= 0) return;
  const x = Math.max(4, Math.min(W - 5, Math.round(sx)));
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(x, 34, 1, 1); ctx.fillRect(x - 1, 35, 3, 1); ctx.fillRect(x - 2, 36, 5, 1);
  drawText(ctx, `${Math.round(-sy / 10)}M`, x, 39, { color: PAL.yellow, shadow: PAL.black, align: 'center' });
}
