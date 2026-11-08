// All sounds are synthesised with WebAudio — no asset files, nothing to license.
let ac = null;
let master, sfxBus, musicBus, noiseBuf;
let soundOn = true;
let musicOn = true;
let creak = null;
let musicTimer = null;
let musicStep = 0;
let nextNoteTime = 0;
let drone = null;

export function isSoundOn() { return soundOn; }
export function isMusicOn() { return musicOn; }

export function setSound(on) {
  soundOn = on;
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.02);
}
export function setMusic(on) {
  musicOn = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.16 : 0, ac.currentTime, 0.05);
}

// Must be called from inside a user gesture (pointerdown / keydown).
export function unlock() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = soundOn ? 1 : 0; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.16 : 0; musicBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { /* audio unavailable — game still works */ }
}

const ready = () => ac && ac.state === 'running';

// ---------- primitives ----------
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.3, delay = 0, attack = 0.005, bus = sfxBus, filter = null }) {
  if (!ready()) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ac.createGain(); env(g, t, attack, vol, dur);
  let node = o;
  if (filter) {
    const f = ac.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.Q || 1;
    o.connect(f); node = f;
  }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, type = 'bandpass', f0 = 1000, f1 = f0, Q = 1, delay = 0, attack = 0.005, bus = sfxBus }) {
  if (!ready()) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = Q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain(); env(g, t, attack, vol, dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// ---------- game sounds ----------
export function creakStart() {
  if (!ready() || creak) return;
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
  const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22;
  const lg = ac.createGain(); lg.gain.value = 0.03;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
  const g = ac.createGain(); g.gain.value = 0.0;
  lfo.connect(lg); lg.connect(g.gain);
  o.connect(f); f.connect(g); g.connect(sfxBus);
  o.start(); lfo.start();
  creak = { o, lfo, g, f };
}
export function creakSet(power) {
  if (!creak) return;
  const t = ac.currentTime;
  creak.o.frequency.setTargetAtTime(80 + power * 260, t, 0.03);
  creak.f.frequency.setTargetAtTime(500 + power * 1200, t, 0.03);
  creak.lfo.frequency.setTargetAtTime(14 + power * 30, t, 0.05);
}
export function creakStop() {
  if (!creak) return;
  const c = creak; creak = null;
  const t = ac.currentTime;
  c.g.gain.cancelScheduledValues(t);
  c.g.gain.setValueAtTime(0, t);
  c.o.stop(t + 0.05); c.lfo.stop(t + 0.05);
}

export function launch() {
  tone({ type: 'sine', f0: 120, f1: 40, dur: 0.25, vol: 0.6 });            // launcher thump
  noise({ dur: 0.2, vol: 0.4, type: 'lowpass', f0: 1800, f1: 300 });       // backblast
  noise({ dur: 0.6, vol: 0.35, type: 'bandpass', f0: 600, f1: 3000, Q: 1.2 });
  noise({ dur: 0.5, vol: 0.12, type: 'highpass', f0: 5000, delay: 0.05 }); // fizz
}
export function fizz() { noise({ dur: 0.08, vol: 0.05, type: 'highpass', f0: 6000 }); }

export function kill() {
  tone({ type: 'sine', f0: 140, f1: 35, dur: 0.5, vol: 0.7 });
  noise({ dur: 0.35, vol: 0.5, type: 'lowpass', f0: 2500, f1: 200 });
  for (let i = 0; i < 14; i++) {
    noise({ dur: 0.03, vol: 0.18 + Math.random() * 0.15, type: 'highpass', f0: 3000 + Math.random() * 4000, delay: 0.08 + Math.random() * 0.7 });
  }
}
export function groundHit() {
  tone({ type: 'sine', f0: 90, f1: 40, dur: 0.18, vol: 0.5 });
  noise({ dur: 0.12, vol: 0.2, type: 'lowpass', f0: 1200, f1: 300 });
  tone({ type: 'square', f0: 900, f1: 500, dur: 0.06, vol: 0.06, delay: 0.04 });
}
export function grunt() {
  tone({ type: 'sawtooth', f0: 150, f1: 85, dur: 0.25, vol: 0.25, filter: { type: 'lowpass', freq: 700 } });
  noise({ dur: 0.1, vol: 0.2, type: 'lowpass', f0: 800 });
}

// "SIUUU": a sawtooth voice through two moving formant filters (ee → oo).
export function siuuu() {
  if (!ready()) return;
  const t = ac.currentTime;
  noise({ dur: 0.16, vol: 0.12, type: 'highpass', f0: 4500 }); // the "S"
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(240, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(340, t + 0.3);
  o.frequency.setValueAtTime(340, t + 0.95);
  o.frequency.exponentialRampToValueAtTime(300, t + 1.15);
  const vib = ac.createOscillator(); vib.frequency.value = 6;
  const vg = ac.createGain(); vg.gain.value = 7; vib.connect(vg); vg.connect(o.frequency);
  const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
  f1.frequency.setValueAtTime(300, t); f1.frequency.linearRampToValueAtTime(330, t + 0.4);
  const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
  f2.frequency.setValueAtTime(2300, t); f2.frequency.exponentialRampToValueAtTime(800, t + 0.4);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.16);
  g.gain.setValueAtTime(0.9, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus);
  o.start(t + 0.1); vib.start(t + 0.1); o.stop(t + 1.25); vib.stop(t + 1.25);
}

export function fistPump() { tone({ type: 'square', f0: 520, f1: 780, dur: 0.1, vol: 0.06 }); }

export function taunt(kind) {
  const notes = [
    [[392, 0.12], [330, 0.12], [440, 0.12], [330, 0.2]],   // "nyah-nyah"
    [[294, 0.2], [277, 0.2], [262, 0.2], [247, 0.45]],      // sad trombone
    [[523, 0.07], [587, 0.07], [523, 0.07], [587, 0.07], [659, 0.07], [784, 0.18]], // goofy trill
  ][kind % 3];
  let d = 0;
  for (const [f, len] of notes) {
    tone({ type: kind === 1 ? 'sawtooth' : 'square', f0: f, f1: kind === 1 ? f * 0.97 : f, dur: len, vol: 0.07, delay: d, filter: { type: 'lowpass', freq: 1800 } });
    d += len;
  }
}

export function sprint() {
  noise({ dur: 0.45, vol: 0.3, type: 'bandpass', f0: 400, f1: 2500, Q: 2 });
}
export function skid() {
  noise({ dur: 0.35, vol: 0.25, type: 'bandpass', f0: 3000, f1: 1200, Q: 4 });
  tone({ type: 'sawtooth', f0: 900, f1: 600, dur: 0.3, vol: 0.05, filter: { type: 'bandpass', freq: 1500, Q: 3 } });
}
// Two loud "WOOF!"s: a pitch-dropping growl through a mouth-ish formant plus a breathy burst.
export function bark() {
  if (!ready()) return;
  [0, 0.24].forEach((d, i) => {
    const t = ac.currentTime + d;
    const f0 = i ? 440 : 520;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.8, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.16);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(1400, t); bp.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 0.2);
    noise({ dur: 0.1, vol: 0.35, type: 'bandpass', f0: 1800, f1: 700, Q: 1.5, delay: d });
  });
}

