# Changelog — rules and lessons (append, newest first)

Format: `YYYY-MM-DD | area | what changed or what we learned (and where it is documented)`.
Routine commits stay in Git; log here only what changes how the game is made.

2026-10-08 | roster | Fighter 11, Asura Blade (A Tu La Vương – Cuồng Đao): the Berserker, with purple blade-qi
crescents drawn by the engine (effects.md "special projectile"). roster.md row 11.
2026-10-08 | design | Get the reference approved by the user BEFORE any sheet (send it with SendUserFile and ask).
The saber design here took 5 iterations, and 3 sheets had to be redone.
- Gemini edits the LAST image in a chat. To go back, ask it to "show the SECOND image in this chat again
  unchanged", then fix any drift (the skirt colour changed).
- It cannot copy one object's shape onto another held at a different angle. Posing both the same way worked.
2026-10-08 | prompts | Never write "the reference image directly above" once sprite sheets follow the reference:
Gemini copies the last sheet and drifts (silver blades, a 3rd saber). Write "the reference attached at the start
of this chat". Long chats (20+ images) drift anyway: start a new chat with the reference pasted.
2026-10-08 | browser | Images without the clipboard or the server download. Both broke during this session:
- `window.__saveLast()` draws the last response image to a canvas and saves it with an `<a download>` click as
  `Gemini_Generated_Image_canvas*.png`.
- `grab.ps1 <manifest> <action>` then waits up to 90 s, runs dl.py and take.py.
- Reference into a new chat:
  1. Make a blob from the image while still in the old chat.
  2. Click "New chat" in the sidebar (SPA navigation keeps the JS state).
  3. Dispatch a synthetic `ClipboardEvent('paste')` with a `DataTransfer` file on `.ql-editor`.
- A drag-drop of a screenshot (`upload_image`) was ignored by Gemini.
- `frameWidth` may go to 448 when a 9-frame special clips (9 × 448 = 4032 stays under the 4096 texture limit).
2026-10-08 | ui | Arcade announcer + results screen.
- `matchAnnouncer.ts` calls ROUND n / FINAL ROUND / FIGHT! / K.O. / PERFECT / TIME UP / DRAW: a slanted stripe and
  gradient display-font words.
- K.O. adds a flash, a shake and 0.7 s of slow motion (`timeWarp` + `anims.globalTimeScale`, always restored).
- `matchResults.ts` shows VICTORY/DEFEAT or PLAYER n WINS, portrait cards (winner gold + ribbon), the score, round
  chips and the winner's quote, with banner buttons that work from the keyboard.
