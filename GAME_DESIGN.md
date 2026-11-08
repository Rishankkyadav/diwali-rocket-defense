# Diwali Rocket Defense — Game Design Doc

Nov 8, 2026 · @rishank

## Overview

Diwali Rocket Defense is a 2D pixel-art artillery game. You defend your rooftop on Diwali night by slingshotting firework rockets at zombies, one at a time, before they reach your door.

### Pillars

- **Feel every shot.** Drag-back aiming with real rocket physics: thrust, gravity, drag and wind.
- **Big payoffs.** A hit explodes the zombie and triggers the player's celebration. A miss earns you a zombie taunt.
- **Festive, not grim.** A glowing dusk cityscape with fireworks everywhere. The zombies are goofy, not gory.

**Platform:** browser, desktop and mobile. Mouse drag on desktop, touch drag on phones. Landscape only.

**v1 scope:** one rocket type, four zombie types, five waves plus endless mode, one power-up, wind from wave 3, lives and score, local high score. Out of scope for v1: extra ammo types, upgrades, online leaderboards.

**Characters:** the launcher is an original footballer character in a kit you design. The power-up is an original hyperactive speedster. Final look is the design lead's call.

## Core loop and screen flow

One zombie at a time walks toward your door. You keep firing until it dies or reaches the door, then the next one spawns.

1. **Spawn.** A zombie appears at the right edge, 18 to 44 m from the house, and starts walking.
2. **Aim.** Drag the rocket back. A partial dotted arc shows where it will start to go.
3. **Launch.** Release. The rocket burns, coasts and lands.
4. **Resolve.** On a kill, the zombie explodes into firework sparks and the player celebrates with a jump-spin and a "SIUUU" shout. On a non-lethal hit, the zombie staggers and is knocked back. On a miss, the zombie stops for 1.5 s, does a taunt dance, then keeps walking.
5. **Repeat** from Aim until the zombie dies, then from Spawn until the wave is cleared.

**Lose condition:** a zombie that reaches the door costs one life and is removed. You start with 3 lives. At 0 lives, the game is over.

**Screens:** Title (Play, high score, sound toggle) → Play (with a wave banner between waves and a pause menu) → Game Over (score, best score, Retry, Title).

Every shot ends in one question: is the zombie dead? If not, you fire again while it keeps walking.

## Controls

Power comes from how far you drag the rocket back, and the angle is the opposite of your drag direction, like a slingshot.

- **Grab:** press on or near the rocket (a 24 px grab radius at native resolution, so it works with thumbs).
- **Pull:** the pull vector is anchor − pointer, clamped to `MAX_PULL` (60 px native). Power t = length / `MAX_PULL`, from 0 to 1.
- **Launch speed:** v0 = `V_MIN` + (`V_MAX` − `V_MIN`) × t.
- **Angle:** the direction of the pull vector, clamped between 5° and 85° above horizontal.
- **Release to fire.** A release with less than 6 px of pull cancels the shot.
- **Feedback while pulling:** the player leans back further with more power. A stretched launch line and a power ring around the rocket change colour from gold to red near max.
- **Trajectory preview:** while pulling, simulate the shot with the real physics but without wind. Draw a dot every 0.05 s for the first 40% of the flight time. The rest of the arc, and the wind's effect, you have to read yourself.
- **Power-up:** tap the power-up icon (or press S) when it's charged.
- **Pause:** Esc or the pause icon.

## Physics

The rocket burns for 0.5 s, then flies ballistically with quadratic air drag measured against the wind. Physics runs in metres with y pointing up, at a fixed 120 Hz step. Rendering converts to pixels at 10 px per metre.

| Constant | Value | Notes |
|---|---|---|
| G | 9.81 m/s² | Real gravity |
| THRUST | 12 m/s² | Applied along the current velocity, so the rocket turns naturally as it climbs |
| BURN_TIME | 0.5 s | Then coast |
| DRAG_K | 0.01 per m | Quadratic drag coefficient |
| V_MIN / V_MAX | 4 / 16 m/s | Launch speed at zero and full pull |
| LAUNCH_POINT | (2.5 m, 8.5 m) | Rooftop, measured from the house's left wall and the ground |
| ROCKET_RADIUS | 0.3 m | Collision circle |
| MAX_FLIGHT | 6 s | Rocket fizzles after this |
| DT | 1/120 s | Fixed timestep, accumulator loop |
| PX_PER_M | 10 | 45 m field fits a 480 px wide screen |

