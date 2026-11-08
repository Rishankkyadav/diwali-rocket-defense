// Pixel drawing helpers. Everything snaps to whole pixels.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// A "brush" for drawing a sprite in local coordinates, optionally mirrored horizontally.
// override: draw every pixel in one colour (used for the white hit flash).
export function brush(ctx, ox, oy, spriteW, flip = false, override = null) {
  ox = Math.round(ox); oy = Math.round(oy);
  const rect = (x, y, w, h, c) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = override || c;
    const X = flip ? ox + (spriteW - x - w) : ox + x;
    ctx.fillRect(X, oy + y, w, h);
  };
  // thick pixel line (Bresenham)
  rect.line = (x0, y0, x1, y1, c, t = 1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      rect(x0, y0, t, t, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  return rect;
}

export function pixelLine(ctx, x0, y0, x1, y1, color, t = 1) {
  brush(ctx, 0, 0, 0).line(x0, y0, x1, y1, color, t);
}

export function fillCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

export function ringCircle(ctx, cx, cy, r, color, thickness = 1, gapEvery = 0) {
  ctx.fillStyle = color;
  cx = Math.round(cx); cy = Math.round(cy);
  const steps = Math.max(12, Math.round(r * 7));
  for (let i = 0; i < steps; i++) {
    if (gapEvery && i % gapEvery === 0) continue;
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), thickness, thickness);
  }
}

// Deterministic RNG for the skyline so it looks the same every run.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerpColorIndex(ramp, f) {
  return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(f * ramp.length)))];
}
