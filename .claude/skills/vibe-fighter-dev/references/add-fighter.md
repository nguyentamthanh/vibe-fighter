# Add a fighter end to end

Typical cost: ~15 Gemini images (reference + 13 actions + portrait) plus 3–10 retries/fixes, 1–2 sessions.
Work one action at a time, look at every preview, and save progress to memory after each action.

## 0. Design the fighter (spec)
Decide, and write into `references/lore.md` first (story owner) and a spec file:
- **id** (kebab, ascii: `wudang-swordsman`), **label** (UI name, English or ASCII-safe — the HUD and cards use
  monospace/arcade fonts; test Vietnamese diacritics before using them), **camelId** for the TS file.
- **Look**: one dense sentence (hair, face, clothes, colours, weapon). Avoid brand/IP names that trip filters
  (write "Viking berserker with an axe", not "Thor"); public-domain legends (Sun Wukong) are fine but describe
  the look concretely.
- **Moves**: idle style, block pose, light attack (engine treats `light-punch` as a HIGH attack), heavy attack
  (`heavy-kick`/`heavy-punch` = LOW attack, so aim it at legs/shins), special-charge aura, special = 3 hits.
- **Effect colours: never pink/purple/magenta** (they get keyed out with the background). Fire = orange/yellow,
  dragon = black smoke + gold, ki = white/gold, water = blue/white.
- **Weapon or long limbs?** Plan a wider frame (`frameWidth` 320–384) and a `visualWidthCap` so the hurtbox stays
  on the body.
- **Stats idea** (see roster.md for the current balance band).

Write the spec as JSON next to the concept folder and generate the manifest with the bundled script:
```
.venv\Scripts\python.exe .claude/skills/vibe-fighter-dev/scripts/make_manifest.py concepts/characters/<date>-<id>/spec.json
```
`spec.json` fields: see the docstring of `make_manifest.py` (description, overflow parts, portrait mood/background,
and the per-move texts). It writes `scripts/sprites/characters/<id>.json` with the proven 13-action template
(3x2 grids, special 3x3, per-frame poses, `autoSlice`, align modes, scaleFrom/visualFrom). Once you hand-edit
the manifest, **do not run make_manifest.py for that id again**.

## 1. Reference image
```
.venv\Scripts\python.exe scripts/sprites/character.py reference scripts/sprites/characters/<id>.json   # prints prompt 00
```
New Gemini chat per fighter (see gemini-browser.md). Send the reference prompt without attachments. Save it with
`scripts/clip.ps1 <manifest> reference`.
**Show the reference to the user and get an explicit OK before any sheet** (SendUserFile + AskUserQuestion).
Weapons especially: the Asura Blade sabers took 5 edits, and sheets drawn from a rejected design were wasted.
**Check the facing immediately.** Gemini draws the way the reference faces and ignores "faces LEFT". If it faces
RIGHT: set `"facing": "RIGHT"` in spec.json and re-run make_manifest.py (it mirrors every left/right word, sets
`drawFacing: RIGHT` so the build flips all sheets, and `portrait.flip`). Do this before any action sheet.

## 2. Actions (13) and portrait
```
.venv\Scripts\python.exe scripts/sprites/character.py prompts scripts/sprites/characters/<id>.json     # writes prompts/01..14
.venv\Scripts\python.exe .claude/skills/vibe-fighter-dev/scripts/pj.py <id> <n>                        # prompt n as JSON for the browser
```
Order: idle (sets the scale for everything) → walk-forward → walk-backward → crouch → jump → block-high →
block-low → hit-high → light-punch → heavy-kick → special-charge → special → knockdown → portrait (14, same chat,
it says "NOT a sprite sheet").
After each image: `clip.ps1 <manifest> <action>` then
`.venv\Scripts\python.exe .claude/skills/vibe-fighter-dev/scripts/take.py <manifest> <action> --no-move` (builds that action and
writes `concepts/_previews/<id>-<action>.png`). **Look at the preview** before the next prompt.

Prompt habits that work:
- Refer to "the character reference attached at the start of this chat", never "the image directly above"
  (after the first sheet that is a sheet, and Gemini drifts toward it).
- Effects in a colour close to magenta (purple, pink) can never be in the sprite. Draw them in the engine
  (effects.md, blade-qi pattern) and ask Gemini for white / grey effects only.
- Describe a DIFFERENT pose for every frame; "same as frame 5" only for held poses.
- Add "All frames belong to this animation only: do not repeat poses from earlier sheets in this chat (no
  blocking/crouching/jumping poses…)" — long chats leak old poses (pj.py appends a generic version; tailor it).
