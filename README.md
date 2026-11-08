# 🎆 Diwali Rocket Defense

A 2D pixel-art artillery game for the browser. Defend your rooftop on Diwali night by slingshotting firework rockets at goofy zombies before they reach your door.

**▶ Play:** https://rishankkyadav.github.io/diwali-rocket-defense/

Works on desktop (mouse) and phones (touch, landscape).

## How to play

Aiming works like a golf game: you pick a target, then time a swing meter.

1. **Aim:** move the mouse (or drag a finger) to put the crosshair where you want the rocket to go. The dotted path shows how it will fly. Close shots fly almost straight, long ones arc. The path ignores **wind**, so check the HUD arrow and the smoke plume and adjust.
2. **Swing:** click (or press Space, or tap **FIRE** on a phone) and a needle starts sweeping across the meter.
3. **Release:** click again when the needle is in the **gold** zone for a perfect shot. Stopping left of centre sends the shot low, right sends it high. You can also press, hold and let go.

- Zombies keep walking while the rocket flies, so **aim ahead of them**.
- Later waves send several zombies at once, and the needle gets faster every wave.
- **Direct hit**: 1 damage, ×2 points. **Splash** (within 1.5 m): 0.5 damage to everyone nearby. A **miss** resets your streak, and the nearest zombie dances at you.
- Three kills in a row charge **Chotu the speedster**. Tap the shoe icon (or press **S**) and he sprints out, flattens the front zombie (Tanks included) and barks about it.
- Zombies that reach the door cost a life. You get a bonus life every 3 waves (max 5). After wave 5 the game switches to **endless mode**.

| Key | Action |
|---|---|
| Mouse move / touch drag | Aim |
| Click / Space / FIRE button | Start the swing, then click again to release |
| Esc (during a swing) | Cancel the swing |
| S | Speedster power-up |
| Esc / P | Pause |
| M | Mute |
| ` (backtick) / F3 | Debug FPS overlay |

## Run locally

No build step is needed. It's plain ES modules, so any static server works:

```bash
npm install && npm run dev      # Vite dev server on http://localhost:5173
# or, with no install at all:
python3 -m http.server 8000     # then open http://localhost:8000
```

`npm run build` makes a production bundle in `dist/`.

## Project layout

```
index.html            page shell, letterboxing, rotate-your-phone notice
GAME_DESIGN.md        the design doc this game implements
src/
  main.js             boot, integer scaling, fixed 120 Hz timestep loop
  config.js           every tunable number (physics, waves, scoring, palette)
  game.js             game state machine: title → play → pause → game over
  physics.js          stepRocket (semi-implicit Euler), preview, collisions
  input.js            pointer/touch/keyboard → native 480×270 coordinates
  waves.js            wave tables, endless mode, wind rolls
  audio.js            all SFX + dhol/shehnai music synthesised with WebAudio
  gfx.js              pixel drawing helpers
  entities/           player, zombie, rocket, speedster (procedural pixel art)
  fx/                 particles, explosions, ambient fireworks, background
  ui/                 bitmap font, HUD, menus
```

To retune the game, edit `src/config.js`. Every number from the design doc lives there.

## Notes

- Art is drawn in code on a 480 × 270 canvas with the Endesga 32 palette and scaled by whole numbers. Sound is synthesised, so the repo ships no third-party assets.
- The footballer (saffron and green kit, #9) and Chotu the speedster are original characters.
- The high score and sound settings are saved in `localStorage`.
