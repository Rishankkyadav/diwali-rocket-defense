import { PAL, RAMPS, MAX_FLIGHT, DT } from '../config.js';
import { makeRotFrames, drawRotFrame } from '../gfx.js';
import { makeRocketState, stepRocket, toScreenX, toScreenY } from '../physics.js';

// 15×7 firework rocket, nose pointing right: fins, red body with gold bands, white nose cone.
const SPRITE = [
  '.oo............',
  '.oOhhbhhhhbhw..',
  'ggrrrbrrrrbrww.',
  'ggrrrbrrrrbrwww',
  'ggdddbddddbdws.',
  '.oOddbddddbds..',
  '.oo............',
];
const COLS = {
  o: PAL.orange, O: PAL.gold, g: PAL.grey3, h: PAL.rose, r: PAL.red2, d: PAL.red,
  b: PAL.yellow, w: PAL.white, s: PAL.grey1,
};
const HALF = 9;
let frames = null;

// heading: screen-space angle (0 = right, positive = down)
export function drawRocketSprite(ctx, sx, sy, heading, burning, t) {
  if (!frames) frames = makeRotFrames(SPRITE, COLS, 7, 3, HALF);
  const dx = Math.cos(heading), dy = Math.sin(heading);
  if (burning) {
    // exhaust flame behind the nozzle, 2-frame flicker
    const f = Math.floor(t * 30) % 2;
    const flame = [[8, PAL.white], [9, PAL.yellow], [10, f ? PAL.gold : PAL.yellow], [11, PAL.orange], [12, f ? PAL.red2 : PAL.orange], [13 + f, PAL.red]];
    for (const [d, col] of flame) {
      ctx.fillStyle = col;
      const w = d < 11 ? 2 : 1;
      ctx.fillRect(Math.round(sx - dx * d - (w - 1) / 2), Math.round(sy - dy * d - (w - 1) / 2), w, w);
    }
  }
  drawRotFrame(ctx, frames, HALF, sx, sy, heading);
}

export class Rocket {
  constructor(angle) {
    this.s = makeRocketState(angle);
    this.trailT = 0;
  }
  get burning() { return this.s.burnLeft > 0; }
  get timedOut() { return this.s.t >= MAX_FLIGHT; }

  step(wind, fx) {
    stepRocket(this.s, wind, DT);
    this.trailT += DT;
    if (this.trailT >= (this.burning ? 1 / 90 : 1 / 25)) {
      this.trailT = 0;
      const sx = toScreenX(this.s.x), sy = toScreenY(this.s.y);
      const sp = Math.hypot(this.s.vx, this.s.vy) || 1;
      const bx = sx - (this.s.vx / sp) * 10, by = sy + (this.s.vy / sp) * 10;
      if (this.burning) {
        fx.particles.spawn(bx, by, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, 0.3 + Math.random() * 0.2, RAMPS.flame, 1, 10);
        if (Math.random() < 0.5) fx.particles.spawn(bx, by, (Math.random() - 0.5) * 6, -4, 0.8, RAMPS.smoke, 2, -8, 1, false);
      } else {
        fx.particles.spawn(bx, by, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.5, RAMPS.gold, 1, 30);
      }
    }
  }

  draw(ctx, t) {
    const sx = toScreenX(this.s.x), sy = toScreenY(this.s.y);
    if (sy < -10) return; // off the top — HUD shows an arrow
    if (this.s.t < 0.07) return; // still inside the launcher tube
    drawRocketSprite(ctx, sx, sy, Math.atan2(-this.s.vy, this.s.vx), this.burning, t);
  }
}
