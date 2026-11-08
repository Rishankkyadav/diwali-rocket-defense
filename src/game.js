// Game state machine: title → play (waves, pause) → game over.
import * as C from './config.js';
import { PAL, RAMPS, W } from './config.js';
import * as audio from './audio.js';
import { LAUNCH_PX, shotFromPull, previewDots, toScreenX, toScreenY, circleHitsRect, distPointRect } from './physics.js';
import { waveParams, buildWave, rollWind, rand } from './waves.js';
import { Player } from './entities/player.js';
import { Zombie } from './entities/zombie.js';
import { Rocket, drawRocketSprite } from './entities/rocket.js';
import { Speedster } from './entities/speedster.js';
import { FX, AmbientFireworks } from './fx/particles.js';
import { Background } from './fx/background.js';
import { drawHUD, drawBanner, drawOffscreenRocket, HUD_BUTTONS, inRect } from './ui/hud.js';
import { titleButtons, pauseButtons, gameOverButtons, hitButton, drawTitle, drawPause, drawGameOver } from './ui/screens.js';
import { pixelLine, ringCircle } from './gfx.js';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(C.STORAGE_KEY)) || {}; } catch { return {}; }
}
function writeSave(obj) {
  try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(obj)); } catch { /* private mode etc. */ }
}

