// Game state machine: title → play (waves, pause) → game over.
// Aiming is golf-style: place a target reticle, then time a swing meter.
import * as C from './config.js';
import { PAL, RAMPS, W } from './config.js';
import * as audio from './audio.js';
import {
  LAUNCH_PX, solveAim, previewPath, toScreenX, toScreenY, toWorldX, toWorldY, circleHitsRect, distPointRect,
} from './physics.js';
import { waveParams, buildWave, rollWind } from './waves.js';
import { Player } from './entities/player.js';
import { Zombie } from './entities/zombie.js';
import { Rocket, drawRocketSprite } from './entities/rocket.js';
import { Speedster } from './entities/speedster.js';
import { FX, AmbientFireworks } from './fx/particles.js';
import { Background } from './fx/background.js';
import { drawHUD, drawBanner, drawOffscreenRocket, drawSwingMeter, HUD_BUTTONS, inRect } from './ui/hud.js';
import { titleButtons, pauseButtons, gameOverButtons, hitButton, drawTitle, drawPause, drawGameOver } from './ui/screens.js';
import { drawText } from './ui/font.js';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(C.STORAGE_KEY)) || {}; } catch { return {}; }
}
function writeSave(obj) {
  try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(obj)); } catch { /* private mode etc. */ }
}

const TAUNT_LINES = ['NYAH NYAH!', 'MISSED!', 'HEH HEH!'];

// Needle position for a swing that has run for t seconds: starts at the left edge, ping-pongs.
export function needleAt(t, period) {
  const u = (t / period) % 1;
  return u < 0.5 ? -1 + 4 * u : 3 - 4 * u;
}

export class Game {
  constructor() {
    this.bg = new Background();
    this.ambient = new AmbientFireworks();
    this.ambient.sound = true;
    this.fx = new FX();
    this.player = new Player();
    this.mode = 'title';
    this.t = 0;
    this.hover = null;
    this.touchUsed = false;
    this.save = { best: 0, sound: true, music: true, ...loadSave() };
    audio.setSound(this.save.sound);
    audio.setMusic(this.save.music);
    this.resetRun();
  }

  resetRun() {
    this.lives = C.START_LIVES;
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.wave = 0;
    this.params = waveParams(1);
    this.queue = [];
    this.zombies = [];
    this.waveActive = false;
    this.spawnClock = 0;
    this.rocket = null;
    this.speedster = null;
    this.wind = 0;
    this.streak = 0;
    this.streakFlash = 0;
    this.meter = 0;          // power-up meter segments
    this.charged = false;
    this.inputLock = 0;
    this.swing = null;       // active swing meter
    this.touchAiming = false;
    this.setAim(25, 0.9);
    this.timers = [];
    this.bannerT = 0;
    this.bannerTotal = 1;
    this.bannerSub = '';
    this.hitStop = 0;
    this.shakeT = 0;
    this.newBest = false;
    this.fx.clear();
    this.player.reset();
    audio.creakStop();
  }

  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  streakMult() { return Math.min(C.STREAK_CAP, 1 + C.STREAK_STEP * this.streak); }
  meterPeriod() { return Math.max(C.METER_PERIOD_MIN, C.METER_PERIOD_START - C.METER_PERIOD_PER_WAVE * (this.wave - 1)); }
  frontZombie() {
    let f = null;
    for (const z of this.zombies) if (!z.dead && (!f || z.x < f.x)) f = z;
    return f;
  }

  // ---------- aim ----------
  setAim(x, y) {
    x = Math.max(C.LAUNCH_POINT.x + 0.6, Math.min(C.FIELD_MAX_X + 2, x));
    y = Math.max(0, Math.min(C.AIM_MAX_HEIGHT, y));
    if (this.aimPt && Math.abs(this.aimPt.x - x) < 0.04 && Math.abs(this.aimPt.y - y) < 0.04) return;
    this.aimPt = { x, y };
    this.solution = solveAim(x, y);
    this.path = previewPath(this.solution.angle, x);
  }
  aimFromScreen(px, py) { this.setAim(toWorldX(px), toWorldY(py)); }

