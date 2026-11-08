// Shoulder-mounted rocket launcher: a green tube with gold Diwali bands,
// a flared rear, a sight, two grips, and (when loaded) the rocket's nose in the muzzle.
import { PAL } from '../config.js';
import { makeRotFrames, drawRotFrame } from '../gfx.js';

const BASE = [
  '.........ss.............',
  'RkHHHHbHHHHHHHHHHbHHMM..',
  'RkTTTTbTTTTTTTTTTbTTMM..',
  'RkDDDDbDDDDDDDDDDbDDMM..',
  '........gg..gg..........',
  '.........g...g..........',
];
const LOADED = BASE.map((row, i) => (i === 2 ? row.slice(0, 22) + 'nw' : i === 1 || i === 3 ? row.slice(0, 22) + 'n.' : row));
const COLS = {
  R: PAL.navy2, k: PAL.grey2, H: PAL.green, T: PAL.green2, D: PAL.green3, b: PAL.gold,
  M: PAL.grey3, s: PAL.grey1, g: PAL.navy, n: PAL.red2, w: PAL.white,
};
const PX = 7, PY = 2;   // pivot (sits on the shoulder)
const HALF = 17;
export const MUZZLE = 16;  // px from pivot to muzzle
export const REAR = 8;     // px from pivot to rear opening
export const GRIP_TRIGGER = { u: 1.5, v: 3 };
export const GRIP_FRONT = { u: 5.5, v: 3 };

let frames = null;
export function drawLauncher(ctx, x, y, heading, loaded) {
  if (!frames) frames = { empty: makeRotFrames(BASE, COLS, PX, PY, HALF), loaded: makeRotFrames(LOADED, COLS, PX, PY, HALF) };
  drawRotFrame(ctx, loaded ? frames.loaded : frames.empty, HALF, x, y, heading);
}

// Point on the launcher at (u along the tube, v across it) in screen space.
export function launcherPoint(x, y, heading, u, v) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return { x: x + u * c - v * s, y: y + u * s + v * c };
}