const TAUNT_LINES = ['NYAH NYAH!', 'MISSED!', 'HEH HEH!'];

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
    this.wave = 0;
    this.params = waveParams(1);
    this.queue = [];
    this.zombie = null;
    this.rocket = null;
    this.speedster = null;
    this.wind = 0;
    this.streak = 0;
    this.streakFlash = 0;
    this.meter = 0;
    this.charged = false;
    this.inputLock = 0;
    this.aim = null;
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
    this.wind = 0;
    audio.waveStart();
    this.after(C.WAVE_BANNER_TIME, () => this.spawnNext());
  }

  spawnNext() {
    if (this.mode !== 'play' || !this.queue.length) return;
    const type = this.queue.shift();
    const x = C.FIELD_MAX_X + 0.3; // enter from the right edge
    this.zombie = new Zombie(type, x, this.params.speedMul);
    this.wind = rollWind(this.params);
    const c = this.zombie.centerPx;
    this.fx.particles.burst(c.x, C.GROUND_Y - 1, 14, [RAMPS.dirt], { speed: [20, 50], life: [0.4, 0.8], gravity: 160, drag: 2, flicker: false });
  }

  zombieResolved() {
    this.zombie = null;
    if (this.queue.length) this.after(C.NEXT_SPAWN_DELAY, () => this.spawnNext());
    else this.after(C.NEXT_SPAWN_DELAY, () => this.waveComplete());
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
    this.cancelAim();
    this.newBest = this.score > this.save.best;
    if (this.newBest) this.save.best = this.score;
    writeSave(this.save);
    audio.gameOver();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.cancelAim();
    this.mode = 'pause';
  }
  resume() { if (this.mode === 'pause') this.mode = 'play'; }

  toggleSound() { this.save.sound = !this.save.sound; audio.setSound(this.save.sound); writeSave(this.save); }
  toggleMusic() { this.save.music = !this.save.music; audio.setMusic(this.save.music); writeSave(this.save); }

  // ---------- input ----------
  canFire() {
    return this.mode === 'play' && this.zombie && !this.zombie.dead && !this.rocket && !this.speedster && this.inputLock <= 0;
  }

  handleEvents(events) {
    for (const e of events) {
      if (e.pointerType === 'touch') this.touchUsed = true;
      switch (e.type) {
        case 'key': this.onKey(e.code); break;
        case 'down': this.onDown(e); break;
        case 'move': this.onMove(e); break;
        case 'up': this.onUp(e); break;
        case 'cancel': this.cancelAim(); break;
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
        if (code === 'Escape' || code === 'KeyP') this.pause();
        else if (code === 'KeyS') this.tryPowerup();
        break;
    }
  }

  onDown(e) {
    if (this.mode !== 'play') {
      const b = hitButton(this.menuButtons(), e);
      if (b) this.onMenuAction(b.id);
      return;
    }
    if (inRect(e, HUD_BUTTONS.pause)) { this.pause(); return; }
    if (inRect(e, HUD_BUTTONS.power)) { this.tryPowerup(); return; }
    if (!this.canFire()) return;
    // Grab on/near the rocket (24 px), or anywhere else as a relative drag — handy on phones
    // where the house sits right at the screen edge.
    const near = Math.hypot(e.x - LAUNCH_PX.x, e.y - LAUNCH_PX.y) <= C.GRAB_RADIUS;
    const ox = near ? LAUNCH_PX.x : e.x, oy = near ? LAUNCH_PX.y : e.y;
    this.aim = { ox, oy, px: e.x, py: e.y, shot: shotFromPull(0, 0) };
    this.aim.shot = shotFromPull(ox - e.x, oy - e.y);
    this.player.setPull(this.aim.shot.power);
    audio.creakStart();
    audio.creakSet(this.aim.shot.power);
  }

  onMove(e) {
    if (this.mode !== 'play') {
      const b = hitButton(this.menuButtons(), e);
      this.hover = b ? b.id : null;
      return;
    }
    if (!this.aim) return;
    this.aim.px = e.x; this.aim.py = e.y;
    this.aim.shot = shotFromPull(this.aim.ox - e.x, this.aim.oy - e.y);
    this.player.setPull(this.aim.shot.power);
    audio.creakSet(this.aim.shot.power);
  }

  onUp(e) {
    if (!this.aim) return;
    this.onMove(e);
    const shot = this.aim.shot;
    this.aim = null;
    audio.creakStop();
    if (shot.len < C.MIN_PULL || !this.canFire()) { this.player.cancelPull(); return; }
    this.fire(shot);
  }

  cancelAim() {
    if (this.aim) { this.aim = null; this.player.cancelPull(); }
    audio.creakStop();
  }

  fire(shot) {
    this.rocket = new Rocket(shot.angle, shot.v0);
    this.lastShot = shot;
    this.player.release();
    audio.launch();
    this.fx.particles.burst(LAUNCH_PX.x, LAUNCH_PX.y, 10, [RAMPS.flame, RAMPS.smoke], { speed: [10, 40], life: [0.2, 0.5], gravity: 20, flicker: false });
  }

  tryPowerup() {
    if (this.mode !== 'play' || !this.charged) return;
    if (!this.zombie || this.zombie.dead || this.rocket || this.speedster) return;
    this.cancelAim();
    this.charged = false;
    this.meter = 0;
    this.speedster = new Speedster();
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

    // timers
    if (this.timers.length) {
      const due = [];
      for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
      if (due.length) { this.timers = this.timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn()); }
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.inputLock > 0) this.inputLock -= dt;
    if (this.streakFlash > 0) this.streakFlash -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;

    const z = this.zombie;
    if (z) {
      z.update(dt);
      if (z.reachedDoor) this.doorBreach(z);
    }
    if (this.rocket) {
      this.rocket.step(this.wind, this.fx);
      this.checkRocket();
    }
    if (this.speedster) {
      for (const ev of this.speedster.update(dt, this.zombie, this.fx)) {
        if (ev === 'hit') {
          audio.skid();
          if (this.zombie && !this.zombie.dead) {
            const c = this.zombie.centerPx;
            this.killZombie(this.zombie, 'speedster');
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
    const z = this.zombie;
    if (z && !z.dead && circleHitsRect(s.x, s.y, C.ROCKET_RADIUS, z.rect)) this.resolveRocket('direct', s.x, s.y);
    else if (s.y <= 0) this.resolveRocket('ground', s.x, 0);
    else if (this.rocket.timedOut) this.resolveRocket('fizzle', s.x, s.y);
  }

  resolveRocket(kind, x, y) {
    this.rocket = null;
    this.inputLock = C.INPUT_LOCK_AFTER;
    const sx = toScreenX(x), sy = toScreenY(y);
    const z = this.zombie;
    if (kind === 'direct') {
      this.hitZombie(z, C.DAMAGE_DIRECT, C.KNOCKBACK_DIRECT, true, sx, sy);
      return;
    }
    // impact burst on the ground (or a fizzle mid-air)
    this.fx.particles.burst(sx, sy - 1, 16, [RAMPS.gold, RAMPS.dirt], { speed: [20, 60], life: [0.3, 0.7], gravity: 140, drag: 2 });
    if (z && !z.dead && distPointRect(x, y, z.rect) <= C.SPLASH_RADIUS) {
      this.fx.explosion(sx, sy - 2);
      this.hitZombie(z, C.DAMAGE_SPLASH, C.KNOCKBACK_SPLASH, false, sx, sy);
    } else {
      audio.groundHit();
      this.miss();
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
    this.shakeT = 0.1;
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
          this.after(0.5, () => this.fx.text('SPEEDSTER READY!', W / 2, 52, { color: PAL.cyan, life: 1.6, vy: -4 }));
        }
      }
    }
    // juice: hit-stop, shake, firework burst
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
    this.zombieResolved();
  }

  miss() {
    this.streak = 0;
    if (!this.charged) this.meter = 0;
    const z = this.zombie;
    if (z && !z.dead && z.taunt()) {
      audio.taunt(z.tauntKind);
      const c = z.centerPx;
      this.fx.text(TAUNT_LINES[z.tauntKind], Math.min(W - 30, c.x), c.y - z.def.sh / 2 - 14, { color: PAL.green, life: 1.4, vy: -6 });
    }
  }

  doorBreach(z) {
    this.lives--;
    this.streak = 0;
    audio.doorKnock();
    this.shakeT = 0.35;
    const c = z.centerPx;
    this.fx.particles.burst(c.x, c.y, 24, [RAMPS.smoke, RAMPS.green], { speed: [20, 60], life: [0.4, 0.9], gravity: -10 });
    this.fx.text('-1 LIFE', 60, 210, { color: PAL.red2, life: 1.4 });
    if (this.lives <= 0) {
      this.zombie = null;
      this.timers = [];
      this.after(1.2, () => this.gameOver());
    } else {
      this.zombieResolved();
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
    if (this.zombie) this.zombie.draw(ctx);
    if (this.speedster) this.speedster.draw(ctx);
    this.player.draw(ctx, this.t);
    this.drawLauncher(ctx);
    if (this.rocket) this.rocket.draw(ctx, this.t);
    this.fx.drawWorld(ctx);
    this.fx.drawTexts(ctx);
    ctx.restore();

    if (this.mode !== 'title') {
      drawHUD(ctx, this, this.t);
      drawBanner(ctx, this, this.t);
      if (this.rocket) drawOffscreenRocket(ctx, toScreenX(this.rocket.s.x), toScreenY(this.rocket.s.y));
    }
    const ui = { buttons: this.menuButtons(), hover: this.hover, best: this.save.best, score: this.score, wave: this.wave, kills: this.kills, newBest: this.newBest };
    if (this.mode === 'title') drawTitle(ctx, ui, this.t);
    else if (this.mode === 'pause') drawPause(ctx, ui);
    else if (this.mode === 'gameover') drawGameOver(ctx, ui, this.t);
  }

  drawLauncher(ctx) {
    if (this.rocket || this.speedster) return;
    const ax = LAUNCH_PX.x, ay = LAUNCH_PX.y;
    if (this.aim) {
      const { shot } = this.aim;
      const a = (shot.angle * Math.PI) / 180;
      // rocket sits back along the (clamped) aim direction, like a slingshot pouch
      const rx = Math.round(ax - Math.cos(a) * shot.len * 0.5);
      const ry = Math.round(ay + Math.sin(a) * shot.len * 0.5);
      const col = shot.power < 0.6 ? PAL.gold : shot.power < 0.85 ? PAL.orange : PAL.red2;
      // preview dots: real physics, no wind, first 40 % of the flight
      const dots = previewDots(shot.angle, shot.v0);
      // big outlined dots so they read against any part of the sky or skyline
      const blink = Math.floor(this.t * 8);
      dots.forEach((p, i) => {
        if (i < 1) return;
        const x = Math.round(toScreenX(p.x)) - 1, y = Math.round(toScreenY(p.y)) - 1;
        ctx.fillStyle = PAL.black; ctx.fillRect(x - 1, y - 1, 4, 4);
        ctx.fillStyle = (i + blink) % 4 === 0 ? PAL.cyan : i % 2 ? PAL.white : PAL.yellow;
        ctx.fillRect(x, y, 2, 2);
      });
      const end = dots[dots.length - 1];
      if (end && end.landed) { // landing marker on the street
        const lx = Math.round(toScreenX(end.x));
        ctx.fillStyle = PAL.black; ctx.fillRect(lx - 4, C.GROUND_Y - 1, 9, 3);
        ctx.fillStyle = PAL.red2; ctx.fillRect(lx - 3, C.GROUND_Y, 7, 1);
        ctx.fillStyle = PAL.white; ctx.fillRect(lx, C.GROUND_Y - 1, 1, 3);
      }
      // stretched launch line + power ring
      pixelLine(ctx, ax, ay, rx, ry, col);
      const r = 7;
      const steps = 24, lit = Math.round(steps * shot.power);
      for (let i = 0; i < steps; i++) {
        const ang = -Math.PI / 2 + (i / steps) * Math.PI * 2;
        ctx.fillStyle = i < lit ? col : PAL.navy2;
        ctx.fillRect(Math.round(rx + Math.cos(ang) * r), Math.round(ry + Math.sin(ang) * r), 1, 1);
      }
      drawRocketSprite(ctx, rx, ry, -a, false, this.t);
    } else if (this.mode !== 'play' || this.inputLock <= 0) {
      drawRocketSprite(ctx, ax, ay - 1, -Math.PI / 3, false, this.t);
      if (this.canFire()) {
        const pulse = Math.floor(this.t * 3) % 2;
        ringCircle(ctx, ax, ay - 1, 6 + pulse, pulse ? PAL.yellow : PAL.gold, 1, 3);
      }
    }
  }
}
