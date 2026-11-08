// The launcher: an original footballer in a saffron-and-green kit, number 9.
import { PAL } from '../config.js';
import { brush, pixelLine } from '../gfx.js';
import { drawLauncher, launcherPoint, GRIP_TRIGGER, GRIP_FRONT } from './launcher.js';

const SKIN = PAL.brown, SKIN_D = PAL.brownD, HAIR = PAL.black;
const SHIRT = PAL.orange, SHIRT_D = PAL.rust, SASH = PAL.white, COLLAR = PAL.yellow;
const SHORTS = PAL.green2, SOCK = PAL.white, BOOT = PAL.navy, BOOT_HI = PAL.gold;

export const PLAYER_X = 6;     // screen px, left of 16×24 sprite
export const PLAYER_FEET = 170; // screen px (roof level)
const SW = 16;

// Celebration: 10 frames over 1.2 s — crouch, jump, spin (side/front/side/back), land in a wide pose.
const CELEB = [
  { y: 2, view: 'side', arms: 'down', legs: 'crouch' },
  { y: -4, view: 'side', arms: 'up2', legs: 'jump' },
  { y: -8, view: 'front', arms: 'up2', legs: 'jump' },
  { y: -10, view: 'sideL', arms: 'up2', legs: 'jump' },
  { y: -10, view: 'back', arms: 'up2', legs: 'jump' },
  { y: -8, view: 'side', arms: 'wide', legs: 'jump' },
  { y: -3, view: 'front', arms: 'wide', legs: 'jump' },
  { y: 0, view: 'front', arms: 'wide', legs: 'wide' },
  { y: 0, view: 'front', arms: 'wide', legs: 'wide' },
  { y: 0, view: 'front', arms: 'wide', legs: 'wide' },
];
export const CELEBRATION_TIME = 1.2;

export class Player {
  constructor() { this.reset(); }
  reset() {
    this.state = 'idle';
    this.t = 0;
    this.power = 0;
    this.siuShown = false;
    this.heading = -Math.PI / 3;  // launcher aim (screen radians)
    this.loaded = true;
  }
  setPull(power) { this.state = 'pull'; this.power = power; this.t = 0; }
  release() { this.state = 'release'; this.t = 0; }
  cancelPull() { this.state = 'idle'; this.t = 0; }
  fistPump() { if (this.state !== 'celebrate') { this.state = 'pump'; this.t = 0; } }
  celebrate() { this.state = 'celebrate'; this.t = 0; this.siuShown = false; }
  get busyCelebrating() { return this.state === 'celebrate'; }

  update(dt) {
    this.t += dt;
    if (this.state === 'release' && this.t > 0.25) this.toIdle();
    if (this.state === 'pump' && this.t > 0.5) this.toIdle();
    if (this.state === 'celebrate' && this.t > CELEBRATION_TIME) this.toIdle();
  }
  toIdle() { this.state = 'idle'; this.t = 0; }

  // Pose for this frame
  pose(globalT) {
    switch (this.state) {
      case 'pull': {
        return { view: 'side', lean: 0, arms: 'hold', legs: 'brace', y: 0 };
      }
      case 'release': {
        return { view: 'side', lean: 0, arms: 'hold', legs: 'brace', y: 0 };
      }
      case 'pump': {
        const f = Math.floor(this.t / 0.125) % 4;
        return { view: 'side', lean: 0, arms: f % 2 === 0 ? 'up' : 'upHalf', legs: 'stand', y: 0, oneHand: true };
      }
      case 'celebrate': {
        const f = Math.min(9, Math.floor((this.t / CELEBRATION_TIME) * 10));
        return { lean: 0, ...CELEB[f] };
      }
      default: {
        const f = Math.floor(globalT / 0.4) % 4;
        return { view: 'side', lean: 0, arms: 'hold', legs: 'stand', y: f >= 2 ? 1 : 0 };
      }
    }
  }

