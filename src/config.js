// Every tunable number from GAME_DESIGN.md lives here, so playtest changes are one-line edits.

// ---- Screen ----
export const W = 480;
export const H = 270;
export const PX_PER_M = 10;
export const GROUND_Y = 250;          // screen y (px) of world y = 0
export const HOUSE_W_PX = 40;
export const HOUSE_H_PX = 80;
export const DOOR_X = 4.0;            // m — house right wall / door; zombies must reach this
export const FIELD_MAX_X = 48;        // m — right edge of the screen

// ---- Rocket physics (metres, y up) ----
export const G = 9.81;
export const THRUST = 12;
export const BURN_TIME = 0.5;
export const DRAG_K = 0.01;
export const V_MIN = 4;
export const V_MAX = 16;
export const LAUNCH_POINT = { x: 2.5, y: 8.5 };
export const ROCKET_RADIUS = 0.3;
export const MAX_FLIGHT = 6;
export const DT = 1 / 120;
export const MAX_STEPS_PER_FRAME = 5;

// ---- Controls ----
export const GRAB_RADIUS = 24;        // px native
export const MAX_PULL = 60;           // px native
export const MIN_PULL = 6;            // px — less than this cancels
export const ANGLE_MIN = -60;         // degrees (negative = aim down from the roof)
export const ANGLE_MAX = 85;
export const PREVIEW_DOT_DT = 0.06;   // s between preview dots
export const PREVIEW_FRACTION = 1.0;  // fraction of flight shown (still ignores wind)

// ---- Combat ----
export const SPLASH_RADIUS = 2.5;     // m from nearest point of hitbox
export const DAMAGE_DIRECT = 1;
export const DAMAGE_SPLASH = 0.5;
export const KNOCKBACK_DIRECT = 1.5;  // m, divided by weight
export const KNOCKBACK_SPLASH = 0.75;
export const KNOCKBACK_TIME = 0.18;   // s the push-back takes
export const STAGGER_TIME = 0.35;
export const MISS_TAUNT_TIME = 1.5;
export const INPUT_LOCK_AFTER = 0.6;
export const NEXT_SPAWN_DELAY = 1.0;
export const RISE_TIME = 0.6;         // zombie climbs out of the ground
export const HIT_STOP = 0.08;
export const SHAKE_PX = 3;
export const SHAKE_TIME = 0.2;
export const KILL_PARTICLES = [60, 90];

// ---- Scoring / lives ----
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const BONUS_LIFE_EVERY = 3;
export const DIRECT_HIT_BONUS = 2;
export const STREAK_STEP = 0.5;
export const STREAK_CAP = 3;
export const WAVE_BANNER_TIME = 2.5;

// ---- Power-up ----
export const POWERUP_SEGMENTS = 3;
export const SPEEDSTER_SPEED = 25;    // m/s
export const SPEEDSTER_SKID_TIME = 0.35;

// ---- Zombies ----
export const ZOMBIES = {
  runner: { w: 0.6, h: 1.2, sw: 12, sh: 14, speed: 2.4, hp: 1, points: 100, weight: 0.7 },
  walker: { w: 0.8, h: 1.8, sw: 16, sh: 20, speed: 1.3, hp: 1, points: 50,  weight: 1.0 },
  brute:  { w: 1.2, h: 2.3, sw: 20, sh: 26, speed: 0.8, hp: 2, points: 150, weight: 1.6 },
  tank:   { w: 1.6, h: 2.9, sw: 26, sh: 32, speed: 0.5, hp: 3, points: 300, weight: 3.0 },
};
export const SPEED_JITTER = 0.10;

export const WAVES = [
  { count: 5, mix: { walker: 100, runner: 0,  brute: 0,  tank: 0  }, dist: [18, 30], wind: 0 },
  { count: 6, mix: { walker: 70,  runner: 30, brute: 0,  tank: 0  }, dist: [20, 36], wind: 0 },
  { count: 7, mix: { walker: 50,  runner: 30, brute: 20, tank: 0  }, dist: [22, 40], wind: 1.5 },
  { count: 8, mix: { walker: 30,  runner: 35, brute: 35, tank: 0  }, dist: [24, 42], wind: 3 },
  { count: 9, mix: { walker: 20,  runner: 30, brute: 30, tank: 20 }, dist: [26, 44], wind: 4 },
];
export const ENDLESS = {
  extraPerWave: 1,
  windStep: 0.5,          // wind grows by this per endless wave…
  windMax: 5,             // …up to ±5 m/s
  speedMulPerWave: 1.05,
  speedMulCap: 1.5,
};

// ---- Palette: Endesga 32 ----
export const PAL = {
  rust: '#be4a2f', clay: '#d77643', sand: '#ead4aa', tan: '#e4a672', brown: '#b86f50',
  brownD: '#733e39', plumD: '#3e2731', red: '#a22633', red2: '#e43b44', orange: '#f77622',
  gold: '#feae34', yellow: '#fee761', green: '#63c74d', green2: '#3e8948', green3: '#265c42',
  teal: '#193c3e', blue3: '#124e89', blue: '#0099db', cyan: '#2ce8f5', white: '#ffffff',
  grey1: '#c0cbdc', grey2: '#8b9bb4', grey3: '#5a6988', navy2: '#3a4466', navy: '#262b44',
  black: '#181425', pink: '#ff0044', purple: '#68386c', magenta: '#b55088', rose: '#f6757a',
  peach: '#e8b796', skin2: '#c28569',
};

// Colour ramps (bright → dark) for particles.
export const RAMPS = {
  gold:    [PAL.white, PAL.yellow, PAL.gold, PAL.orange, PAL.rust, PAL.brownD],
  magenta: [PAL.white, PAL.rose, PAL.pink, PAL.magenta, PAL.purple, PAL.plumD],
  green:   [PAL.white, PAL.yellow, PAL.green, PAL.green2, PAL.green3, PAL.teal],
  cyan:    [PAL.white, PAL.cyan, PAL.blue, PAL.blue3, PAL.navy2, PAL.navy],
  smoke:   [PAL.grey1, PAL.grey2, PAL.grey3, PAL.navy2],
  dirt:    [PAL.tan, PAL.brown, PAL.brownD, PAL.plumD],
  flame:   [PAL.white, PAL.yellow, PAL.gold, PAL.orange, PAL.red2, PAL.red],
};

export const STORAGE_KEY = 'diwali-rocket-defense';
