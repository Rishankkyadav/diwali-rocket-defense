# 🎆 Diwali Rocket Defense

A 2D pixel-art artillery game for the browser. Defend your rooftop on Diwali night by slingshotting firework rockets at goofy zombies before they reach your door.

**▶ Play:** https://rishankkyadav.github.io/diwali-rocket-defense/

Works on desktop (mouse) and phones (touch, landscape).

## How to play

It's a slingshot:

- **Press anywhere, pull back, release.** Pull down and back to fire up and out, or pull up and back to fire *down* at zombies near your door. The further you pull, the faster and flatter the shot.
- **Trackpad-friendly:** click once without dragging, move to pull back, click again to fire.
- The dotted path shows the whole flight, ignoring wind. **Yellow brackets** appear on the zombie the shot is lined up on.
- Zombies keep walking while the rocket flies, so **aim ahead of them**.
- Later waves send several zombies at once.
- **Direct hit**: 1 damage, ×2 points. **Splash** (within 1.5 m): 0.5 damage to everyone nearby. A **miss** resets your streak, and the nearest zombie dances at you.
- Three kills in a row charge **Chotu the speedster**. Tap the shoe icon (or press **S**) and he sprints out, flattens the front zombie (Tanks included) and barks about it.
- Zombies that reach the door cost a life. You get a bonus life every 3 waves (max 5). After wave 5 the game switches to **endless mode**.

| Key | Action |
|---|---|
| Drag back, release | Aim and fire |
| Click, move, click | Aim and fire without holding (trackpads) |
| Esc (while aiming) | Cancel the shot |
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