export function doorKnock() {
  for (let i = 0; i < 3; i++) {
    tone({ type: 'sine', f0: 180, f1: 90, dur: 0.1, vol: 0.6, delay: i * 0.16 });
    noise({ dur: 0.05, vol: 0.25, type: 'lowpass', f0: 900, delay: i * 0.16 });
  }
}
export function ambientPop() {
  const v = 0.03 + Math.random() * 0.04;
  tone({ type: 'sine', f0: 100, f1: 40, dur: 0.3, vol: v * 2 });
  for (let i = 0; i < 5; i++) noise({ dur: 0.03, vol: v, type: 'highpass', f0: 3000, delay: 0.05 + Math.random() * 0.4 });
}
export function uiClick() { tone({ type: 'square', f0: 660, f1: 990, dur: 0.06, vol: 0.06 }); }
export function waveStart() {
  [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.09 }));
}
export function lifeUp() {
  [659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.06, delay: i * 0.08 }));
}
export function powerReady() {
  [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.1, vol: 0.1, delay: i * 0.06 }));
}
export function gameOver() {
  [392, 370, 349, 330, 262].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.3, vol: 0.08, delay: i * 0.22, filter: { type: 'lowpass', freq: 1200 } }));
}

// ---------- music: dhol groove + shehnai-ish melody in Raag Bhupali, over a drone ----------
const SA = 293.66; // D4
const BPM = 100;
const STEP = 60 / BPM / 4; // 16th note
// [semitones from Sa | null, length in 16ths] — 64 steps total
const MELODY = [
  [7, 2], [9, 2], [12, 4], [9, 2], [7, 2], [4, 4], [7, 2], [4, 2], [2, 4], [0, 8],
  [2, 2], [4, 2], [7, 4], [9, 2], [7, 2], [4, 4], [2, 2], [4, 2], [2, 2], [0, 2], [0, 8],
];
const melodyAt = {};
{ let s = 0; for (const [n, len] of MELODY) { melodyAt[s] = [n, len]; s += len; } }
const DHA = new Set([0, 3, 6, 10, 12]);
const TIN = new Set([2, 4, 8, 9, 14, 15]);

function dhol(t, low) {
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(low ? 95 : 260, t);
  o.frequency.exponentialRampToValueAtTime(low ? 45 : 180, t + (low ? 0.25 : 0.08));
  const g = ac.createGain(); env(g, t, 0.003, low ? 0.9 : 0.35, low ? 0.3 : 0.1);
  o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  if (!low) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 2;
    const g2 = ac.createGain(); env(g2, t, 0.002, 0.25, 0.05);
    s.connect(f); f.connect(g2); g2.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.08);
  }
}

function shehnai(t, semis, dur) {
  const f = SA * Math.pow(2, semis / 12);
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const vib = ac.createOscillator(); vib.frequency.value = 5.5;
  const vg = ac.createGain(); vg.gain.value = f * 0.012; vib.connect(vg); vg.connect(o.frequency);
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
  g.gain.setValueAtTime(0.35, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); bp.connect(g); g.connect(musicBus);
  o.start(t); vib.start(t); o.stop(t + dur + 0.02); vib.stop(t + dur + 0.02);
}

function scheduleMusic() {
  if (!ac) return;
  while (nextNoteTime < ac.currentTime + 0.12) {
    const s16 = musicStep % 16;
    if (DHA.has(s16)) dhol(nextNoteTime, true);
    if (TIN.has(s16)) dhol(nextNoteTime, false);
    const m = melodyAt[musicStep % 64];
    if (m) shehnai(nextNoteTime, m[0], m[1] * STEP * 0.95);
    nextNoteTime += STEP;
    musicStep++;
  }
}

export function startMusic() {
  if (!ac || musicTimer) return;
  musicStep = 0;
  nextNoteTime = ac.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 25);
  // tanpura-ish drone on Sa and Pa
  const g = ac.createGain(); g.gain.value = 0.12; g.connect(musicBus);
  const oscs = [SA / 2, (SA * 1.5) / 2, SA / 4].map((f) => {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(); return o;
  });
  drone = { g, oscs };
}
export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (drone) { drone.oscs.forEach((o) => o.stop()); drone = null; }
}