- "Exactly 6 frames." Gemini often returns 7–8 anyway; autoSlice copes.
- Effects must "touch the body/weapon (no separate floating sparks)" or they get sliced as extra frames.
- Crouch/low block: describe a clearly different shape ("kneeling on one knee"), not "15% lower".
- If two sheets in a row come back 4x2 with an old pose filling row 2, the chat is contaminated: start a new
  chat, paste the reference image (PowerShell `[System.Windows.Forms.Clipboard]::SetImage(...)`, click the input,
  ctrl+v) and send the original prompt ("Using the attached character reference…"). Record the new chat URL.

## 3. Fixing what Gemini returns (manifest fields, no regeneration needed)
| Symptom in the build table / preview | Fix |
|---|---|
| Uneven rows (4+3), wrong grid | nothing with `autoSlice: true`; otherwise `"sliceGrid": "auto"` or `"4x2"` |
| Extra frames from earlier sheets (kneel, palm pose in a kick sheet) | `"dropFrames": [i, …]` (indices of what was found) |
| A spark/streak/fire scrap sliced as its own tiny frame (w/h ≪ body) | `dropFrames` that index |
| Two strike frames back to back (engine needs an inactive frame between hits) | `"frameOrder": [...]` — indices may repeat, e.g. `[0,1,2,5,3,5,4,6]` |
| One frame mirrored | `"flipFrames": [i]` |
| Scale jumps because frame 0 is crouched | remove `scaleFrom` or point it at a standing frame |
| `clipped-px` > ~100 on a weapon/kick/fireball | raise `frameWidth` (monk 384) for the whole fighter |
| Pinkish/dark-magenta rim or background | `"background": "auto"` on that action |
| Grid lines | handled (grid-aware removal + line runs); check `work/<action>/keyed.png` if not |
| Narrow ~35×115 px "frames" that are a leg/foot, and bodies missing that leg | was a pipeline bug (fixed 2026-10-07): `remove_line_runs` treated every column of black trousers as a grid line. It now only removes runs ≤ 2 px thick. If it ever comes back, look at `work/<action>/keyed.png` (complete?) vs the sliced frames before regenerating art |
| `align` | `feet` standing actions, `centroid` walks, `fixed-y` jump/knockdown, `fixed` only if Gemini kept the body still in its cell (rare; special is usually `feet` with autoSlice) |

Attack indices in `attack.frames` / `attackSpans` refer to frames **after** drop/reorder.

## 4. Full build and hitboxes
```
.venv\Scripts\python.exe scripts/sprites/character.py build scripts/sprites/characters/<id>.json [--force-ts]
.venv\Scripts\python.exe .claude/skills/vibe-fighter-dev/scripts/boxes.py src/game/<camelId>.ts public/assets/<id> concepts/_previews/<id>-boxes.png light-punch heavy-kick special
```
`build` writes `src/game/<camelId>.ts` only when all 13 actions + portrait exist; `--force-ts` regenerates it
(overwrites hand-tuned boxes — put tuned boxes in the manifest as `frameBounds` instead).
Red box = attack box. It must cover the fist/foot/weapon that lands; if it only covers a fingertip or the effect
covers the body, set `"frameBounds": [x, y, w, h]` (cell coordinates of the final sheet frame) on that `attack`
or span and rebuild with `--force-ts`.

## 5. Register, balance, bio
- `src/game/hero.ts`: import `<CONST>_CHARACTER`, add to `CHARACTER_DEFINITIONS`.
- `src/game/roster.ts`: add the id in display order (select-screen grid adapts automatically).
- `src/game/fighterConfig.ts`: `FIGHTER_STAT_OVERRIDES` (walkSpeed, airDrift, jump) and
  `FIGHTER_COMBAT_OVERRIDES` (maxHealth, high/low/special damage, knockback) — stay inside the band in roster.md.
- `src/game/lore.ts`: origin, style and one-line bio (copy from lore.md).
- Guard/hit effects specific to the fighter: see effects.md (e.g. `GOLDEN_BELL_FIGHTERS`).

## 6. Playtest (must do)
Use the harness in testing-and-deploy.md: start `MatchScene` with the new fighter vs another, script inputs and
check: light and heavy hit (damage numbers and reach), special lands 3 hits, block = 0 damage, knockdown on KO,
both sides (P1 facing right, P2 facing left). Screenshot the select screen and a match.

## 7. Close the loop
- `references/roster.md`: new row (stats, frameWidth, quirks such as dropFrames used).
- `references/changelog.md`: one line per lesson learned.
- Memory: progress line. Notion: Vibe Fighter page "Current state" + BA Spec roster line.
- `npx tsc --noEmit && npm test && npm run build`; commit/push only when asked.