  draw(ctx, globalT) {
    const p = this.pose(globalT);
    const oy = PLAYER_FEET - 24 + (p.y || 0);
    drawFootballer(ctx, PLAYER_X, oy, p);
    if (this.state === 'celebrate') return; // launcher goes on his back for the SIUUU
    // recoil: the tube kicks back along its axis right after a shot
    const kick = this.state === 'release' ? Math.max(0, 3 - this.t * 20) : 0;
    const h = this.heading;
    const px = PLAYER_X + 10 - Math.cos(h) * kick, py = oy + 8 - Math.sin(h) * kick;
    drawLauncher(ctx, px, py, h, this.loaded);
    const grip = (g) => launcherPoint(px, py, h, g.u, g.v);
    const t = grip(GRIP_TRIGGER), f = grip(GRIP_FRONT);
    const shY = oy + 10;
    pixelLine(ctx, PLAYER_X + 6, shY, t.x, t.y, PAL.brownD, 2);           // back arm to trigger
    ctx.fillStyle = PAL.brown; ctx.fillRect(Math.round(t.x), Math.round(t.y), 2, 2);
    if (!p.oneHand) {
      pixelLine(ctx, PLAYER_X + 10, shY, f.x, f.y, PAL.brown, 2);         // front arm to fore-grip
      ctx.fillStyle = PAL.orange; ctx.fillRect(PLAYER_X + 10, shY - 1, 2, 2); // sleeve
    }
  }
}

