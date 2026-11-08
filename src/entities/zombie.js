import {
  ZOMBIES, PAL, DOOR_X, FIELD_MAX_X, SPEED_JITTER, STAGGER_TIME, MISS_TAUNT_TIME,
  RISE_TIME, KNOCKBACK_TIME, GROUND_Y, PX_PER_M,
} from '../config.js';
import { brush } from '../gfx.js';

const LOOKS = {
  runner: { skin: PAL.green, skinD: PAL.green2, shirt: PAL.red2, shirtD: PAL.red, pants: PAL.navy2, hat: 'cap' },
  walker: { skin: PAL.green, skinD: PAL.green2, shirt: PAL.blue, shirtD: PAL.blue3, pants: PAL.brownD, hat: 'tuft' },
  brute:  { skin: PAL.green2, skinD: PAL.green3, shirt: PAL.brownD, shirtD: PAL.plumD, pants: PAL.navy, hat: 'stitches' },
  tank:   { skin: PAL.green2, skinD: PAL.green3, shirt: PAL.grey3, shirtD: PAL.navy2, pants: PAL.navy, hat: 'bucket' },
};

export class Zombie {
  constructor(type, spawnX, speedMul = 1) {
    this.type = type;
    this.def = ZOMBIES[type];
    this.look = LOOKS[type];
    this.x = spawnX; // left edge, metres (spawns just off the right edge and walks in)
    this.hp = this.def.hp;
    this.speed = this.def.speed * speedMul * (1 + (Math.random() * 2 - 1) * SPEED_JITTER);
    this.state = 'walk';
    this.stateT = 0;
    this.animT = Math.random();
    this.flash = 0;
    this.kbLeft = 0;
    this.kbRate = 0;
    this.tauntKind = 0;
    this.reachedDoor = false;
    this.dead = false;
  }

  get rect() { return { x0: this.x, x1: this.x + this.def.w, y0: 0, y1: this.def.h }; }
  get centerPx() { return { x: (this.x + this.def.w / 2) * PX_PER_M, y: GROUND_Y - (this.def.h / 2) * PX_PER_M }; }

  update(dt) {
    this.animT += dt;
    this.stateT += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.kbLeft > 0) {
      const m = Math.min(this.kbLeft, this.kbRate * dt);
      this.x = Math.max(this.x, Math.min(FIELD_MAX_X - this.def.w, this.x + m));
      this.kbLeft -= m;
    }
    switch (this.state) {
      case 'rise': if (this.stateT >= RISE_TIME) this.setState('walk'); break;
      case 'walk': this.x -= this.speed * dt; break;
      case 'stagger': if (this.stateT >= STAGGER_TIME) this.setState('walk'); break;
      case 'taunt': if (this.stateT >= MISS_TAUNT_TIME) this.setState('walk'); break;
    }
    if (this.x <= DOOR_X) { this.x = DOOR_X; this.reachedDoor = true; }
  }

  setState(s) { this.state = s; this.stateT = 0; }

  // returns 'kill' or 'hit'
  damage(amount, knockback) {
    this.hp -= amount;
    if (this.hp <= 1e-6) { this.hp = 0; this.dead = true; return 'kill'; }
    this.flash = 2 / 60;
    this.kbLeft = knockback / this.def.weight;
    this.kbRate = this.kbLeft / KNOCKBACK_TIME;
    if (this.state !== 'rise') this.setState('stagger');
    return 'hit';
  }

  taunt() {
    if (this.state === 'rise') return false;
    this.tauntKind = Math.floor(Math.random() * 3);
    this.setState('taunt');
    return true;
  }

  draw(ctx) {
    const d = this.def;
    const cx = (this.x + d.w / 2) * PX_PER_M;
    const left = Math.round(cx - d.sw / 2);
    let top = GROUND_Y - d.sh;
    if (this.state === 'rise') {
      const p = Math.min(1, this.stateT / RISE_TIME);
      top += Math.round(d.sh * (1 - p));
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, 480, GROUND_Y); ctx.clip();
      drawZombieSprite(ctx, left, top, this, 'walk', 0);
      ctx.restore();
    } else {
      drawZombieSprite(ctx, left, top, this, this.state, this.animT);
    }
    this.drawPips(ctx, Math.round(cx), top - 5);
  }

  drawPips(ctx, cx, y) {
    const n = this.def.hp;
    const w = n * 4 - 1;
    let x = cx - Math.floor(w / 2);
    for (let i = 0; i < n; i++) {
      const fill = Math.max(0, Math.min(1, this.hp - i));
      ctx.fillStyle = PAL.black; ctx.fillRect(x - 1, y - 1, 5, 4);
      ctx.fillStyle = PAL.plumD; ctx.fillRect(x, y, 3, 2);
      if (fill > 0) { ctx.fillStyle = PAL.green; ctx.fillRect(x, y, fill >= 1 ? 3 : 2, 2); }
      x += 4;
    }
  }
}

