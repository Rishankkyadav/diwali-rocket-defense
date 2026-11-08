import {
  G, THRUST, BURN_TIME, DRAG_K, LAUNCH_SPEED, LAUNCH_POINT, MAX_FLIGHT, DT,
  PX_PER_M, GROUND_Y, AIM_ANGLE_MIN, AIM_ANGLE_MAX, PREVIEW_DOT_DT,
} from './config.js';

// ---- Units ----
export const toScreenX = (x) => x * PX_PER_M;
export const toScreenY = (y) => GROUND_Y - y * PX_PER_M;
export const toWorldX = (px) => px / PX_PER_M;
export const toWorldY = (py) => (GROUND_Y - py) / PX_PER_M;
export const LAUNCH_PX = { x: toScreenX(LAUNCH_POINT.x), y: toScreenY(LAUNCH_POINT.y) };

export function makeRocketState(angleDeg, v0 = LAUNCH_SPEED) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: LAUNCH_POINT.x, y: LAUNCH_POINT.y,
    vx: v0 * Math.cos(a), vy: v0 * Math.sin(a),
    burnLeft: BURN_TIME, t: 0,
  };
}

// Semi-implicit Euler, as in the design doc.
export function stepRocket(r, wind, dt) {
  let ax = 0, ay = -G;
  if (r.burnLeft > 0) {                 // thrust along velocity
    const s = Math.hypot(r.vx, r.vy) || 1;
    ax += (THRUST * r.vx) / s;
    ay += (THRUST * r.vy) / s;
    r.burnLeft -= dt;
  }
  const rx = r.vx - wind, ry = r.vy;    // velocity relative to air
  const rs = Math.hypot(rx, ry);
  ax -= DRAG_K * rs * rx;
  ay -= DRAG_K * rs * ry;
  r.vx += ax * dt; r.vy += ay * dt;     // velocity first
  r.x += r.vx * dt; r.y += r.vy * dt;   // then position
  r.t += dt;
}

// Height of a no-wind shot when it first reaches x = tx (null if it lands first).
function heightAt(angle, tx, dt) {
  const r = makeRocketState(angle);
  while (r.t < MAX_FLIGHT) {
    stepRocket(r, 0, dt);
    if (r.x >= tx) return r.y;
    if (r.y <= 0) return null;
  }
  return null;
}

// Golf-style aim: given a target point (metres), find the launch angle whose
// no-wind path passes through it. Takes the low, direct branch, so close
// targets get a near-straight shot and far ones get a lob.
export function solveAim(tx, ty) {
  const COARSE = 1 / 60;
  let prevA = null;
  let best = { a: 40, h: -Infinity };
  for (let a = AIM_ANGLE_MIN; a <= AIM_ANGLE_MAX; a += 0.5) {
    const h = heightAt(a, tx, COARSE);
    if (h !== null && h > best.h) best = { a, h };
    if (h !== null && h >= ty) {
      // bisect between the last angle that passed under the target and this one
      let lo = prevA === null ? a - 0.5 : prevA, hi = a;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const hm = heightAt(mid, tx, DT);
        if (hm !== null && hm >= ty) hi = mid; else lo = mid;
      }
      return { angle: hi, reachable: true };
    }
    prevA = a;
  }
  return { angle: best.a, reachable: false };
}

// No-wind flight path for the preview: dots up to the target x (or landing).
export function previewPath(angle, tx) {
  const r = makeRocketState(angle);
  const pts = [];
  let next = PREVIEW_DOT_DT;
  while (r.t < MAX_FLIGHT && r.y > 0 && r.x < tx) {
    stepRocket(r, 0, DT);
    if (r.t >= next) { pts.push({ x: r.x, y: Math.max(0, r.y) }); next += PREVIEW_DOT_DT; }
  }
  return pts;
}

// Full-flight simulation, used by tests / tuning.
export function simulateShot(angle, wind = 0) {
  const r = makeRocketState(angle);
  while (r.t < MAX_FLIGHT && r.y > 0) stepRocket(r, wind, DT);
  return { x: r.x, y: r.y, t: r.t };
}

// ---- Collision helpers (metres) ----
export function distPointRect(px, py, rect) {
  const cx = Math.max(rect.x0, Math.min(px, rect.x1));
  const cy = Math.max(rect.y0, Math.min(py, rect.y1));
  return Math.hypot(px - cx, py - cy);
}
export function circleHitsRect(cx, cy, r, rect) {
  return distPointRect(cx, cy, rect) <= r;
}