With these values the longest shot lands around 45 to 50 m, which just covers the field. Treat every number as a starting point for playtesting.

Step function (semi-implicit Euler):

```js
function stepRocket(r, wind, dt) {
  let ax = 0, ay = -G;
  if (r.burnLeft > 0) {                 // thrust along velocity
    const s = Math.hypot(r.vx, r.vy) || 1;
    ax += THRUST * r.vx / s;
    ay += THRUST * r.vy / s;
    r.burnLeft -= dt;
  }
  const rx = r.vx - wind, ry = r.vy;    // velocity relative to air
  const rs = Math.hypot(rx, ry);
  ax -= DRAG_K * rs * rx;
  ay -= DRAG_K * rs * ry;
  r.vx += ax * dt;  r.vy += ay * dt;    // velocity first
  r.x  += r.vx * dt; r.y  += r.vy * dt; // then position
}
```

**Wind:** a horizontal air speed in m/s, rolled at the start of each zombie and shown by a smoke plume and an arrow with a number in the HUD. Positive blows toward the zombies.

**Game loop:** accumulate real elapsed time, run `stepRocket` and zombie updates in fixed DT steps, cap catch-up at 5 steps per frame, then render once. This keeps shots identical on 60 Hz and 144 Hz screens.

**Collisions:** the rocket ends when its circle overlaps a zombie's hitbox, touches the ground (y ≤ 0), or reaches `MAX_FLIGHT`.

## Combat

A direct hit does 1 damage, and a near miss does 0.5 splash damage, so accuracy is rewarded but close shots still count.

| Result | Condition | Damage | Knockback |
|---|---|---|---|
| Direct hit | Rocket circle overlaps the zombie hitbox | 1 | 1.5 m |
| Splash | Impact point within 2.5 m of the nearest point of the hitbox | 0.5 | 0.75 m |
| Miss | Neither | 0 | none |

Knockback is divided by the zombie's weight factor (Runner 0.7, Walker 1, Brute 1.6, Tank 3), so heavy zombies barely move.

### Outcomes

- **Kill:** 80 ms hit-stop, 3 px screen shake for 0.2 s, and the zombie bursts into 60 to 90 firework particles in gold, magenta and green. The player plays the jump-spin celebration (about 1.2 s) and a "SIUUU" text pops above them. The next zombie spawns 1 s later.
- **Hit, not dead:** the zombie flashes white for 2 frames, staggers back and loses its HP pip. The player does a short fist pump.
- **Miss:** a small ground burst where the rocket lands. The zombie stops for 1.5 s and plays one of 3 original taunt dances, picked at random, then resumes walking.

**Input lock:** the player can't grab a new rocket while one is in the air, and for 0.6 s after it resolves. The celebration and taunts keep playing, but you can fire through them.

**Score:** points per kill by zombie type (see the roster), ×2 if the killing blow was a direct hit. A streak multiplier adds +0.5× per consecutive kill without a miss, capped at 3×.

## Zombies and waves

Speed and toughness trade off: small zombies are fast and die in one hit, big ones are slow and take two or three.

| Type | Hitbox (w × h) | Sprite (native px) | Speed | HP | Points |
|---|---|---|---|---|---|
| Runner | 0.6 × 1.2 m | 12 × 14 | 2.4 m/s | 1 | 100 |
| Walker | 0.8 × 1.8 m | 16 × 20 | 1.3 m/s | 1 | 50 |
| Brute | 1.2 × 2.3 m | 20 × 26 | 0.8 m/s | 2 | 150 |
| Tank | 1.6 × 2.9 m | 26 × 32 | 0.5 m/s | 3 | 300 |

Each zombie's spawn distance is random within the wave's range, and each gets a ±10% random speed jitter so no two shots are the same.

| Wave | Zombies | Mix (Walker / Runner / Brute / Tank) | Spawn distance | Wind |
|---|---|---|---|---|
| 1 | 5 | 100 / 0 / 0 / 0 % | 18–30 m | none |
| 2 | 6 | 70 / 30 / 0 / 0 % | 20–36 m | none |
| 3 | 7 | 50 / 30 / 20 / 0 % | 22–40 m | ±1.5 m/s |
| 4 | 8 | 30 / 35 / 35 / 0 % | 24–42 m | ±3 m/s |
| 5 | 9 | 20 / 30 / 30 / 20 % | 26–44 m | ±4 m/s |

