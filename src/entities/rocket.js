import { PAL, RAMPS, MAX_FLIGHT, DT } from '../config.js';
import { makeRocketState, stepRocket, toScreenX, toScreenY } from '../physics.js';

export class Rocket {
  constructor(angle, v0) {
    this.s = makeRocketState(angle, v0);
    this.trailT = 0;
    this.done = false;
  }
  get burning() { return this.s.burnLeft > 0; }

  step(wind, fx) {
    stepRocket(this.s, wind, DT);
    this.trailT += DT;
    if (this.trailT >= (this.burning ? 1 / 60 : 1 / 20)) {
      this.trailT = 0;
      const sx = toScreenX(this.s.x), sy = toScreenY(this.s.y);
      const sp = Math.hypot(this.s.vx, this.s.vy) || 1;
      const bx = sx - (this.s.vx / sp) * 4, by = sy + (this.s.vy / sp) * 4;
      if (this.burning) {
        fx.particles.spawn(bx, by, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.25 + Math.random() * 0.15, RAMPS.flame, 1, 20);
      } else {
        fx.particles.spawn(bx, by, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 0.5, RAMPS.gold, 1, 30);
      }
    }
  }
  get timedOut() { return this.s.t >= MAX_FLIGHT; }

  draw(ctx, t) {
    const sx = toScreenX(this.s.x), sy = toScreenY(this.s.y);
    if (sy < -2) return; // off the top — HUD shows an arrow
    drawRocketSprite(ctx, sx, sy, Math.atan2(-this.s.vy, this.s.vx), this.burning, t);
  }
}

// 6×3-ish rocket drawn pixel-by-pixel along its heading, with a 2-frame flame.
export function drawRocketSprite(ctx, sx, sy, heading, burning, t) {
  const dx = Math.cos(heading), dy = Math.sin(heading);
  const px = (i, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(sx + dx * i), Math.round(sy + dy * i), 1, 1); };
  // stick
  for (let i = -6; i <= -3; i++) px(i, PAL.brown);
  // tube
  px(-2, PAL.red); px(-1, PAL.red2); px(0, PAL.red2); px(1, PAL.gold);
  ctx.fillStyle = PAL.red2;
  ctx.fillRect(Math.round(sx - dy * 1 + dx * -1), Math.round(sy + dx * 1 + dy * -1), 1, 1);
  px(2, PAL.yellow); // tip
  if (burning) {
    const f = Math.floor(t * 30) % 2;
    px(-3, f ? PAL.yellow : PAL.white);
    px(-4, f ? PAL.orange : PAL.gold);
    if (f) px(-5, PAL.red2);
  }
}