// Parametric goofy zombie, facing left (toward the house).
export function drawZombieSprite(ctx, ox, oy, z, state, t) {
  const { sw, sh } = z.def;
  const L = z.look;
  const R = brush(ctx, ox, oy, sw, false, z.flash > 0 ? PAL.white : null);
  const headH = Math.max(5, Math.round(sh * 0.32));
  const headW = Math.max(6, Math.round(sw * 0.55));
  const torsoH = Math.round(sh * 0.36);
  const torsoW = Math.max(5, Math.round(sw * 0.5));
  const legTop = headH + torsoH;
  const legH = sh - legTop;
  const lw = Math.max(2, Math.round(torsoW * 0.35));
  const at = Math.max(2, Math.round(sh * 0.08)); // arm thickness
  const torsoX = Math.round((sw - torsoW) / 2) + 1;
  let headX = torsoX - 2;

  let frame = 0, bob = 0, sway = 0, hop = 0;
  let armMode = 'reach';
  let legSwing = 0, kick = 0;
  if (state === 'walk') {
    frame = Math.floor(t * 8) % 6;
    const ph = (frame / 6) * Math.PI * 2;
    bob = frame % 3 === 0 ? 1 : 0;
    legSwing = Math.round(Math.sin(ph) * Math.max(1, sw * 0.1));
  } else if (state === 'stagger') {
    frame = Math.floor(t * 12) % 2;
    armMode = 'flail';
    headX += 2; sway = 1;
  } else if (state === 'taunt') {
    frame = Math.floor(t * 10.67) % 8; // 8 frames per 0.75 s
    if (z.tauntKind === 0) { armMode = frame % 4 < 2 ? 'discoUp' : 'discoDown'; sway = frame % 4 < 2 ? -1 : 1; }
    else if (z.tauntKind === 1) { armMode = 'noodle'; bob = frame % 2; }
    else { armMode = 'hips'; hop = [0, -1, -2, -1, 0, -1, -2, -1][frame]; kick = frame < 4 ? 1 : -1; }
  }
  const by = bob + hop;
  const tx = torsoX + sway;

  // legs
  const legY = legTop + hop;
  const lh = legH - (hop < 0 ? 0 : 0);
  const backLegX = tx + torsoW - lw - 1 - legSwing;
  const frontLegX = tx + 1 + legSwing;
  R(backLegX, legY, lw, lh - 1, L.pants);
  R(backLegX - 1, legY + lh - 1, lw + 1, 1, PAL.black);
  const fk = kick > 0 ? -2 : 0;
  R(frontLegX + fk, legY, lw, lh - 1 - (kick > 0 ? 1 : 0), L.pants);
  R(frontLegX + fk - 1, legY + lh - 1 - (kick > 0 ? 1 : 0), lw + 1, 1, PAL.black);

  // back arm
  const shY = headH + 1 + by;
  const armLen = Math.max(4, Math.round(sw * 0.4));
  const drawArm = (back) => {
    const c = back ? L.skinD : L.skin;
    const sx = back ? tx + torsoW - 2 : tx + 1;
    const yy = shY + (back ? -1 : 0);
    switch (armMode) {
      case 'reach': {
        const wob = back ? (frame % 2) : ((frame + 1) % 2);
        R(sx - armLen, yy + wob, armLen + 1, at, c);
        R(sx - armLen - 1, yy + wob, 1, at + 1, c);
        break;
      }
      case 'flail': R.line(sx, yy, sx - 3 + (back ? 4 : 0), yy - armLen + (frame ? 1 : 0), c, at); break;
      case 'discoUp': back ? R.line(sx, yy, sx + 3, yy + armLen - 2, c, at) : R.line(sx, yy, sx - 3, yy - armLen, c, at); break;
      case 'discoDown': back ? R.line(sx, yy, sx + 3, yy - armLen + 1, c, at) : R.line(sx, yy, sx - armLen, yy + 3, c, at); break;
      case 'noodle': { const w = frame % 2 ? 2 : -2; R.line(sx, yy, sx + w + (back ? 2 : -2), yy - armLen, c, at); break; }
      case 'hips': R.line(sx, yy, sx + (back ? 2 : -2), yy + Math.round(torsoH / 2), c, at); break;
    }
  };
  drawArm(true);

  // torso (torn shirt)
  const ty = headH + by;
  R(tx, ty, torsoW, torsoH, L.shirt);
  R(tx + torsoW - 1, ty, 1, torsoH, L.shirtD);
  for (let i = 0; i < torsoW; i += 2) R(tx + i, ty + torsoH - 1, 1, 1, L.pants);
  if (z.type === 'tank') { R(tx + 1, ty + 2, torsoW - 3, torsoH - 4, L.skin); R(tx + 2, ty + Math.round(torsoH / 2), 2, 1, L.skinD); } // belly
  if (z.type === 'brute') { R(tx + 1, ty + 1, 2, torsoH - 2, L.skin); }

  // head
  const hy = by;
  const hx = headX + sway;
  R(hx, hy, headW, headH, L.skin);
  R(hx + headW - 1, hy, 1, headH, L.skinD);
  R(hx, hy + headH - 1, headW, 1, L.skinD); // jaw shadow
  // googly eyes
  const eyeY = hy + Math.max(1, Math.round(headH * 0.25));
  const big = sh >= 20 ? 3 : 2;
  R(hx + 1, eyeY, big, big, PAL.white);
  R(hx + 1 + ((frame % 2) ? 1 : 0), eyeY + big - 1, 1, 1, PAL.black);
  R(hx + 2 + big, eyeY + 1, 2, 2, PAL.white);
  R(hx + 2 + big + 1, eyeY + 1, 1, 1, PAL.black);
  // mouth + tongue
  const my = hy + headH - 2 - (headH > 6 ? 1 : 0);
  const mouthOpen = state === 'taunt' || state === 'stagger';
  R(hx + 1, my, 3, mouthOpen ? 2 : 1, PAL.black);
  R(hx + 2, my + 1, 1, mouthOpen ? 2 : 1, PAL.rose);
  // headgear
  switch (L.hat) {
    case 'cap': R(hx, hy - 1, headW, 2, PAL.gold); R(hx - 2, hy, 3, 1, PAL.gold); break;
    case 'tuft': R(hx + 2, hy - 2, 1, 2, PAL.black); R(hx + 4, hy - 1, 1, 1, PAL.black); break;
    case 'stitches': for (let i = 1; i < headW - 1; i += 2) R(hx + i, hy + 1, 1, 1, PAL.plumD); R(hx + 1, hy + 1, headW - 2, 0, PAL.plumD); break;
    case 'bucket': R(hx - 1, hy - 3, headW + 2, 4, PAL.grey2); R(hx - 1, hy + 1, headW + 2, 1, PAL.grey3); R(hx + 1, hy - 2, 2, 1, PAL.grey1); break;
  }

  drawArm(false);
}