**Endless mode** (after wave 5): +1 zombie per wave, wind up to ±5 m/s, all speeds ×1.05 per wave, capped at ×1.5.

**Between waves:** a 2.5 s "Wave N" banner, and a bonus life every 3 waves up to a maximum of 5.

## Power-up: the speedster

Three kills in a row without a miss charge one speedster, which instantly kills the current zombie, Tanks included.

- **Charge:** a 3-segment meter in the HUD. Each kill fills one segment, and any miss empties it. Non-lethal hits neither fill nor empty it.
- **Storage:** one charge at most. While stored, the icon glows and the meter stops filling.
- **Trigger:** tap the icon or press S. Only works while a zombie is on the field and no rocket is in the air.
- **Sequence (about 2 s):** the speedster bursts out of the front door, sprints at 25 m/s with a dust trail, slams into the zombie (zombie poofs into sparks with the full kill effects), skids, and sprints back inside. The game keeps running but rocket input is locked.
- **Scoring:** full points for the zombie, but no direct-hit bonus and the streak is not increased.
- **Sprite:** 16 × 22 native px, run cycle of 6 frames plus a skid frame. An original character, design to be decided.

## Art direction

The game is drawn at 480 × 270 and scaled up by whole numbers (×2 = 960 × 540, ×4 = 1920 × 1080), with letterboxing for other screen shapes. That's a step up from the 320 × 180 we first discussed, so the zombies are big enough to read at 10 px per metre.

**Rendering rules:** `imageSmoothingEnabled = false`, all sprites drawn at whole-pixel positions, and one palette of 32 colours for everything. A ready-made Lospec palette such as Endesga 32 is a fine start.

### Scene: Diwali at dusk, back to front

1. **Sky:** dithered gradient bands from deep indigo at the top to rose and amber at the horizon, with a few early stars.
2. **Ambient fireworks:** bursts behind the skyline every 0.8 to 2.5 s, 40 to 80 particles each, in gold, magenta, green and cyan, at about 60% brightness so they never compete with your own rockets.
3. **Far skyline:** flat silhouettes of domes, a temple shikhara and high-rises, moving at 0.2× parallax with the screen shake.
4. **Near skyline:** houses with flat roofs, water tanks and balconies, warm windows that flicker, and strings of fairy lights between buildings that twinkle in sequence.
5. **Street:** the lane the zombies walk on, with rangoli outlines on doorsteps and a few lanterns on poles.
6. **Your house:** at the left edge (40 × 80 px), a row of diyas on the parapet whose flames animate, a lantern, and the door the zombies are trying to reach.

### Asset list

| Asset | Size (native px) | Frames |
|---|---|---|
| Player: idle, pull-back lean, release, fist pump, jump-spin celebration | 16 × 24 | 4 / 3 / 2 / 4 / 10 |
| Runner, Walker, Brute, Tank: walk, stagger, taunt × 3 | per roster table | 6 / 2 / 8 each |
| Speedster: run, skid | 16 × 22 | 6 / 1 |
| Rocket with flame trail | 6 × 3 | 2 |
| Explosion sprite (paired with particles) | 32 × 32 | 6 |
| Diya flame | 3 × 5 | 4 |
| House, rooftop, door | 40 × 80 | 1 |
| Skyline layers (far, near) | 480 × 120 each | 1 (+ window and light overlays) |
| HUD: hearts, wind arrow, power-up meter and icon, score digits | 8 × 8 tiles | 1–2 |
| "SIUUU" pop text and wave banner | text sprite | 1 |

Placeholder rectangles are fine until milestone 6, so art never blocks the game logic.

## Audio

Short, punchy sound effects carry the feel. Music is a quiet festive loop under them, mutable from the title screen.

| Sound | When |
|---|---|
| Rubber-band creak, rising pitch with power | While pulling |
| Rocket whoosh and fizz | Launch, through the burn |
| Firework crackle and boom | Kill |
| Thud and small pop | Ground hit, miss |
| Grunt | Non-lethal hit |
| "SIUUU" shout | Celebration |
| Short goofy taunt sting × 3 | Zombie taunt dances |
| Sprint whoosh, skid | Speedster |
| Door knock | Zombie reaches the door |
| Distant firework pops | Ambient, randomised, low volume |
| Festive loop (dhol and shehnai feel) | Background music |

Use royalty-free or self-made sounds (free sites like freesound.org, or a generator like jsfxr for the retro effects). Browsers block audio until the first tap, so start the audio context on the Play button.