- Sounds are synthesized with `playArcadeSting` in audio.ts.
- Every fighter now needs a `winQuote` in lore.md and lore.ts.
2026-10-08 | stages | Four new stages (Shaolin Temple, Wudang Summit, Night Market, Dragon's Lair).
- The art is from one Gemini chat, using a fixed layout-rules prompt.
- Motion is procedural (`stageAmbience.ts`).
- New `groundFraction` per stage, and the level select is now a grid.
- New `stage_dl.py` saves an image and patch-fills the watermark (a blur fill smears pixel floors).
- Workflow: references/stages.md.
2026-10-08 | balance | Play styles: new combat fields `defense`, `guardBreak` (chip) and `meterGain`. Every fighter
has an archetype, and the select screen shows 1–5 ratings derived from the real numbers. The design table is in
roster.md "Play styles"; `playstyle.test.ts` keeps the profiles distinct. Removed the stale combat block from
`public/configs/fighter-playground.json`: it silently overrode code defaults.
2026-10-08 | ui | Select screen relaid out (grid + info panel; side by side in landscape, stacked in portrait).
Names sit in name plates and shrink to fit. Labels are English: Hắc Long → "Black Dragon" (manifest + spec too).
2026-10-08 | roster | Monkey King (Wukong) done locally: all three wuxia fighters registered and playtested on
both sides (roster.md row 10). Not pushed.
2026-10-08 | game | `SELECTABLE_ROSTER` now follows `SELECTABLE_FIGHTER_IDS` order (it used to keep the
`CHARACTER_DEFINITIONS` order, so the "display order" list was ignored). Hắc Long, the final boss, is last.
2026-10-08 | browser | Clipboard can become unreadable after a session resume (OpenClipboard error 5): save
images with Gemini's "Download full size image" button + `scripts/dl.py` (gemini-browser.md). A localhost
receiver script was tried and deleted: Gemini's CSP blocks the POST to 127.0.0.1.
2026-10-08 | pipeline | A reference drawn facing RIGHT: set `facing: RIGHT` in spec.json and regenerate the
manifest + prompts with --force BEFORE the first hand edit (worked cleanly for the Monkey King).
2026-10-08 | testing | The first scripted move right after a match starts can register extra hits (round intro);
step ~40 frames first or repeat the measurement before trusting an odd number.
2026-10-08 | prompts | Weapon fighters: Gemini switches to 4x2 with narrow cells and cuts the blade at the cell
edge. Add to EVERY prompt: "only 3 columns and 2 rows (6 frames, NOT 4 columns, NOT 8 frames). The whole sword,
including the blade tip, must be fully inside each cell; draw the character smaller if needed."
2026-10-08 | prompts | Sword fighters get a SECOND sword drawn in held poses (block, charge): say "exactly ONE sword"
and drop the bad frames. Attack frames are often drawn facing the other way: fix with `flipFrames` (source
indices, applied before drop/order) instead of regenerating.
2026-10-08 | prompts | Gemini may return the previous sheet unchanged (walk-backward = walk-forward). Check with a
pixel diff; a walk played backwards (`frameOrder` reversed) is a fine walk-backward.
2026-10-08 | pipeline | A 9-frame special that comes back as 6 frames: build the 9-frame timing with `frameOrder`
(hits at 2/4/6, transitions between) and drop `scaleFrom` if the last frame is not standing.
2026-10-08 | roster | Wudang Swordswoman (Bai Yun) finished, registered and playtested both sides.
2026-10-08 | prompts | After ~8 sheets a chat gets "contaminated": every new sheet comes back 4x2 with the previous
pose (kneeling block) repeated in row 2. Don't fight it — open a NEW chat, paste the reference (clipboard
`SetImage` + ctrl+v; Gemini has no file input) and continue. Hắc Long actions 10–14 were clean 3x2 after that.
2026-10-08 | browser | Clear the clipboard before clicking Copy image: a click that doesn't register leaves the old
image (here the reference) on it and clip.ps1 saves the wrong file.
2026-10-08 | pipeline | autoSlice can split an opponent's fist / stray scrap into its own frame; read
`work/<action>/frames.json` (bbox per piece) to pick `dropFrames` indices instead of guessing from the image.
2026-10-08 | pipeline | `character.py` now escapes quotes in TS labels (`ts_str`) — "Dragon's Regret" broke tsc.
2026-10-08 | ui | Vietnamese diacritics ("Hắc Long") render fine on the select cards and the match HUD.
2026-10-08 | roster | Hắc Long finished (13 actions + portrait, 384 px), registered and playtested both sides.
2026-10-08 | browser | Claude in Chrome can show no browser while Brave runs; opening Brave from the shell doesn't
wake it — the user must open the Claude side panel (gemini-browser.md → "If the extension is not connected").
2026-10-07 | skill | Created this skill from the project's history (GAME_PROMPT_TEMPLATE.md, memory logs, helper
scripts). Helpers moved from a temp folder into `scripts/`; `make_manifest.py` now reads a spec.json.
2026-10-07 | lore | "The Black Dragon Tournament" premise, bios for 10 fighters (lore.md). Hắc Long = host/boss.
In game: `src/game/lore.ts` + a bio line under the cards on the select screen (CARD_AREA_BOTTOM 124). In-game names
are ASCII ("Hac Long") until diacritics are verified in the fonts.
2026-10-07 | env | System Python (C:\Python314) disappeared; `python` on PATH is only the Windows Store alias. Check
`python -c "import numpy, PIL, scipy"` before pipeline work (testing-and-deploy.md → Python).
Fix chosen (user ok): repo-local `.venv` from uv's CPython 3.12 with requirements.txt installed (git-ignored).
Run the pipeline and skill scripts with `.venv\Scripts\python.exe`.
2026-10-07 | skill | Specs/manifests written by Windows PowerShell carry a UTF-8 BOM → scripts read `utf-8-sig`.
2026-10-07 | pipeline | Black-clothed fighters (Hắc Long): `sprites.remove_line_runs` erased trouser legs (each dark
column looked like a grid line) → only runs ≤ 2 px thick count now. Verified Muay Thai builds are unchanged
apart from a few dark pixels the old rule removed by mistake. Lesson: when frames look cut, compare
`work/<action>/keyed.png` with the sliced frames before blaming the art.
2026-10-07 | browser | Gemini sometimes answers "Sorry, something went wrong" for an image: just resend the prompt.
After ~10 images in a session it may refuse with "unable to generate new images due to a temporary system error":
stop after 2–3 failures, save progress, resume later in the same chat (don't burn retries).
2026-10-07 | prompts | Long chats leak the previous sheet's pose (kneeling from crouch into jump): name the
previous poses explicitly ("no kneeling, crouching or jumping poses") and `dropFrames` what still leaks.
2026-10-06 | effects | Washed-out additive bell rejected by the user ("xấu, phải đậm hơn, cao hơn người"): solid
objects go magenta → RGBA, normal blend, two layers (dark back + faint front), sized 1.4× fighter (effects.md).
2026-10-06 | effects | Gemini watermark sits ~87 px from the bottom-right corner of 1024 px images, often over art:
fill by position, not by colour (effect.py `remove_watermark`).
2026-10-06 | testing | Phaser 4 tweens use `Date.now()`: the stepping harness must patch it forward-only, and must
wait for MainMenu before jumping scenes (testing-and-deploy.md).
2026-10-06 | dev | Port 5173 is taken by another app on this machine; dev server runs on 5174.
2026-10-05 | pipeline | `frameOrder` indices may repeat (transition frame reused between hits); entries are copied.
2026-10-05 | pipeline | Weapon/fireball clipping at 320 px → monk uses `frameWidth` 384.
2026-10-05 | pipeline | Effects that do not touch the body (streaks, fire scraps) get sliced as extra frames → ask for
"touching the body" and `dropFrames` the scrap.
2026-10-05 | pipeline | `autoSlice: true` handles uneven rows (4+3) and 7–8 frame sheets automatically.
2026-10-05 | pipeline | Thin 1 px grid lines on 1024 px clipboard images: grid-aware removal + line-run removal.
2026-10-05 | browser | Brave blocks repeated Gemini downloads → clipboard copy workflow (gemini-browser.md).
2026-10-05 | release | Raw Gemini sheets (~430 MB) are git-ignored; prompts, manifests and final assets are committed.
2026-10-04 | pipeline | Gemini follows the reference's facing, not the prompt → check facing at the reference,
`drawFacing: RIGHT` flips everything.
2026-10-04 | pipeline | 3x2 grids keep weapons inside cells better than 4x2; describe a different pose per frame.