  // ---------- flow ----------
  startGame() {
    audio.unlock();
    audio.startMusic();
    this.resetRun();
    this.mode = 'play';
    this.startWave(1, '');
  }

  startWave(n, sub) {
    this.wave = n;
    this.params = waveParams(n);
    this.queue = buildWave(this.params);
    this.bannerT = this.bannerTotal = C.WAVE_BANNER_TIME;
    this.bannerSub = sub || (this.params.wind ? `WIND UP TO ${this.params.wind}` : '');
    this.waveActive = false;
    audio.waveStart();
    this.after(C.WAVE_BANNER_TIME, () => { this.waveActive = true; this.spawnNext(); });
  }

  spawnNext() {
    if (this.mode !== 'play' || !this.queue.length) return;
    const type = this.queue.shift();
    this.zombies.push(new Zombie(type, C.FIELD_MAX_X + 0.3, this.params.speedMul));
    this.wind = rollWind(this.params);
    this.spawnClock = 0;
  }

  updateSpawning(dt) {
    if (!this.waveActive) return;
    this.spawnClock += dt;
    const alive = this.zombies.length;
    if (this.queue.length) {
      const need = alive === 0 ? C.NEXT_SPAWN_DELAY : this.params.gap;
      if (alive < this.params.maxOn && this.spawnClock >= need) this.spawnNext();
    } else if (alive === 0) {
      this.waveActive = false;
      this.after(C.NEXT_SPAWN_DELAY, () => this.waveComplete());
    }
  }

  removeZombie(z) {
    this.zombies = this.zombies.filter((o) => o !== z);
    if (this.zombies.length === 0) this.spawnClock = 0;
  }

  waveComplete() {
    if (this.mode !== 'play' || this.lives <= 0) return;
    const n = this.wave;
    const subs = [];
    if (n % C.BONUS_LIFE_EVERY === 0 && this.lives < C.MAX_LIVES) {
      this.lives++;
      subs.push('+1 LIFE');
      audio.lifeUp();
    }
    if (n === C.WAVES.length) subs.push('ENDLESS MODE');
    this.startWave(n + 1, subs.join('   '));
  }

  gameOver() {
    this.mode = 'gameover';
    this.cancelSwing();
    this.newBest = this.score > this.save.best;
    if (this.newBest) this.save.best = this.score;
    writeSave(this.save);
    audio.gameOver();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.cancelSwing();
    this.mode = 'pause';
  }
  resume() { if (this.mode === 'pause') this.mode = 'play'; }

  toggleSound() { this.save.sound = !this.save.sound; audio.setSound(this.save.sound); writeSave(this.save); }
  toggleMusic() { this.save.music = !this.save.music; audio.setMusic(this.save.music); writeSave(this.save); }

  // ---------- input ----------
  canFire() {
    return this.mode === 'play' && this.zombies.length > 0 && !this.rocket && !this.speedster && this.inputLock <= 0;
  }

  handleEvents(events) {
    for (const e of events) {
      if (e.pointerType === 'touch') this.touchUsed = true;
      switch (e.type) {
        case 'key': this.onKey(e.code); break;
        case 'down': this.onDown(e); break;
        case 'move': this.onMove(e); break;
        case 'up': this.onUp(e); break;
        case 'cancel': this.touchAiming = false; break;
        case 'blur': this.pause(); break;
      }
    }
  }

  menuButtons() {
    if (this.mode === 'title') return titleButtons(this.save.sound, this.save.music);
    if (this.mode === 'pause') return pauseButtons(this.save.sound, this.save.music);
    if (this.mode === 'gameover') return gameOverButtons();
    return [];
  }

  onMenuAction(id) {
    audio.uiClick();
    switch (id) {
      case 'play': case 'retry': case 'restart': this.startGame(); break;
      case 'resume': this.resume(); break;
      case 'sound': this.toggleSound(); break;
      case 'music': this.toggleMusic(); break;
      case 'quit': case 'title': this.resetRun(); this.mode = 'title'; break;
    }
  }