export function drawFootballer(ctx, ox, oy, p) {
  const flip = p.view === 'sideL';
  const side = p.view === 'side' || p.view === 'sideL';
  const R = brush(ctx, ox, oy, SW, flip);
  const L = p.lean || 0;
  const crouch = p.legs === 'crouch' ? 2 : 0;

  // ----- legs -----
  const leg = (x, top, len, footDir) => {
    R(x, top, 2, Math.max(0, len - 3), SKIN);
    R(x, top + len - 3, 2, 2, SOCK);
    R(footDir < 0 ? x - 1 : x, top + len - 1, 3, 2, BOOT);
  };
  if (side) {
    switch (p.legs) {
      case 'kick':
        leg(6, 17, 5, 1);
        R.line(10, 17, 13, 19, SKIN, 2); R(13, 19, 2, 1, SOCK); R(14, 19, 2, 2, BOOT); R(15, 19, 1, 1, BOOT_HI);
        break;
      case 'brace':
        leg(5 - Math.min(L, 2), 17, 5, -1); leg(10, 17, 5, 1);
        break;
      case 'jump':
        R(6, 17, 2, 3, SKIN); R(5, 20, 3, 1, BOOT);
        R(9, 17, 2, 2, SKIN); R(10, 19, 2, 1, SOCK); R(11, 19, 2, 2, BOOT);
        break;
      default:
        leg(6, 17 + crouch, 5 - crouch, 1); leg(9, 17 + crouch, 5 - crouch, 1);
    }
  } else {
    if (p.legs === 'wide') {
      R.line(6, 17, 4, 21, SKIN, 2); R(3, 21, 3, 1, SOCK); R(2, 22, 4, 2, BOOT);
      R.line(9, 17, 11, 21, SKIN, 2); R(10, 21, 3, 1, SOCK); R(10, 22, 4, 2, BOOT);
    } else if (p.legs === 'jump') {
      R(5, 17, 2, 3, SKIN); R(4, 20, 3, 1, BOOT); R(9, 17, 2, 3, SKIN); R(9, 20, 3, 1, BOOT);
    } else {
      leg(5, 17, 5, 1); leg(9, 17, 5, 1);
    }
  }

  // ----- shorts -----
  const bodyX = side ? 5 - L : 4;
  const bodyW = side ? 6 : 8;
  R(bodyX + (side ? Math.ceil(L / 2) : 0), 15 + crouch, bodyW, 3, SHORTS);

  // ----- back arm (side view) -----
  if (side) {
    const sx = bodyX, sy = 9 + crouch;
    if (p.arms === 'hold' || p.arms === 'up' || p.arms === 'upHalf') { /* drawn with the launcher */ }
    else if (p.arms === 'pull' || p.arms === 'forward') R.line(sx, sy, sx - 3, sy + 3, SKIN_D, 2);
    else if (p.arms === 'up2') R.line(sx, sy, sx - 2, sy - 7, SKIN_D, 2);
    else if (p.arms === 'wide') R.line(sx, sy, sx - 4, sy + 4, SKIN_D, 2);
    else R(sx - 1, sy, 2, 5, SKIN_D);
  }

  // ----- torso -----
  const ty = 8 + crouch;
  R(bodyX, ty, bodyW, 7, SHIRT);
  if (side) {
    R(bodyX, ty, 1, 7, SHIRT_D);
    R(bodyX + 2, ty, 3, 1, COLLAR);
    R(bodyX + 4, ty + 1, 1, 1, SASH); R(bodyX + 3, ty + 2, 1, 1, SASH);
    R(bodyX + 2, ty + 3, 1, 1, SASH); R(bodyX + 1, ty + 4, 1, 1, SASH);
  } else if (p.view === 'front') {
    R(bodyX + 3, ty, 2, 1, COLLAR);
    R(bodyX + 6, ty + 1, 1, 1, SASH); R(bodyX + 5, ty + 2, 1, 1, SASH); R(bodyX + 4, ty + 3, 1, 1, SASH);
    R(bodyX + 3, ty + 4, 1, 1, SASH); R(bodyX + 2, ty + 5, 1, 1, SASH);
  } else { // back: number 9
    R(bodyX + 3, ty, 2, 1, SHIRT_D);
    const nine = ['111', '101', '111', '001', '111'];
    nine.forEach((row, r) => [...row].forEach((b, c) => { if (b === '1') R(bodyX + 2 + c, ty + 1 + r, 1, 1, SASH); }));
  }

  // ----- head -----
  const hx = side ? 6 - L : 5;
  const hy = 1 + crouch;
  R(hx + (side ? 1 : 0), 7 + crouch, 2, 1, SKIN_D); // neck
  if (side) {
    R(hx, hy + 1, 5, 6, SKIN);
    R(hx - 1, hy, 6, 2, HAIR); R(hx - 1, hy + 2, 2, 2, HAIR);
    R(hx + 1, hy + 3, 1, 1, SKIN_D); // ear
    R(hx + 3, hy + 3, 1, 1, HAIR);   // eye
    R(hx + 4, hy + 5, 1, 1, SKIN_D); // mouth
    if (p.arms === 'up' || p.arms === 'upHalf') R(hx + 3, hy + 5, 2, 1, PAL.black); // shouting
  } else if (p.view === 'front') {
    R(hx, hy + 1, 6, 6, SKIN);
    R(hx, hy, 6, 2, HAIR);
    R(hx + 1, hy + 3, 1, 1, HAIR); R(hx + 4, hy + 3, 1, 1, HAIR);
    R(hx + 2, hy + 5, 2, 1, PAL.black); // open mouth: SIUUU
  } else {
    R(hx, hy + 1, 6, 6, SKIN);
    R(hx, hy, 6, 5, HAIR);
  }

  // ----- front arm(s) -----
  const sy = 9 + crouch;
  if (side) {
    const sx = bodyX + bodyW - 1;
    switch (p.arms) {
      case 'hold': break;
      case 'pull': R.line(sx, sy, sx + 4 + L, sy + 4, SKIN, 2); R(sx, sy, 2, 2, SHIRT); break;
      case 'forward': R.line(sx, sy, sx + 5, sy - 1, SKIN, 2); R(sx, sy, 2, 2, SHIRT); break;
      case 'up': R(sx, sy - 8, 2, 9, SKIN); R(sx - 1, sy - 9, 3, 2, SKIN); R(sx, sy, 2, 2, SHIRT); break;
      case 'upHalf': R.line(sx, sy, sx + 2, sy - 5, SKIN, 2); R(sx + 1, sy - 6, 3, 2, SKIN); R(sx, sy, 2, 2, SHIRT); break;
      case 'up2': R.line(sx, sy, sx + 2, sy - 7, SKIN, 2); R(sx, sy, 2, 2, SHIRT); break;
      case 'wide': R.line(sx, sy, sx + 4, sy + 4, SKIN, 2); R(sx, sy, 2, 2, SHIRT); break;
      default: R(sx, sy, 2, 2, SHIRT); R(sx, sy + 2, 2, 3, SKIN);
    }
  } else {
    if (p.arms === 'wide') {
      R.line(3, sy, 0, sy + 5, SKIN, 2); R(2, sy, 2, 2, SHIRT);
      R.line(12, sy, 14, sy + 5, SKIN, 2); R(12, sy, 2, 2, SHIRT);
    } else if (p.arms === 'up2') {
      R.line(3, sy, 1, sy - 7, SKIN, 2); R.line(12, sy, 14, sy - 7, SKIN, 2);
      R(2, sy, 2, 2, SHIRT); R(12, sy, 2, 2, SHIRT);
    } else {
      R(2, sy, 2, 2, SHIRT); R(2, sy + 2, 2, 3, SKIN); R(12, sy, 2, 2, SHIRT); R(12, sy + 2, 2, 3, SKIN);
    }
  }
}
