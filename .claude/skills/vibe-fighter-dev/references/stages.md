# Adding a fight stage

A stage = one painted background (Gemini) + procedural motion layers (`src/game/stageAmbience.ts`).
Registry: `STAGE_DEFINITIONS` in `src/game/stageConfig.ts`. Assets: `public/assets/backgrounds/<id>-stage.png`.

## Current stages
| id | Label | Ground | Ambience | Gemini chat |
|---|---|---|---|---|
| rooftop-twilight | Rooftop Twilight | 0.82 | none | (original) |
| rooftop-sunset | Rooftop Sunset | 0.82 | none | (original) |
| shaolin-temple | Shaolin Temple | 0.82 | petals, mist | efbcbe3080e4c1a7 |
| wudang-summit | Wudang Summit | 0.82 | clouds, mist | efbcbe3080e4c1a7 |
| night-market | Night Market | 0.82 | rain (+ lightning), neon | efbcbe3080e4c1a7 |
| dragon-lair | Dragon's Lair (final boss) | 0.82 | embers | efbcbe3080e4c1a7 |

## Steps
1. **Prompt (Gemini web, one chat for all stages).** Describe the scene, then append the layout rules
   verbatim. Gemini honoured them every time and returned 2:1 images at 2816 px wide.
   The rules:
   > Layout rules (important, it is a 2D fighting game stage): side view, camera at eye level. A flat, EMPTY
   > floor runs across the WHOLE width as the fighting area, from about 60% to 82% of the image height; at
   > 82% of the height the floor ends at a straight horizontal front edge, with a low front wall or ledge
   > below it down to the bottom edge. Nothing stands on the middle of the floor; props only at the far left
   > and far right edges and in the background. Very wide panoramic image, 2:1 aspect ratio (twice as wide as
   > tall). Detailed SNES-era 16-bit pixel art like Street Fighter II stage backgrounds, rich colours, crisp
   > pixels. No people, no characters, no animals in the foreground, no text, no logo, no watermark, no
   > frame, no UI.

   A background crowd is fine ("a shadowy crowd far behind").
   Ask for a "NEW, different stage in the same style and the same layout rules" for each further stage.
2. **Save:** hover the image, click `Download full size image` (standalone click), then run
   `.venv\Scripts\python.exe .claude/skills/vibe-fighter-dev/scripts/stage_dl.py <id>`. The script:
   - keeps the original in `concepts/stages/<id>/raw/source.png` (git-ignored);
   - covers Gemini's ✦ watermark with the pixels to its left (a blur fill looks wrong on pixel floors);
   - scales the image to 900 px tall (~1820×900, about 2 MB);
   - prints the strongest horizontal edges.

   The download can land a few seconds after the click: poll Downloads before running the script.
   `--from-raw` reprocesses the source without downloading again.
3. **Ground line:** fighters' feet sit at `groundFraction` × screen height (default 0.82). Choose a row inside
   the floor band, above its front edge (the edge list helps; the floor edges were at 0.85–0.88).
4. **Register** in `STAGE_DEFINITIONS` (width/height = saved file size, `groundFraction`, `ambience`).
   The image preloads through `STAGE_IMAGE_ASSETS`.
   The level select grid fits any count (3×2 landscape, 2×3 portrait).
5. **Verify:** for each new stage, use the harness from testing-and-deploy.md to start a match with
   `stageId: '<id>'`.
   - Take a screenshot: feet should be on the floor, nothing important behind the HUD.
   - To prove the motion, read an ambience object's x before and after `__step(180)`.

## Ambience kinds (`StageAmbienceKind`)
| kind | What it does | Depth |
|---|---|---|
| petals | pink petals falling and drifting | back layer + a few in front of the fighters |
| mist | soft white banks sliding along the horizon, parallax 0.35 | 1 |
| clouds | long wisps across the upper sky | 1 |
| rain | slanted rain in two layers, plus a lightning flash every 6–13 s | back + front |
| embers | additive embers rising from the floor, plus a warm flickering wash | back + front |
| neon | pink/cyan/purple additive wash that hums and stutters | 1 |

All layers are screen-space (scroll factor 0) and made from generated textures, so no extra art is needed.
White mist over white clouds is invisible; pick layers that contrast with the painting.
A new kind goes in `stageAmbience.ts` plus the `StageAmbienceKind` union.
