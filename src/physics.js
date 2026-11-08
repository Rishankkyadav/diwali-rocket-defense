import {
  G, THRUST, BURN_TIME, DRAG_K, V_MIN, V_MAX, LAUNCH_POINT, MAX_FLIGHT, DT,
  PX_PER_M, GROUND_Y, MAX_PULL, ANGLE_MIN, ANGLE_MAX, PREVIEW_DOT_DT, PREVIEW_FRACTION,
} from './config.js';

// ---- Units ----
export const toScreenX = (x) => x * PX_PER_M;
export const toScreenY = (y) => GROUND_Y - y * PX_PER_M;
export const LAUNCH_PX = { x: toScreenX(LAUNCH_POINT.x), y: toScreenY(LAUNCH_POINT.y) };

export function makeRocketState(angleDeg, v0) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: LAUNCH_POINT.x, y: LAUNCH_POINT.y,
    vx: v0 * Math.cos(a), vy: v0 * Math.sin(a),
    burnLeft: BURN_TIME, t: 0,
  };
}

// Semi-implicit Euler, exactly as in the design doc.
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

// Turn a pull vector (screen px, anchor − pointer) into a shot.
export function shotFromPull(dx, dy) {
  const len = Math.min(Math.hypot(dx, dy), MAX_PULL);
  const t = len / MAX_PULL;
  // screen y points down; pulling the pointer *down* aims *up*
  let ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (ang > ANGLE_MAX || ang < ANGLE_MIN) {
    // snap to whichever limit is closer around the circle, so the aim never jumps wildly
    const toMax = (((ang - ANGLE_MAX) % 360) + 360) % 360;
    const toMin = (((ANGLE_MIN - ang) % 360) + 360) % 360;
    ang = toMax <= toMin ? ANGLE_MAX : ANGLE_MIN;
  }
  const v0 = V_MIN + (V_MAX - V_MIN) * t;
  return { len, power: t, angle: ang, v0 };
}

// Simulate a full shot without wind (preview). Returns dots for the first 40% of flight.
export function previewDots(angle, v0) {
  const r = makeRocketState(angle, v0);
  const pts = [{ x: r.x, y: r.y, t: 0 }];
  let next = PREVIEW_DOT_DT;
  while (r.t < MAX_FLIGHT && r.y > 0) {
    stepRocket(r, 0, DT);
    if (r.t >= next - 1e-9) { pts.push({ x: r.x, y: r.y, t: r.t }); next += PREVIEW_DOT_DT; }
  }
  pts.push({ x: r.x, y: Math.max(0, r.y), t: r.t, landed: r.y <= 0 }); // where it comes down
  const cutoff = r.t * PREVIEW_FRACTION + 1e-9;
  return pts.filter((p) => p.t <= cutoff);
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
