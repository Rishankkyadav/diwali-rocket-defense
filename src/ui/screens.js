import { PAL, W, H } from '../config.js';
import { drawText } from './font.js';
import { inRect } from './hud.js';

const btn = (id, label, cx, y, w = 96, h = 18) => ({ id, label, x: Math.round(cx - w / 2), y, w, h });

export function titleButtons(soundOn, musicOn) {
  return [
    btn('play', 'PLAY', W / 2, 118, 110, 24),
    btn('sound', `SOUND ${soundOn ? 'ON' : 'OFF'}`, W / 2 - 52, 150, 96, 18),
    btn('music', `MUSIC ${musicOn ? 'ON' : 'OFF'}`, W / 2 + 52, 150, 96, 18),
  ];
}
export function pauseButtons(soundOn, musicOn) {
  return [
    btn('resume', 'RESUME', W / 2, 96, 110, 20),
    btn('restart', 'RESTART', W / 2, 122, 110, 18),
    btn('sound', `SOUND ${soundOn ? 'ON' : 'OFF'}`, W / 2 - 52, 146, 96, 18),
    btn('music', `MUSIC ${musicOn ? 'ON' : 'OFF'}`, W / 2 + 52, 146, 96, 18),
    btn('quit', 'QUIT TO TITLE', W / 2, 170, 110, 18),
  ];
}
export function gameOverButtons() {
  return [btn('retry', 'RETRY', W / 2 - 60, 168, 100, 22), btn('title', 'TITLE', W / 2 + 60, 168, 100, 22)];
}

export function hitButton(buttons, p) { return buttons.find((b) => inRect(p, b)); }

function drawButton(ctx, b, hover, primary) {
  ctx.fillStyle = PAL.black; ctx.fillRect(b.x + 1, b.y + 2, b.w, b.h);
  ctx.fillStyle = hover ? PAL.yellow : primary ? PAL.gold : PAL.navy2;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = hover ? PAL.white : primary ? PAL.yellow : PAL.grey3;
  ctx.fillRect(b.x, b.y, b.w, 1);
  ctx.fillStyle = primary || hover ? PAL.brownD : PAL.navy;
  ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
  const scale = b.h >= 22 ? 2 : 1;
  drawText(ctx, b.label, b.x + b.w / 2, b.y + Math.round((b.h - 7 * scale) / 2), {
    scale, color: primary || hover ? PAL.plumD : PAL.white, align: 'center',
  });
}

function panel(ctx, x, y, w, h) {
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = PAL.black; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.gold; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillStyle = PAL.orange; ctx.fillRect(x, y + 1, w, 1); ctx.fillRect(x, y + h - 2, w, 1);
}

export function drawTitle(ctx, ui, t) {
  panel(ctx, 70, 26, W - 140, 196);
  const bob = Math.round(Math.sin(t * 2) * 2);
  drawText(ctx, 'DIWALI', W / 2, 38 + bob, { scale: 4, color: PAL.yellow, outline: PAL.rust, align: 'center' });
  drawText(ctx, 'ROCKET DEFENSE', W / 2, 74, { scale: 2, color: PAL.white, outline: PAL.magenta, align: 'center' });
  drawText(ctx, 'DEFEND YOUR ROOFTOP ON DIWALI NIGHT', W / 2, 96, { color: PAL.peach, align: 'center' });
  for (const b of ui.buttons) drawButton(ctx, b, ui.hover === b.id, b.id === 'play');
  drawText(ctx, `BEST ${ui.best}`, W / 2, 178, { color: PAL.gold, align: 'center' });
  drawText(ctx, 'DRAG BACK ANYWHERE AND RELEASE TO LAUNCH', W / 2, 194, { color: PAL.grey1, align: 'center' });
  drawText(ctx, 'S / TAP SHOE: SPEEDSTER   ESC: PAUSE', W / 2, 205, { color: PAL.grey2, align: 'center' });
}

export function drawPause(ctx, ui) {
  ctx.globalAlpha = 0.45; ctx.fillStyle = PAL.black; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  panel(ctx, 120, 56, W - 240, 140);
  drawText(ctx, 'PAUSED', W / 2, 68, { scale: 2, color: PAL.yellow, outline: PAL.rust, align: 'center' });
  for (const b of ui.buttons) drawButton(ctx, b, ui.hover === b.id, b.id === 'resume');
}

export function drawGameOver(ctx, ui, t) {
  ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.black; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  panel(ctx, 110, 40, W - 220, 160);
  drawText(ctx, 'GAME OVER', W / 2, 52, { scale: 3, color: PAL.red2, outline: PAL.black, align: 'center' });
  drawText(ctx, `SCORE ${ui.score}`, W / 2, 88, { scale: 2, color: PAL.yellow, align: 'center' });
  drawText(ctx, `BEST ${ui.best}`, W / 2, 110, { color: PAL.gold, align: 'center' });
  drawText(ctx, `REACHED WAVE ${ui.wave}   KILLS ${ui.kills}`, W / 2, 124, { color: PAL.grey1, align: 'center' });
  if (ui.newBest && Math.floor(t * 4) % 2 === 0) drawText(ctx, 'NEW BEST!', W / 2, 142, { scale: 2, color: PAL.cyan, outline: PAL.black, align: 'center' });
  for (const b of ui.buttons) drawButton(ctx, b, ui.hover === b.id, b.id === 'retry');
}