  onKey(code) {
    if (code === 'Backquote' || code === 'F3') { this.debug = !this.debug; return; }
    if (code === 'KeyM') { this.toggleSound(); return; }
    switch (this.mode) {
      case 'title': if (code === 'Enter' || code === 'Space') this.onMenuAction('play'); break;
      case 'gameover': if (code === 'Enter' || code === 'Space') this.onMenuAction('retry'); break;
      case 'pause': if (code === 'Escape' || code === 'KeyP' || code === 'Enter' || code === 'Space') this.resume(); break;
      case 'play':
        if (code === 'Escape') { if (this.swing) this.cancelSwing(); else this.pause(); }
        else if (code === 'KeyP') this.pause();
        else if (code === 'KeyS') this.tryPowerup();
        else if (code === 'Space' || code === 'Enter') this.swingButton(false);
        break;
    }
  }

  // Start the swing, or (if it's already running) release the shot.
  swingButton(byHold) {
    if (this.swing) { this.fire(); return; }
    if (!this.canFire()) return;
    this.swing = { t: 0, byHold };
    this.player.setPull(0.7);
    audio.creakStart();
  }

  cancelSwing() {
    if (this.swing) { this.swing = null; this.player.cancelPull(); }
    audio.creakStop();
  }

  onDown(e) {
    if (this.mode !== 'play') {
      const b = hitButton(this.menuButtons(), e);
      if (b) this.onMenuAction(b.id);
      return;
    }
    if (inRect(e, HUD_BUTTONS.pause)) { this.pause(); return; }
    if (inRect(e, HUD_BUTTONS.power)) { this.tryPowerup(); return; }
    if (this.touchUsed && inRect(e, HUD_BUTTONS.fire)) { this.swingButton(true); return; }
    if (this.swing) { this.fire(); return; }           // second click releases
    if (e.pointerType === 'touch') {                   // touch: drag to place the reticle
      this.touchAiming = true;
      this.aimFromScreen(e.x, e.y - 12);               // sit above the finger so you can see it
      return;
    }
    this.aimFromScreen(e.x, e.y);
    this.swingButton(true);                            // mouse/trackpad: click starts the swing
  }

  onMove(e) {
    if (this.mode !== 'play') {
      const b = hitButton(this.menuButtons(), e);
      this.hover = b ? b.id : null;
      return;
    }
    if (this.swing) return;                            // aim locks while the meter runs
    if (this.touchAiming) this.aimFromScreen(e.x, e.y - 12);
    else if (!this.touchUsed || e.pointerType !== 'touch') this.aimFromScreen(e.x, e.y);
  }

  onUp() {
    this.touchAiming = false;
    // hold-and-release also works: a long press fires on release
    if (this.swing && this.swing.byHold && this.swing.t >= C.HOLD_THRESHOLD) this.fire();
  }

  fire() {
    if (!this.swing) return;
    const e = needleAt(this.swing.t, this.meterPeriod());
    this.swing = null;
    audio.creakStop();
    if (!this.canFire()) { this.player.cancelPull(); return; }
    const perfect = Math.abs(e) <= C.METER_PERFECT;
    const err = perfect ? 0 : e * C.METER_MAX_ERROR;
    this.rocket = new Rocket(this.solution.angle + err);
    this.shots++;
    this.player.release();
    audio.launch();
    const label = perfect ? 'PERFECT!' : Math.abs(e) <= C.METER_GOOD ? 'GOOD' : e > 0 ? 'TOO HIGH!' : 'TOO LOW!';
    const col = perfect ? PAL.cyan : Math.abs(e) <= C.METER_GOOD ? PAL.green : PAL.red2;
    this.fx.text(label, 70, 108, { color: col, life: 0.9, vy: -10 });
    this.fx.particles.burst(LAUNCH_PX.x, LAUNCH_PX.y, 12, [RAMPS.flame, RAMPS.smoke], { speed: [10, 40], life: [0.2, 0.5], gravity: 20, flicker: false });
  }

  tryPowerup() {
    if (this.mode !== 'play' || !this.charged) return;
    const target = this.frontZombie();
    if (!target || this.rocket || this.speedster) return;
    this.cancelSwing();
    this.charged = false;
    this.meter = 0;
    this.speedster = new Speedster();
    this.speedster.target = target;
    audio.sprint();
    this.fx.text('CHOTU GO!', 60, 196, { color: PAL.cyan });
  }