## Tech plan

Plain HTML5 Canvas and vanilla JavaScript modules, with Vite as the dev server. There's no engine to learn, and the physics stays fully under your control.

### File structure

```
diwali-rocket-defense/
  index.html
  GAME_DESIGN.md          ← this doc, exported to Markdown
  src/
    main.js               boot, fixed-timestep loop, scaling
    config.js             every constant from this doc
    input.js              pointer and touch drag
    physics.js            stepRocket, collisions
    waves.js              wave tables, spawning, endless mode
    entities/
      player.js  rocket.js  zombie.js  speedster.js
    fx/
      particles.js        explosions and ambient fireworks
      background.js       sky, skyline layers, lights
    ui/
      hud.js  screens.js
    audio.js
  assets/
    sprites/  sfx/  music/
```

### Milestones (each one playable before moving on)

1. **Skeleton:** canvas at 480 × 270 with integer scaling, fixed-timestep loop, debug overlay showing FPS.
2. **Shooting:** drag aiming, rocket physics, preview dots, ground collision. Grey boxes only.
3. **Target:** one Walker walking in, hitbox collision, kill and miss outcomes, lives and the door.
4. **Game:** full roster, HP and knockback, waves and endless mode, wind, score, streak, game over.
5. **Power-up:** meter, storage, speedster sequence.
6. **Art:** background layers, ambient fireworks, all sprites replacing boxes.
7. **Juice:** celebration, taunts, hit-stop, screen shake, particles tuned.
8. **Polish:** audio, title and game over screens, local high score, mobile touch testing.
9. **Ship:** deploy as a static site (GitHub Pages, Netlify or Vercel) and share the link.

Working with the CLI: put this doc in the repo as `GAME_DESIGN.md` and ask for one milestone at a time, for example "Read GAME_DESIGN.md and build milestone 2". Keep all tunable numbers in `config.js` so playtest changes are one-line edits.

## v1.1 changes after playtesting (Nov 2026)

The slingshot drag felt unintuitive and glitchy on trackpads, and the game was too easy, so these parts of the spec changed:

- **Aim is golf-style** (modelled on Golf Clash and 3-click golf swing meters). You place a target reticle, and the game solves the launch angle along the low, direct trajectory to it. The full no-wind path is drawn as dots. Click to start a swing meter, then click again (or hold and release) when the needle is in the centre. The needle's offset from centre becomes a launch-angle error, up to ±10° at the edges, and is 0 inside the perfect zone (±7%). The needle speeds up each wave.
- **Rocket physics:** fixed launch speed of 14 m/s, `THRUST` 16 m/s² for a `BURN_TIME` of 0.8 s, which gives a max range of about 55 m. Close shots fly nearly straight and only far ones arc. The aim angle can go from −85° to 85°, so you can shoot down off the roof.
- **Spawning:** zombies walk in from the right edge. Each wave has a `gap` between spawns and a `maxOn` limit on how many can be on the street at once (2 → 5, rising to 7 in endless mode).
- **Tuning:** zombie speeds are about 25% faster, and the splash radius dropped to 1.5 m and now hits every zombie in range.
- **Art:** the rocket is now a 15×7 sprite (fins, banded body, nose cone) pre-rotated into 64 frames, with an exhaust flame.
- **Speedster:** barks twice ("WOOF! WOOF!") after he flattens a zombie.

## v1.2: back to the slingshot (Nov 2026)

The golf-style reticle and swing meter didn't feel right, so v1.2 brings back a slingshot that is more forgiving:

- **Relative drag:** press anywhere and pull back. The pull direction (reversed) sets the angle, from −85° to 85°, so you can shoot down off the roof. The pull length (up to 70 px) sets the speed, now 5–24 m/s. Full pull with a near-flat aim crosses the street in about 1.5 s.
- **No glitches:** an 8 px dead zone around the press point stops the aim spinning, and a backward pull holds the nearest limit instead of flipping between up and down.
- **Click-move-click:** a click without a drag starts a pull, and the next click fires.
- **Preview:** the full no-wind path is shown, plus lock-on brackets on the zombie the shot would hit right now, or a landing marker.
- Kept from v1.1: the rocket physics (16 m/s² thrust, 0.8 s burn), several zombies at once, faster zombies, a 1.5 m splash, the rocket sprite and the speedster bark. The swing meter is gone.
