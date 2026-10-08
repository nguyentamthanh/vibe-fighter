---
name: vibe-fighter-dev
description: >-
  The working manual for the Vibe Fighter game (Phaser 4 + TypeScript + Vite, deployed on Vercel): how to add a
  new fighter end to end (Gemini art driven through the browser, the Python sprite pipeline, hitboxes, stats,
  registration, playtest), how to make combat effects, how the story/lore and in-game bios work, how to test
  the game headless and how to ship it. Use this skill for ANY work in this repository that touches fighters,
  sprites, Gemini prompts, effects, the roster, lore/bios, menus, balance, testing or deployment, even when the
  user only says "thêm nhân vật", "tạo hiệu ứng", "sửa đòn đánh", "cốt truyện", "chạy thử", "đẩy lên vercel".
  It also tells you to update this skill after every change so the next session starts from the latest rules.
---

# Vibe Fighter — development manual

A Street-Fighter-style 2D fighter that runs in the browser. Roster, lore and every hard-won lesson live in this
skill so that each new fighter or feature is made the same, proven way.

## First, every session
1. Read `references/roster.md` (who exists, their quirks, what is in progress) and the latest entries of
   `references/changelog.md`.
2. Check the project auto-memory (`MEMORY.md` index → the newest `roster-expansion-*.md`) for the step you were
   on last time.
3. Verify claims against the code before acting — docs can lag behind; the code and `git log` win.

## Golden rules (why they matter)
- **Update this skill after every change.** When you add a fighter, fix a pipeline problem, change a rule or
  learn something the hard way, edit the matching reference file and add one line to `references/changelog.md`
  in the same piece of work. The user asked for this explicitly: the skill is how future sessions avoid
  repeating mistakes.
- **Save progress to memory after each step** (done / next / blockers) — work spans many sessions and the user
  wants to resume without re-explaining. Memory = where we are; this skill = how we do it.
- **One canonical home per fact.** Roster facts → `roster.md`; story → `lore.md` (+ `src/game/lore.ts` for the
  in-game text); how-to → the workflow files; history → `changelog.md`. Link instead of copying.
- **Ask before outward-facing actions:** commits/pushes (pushing `master` deploys production on Vercel),
  installing things, browser settings. Downloads of generated sprite images were approved by the user.
- **Never regenerate a manifest that has hand edits** (`dropFrames`, `frameOrder`, `frameBounds`…): edit it.
- **Verify in the running game**, not only with `tsc`: screenshots of the feature in a real match.

## Repository map
| Need | Go to |
|---|---|
| Scenes (menu, select, match) | `src/scenes/*Scene.ts`, shared helpers `BaseScene.ts` |
| Fighter definitions (generated) | `src/game/<camelId>.ts`, registry `src/game/hero.ts` |
| Selectable roster order | `src/game/roster.ts` |
| Stats / combat balance | `src/game/fighterConfig.ts` (`FIGHTER_STAT_OVERRIDES`, `FIGHTER_COMBAT_OVERRIDES`) |
| Combat resolution | `src/scenes/MatchScene.ts` (`tryHit`, `spawnHitFx`), `src/game/fighter.ts` |
| Round calls / results screen | `src/game/matchAnnouncer.ts`, `src/game/matchResults.ts`, stings in `core/audio.ts` |
| Play styles / ratings | `src/game/playstyle.ts` (+ table in `references/roster.md`) |
| Stages + animated layers | `src/game/stageConfig.ts`, `src/game/stageAmbience.ts` (`references/stages.md`) |
| Effects | `src/game/vfx.ts`, `src/game/goldenBell.ts`, sheets in `public/assets/vfx/` |
| Menu look | `src/game/menuBackdrop.ts`, `createBannerButton` in `src/game/ui.ts` |
| Story text in game | `src/game/lore.ts` (bios on the select screen) |
| Sprite pipeline | `scripts/sprites/character.py`, `sprites.py`, `effect.py`, manifests in `scripts/sprites/characters/` |
| Prompts, references, raw art | `concepts/characters/<date>-<id>/` (raw/ and work/ are git-ignored) |
| Helper scripts for this skill | `.claude/skills/vibe-fighter-dev/scripts/` |

## Workflows — read the file for the task at hand
- **Add a fighter (most common):** `references/add-fighter.md`. Covers spec → manifest → reference image →
  13 actions + portrait in Gemini → build → boxes → register → stats → bio → playtest → docs.
- **Drive Gemini in the browser:** `references/gemini-browser.md` (prompt sending, waiting, clipboard copy,
  coordinate scaling, extension disconnects, watermark).
- **Add a fight stage:** `references/stages.md` (Gemini prompt with layout rules, `stage_dl.py`, ground line,
  procedural ambience: petals, mist, clouds, rain, embers, neon).
- **Combat / visual effects:** `references/effects.md` (black + additive vs magenta + RGBA, `effect.py`, the
  Golden Bell pattern).
- **Story, lore and bios:** `references/lore.md` — the tournament story and every fighter's profile. Keep
  `src/game/lore.ts` in sync with it.
- **Test, verify and ship:** `references/testing-and-deploy.md` (headless stepping harness with a fake clock,
  scripted inputs for combat checks, typecheck/tests/build, push → Vercel, live checks).
- **Roster status and per-fighter quirks:** `references/roster.md`.

## Definition of done for any change
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` pass.
- [ ] Seen working in the browser (screenshots of the actual feature).
- [ ] `references/roster.md` / `lore.md` / workflow file updated if the facts changed; a line in `changelog.md`.
- [ ] Memory updated with what is done and what is next.
- [ ] Notion project page (Startup Projects → Vibe Fighter, and its BA Spec) updated when the status changes.
- [ ] Commit/push only when the user asks.
