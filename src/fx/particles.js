// Particles (screen px), explosion sprites, floating text and ambient background fireworks.
import { PAL, RAMPS, W } from '../config.js';
import { fillCircle, ringCircle } from '../gfx.js';
import { drawText } from '../ui/font.js';
import * as audio from '../audio.js';

export class Particles {
  constructor(max = 1500) { this.list = []; this.max = max; }
  spawn(x, y, vx, vy, life, ramp, size = 1, gravity = 60, drag = 1.5, flicker = false) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, vx, vy, life, max: life, ramp, size, gravity, drag, flicker });
  }
  burst(x, y, n, ramps, { speed = [30, 110], life = [0.6, 1.3], gravity = 50, drag = 1.6, size = [1, 2], flicker = true } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed[0] + Math.random() * (speed[1] - speed[0]);
      const ramp = ramps[i % ramps.length];
      const sz = Math.random() < 0.25 ? size[1] : size[0];
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life[0] + Math.random() * (life[1] - life[0]), ramp, sz, gravity, drag, flicker);
    }
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l[i] = l[l.length - 1]; l.pop(); continue; }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(ctx, rampOffset = 0) {
    for (const p of this.list) {
      const f = 1 - p.life / p.max;
      if (p.flicker && p.life < p.max * 0.35 && Math.random() < 0.35) continue;
      const idx = Math.min(p.ramp.length - 1, Math.floor(f * p.ramp.length) + rampOffset);
      ctx.fillStyle = p.ramp[idx];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
}

// 32×32, 6-frame procedural explosion that pairs with particles.
const EXPLO_FRAMES = [
  (c, x, y) => { fillCircle(c, x, y, 4, PAL.white); },
  (c, x, y) => { fillCircle(c, x, y, 8, PAL.yellow); fillCircle(c, x, y, 5, PAL.white); },
  (c, x, y) => { fillCircle(c, x, y, 11, PAL.gold); fillCircle(c, x, y, 8, PAL.yellow); fillCircle(c, x, y, 4, PAL.white); },
  (c, x, y) => { ringCircle(c, x, y, 13, PAL.orange, 2); ringCircle(c, x, y, 10, PAL.gold, 2); },
  (c, x, y) => { ringCircle(c, x, y, 14, PAL.rust, 1, 3); ringCircle(c, x, y, 11, PAL.orange, 1, 2); },
  (c, x, y) => { ringCircle(c, x, y, 15, PAL.brownD, 1, 2); },
];

export class FX {
  constructor() {
    this.particles = new Particles();
    this.explosions = [];
    this.texts = [];
  }
  explosion(x, y, scale = 1) { this.explosions.push({ x, y, t: 0, scale }); }
  text(str, x, y, { color = PAL.yellow, scale = 1, life = 1.1, vy = -14, outline = PAL.black, pop = true } = {}) {
    this.texts.push({ str, x, y, t: 0, life, color, scale, vy, outline, pop });
  }
  clear() { this.particles.list.length = 0; this.explosions.length = 0; this.texts.length = 0; }
  update(dt) {
    this.particles.update(dt);
    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter((e) => e.t < 0.3);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 1 - 2 * dt; }
    this.texts = this.texts.filter((t) => t.t < t.life);
  }
  drawWorld(ctx) {
    for (const e of this.explosions) {
      const f = Math.min(5, Math.floor(e.t / 0.05));
      EXPLO_FRAMES[f](ctx, e.x, e.y);
    }
    this.particles.draw(ctx);
  }
  drawTexts(ctx) {
    for (const t of this.texts) {
      if (t.t > t.life - 0.25 && Math.floor(t.t * 20) % 2) continue; // blink out
      const s = t.pop && t.t < 0.08 ? t.scale + 1 : t.scale;
      drawText(ctx, t.str, t.x, Math.round(t.y), { scale: s, color: t.color, outline: t.outline, align: 'center' });
    }
  }
}

// Background fireworks: dimmer ramps so they never compete with your rockets.
export class AmbientFireworks {
  constructor() { this.shells = []; this.parts = new Particles(900); this.timer = 0.5; this.sound = false; }
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.8 + Math.random() * 1.7;
      const x = 30 + Math.random() * (W - 60);
      this.shells.push({ x, y: 230, vy: -(120 + Math.random() * 50), vx: (Math.random() - 0.5) * 15, burstY: 25 + Math.random() * 90 });
    }
    for (const s of this.shells) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt;
      if (Math.random() < 0.5) this.parts.spawn(s.x, s.y, 0, 6, 0.35, RAMPS.gold, 1, 0, 0);
      if (s.y <= s.burstY || s.vy >= -10) {
        s.dead = true;
        const keys = ['gold', 'magenta', 'green', 'cyan'];
        const a = RAMPS[keys[Math.floor(Math.random() * 4)]];
        const b = RAMPS[keys[Math.floor(Math.random() * 4)]];
        const n = 40 + Math.floor(Math.random() * 41);
        this.parts.burst(s.x, s.y, n, [a, a, b], { speed: [15, 55], life: [0.9, 1.7], gravity: 18, drag: 1.2, size: [1, 1] });
        if (this.sound) audio.ambientPop();
      }
    }
    this.shells = this.shells.filter((s) => !s.dead);
    this.parts.update(dt);
  }
  draw(ctx) {
    ctx.fillStyle = PAL.gold;
    for (const s of this.shells) ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 2);
    this.parts.draw(ctx, 1); // ~60% brightness: skip the brightest colour of each ramp
  }
}
