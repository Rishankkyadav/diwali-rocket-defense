// "Chotu" — an original hyperactive kid in a cyan kurta, yellow headband and red sneakers.
import { PAL, RAMPS, DOOR_X, SPEEDSTER_SPEED, SPEEDSTER_SKID_TIME, PX_PER_M, GROUND_Y } from '../config.js';
import { brush } from '../gfx.js';

const SW = 16, SH = 22;
const W_M = 1.0; // body width in metres for contact

export class Speedster {
  constructor() {
    this.x = DOOR_X - 1.2; // left edge, metres (starts inside the door)
    this.state = 'out';     // out → skid → back → done
    this.t = 0;
    this.v = SPEEDSTER_SPEED;
    this.dir = 1;
    this.dustT = 0;
    this.done = false;
  }

  // events: 'hit' when it slams the zombie, 'done' when it's back inside.
  update(dt, zombie, fx) {
    this.t += dt;
    const events = [];
    if (this.state === 'out') {
      this.x += SPEEDSTER_SPEED * dt;
      const target = zombie && !zombie.dead ? zombie.x - W_M * 0.6 : this.x + 1;
      if (this.x >= target) {
        this.x = target;
        this.state = 'skid'; this.t = 0; this.v = 8;
        events.push('hit');
      }
    } else if (this.state === 'skid') {
      this.v = Math.max(0, this.v - 30 * dt);
      this.x += this.v * dt;
      if (Math.random() < 0.6) fx.particles.spawn((this.x + W_M) * PX_PER_M, GROUND_Y - 1, 20 + Math.random() * 40, -20 - Math.random() * 30, 0.5, RAMPS.dirt, 1, 120);
      if (this.t >= SPEEDSTER_SKID_TIME) { this.state = 'back'; this.t = 0; this.dir = -1; events.push('turn'); }
    } else if (this.state === 'back') {
      this.x -= SPEEDSTER_SPEED * dt;
      if (this.x <= DOOR_X - 1.2) { this.state = 'done'; this.done = true; events.push('done'); }
    }
    if (this.state === 'out' || this.state === 'back') {
      this.dustT += dt;
      while (this.dustT > 0.012) {
        this.dustT -= 0.012;
        const bx = (this.x + (this.dir > 0 ? 0 : W_M)) * PX_PER_M;
        fx.particles.spawn(bx, GROUND_Y - 1 - Math.random() * 3, -this.dir * (10 + Math.random() * 30), -5 - Math.random() * 15, 0.5 + Math.random() * 0.3, RAMPS.smoke, Math.random() < 0.3 ? 2 : 1, 10);
      }
    }
    return events;
  }

  draw(ctx) {
    if (this.done) return;
    const left = Math.round((this.x + W_M / 2) * PX_PER_M - SW / 2);
    ctx.save();
    // hide while "inside" the house (left of the door)
    ctx.beginPath(); ctx.rect(DOOR_X * PX_PER_M - 2, 0, 480, 270); ctx.clip();
    const frame = this.state === 'skid' ? -1 : Math.floor(this.t * 24) % 6;
    drawSpeedster(ctx, left, GROUND_Y - SH, frame, this.dir < 0);
    // motion lines
    if (frame >= 0) {
      ctx.fillStyle = PAL.white;
      const back = this.dir > 0 ? left - 6 : left + SW + 2;
      for (const yy of [5, 10, 15]) ctx.fillRect(back + ((yy + frame) % 3), GROUND_Y - SH + yy, 4, 1);
    }
    ctx.restore();
  }
}

export function drawSpeedster(ctx, ox, oy, frame, flip) {
  const R = brush(ctx, ox, oy, SW, flip);
  const SKIN = PAL.clay, HAIR = PAL.black, KURTA = PAL.cyan, KURTA_D = PAL.blue, PANTS = PAL.white, SHOE = PAL.red2;
  if (frame < 0) {
    // skid: leaning back, front leg braced
    R.line(6, 15, 3, 20, PANTS, 2); R(1, 20, 4, 2, SHOE);
    R.line(9, 15, 13, 20, PANTS, 2); R(12, 20, 4, 2, SHOE);
    R(4, 8, 6, 8, KURTA); R(4, 8, 1, 8, KURTA_D);
    R(3, 2, 6, 6, SKIN); R(2, 1, 7, 2, HAIR); R(2, 3, 2, 1, PAL.yellow); R(0, 3, 3, 1, PAL.yellow);
    R(7, 4, 1, 1, PAL.black); R(7, 6, 2, 1, PAL.black);
    R.line(5, 9, 1, 6, SKIN, 2); R.line(9, 9, 13, 6, SKIN, 2);
    return;
  }
  const legs = [[4, 11], [6, 10], [8, 8], [11, 4], [10, 6], [8, 8]][frame];
  // legs: back then front
  R.line(7, 15, legs[0], 19, PANTS, 2); R(legs[0] - 1, 19, 3, 2, SHOE);
  R.line(8, 15, legs[1], 19, PANTS, 2); R(legs[1], 19, 3, 2, SHOE);
  // kurta (leaning forward)
  R(5, 8, 7, 8, KURTA); R(5, 8, 1, 8, KURTA_D); R(6, 15, 6, 1, KURTA_D);
  R(9, 9, 1, 3, PAL.yellow); // buttons placket
  // head
  R(7, 2, 6, 6, SKIN);
  R(6, 0, 7, 2, HAIR); R(12, 1, 1, 1, HAIR); R(6, 2, 1, 2, HAIR);
  R(6, 2, 7, 1, PAL.yellow); // headband
  const tail = frame % 2 ? 1 : 0;
  R(2, 2 + tail, 4, 1, PAL.yellow); R(1, 3 - tail, 2, 1, PAL.gold);
  R(11, 4, 1, 1, PAL.black); // eye
  R(11, 6, 2, 1, PAL.white); // grin
  // pumping arms
  const a = frame % 3;
  R.line(8, 9, [4, 6, 10][a], [12, 13, 12][a], SKIN, 2);
  R.line(10, 9, [13, 11, 8][a], [8, 11, 13][a], SKIN, 2);
}
