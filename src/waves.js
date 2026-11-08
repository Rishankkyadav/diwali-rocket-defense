import { WAVES, ENDLESS } from './config.js';

export const rand = (a, b) => a + Math.random() * (b - a);

// Parameters for wave n (1-based). Waves past the table become endless mode.
export function waveParams(n) {
  if (n <= WAVES.length) {
    const w = WAVES[n - 1];
    return { n, count: w.count, mix: w.mix, dist: w.dist, wind: w.wind, speedMul: 1, endless: false };
  }
  const last = WAVES[WAVES.length - 1];
  const k = n - WAVES.length; // 1, 2, 3 …
  return {
    n,
    count: last.count + k * ENDLESS.extraPerWave,
    mix: last.mix,
    dist: last.dist,
    wind: Math.min(ENDLESS.windMax, last.wind + k * ENDLESS.windStep),
    speedMul: Math.min(ENDLESS.speedMulCap, Math.pow(ENDLESS.speedMulPerWave, k)),
    endless: true,
  };
}

// Exact counts from the percentage mix (largest remainder), then shuffled.
export function buildWave(params) {
  const types = Object.keys(params.mix);
  const raw = types.map((t) => ({ t, v: (params.mix[t] / 100) * params.count }));
  const counts = raw.map((r) => ({ t: r.t, n: Math.floor(r.v), rem: r.v - Math.floor(r.v) }));
  let left = params.count - counts.reduce((s, c) => s + c.n, 0);
  [...counts].sort((a, b) => b.rem - a.rem).forEach((c) => { if (left > 0 && c.rem > 0) { c.n++; left--; } });
  const list = [];
  for (const c of counts) for (let i = 0; i < c.n; i++) list.push(c.t);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function rollWind(params) {
  if (!params.wind) return 0;
  return Math.round(rand(-params.wind, params.wind) * 10) / 10;
}
