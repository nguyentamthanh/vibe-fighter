# Combat and visual effects

## Built-in effects (`src/game/vfx.ts`)
`spawnHitSpark(scene, x, y, 'red'|'gold'|'blue', scale)` (atlas icon + ring), `spawnImpactFlash`,
`spawnChargeAura`. `MatchScene.spawnHitFx` picks red (clean hit), blue (blocked), gold (finisher or a Golden Bell
block) and shakes the camera.

## Generated effect sheets (`scripts/sprites/effect.py`)
Two modes — pick by the look you need:
| Look | Gemini background | effect.py | Phaser |
|---|---|---|---|
| Glow, light, energy (translucent) | pure black `#000000` | default `--key black` | `setBlendMode(ADD)` |
| Solid object with dark outlines (bell, shield, weapon) | magenta `#ff00ff` | `--key magenta` | normal blend, alpha as needed |
```
python scripts/sprites/effect.py RAW.png --key magenta --grid 4x2 --frames 8 --cell 320x384 --out public/assets/vfx/NAME.png
python scripts/sprites/effect.py RAW2.png --key magenta --grid 4x2 --frames 8 --cell 480x384 --fps 16 --out public/assets/vfx/NAME-hit.png --match public/assets/vfx/NAME.json
```
- Frames keep their in-cell position; the union is scaled once and the **core** (body without sparks) is anchored
  bottom-centre (`bottomPad` 6 px) → loops do not jitter. Writes `NAME.json` (cell size, coreHeight) used by
  `--match` so an idle loop and a hit reaction line up.
- Gemini's corner watermark is filled before keying. Magenta mode only clears lines on the expected cell
  boundaries (the fighter `remove_grid_lines` cut a stripe through a tall bell) and hard-edges the alpha.
- Register sheets in `VFX_SPRITESHEET_ASSETS` (`src/game/assets.ts`, frame size + frames + fps + repeat); the
  animations are created in `registerStarterAnimations`.
- Prompts live in `concepts/effects/<date>-<name>/prompts/`; ask for "the same shape, size and position in every
  frame, centred, bottom on the same line", flashes in white/yellow/gold only.

## Pattern: special projectile drawn by the engine (blade-qi, `src/game/bladeQi.ts`)
Use this when a fighter's special must throw something across the stage, or when the effect colour is
purple/pink/magenta. Those colours cannot be in a sprite, because sprites are keyed on magenta.
- `BLADE_QI_FIGHTERS` lists who gets it. `MatchScene.spawnFighters` creates one `BladeQiCaster` per such fighter.
- The caster:
  - polls `fighter.currentAction` / `currentFrame` (getters on `Fighter`);
  - shows a purple ADD aura plus rising sparks during `special-charge` and `special`;
  - launches one `BladeQi` crescent per frame in `LAUNCH_FRAMES` (the big slash frames of the special sheet).
- Crescents:
  - Textures are generated: a canvas crescent with a radial gradient, tinted purple with a white core, plus a
    spark trail particle emitter.
  - Each crescent flies at 900 px/s × display scale and fizzles after 1100 px.
  - `MatchScene.updateBladeQi` lands them through `landStrike`, the same helper melee hits use (guard, chip,
    meter, hit FX, Golden Bell). It uses the owner's `specialProfile`, and the last crescent is the finisher.
- Remove the special's melee `attackSpans` from the manifest so the special does not hit twice. Set
  `specialHits` in `playstyle.ts` to the number of crescents so the rating stays honest.
- Clear the crescents on a round reset (`clearBladeQi`) and destroy them on shutdown.

## Pattern: guard effect for one fighter (Golden Bell, `src/game/goldenBell.ts`)
- `GOLDEN_BELL_FIGHTERS` lists who gets it; `MatchScene.spawnFighters` creates one shield per such fighter,
  `update()` runs after the fighters update, `tryHit` calls `strike()` on blocked hits and passes
  `goldenGuard` to `spawnHitFx` (gold spark), `startRound` hides it, SHUTDOWN destroys it.
- `Fighter` exposes read-only `isGuarding`, `groundLine`, `displayScale`, `spriteDepth` for such effects.
- Size from the fighter: `scale = displayScale × (196 × 1.4) / coreHeight` (bell 1.4× fighter height).
- To keep the fighter visible *inside* a solid object, draw it twice: a dark-tinted copy behind the fighter
  (alpha 0.95) and a faint copy in front (alpha 0.3).
- Hit sheet is drawn struck from the RIGHT; flip it when the attacker is on the left.
- Sound: `playBellStrike(settings)` in `core/audio.ts` (WebAudio partials, respects mute/SFX volume). Add new
  synthesized sounds the same way rather than shipping audio files when a simple tone works.
- User feedback that shaped it: a washed-out additive glow looked "ugly"; the user wanted it bolder and taller
  than the fighter → solid bronze art, 1.4× height.

To reuse for another fighter (e.g. a dragon-scale shield), copy the class, swap the sheet keys and sizes, and add
a `<NAME>_FIGHTERS` list; keep MatchScene changes to the same four hook points.
