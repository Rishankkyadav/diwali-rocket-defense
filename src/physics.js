import {
  G, THRUST, BURN_TIME, DRAG_K, LAUNCH_POINT, MAX_FLIGHT, DT, V_MIN, V_MAX, MAX_PULL,
  PX_PER_M, GROUND_Y, AIM_ANGLE_MIN, AIM_ANGLE_MAX, PREVIEW_DOT_DT, ROCKET_RADIUS,
} from './config.js';

// ---- Units ----
export const toScreenX = (x) => x * PX_PER_M;
export const toScreenY = (y) => GROUND_Y - y * PX_PER_M;
export const toWorldX = (px) => px / PX_PER_M;
export const toWorldY = (py) => (GROUND_Y - py) / PX_PER_M;
export const LAUNCH_PX = { x: toScreenX(LAUNCH_POINT.x), y: toScreenY(LAUNCH_POINT.y) };

export function makeRocketState(angleDeg, v0) {
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

// Slingshot: pull vector (screen px, press point − pointer) → shot.
// The aim is the pull direction; anything outside the allowed range snaps to the
// nearer limit, so the aim never flips or jumps.
// prevAngle: the aim from the last frame. When the pull points "backwards" we stay on
// whichever limit you were already nearest, instead of flipping between up and down.
export function shotFromPull(dx, dy, prevAngle = null) {
  const len = Math.min(Math.hypot(dx, dy), MAX_PULL);
  let ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // screen y is down
  if (ang > AIM_ANGLE_MAX || ang < AIM_ANGLE_MIN) {
    if (prevAngle !== null) {
      ang = Math.abs(prevAngle - AIM_ANGLE_MAX) <= Math.abs(prevAngle - AIM_ANGLE_MIN) ? AIM_ANGLE_MAX : AIM_ANGLE_MIN;
    } else {
      const toMax = (((ang - AIM_ANGLE_MAX) % 360) + 360) % 360;
      const toMin = (((AIM_ANGLE_MIN - ang) % 360) + 360) % 360;
      ang = toMax <= toMin ? AIM_ANGLE_MAX : AIM_ANGLE_MIN;
    }
  }
  const power = len / MAX_PULL;
  return { len, power, angle: ang, v0: V_MIN + (V_MAX - V_MIN) * power };
}

// No-wind preview of the whole flight. Stops where it would hit a zombie
// (as they stand right now) or the ground.
export function previewShot(angle, v0, zombies = []) {
  const r = makeRocketState(angle, v0);
  const pts = [];
  let next = PREVIEW_DOT_DT, hit = null;
  while (r.t < MAX_FLIGHT && r.y > 0) {
    stepRocket(r, 0, DT);
    if (r.t >= next) { pts.push({ x: r.x, y: Math.max(0, r.y) }); next += PREVIEW_DOT_DT; }
    hit = zombies.find((z) => !z.dead && circleHitsRect(r.x, r.y, ROCKET_RADIUS, z.rect));
    if (hit) break;
  }
  return { pts, hit, end: { x: r.x, y: Math.max(0, r.y) }, landed: r.y <= 0 };
}

// Full-flight simulation, used by tests / tuning.
export function simulateShot(angle, v0, wind = 0) {
  const r = makeRocketState(angle, v0);
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