  // ---------- simulation (fixed DT) ----------
  update(dt) {
    if (this.mode === 'pause') return;
    this.t += dt;
    this.bg.update(dt, this.mode === 'play' ? this.wind : 0.8);
    this.ambient.update(dt);
    this.fx.update(dt);
    this.player.update(dt);
    if (this.mode !== 'play') return;

    if (this.timers.length) {
      const due = [];
      for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
      if (due.length) { this.timers = this.timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn()); }
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.inputLock > 0) this.inputLock -= dt;
    if (this.streakFlash > 0) this.streakFlash -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.swing) {
      this.swing.t += dt;
      audio.creakSet((needleAt(this.swing.t, this.meterPeriod()) + 1) / 2);
      if (!this.canFire()) this.cancelSwing();
    }

    this.updateSpawning(dt);
    for (const z of [...this.zombies]) {
      z.update(dt);
      if (z.reachedDoor && !z.dead) this.doorBreach(z);
    }
    if (this.rocket) {
      this.rocket.step(this.wind, this.fx);
      this.checkRocket();
    }
    if (this.speedster) {
      const target = this.speedster.target;
      for (const ev of this.speedster.update(dt, target, this.fx)) {
        if (ev === 'hit') {
          audio.skid();
          if (target && !target.dead) {
            const c = target.centerPx;
            this.killZombie(target, 'speedster');
            audio.bark();
            this.speedster.barkT = 0.6;
            this.fx.text('WOOF! WOOF!', Math.max(40, Math.min(W - 40, c.x)), c.y - 40, { color: PAL.white, scale: 2, life: 1.3, vy: -10, outline: PAL.blue3 });
          }
        } else if (ev === 'turn') audio.sprint();
        else if (ev === 'done') this.speedster = null;
      }
    }
  }

  checkRocket() {
    const s = this.rocket.s;
    const sorted = this.zombies.filter((z) => !z.dead).sort((a, b) => a.x - b.x);
    const hit = sorted.find((z) => circleHitsRect(s.x, s.y, C.ROCKET_RADIUS, z.rect));
    if (hit) this.resolveRocket('direct', s.x, s.y, hit);
    else if (s.y <= 0) this.resolveRocket('ground', s.x, 0, null);
    else if (this.rocket.timedOut) this.resolveRocket('fizzle', s.x, s.y, null);
  }

  resolveRocket(kind, x, y, direct) {
    this.rocket = null;
    this.inputLock = C.INPUT_LOCK_AFTER;
    const sx = toScreenX(x), sy = toScreenY(y);
    let anyHit = false;
    if (direct) {
      this.hitZombie(direct, C.DAMAGE_DIRECT, C.KNOCKBACK_DIRECT, true, sx, sy);
      anyHit = true;
    }
    // splash everyone else nearby
    for (const z of [...this.zombies]) {
      if (z === direct || z.dead) continue;
      if (distPointRect(x, y, z.rect) <= C.SPLASH_RADIUS) {
        this.hitZombie(z, C.DAMAGE_SPLASH, C.KNOCKBACK_SPLASH, false, sx, sy);
        anyHit = true;
      }
    }
    if (!direct) {
      this.fx.particles.burst(sx, sy - 1, 16, [RAMPS.gold, RAMPS.dirt], { speed: [20, 60], life: [0.3, 0.7], gravity: 140, drag: 2 });
      if (anyHit) this.fx.explosion(sx, sy - 2);
    }
    if (!anyHit) {
      audio.groundHit();
      this.miss(x);
    }
  }

  hitZombie(z, dmg, kb, direct, sx, sy) {
    const res = z.damage(dmg, kb);
    if (res === 'kill') { this.killZombie(z, direct ? 'direct' : 'splash'); return; }
    audio.grunt();
    this.player.fistPump();
    audio.fistPump();
    this.fx.explosion(sx, sy);
    this.fx.particles.burst(sx, sy, 20, [RAMPS.gold, RAMPS.magenta], { speed: [20, 70], life: [0.3, 0.7] });
    const c = z.centerPx;
    this.fx.text(direct ? 'HIT!' : 'SPLASH!', c.x, c.y - z.def.sh / 2 - 14, { color: PAL.white });
    this.shakeT = Math.max(this.shakeT, 0.1);
  }

  killZombie(z, how) {
    z.dead = true;
    const c = z.centerPx;
    const mult = this.streakMult();
    const pts = Math.round(z.def.points * (how === 'direct' ? C.DIRECT_HIT_BONUS : 1) * mult);
    this.score += pts;
    this.kills++;
    if (how !== 'speedster') {
      this.streak++;
      this.streakFlash = 0.6;
      if (!this.charged) {
        this.meter++;
        if (this.meter >= C.POWERUP_SEGMENTS) {
          this.charged = true;
          this.meter = C.POWERUP_SEGMENTS;
          audio.powerReady();
        }
      }
    }
    this.hitStop = C.HIT_STOP;
    this.shakeT = C.SHAKE_TIME;
    const n = C.KILL_PARTICLES[0] + Math.floor(Math.random() * (C.KILL_PARTICLES[1] - C.KILL_PARTICLES[0] + 1));
    this.fx.particles.burst(c.x, c.y, n, [RAMPS.gold, RAMPS.magenta, RAMPS.green], { speed: [30, 120], life: [0.6, 1.4], gravity: 45 });
    this.fx.explosion(c.x, c.y);
    this.fx.text(`+${pts}`, c.x, c.y - 20, { color: PAL.yellow });
    if (how === 'direct') this.fx.text('DIRECT HIT X2', c.x, c.y - 32, { color: PAL.cyan, life: 1 });
    audio.kill();
    this.player.celebrate();
    this.after(0.25, () => { audio.siuuu(); this.fx.text('SIUUU!', 46, 126, { color: PAL.yellow, scale: 2, life: 1.2, vy: -8, outline: PAL.rust }); });
    this.removeZombie(z);
  }

  miss(x) {
    this.streak = 0;
    if (!this.charged) this.meter = 0;
    // the zombie closest to where it landed gets to gloat
    let near = null;
    for (const z of this.zombies) if (!z.dead && (!near || Math.abs(z.x - x) < Math.abs(near.x - x))) near = z;
    if (near && near.taunt()) {
      audio.taunt(near.tauntKind);
      const c = near.centerPx;
      this.fx.text(TAUNT_LINES[near.tauntKind], Math.max(30, Math.min(W - 30, c.x)), c.y - near.def.sh / 2 - 14, { color: PAL.green, life: 1.4, vy: -6 });
    }
  }

  doorBreach(z) {
    z.dead = true;
    this.lives--;
    this.streak = 0;
    audio.doorKnock();
    this.shakeT = 0.35;
    const c = z.centerPx;
    this.fx.particles.burst(c.x, c.y, 24, [RAMPS.smoke, RAMPS.green], { speed: [20, 60], life: [0.4, 0.9], gravity: -10 });
    this.fx.text('-1 LIFE', 60, 210, { color: PAL.red2, life: 1.4 });
    this.removeZombie(z);
    if (this.lives <= 0) {
      this.lives = 0;
      this.waveActive = false;
      this.timers = [];
      this.after(1.2, () => this.gameOver());
    }
  }

  // ---------- render ----------
  render(ctx) {
    let sx = 0, sy = 0;
    if (this.shakeT > 0 && this.mode !== 'pause') {
      sx = Math.round((Math.random() * 2 - 1) * C.SHAKE_PX);
      sy = Math.round((Math.random() * 2 - 1) * C.SHAKE_PX);
    }
    this.bg.drawSky(ctx, this.t);
    this.ambient.draw(ctx);
    this.bg.drawFar(ctx, sx, sy);
    ctx.save();
    ctx.translate(sx, sy);
    this.bg.drawNear(ctx, this.t);
    this.bg.drawHouse(ctx, this.t);
    for (const z of [...this.zombies].sort((a, b) => b.x - a.x)) z.draw(ctx);
    if (this.speedster) this.speedster.draw(ctx);
    this.player.draw(ctx, this.t);
    this.drawAim(ctx);
    if (this.rocket) this.rocket.draw(ctx, this.t);
    this.fx.drawWorld(ctx);
    this.fx.drawTexts(ctx);
    ctx.restore();

    if (this.mode !== 'title') {
      if (this.swing) drawSwingMeter(ctx, needleAt(this.swing.t, this.meterPeriod()), this.t);
      drawHUD(ctx, this, this.t);
      drawBanner(ctx, this, this.t);
      if (this.rocket) drawOffscreenRocket(ctx, toScreenX(this.rocket.s.x), toScreenY(this.rocket.s.y));
      if (this.mode === 'play' && this.wave === 1 && this.shots < 2 && this.bannerT <= 0) {
        const msg = this.touchUsed ? 'DRAG TO AIM, TAP FIRE, TAP AGAIN ON GOLD' : 'AIM WITH THE MOUSE, CLICK, THEN CLICK AGAIN ON GOLD';
        drawText(ctx, msg, W / 2, 50, { color: PAL.white, outline: PAL.black, align: 'center' });
      }
    }
    const ui = { buttons: this.menuButtons(), hover: this.hover, best: this.save.best, score: this.score, wave: this.wave, kills: this.kills, newBest: this.newBest };
    if (this.mode === 'title') drawTitle(ctx, ui, this.t);
    else if (this.mode === 'pause') drawPause(ctx, ui);
    else if (this.mode === 'gameover') drawGameOver(ctx, ui, this.t);
  }

  // Golf-style aim: rocket on the launcher points along the solved angle,
  // dotted no-wind path to the reticle, and the reticle itself.
  drawAim(ctx) {
    if (this.rocket || this.speedster) return;
    const ax = LAUNCH_PX.x, ay = LAUNCH_PX.y;
    const ang = (this.solution.angle * Math.PI) / 180;
    if (this.mode !== 'play' || this.inputLock <= 0) {
      drawRocketSprite(ctx, ax, ay - 1, this.mode === 'play' ? -ang : -Math.PI / 3, false, this.t);
    }
    if (this.mode !== 'play' || !this.zombies.length || this.inputLock > 0) return;

    const ok = this.solution.reachable;
    const blink = Math.floor(this.t * 8);
    this.path.forEach((p, i) => {
      if (i < 3) return;
      const x = Math.round(toScreenX(p.x)) - 1, y = Math.round(toScreenY(p.y)) - 1;
      ctx.fillStyle = PAL.black; ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.fillStyle = !ok ? PAL.rose : (i + blink) % 4 === 0 ? PAL.cyan : i % 2 ? PAL.white : PAL.yellow;
      ctx.fillRect(x, y, 2, 2);
    });
    // reticle
    const rx = Math.round(toScreenX(this.aimPt.x)), ry = Math.round(toScreenY(this.aimPt.y));
    const col = !ok ? PAL.red2 : this.swing ? PAL.yellow : PAL.white;
    const r = this.swing ? 5 : 6 + (Math.floor(this.t * 3) % 2);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(rx - r - 1, ry - 1, r * 2 + 3, 3); ctx.fillRect(rx - 1, ry - r - 1, 3, r * 2 + 3);
    ctx.fillStyle = col;
    ctx.fillRect(rx - r, ry, r - 2, 1); ctx.fillRect(rx + 3, ry, r - 2, 1);
    ctx.fillRect(rx, ry - r, 1, r - 2); ctx.fillRect(rx, ry + 3, 1, r - 2);
    ctx.fillRect(rx, ry, 1, 1);
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillRect(rx + cx * r, ry + cy * r, 1, 1);
      ctx.fillRect(rx + cx * (r - 1), ry + cy * r, 1, 1);
      ctx.fillRect(rx + cx * r, ry + cy * (r - 1), 1, 1);
    }
    if (!ok) drawText(ctx, 'OUT OF RANGE', rx, ry - r - 10, { color: PAL.red2, outline: PAL.black, align: 'center' });
  }
}
