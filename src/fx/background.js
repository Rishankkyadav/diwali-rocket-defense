// Diwali-at-dusk scene: sky, far skyline, near skyline with lights, street, and your house.
import { PAL, RAMPS, W, H, GROUND_Y } from '../config.js';
import { makeCanvas, seeded, fillCircle } from '../gfx.js';

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const LIGHT_COLS = [PAL.red2, PAL.gold, PAL.green, PAL.cyan, PAL.pink, PAL.yellow];
const FAR_Y = 100, NEAR_Y = 110;

export class Background {
  constructor() {
    this.rng = seeded(1408);
    this.windows = [];
    this.strings = [];
    this.lanterns = [];
    this.rangolis = [];
    this.smoke = [];
    this.smokeT = 0;
    this.smokeSrc = { x: 0, y: 0 };
    this.stars = [];
    this.buildSky();
    this.buildFar();
    this.buildNear();
    this.buildStreet();
    this.buildHouse();
  }

  // ---------- prerender ----------
  buildSky() {
    const [c, ctx] = makeCanvas(W, H);
    const bands = [[0, PAL.black], [40, PAL.navy], [76, PAL.navy2], [110, PAL.purple], [142, PAL.magenta], [172, PAL.rose], [200, PAL.tan], [228, PAL.gold], [999, PAL.gold]];
    for (let i = 0; i < bands.length - 1; i++) {
      const [y0, col] = bands[i];
      const y1 = Math.min(H, bands[i + 1][0]);
      ctx.fillStyle = col; ctx.fillRect(0, y0, W, y1 - y0);
      const next = bands[i + 1][1];
      // ordered-dither transition into the next band
      for (let y = y1 - 8; y < y1; y++) {
        const d = (y - (y1 - 8) + 1) / 9;
        ctx.fillStyle = next;
        for (let x = 0; x < W; x++) if ((BAYER[y & 3][x & 3] + 0.5) / 16 < d) ctx.fillRect(x, y, 1, 1);
      }
    }
    this.sky = c;
    const r = seeded(77);
    for (let i = 0; i < 45; i++) this.stars.push({ x: Math.floor(r() * W), y: Math.floor(r() * 95), ph: r() * 6.28, sp: 1 + r() * 3, big: r() < 0.12 });
  }

  buildFar() {
    const Hh = 150;
    const [c, ctx] = makeCanvas(W + 4, Hh);
    const r = this.rng;
    const col = PAL.purple;
    ctx.fillStyle = col;
    const lights = [];
    let x = -6;
    while (x < W + 4) {
      const w = 12 + Math.floor(r() * 16), h = 40 + Math.floor(r() * 70);
      ctx.fillStyle = col; ctx.fillRect(x, Hh - h, w, h);
      if (r() < 0.4) ctx.fillRect(x + Math.floor(w / 2), Hh - h - 6, 1, 6); // antenna
      for (let yy = Hh - h + 3; yy < Hh - 4; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) if (r() < 0.12) lights.push([xx, yy]);
      x += w + Math.floor(r() * 6) - 2;
    }
    // landmarks: temple shikhara and domes
    const shikhara = (sx, w, h) => {
      ctx.fillStyle = col;
      for (let j = 0; j < h; j++) {
        const p = j / h;
        let half = (w / 2) * (1 - Math.pow(p, 2.4));
        if (j % 6 < 1) half += 1; // horizontal ridges
        ctx.fillRect(Math.round(sx + w / 2 - half), Hh - 1 - j, Math.round(half * 2), 1);
      }
      ctx.fillRect(sx + w / 2 - 2, Hh - h - 2, 4, 2);     // kalash
      ctx.fillRect(sx + w / 2 - 1, Hh - h - 4, 2, 2);
      ctx.fillRect(sx + w / 2, Hh - h - 10, 1, 7);        // flag pole
      ctx.fillStyle = PAL.orange; ctx.fillRect(sx + w / 2 + 1, Hh - h - 10, 3, 1); ctx.fillRect(sx + w / 2 + 1, Hh - h - 9, 2, 1);
      ctx.fillStyle = col;
      ctx.fillRect(sx - 8, Hh - 30, w + 16, 30); // mandapa base
    };
    const dome = (sx, w, base) => {
      ctx.fillStyle = col;
      const rr = Math.floor(w / 2);
      ctx.fillRect(sx, Hh - base, w, base);
      fillCircle(ctx, sx + rr, Hh - base, rr - 1, col);
      ctx.fillRect(sx + rr, Hh - base - rr - 4, 1, 4);
      // minarets
      for (const mx of [sx - 4, sx + w + 2]) {
        ctx.fillRect(mx, Hh - base - 22, 3, base + 22);
        fillCircle(ctx, mx + 1, Hh - base - 22, 2, col);
      }
    };
    shikhara(140, 28, 108);
    dome(296, 34, 34);
    dome(418, 24, 26);
    shikhara(40, 18, 72);
    for (const [lx, ly] of lights) { ctx.fillStyle = r() < 0.5 ? PAL.magenta : PAL.rose; ctx.fillRect(lx, ly, 1, 1); }
    this.far = c;
  }

