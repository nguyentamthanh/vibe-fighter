# Roster — status, stats and per-fighter quirks

Canonical list of fighters. Update the row (and `changelog.md`) whenever a fighter is added or changed.
Selectable order lives in `src/game/roster.ts`; stats in `src/game/fighterConfig.ts`; story in `lore.md`.

**Defaults** (no override): walk 230, air 190, jump 980, gravity 2300, scale 1.4 • hp 100, light (high) 7,
heavy (low) 12, special 6 per hit, defense 0 %, guardBreak 0 %, meterGain 100 %. The "Stats" column below is
history; the **Play styles** table is the current design (2026-10-08).

## Play styles (every fighter must play differently)
Mechanics (`fighter.ts applyHit` / `registerOffense`):
- `defense` % cuts clean-hit damage (min 1).
- `guardBreak` % of the attacker's damage chips through a block, but chip never KOs. The Golden Bell cancels chip.
- `meterGain` % scales every meter gain.

Ratings 1–5 on the select screen come from `playstyle.ts computeFighterRatings`, centred on the default
fighter = 3:
- power = light + heavy
- defense = hp / (1 − defense)
- speed = walk
- special = 3 × special × meterGain

`playstyle.test.ts` fails if two fighters end up with the same 4-digit profile, so keep them distinct.
A new fighter needs an entry in `FIGHTER_PLAYSTYLES` (archetype, tip, colour) and an archetype that is not taken.

| id | Archetype | P/D/S/Sp | hp | def | light | heavy | special | chip | meter | walk |
|---|---|---|---|---|---|---|---|---|---|---|
| red-brawler | All-rounder | 3/3/3/3 | 100 | 0 | 7 | 12 | 7 | 0 | 100 | 230 |
| green-boxer | Rushdown | 4/3/4/3 | 100 | 5 | 10 (stun 320) | 10 | 6 | 0 | 130 | 250 |
| jiujitsu-fighter | Grappler | 4/4/3/2 | 110 | 10 | 6 | 14 (stun 520) | 5 | 0 | 110 | 240 |
| viking-berserker | Juggernaut | 5/5/1/2 | 120 | 15 | 8 | 15 | 8 | 25 | 80 | 200 |
| kunoichi | Speedster | 1/2/5/5 | 85 | 0 | 6 | 10 | 9 | 0 | 125 | 270 |
| muay-thai | Pressure | 5/3/4/3 | 100 | 0 | 8 | 14 | 8 | 20 | 100 | 250 |
| shaolin-monk | Iron Wall | 2/5/3/3 | 100 | 20 | 7 | 11 | 8 | 0 | 100 | 230 |
| hac-long | Boss | 4/4/3/4 | 110 | 10 | 8 | 13 | 10 | 15 | 90 | 240 |
| wudang-swordswoman | Duelist | 4/2/3/4 | 90 | 0 | 9 | 11 | 8 | 10 | 115 | 240 |
| monkey-king | Trickster | 2/3/4/5 | 95 | 5 | 6 | 11 | 8 | 0 | 150 | 245 |
| asura-blade | Berserker | 5/2/4/4 | 85 | 0 | 9 | 15 | 13 × 2 crescents (`specialHits: 2`) | 10 | 100 | 255 |

`public/configs/fighter-playground.json` (the dev-panel save) overrides these per fighter when it has a
`combat` entry. Its combat block was removed on 2026-10-08 so the code defaults apply; keep it that way.

