// Boot, integer scaling with letterboxing, and the fixed-timestep loop.
import { W, H, DT, MAX_STEPS_PER_FRAME, PAL } from './config.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { drawText } from './ui/font.js';

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  // whole-number scale in *device* pixels keeps every game pixel crisp
  const s = Math.floor(Math.min((vw * dpr) / W, (vh * dpr) / H));
  let cssW, cssH;
  if (s >= 1) { cssW = (W * s) / dpr; cssH = (H * s) / dpr; }
  else { const f = Math.min(vw / W, vh / H); cssW = W * f; cssH = H * f; }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const input = new Input(canvas);
const game = new Game();
window.__game = game; // handy for debugging in the console

document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

let last = performance.now();
let acc = 0;
let fps = 0, fpsFrames = 0, fpsT = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  game.handleEvents(input.drain());

  if (game.hitStop > 0) {
    game.hitStop -= dt; // freeze the sim for the hit-stop, keep rendering
  } else {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
      game.update(DT);
      acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME && acc >= DT) acc = 0; // drop the backlog instead of spiralling
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  game.render(ctx);

  fpsFrames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
  if (game.debug) {
    ctx.fillStyle = PAL.black; ctx.fillRect(0, H - 11, 150, 11);
    const r = game.rocket ? game.rocket.s : null;
    drawText(ctx, `FPS ${fps}${r ? `  V ${Math.hypot(r.vx, r.vy).toFixed(1)}` : ''}`, 2, H - 9, { color: PAL.green });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