  buildNear() {
    const Hh = 140;
    const [c, ctx] = makeCanvas(W, Hh);
    const r = seeded(2024);
    const body = PAL.plumD, rim = PAL.purple;
    let x = 46;
    const buildings = [];
    while (x < W) {
      const w = 34 + Math.floor(r() * 28), h = 50 + Math.floor(r() * 50);
      buildings.push({ x, w, h, top: Hh - h });
      x += w + 2 + Math.floor(r() * 4);
    }
    let smokeB = buildings.reduce((best, b) => (Math.abs(b.x - 250) < Math.abs(best.x - 250) ? b : best), buildings[0]);
    for (const b of buildings) {
      ctx.fillStyle = body; ctx.fillRect(b.x, b.top, b.w, b.h);
      ctx.fillStyle = rim; ctx.fillRect(b.x, b.top, b.w, 1); ctx.fillRect(b.x, b.top, 1, b.h);
      // parapet notches
      ctx.fillStyle = body; ctx.fillRect(b.x, b.top - 2, 2, 2); ctx.fillRect(b.x + b.w - 2, b.top - 2, 2, 2);
      // water tank
      if (r() < 0.55 && b !== smokeB) {
        const tx = b.x + 4 + Math.floor(r() * (b.w - 14));
        ctx.fillStyle = PAL.navy; ctx.fillRect(tx, b.top - 9, 8, 6); ctx.fillRect(tx + 1, b.top - 3, 1, 3); ctx.fillRect(tx + 6, b.top - 3, 1, 3);
        ctx.fillStyle = PAL.navy2; ctx.fillRect(tx, b.top - 9, 8, 1);
      }
      if (b === smokeB) {
        const px = b.x + Math.floor(b.w / 2);
        ctx.fillStyle = PAL.grey3; ctx.fillRect(px, b.top - 8, 3, 8); ctx.fillStyle = PAL.navy2; ctx.fillRect(px - 1, b.top - 9, 5, 2);
        this.smokeSrc = { x: px + 1, y: NEAR_Y + b.top - 10 };
      }
      // windows on a grid
      for (let fy = b.top + 5; fy < Hh - 14; fy += 12) {
        for (let wx = b.x + 4; wx < b.x + b.w - 5; wx += 8) {
          ctx.fillStyle = PAL.navy; ctx.fillRect(wx, fy, 3, 4);
          if (r() < 0.6) this.windows.push({ x: wx, y: NEAR_Y + fy, col: [PAL.gold, PAL.orange, PAL.yellow, PAL.gold][Math.floor(r() * 4)], ph: r() * 10, flick: r() < 0.25 });
        }
        if (r() < 0.35) { // balcony
          const bw = Math.min(16, b.w - 8), bx = b.x + 4 + Math.floor(r() * (b.w - bw - 6));
          ctx.fillStyle = rim; ctx.fillRect(bx, fy + 6, bw, 1);
          for (let i = 0; i < bw; i += 2) ctx.fillRect(bx + i, fy + 7, 1, 2);
          ctx.fillRect(bx, fy + 9, bw, 1);
        }
      }
      // ground-floor door with warm light + rangoli on the step
      const dx = b.x + Math.floor(b.w / 2) - 3;
      ctx.fillStyle = PAL.brownD; ctx.fillRect(dx - 1, Hh - 11, 8, 11);
      ctx.fillStyle = PAL.gold; ctx.fillRect(dx, Hh - 10, 6, 10);
      ctx.fillStyle = PAL.orange; ctx.fillRect(dx, Hh - 10, 1, 10);
      this.rangolis.push(dx + 3);
      // fairy lights along the roof
      const pts = [];
      for (let i = 1; i < b.w - 1; i += 3) {
        const p = i / b.w;
        pts.push({ x: b.x + i, y: NEAR_Y + b.top + 2 + Math.round(Math.sin(p * Math.PI) * 5) });
      }
      this.strings.push(pts);
    }
    // a long string from your house roof to the first building
    const b0 = buildings[0];
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const p = i / 20;
      pts.push({ x: Math.round(40 + (b0.x + 3 - 40) * p), y: Math.round(171 + (NEAR_Y + b0.top + 3 - 171) * p + Math.sin(p * Math.PI) * 8) });
    }
    this.strings.push(pts);
    this.near = c;
    this.lanterns = [150, 290, 430].map((lx, i) => ({ x: lx, ph: i * 1.7 }));
  }

  buildStreet() {
    const [c, ctx] = makeCanvas(W, H - GROUND_Y);
    ctx.fillStyle = PAL.navy; ctx.fillRect(0, 0, W, H - GROUND_Y);
    ctx.fillStyle = PAL.grey3; ctx.fillRect(0, 0, W, 1);
    ctx.fillStyle = PAL.navy2; ctx.fillRect(0, 1, W, 2);
    ctx.fillStyle = PAL.grey3;
    for (let x = 6; x < W; x += 22) ctx.fillRect(x, 13, 9, 1);
    // rangoli outlines on doorsteps
    const motif = (cx, cy, big) => {
      const cols = [PAL.pink, PAL.gold, PAL.cyan, PAL.green];
      const rr = big ? 5 : 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.fillStyle = cols[i % 4];
        ctx.fillRect(Math.round(cx + Math.cos(a) * rr * 2), Math.round(cy + Math.sin(a) * rr * 0.6), 1, 1);
      }
      ctx.fillStyle = PAL.gold; ctx.fillRect(cx - 1, cy, 3, 1);
      ctx.fillStyle = PAL.pink; ctx.fillRect(cx, cy - 1, 1, 1); ctx.fillRect(cx, cy + 1, 1, 1);
      ctx.fillStyle = PAL.white; ctx.fillRect(cx - rr, cy, 1, 1); ctx.fillRect(cx + rr, cy, 1, 1);
    };
    for (const x of this.rangolis) motif(x, 6, false);
    motif(48, 7, true);
    this.street = c;
  }

  buildHouse() {
    const [c, ctx] = makeCanvas(42, 104); // covers y 146..250
    const oy = 24; // canvas y of the roof line (screen 170)
    const f = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y + oy, w, h); };
    f(0, 2, 40, 78, PAL.skin2);           // wall
    f(37, 2, 3, 78, PAL.brown);           // shade
    f(0, 76, 40, 4, PAL.brownD);          // plinth
    f(0, 0, 41, 2, PAL.grey2);            // roof slab
    f(0, 2, 41, 1, PAL.grey3);
    f(27, -4, 13, 4, PAL.skin2);          // parapet
    f(27, -4, 13, 1, PAL.peach);
    // windows
    for (const wy of [12, 40]) {
      f(7, wy, 13, 13, PAL.brownD);
      f(8, wy + 1, 11, 11, PAL.gold);
      f(8, wy + 1, 11, 2, PAL.yellow);
      f(13, wy + 1, 1, 11, PAL.brownD); f(8, wy + 6, 11, 1, PAL.brownD);
      f(6, wy + 13, 15, 1, PAL.peach);    // sill
    }
    // door
    f(29, 58, 10, 18, PAL.brownD);
    f(30, 59, 8, 17, PAL.brown);
    f(31, 61, 2, 6, PAL.rust); f(35, 61, 2, 6, PAL.rust); f(31, 69, 2, 5, PAL.rust); f(35, 69, 2, 5, PAL.rust);
    f(31, 67, 1, 1, PAL.gold);
    // toran over the door
    for (let i = 0; i < 11; i++) { f(28 + i, 56, 1, 1, i % 2 ? PAL.orange : PAL.green); if (i % 2 === 0) f(28 + i, 57, 1, 2, PAL.green2); }
    // lantern pole on roof (left)
    f(1, -22, 1, 22, PAL.grey3); f(1, -22, 4, 1, PAL.grey3);
    // launch bottle
    f(24, -4, 3, 4, PAL.green3); f(25, -6, 1, 2, PAL.green3); f(24, -3, 1, 2, PAL.green);
    this.house = c;
    this.houseY = 170 - oy;
  }

  // ---------- per-frame ----------
  update(dt, wind) {
    this.smokeT += dt;
    while (this.smokeT > 0.09) {
      this.smokeT -= 0.09;
      this.smoke.push({ x: this.smokeSrc.x + Math.random() * 2, y: this.smokeSrc.y, vx: (Math.random() - 0.5) * 3, vy: -9 - Math.random() * 4, life: 0, max: 2.6 + Math.random() });
    }
    for (const s of this.smoke) {
      s.life += dt;
      s.vx += (wind * 7 - s.vx) * Math.min(1, dt * 1.5);
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vy *= 1 - 0.4 * dt;
    }
    this.smoke = this.smoke.filter((s) => s.life < s.max);
  }

  drawSky(ctx, t) {
    ctx.drawImage(this.sky, 0, 0);
    for (const s of this.stars) {
      const v = Math.sin(t * s.sp + s.ph);
      if (v < -0.6) continue;
      ctx.fillStyle = v > 0.7 ? PAL.white : PAL.grey2;
      ctx.fillRect(s.x, s.y, 1, 1);
      if (s.big && v > 0.8) { ctx.fillStyle = PAL.grey2; ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); ctx.fillStyle = PAL.white; ctx.fillRect(s.x, s.y, 1, 1); }
    }
  }

  drawFar(ctx, shakeX, shakeY) {
    ctx.drawImage(this.far, -2 + Math.round(shakeX * 0.2), FAR_Y + Math.round(shakeY * 0.2));
  }

  drawNear(ctx, t) {
    ctx.drawImage(this.near, 0, NEAR_Y);
    // flickering windows
    for (const w of this.windows) {
      if (w.flick && Math.sin(t * 7 + w.ph) + Math.sin(t * 13.1 + w.ph * 2) > 1.5) continue;
      ctx.fillStyle = w.col; ctx.fillRect(w.x, w.y, 3, 4);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(w.x, w.y, 3, 1);
    }
    // smoke plume (shows the wind)
    for (const s of this.smoke) {
      const p = s.life / s.max;
      ctx.fillStyle = RAMPS.smoke[Math.min(3, Math.floor(p * 4))];
      const sz = p < 0.3 ? 1 : p < 0.7 ? 2 : 3;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), sz, sz);
    }
    // fairy lights twinkle in sequence
    const step = Math.floor(t * 6);
    for (const pts of this.strings) {
      ctx.fillStyle = PAL.black;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        ctx.fillRect(a.x, a.y, Math.max(1, b.x - a.x), 1);
      }
      pts.forEach((p, i) => {
        const on = (i + step) % 4 !== 0;
        ctx.fillStyle = on ? LIGHT_COLS[(i + Math.floor(step / 4)) % LIGHT_COLS.length] : PAL.plumD;
        ctx.fillRect(p.x, p.y + 1, 1, 1);
      });
    }
    // street
    ctx.drawImage(this.street, 0, GROUND_Y);
    // lantern poles
    for (const l of this.lanterns) {
      ctx.fillStyle = PAL.grey3; ctx.fillRect(l.x, GROUND_Y - 30, 1, 30); ctx.fillRect(l.x, GROUND_Y - 30, 5, 1);
      const sway = Math.round(Math.sin(t * 2 + l.ph));
      const lx = l.x + 4 + sway, ly = GROUND_Y - 28;
      // dithered glow
      ctx.fillStyle = PAL.orange;
      for (let yy = -5; yy <= 9; yy++) for (let xx = -6; xx <= 7; xx++) {
        if ((xx + yy) & 1) continue;
        const d = Math.hypot(xx - 0.5, yy - 2);
        if (d < 7 && d > 3) ctx.fillRect(lx + xx, ly + yy, 1, 1);
      }
      ctx.fillStyle = PAL.black; ctx.fillRect(lx, ly, 1, 1);
      ctx.fillStyle = PAL.red2; ctx.fillRect(lx - 1, ly + 1, 3, 5);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(lx, ly + 2, 1, 3);
      ctx.fillStyle = PAL.gold; ctx.fillRect(lx - 1, ly + 6, 3, 1);
    }
  }

  drawHouse(ctx, t) {
    ctx.drawImage(this.house, 0, this.houseY);
    // diya flames on the parapet (4-frame flicker each)
    [29, 33, 37].forEach((x, i) => {
      const f = (Math.floor(t * 8) + i * 3) % 4;
      ctx.fillStyle = PAL.clay; ctx.fillRect(x - 1, 164, 3, 1); ctx.fillStyle = PAL.rust; ctx.fillRect(x, 165, 1, 1);
      const shapes = [[0, -1, 1, 2], [0, -2, 1, 3], [-1, -1, 1, 2], [1, -2, 1, 3]];
      const [ox, oy, w, h] = shapes[f];
      ctx.fillStyle = PAL.gold; ctx.fillRect(x + ox, 163 + oy, w, h);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(x, 163, 1, 1);
      if (f === 1) { ctx.fillStyle = PAL.white; ctx.fillRect(x, 162, 1, 1); }
    });
    // roof-edge fairy lights
    const step = Math.floor(t * 5);
    for (let x = 1, i = 0; x < 40; x += 3, i++) {
      ctx.fillStyle = (i + step) % 3 === 0 ? PAL.plumD : LIGHT_COLS[(i + step) % LIGHT_COLS.length];
      ctx.fillRect(x, 173 + (i % 2), 1, 1);
    }
    // akash kandil (star lantern), swaying from the roof pole
    const sway = Math.round(Math.sin(t * 1.6));
    const lx = 3 + sway, ly = 150;
    ctx.fillStyle = PAL.grey3; ctx.fillRect(4, 149, 1, 2);
    const star = ['..#..', '.###.', '#####', '.###.', '..#..'];
    star.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (ch === '#') { ctx.fillStyle = (rx + ry) % 2 ? PAL.red2 : PAL.gold; ctx.fillRect(lx - 1 + rx, ly + ry, 1, 1); }
    }));
    ctx.fillStyle = PAL.yellow; ctx.fillRect(lx + 1, ly + 2, 1, 1);
    ctx.fillStyle = PAL.gold; ctx.fillRect(lx, ly + 5, 1, 2 + (Math.floor(t * 3) % 2)); ctx.fillRect(lx + 2, ly + 5, 1, 2);
  }
}