| # | id | Label | Status | Frame w | Stats / combat overrides | Quirks (manifest edits, notes) |
|---|---|---|---|---|---|---|
| 1 | red-brawler | Red Brawler | Live | 256 | special 7, special kb 170 | Original starter fighter |
| 2 | jiujitsu-fighter | Jiu-Jitsu Fighter | Live | 256 | walk 240, air 210, jump 1040; hp 110, light 6, heavy 14 (kb 380, stun 480), special 5 | Original starter fighter |
| 3 | green-boxer | Green Boxer | Live | 256 | walk 250, jump 1000; light 9 (kb 220), heavy 10 (kb 300) | Original starter fighter (was hidden, unhidden 2026-10-05) |
| 4 | viking-berserker | Viking Berserker | Live | 352 | walk 200, air 170, jump 920; hp 115, light 8, heavy 14 (kb 380), special 8 (kb 190) | drawFacing RIGHT; walk-forward dropFrames 7; uses `heavy-punch`; special-charge clips ~148 px |
| 5 | kunoichi | Kunoichi | Live | 320 | walk 270, air 230, jump 1080; hp 90, light 6, heavy 10, special 7 | crouch drop [1,2,3]; block-low drop [3,4,5]; special flipFrames [1-4] + background auto + span frameBounds; knockdown drop 6 |
| 6 | muay-thai | Muay Thai | Live | 320 | walk 250, jump 1000; light 8, heavy 13 (kb 360), special 8 | drawFacing RIGHT; jump drop 3; block-high drop [3,4,5]; light/heavy drop 5 + frameBounds; special 4x2 frameOrder [0,1,2,3,5,4,6,7] + frameBounds; knockdown drop 4. Gemini chat 3df9734a671f2afc |
| 7 | shaolin-monk | Shaolin Monk | Live | 384 | air 210, jump 1060; special 8 (kb 180) | drawFacing RIGHT, autoSlice; block-low drop [4,5,6] (shallow crouch accepted); light drop 5 + frameBounds [88,46,64,50]; heavy drop 3; special drop 4 + frameOrder [0,1,2,5,3,5,4,6]; **Golden Bell** guard effect. Gemini chat b50ffb5d4ab9244c |
| 8 | hac-long | Hắc Long | Done locally 2026-10-08 (registered, playtested, not pushed) | 384 | walk 245; hp 105, light 8, heavy 12, special 8 (kb 200) | Host / final boss in lore; special "Dragon's Regret" (*Kháng Long Hữu Hối*) ends in a smoke-dragon palm (needed 384 px). drawFacing RIGHT; jump drop [5,6,7]; block-high/low drop [7] (watermark); hit-high drop [4..7] + frameOrder [1,2,3,0]; light drop [4..7] + frameOrder [0,1,2,3,1,0] + frameBounds [104,68,64,40]; special frameOrder [0,1,2,1,3,1,5,4,6] + span frameBounds; knockdown drop [1,5] (opponent fist + stray pose). Chats: 6a9b57adf5ddf0b8 (actions 1–9, became contaminated), 278be43c3f3e6362 (10–14) |
| 9 | wudang-swordswoman | Wudang Swordswoman | Done locally 2026-10-08 (registered, playtested, not pushed) | 384 | walk 240, air 210, jump 1020; hp 95, light 8, heavy 12, special 7 | Bai Yun; jian sword; faces LEFT (no flip). walk-backward = walk-forward sheet reversed (frameOrder [5..0]); block-high drop [2..5] (2nd sword); light flipFrames [2,3] + frameOrder [0,1,2,3,4,0]; charge drop [4,5] + frameOrder [0,1,2,3,2,3]; special = 6 frames → frameOrder [0,0,1,3,2,3,4,5,5], no scaleFrom, span frameBounds; knockdown drop [2,4]. Gemini chat 1e40e67a2381ab8f |
| 10 | monkey-king | Monkey King | Done locally 2026-10-08 (registered, playtested, not pushed) | 384 | walk 260, air 220, jump 1100; hp 95, light 7, heavy 12, special 7 | Wukong; golden-banded staff; public-domain legend (Journey to the West). Reference faced RIGHT → spec `facing: RIGHT` + make_manifest --force before any hand edit (drawFacing RIGHT). walk-backward = walk-forward raw + frameOrder [5..0]; jump drop [3] + frameOrder [0,1,2,2,3,4]; heavy frameOrder [0,1,2,2,4,5]; charge drop [5] (2 staffs) + frameOrder [0,1,2,3,4,4]; special = 6 frames + a scrap piece → frameOrder [0,1,2,1,5,1,3,3,0], no scaleFrom, span frameBounds [28,62,84,76]. Images saved with the Download button + dl.py (clipboard denied). Gemini chat ccb1b706c8c0f4a4 |
| 11 | asura-blade | Asura Blade | Done locally 2026-10-08 (registered, playtested, not pushed) | **448** | walk 255, air 220, jump 1040; hp 85, light 9, heavy 15 (kb 380), special 13 × 2 crescents (kb 220), chip 10 | A Tu La Vương – Cuồng Đao. Original asura design inspired by La Hầu (*Tây Hành Kỷ*); the user approved it after several saber edits. Two DIFFERENT sabers: a hook-tipped scimitar in the back hand and a broad serrated saber in the front hand. Reference = the FIRST demonic version (`raw/ref-demonic-v1.png`). drawFacing RIGHT. walk flipFrames [4], walk-backward = walk raw + flip + [5..0]; crouch / block-low frameOrder [0,1,2,2,2,2]; hit-high frameOrder [1,2,3,0]; charge frameOrder [0,1,2,3,5,5]; special: 2 slashes at indices 2 and 4, NO melee attackSpans, so the purple crescents in `bladeQi.ts` deal all the damage; knockdown drop [0,1,3,6] (flying sabers). frameWidth 448 because the special arcs clipped at 384 (9 × 448 = 4032 < 4096 texture limit). Chats: 53100f88217fb71d (design + actions 1–9, drifted later), 5f51318bd6174556 (10–14, reference pasted) |

Shared notes
- `light-punch` = HIGH attack, `heavy-kick`/`heavy-punch` = LOW attack in the engine (`fighter.ts`).
- MatchScene disables crouch; block-low is only visible in the Playground (block-high is what players see).
- Select screen fits any roster size (column search in `CharacterSelectScene.buildCards`).
  - Landscape: card grid on the left, info panel (name, archetype, ratings, traits, bio) on the right.
  - Portrait: the info panel goes below the grid.
  - Card names sit in a name plate and shrink to fit (`fitTextToBox` in `ui.ts`).
  - Card labels must be English: Hắc Long's card/HUD label is "Black Dragon". The lore name stays "Hac Long".
