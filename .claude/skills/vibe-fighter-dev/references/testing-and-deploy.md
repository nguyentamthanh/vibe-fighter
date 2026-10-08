# Testing, verifying and shipping

## Python for the sprite pipeline
The pipeline needs Python 3.11+ with `pillow`, `numpy`, `scipy` (`scripts/sprites/requirements.txt`). Check first:
`python -c "import numpy, PIL, scipy"`. On this machine the system Python was removed on 2026-10-07 and `python`
resolves to the Windows Store alias. Use the repo-local environment: `.venv\Scripts\python.exe` (created from
uv's CPython 3.12, `pip install -r scripts/sprites/requirements.txt`; git-ignored). If `.venv` is missing, recreate
it the same way (ask the user before installing packages).

## Static checks
`npx tsc --noEmit` • `npm test` (Vitest, 8 tests) • `npm run build` (the >500 kB chunk warning is expected).

## Dev server
`.claude/launch.json` runs `npm run dev -- --port 5174 --strictPort` (port 5173 is used by another app on this
machine). Start it with the preview tool (`preview_start name=vibe-fighter`). `?profile=portrait` switches to the
720×1280 layout. `/dashboard` = dev-only debug shell.

## Headless stepping harness (browser pane is usually hidden → no rAF)
The dev build exposes `window.__PHASER_GAME__`. Phaser 4 tweens and camera effects time themselves with
`Date.now()`, so a plain `game.step()` loop freezes them. Patch the clock forward-only and wait for the boot:
```js
const g = window.__PHASER_GAME__;
let k = 0; while (!g.scene.isActive('MainMenuScene') && k < 300) { g.step(performance.now(), 16.7); await new Promise(r => setTimeout(r, 30)); k++; }
const epoch = Date.now() + 1e7; window.__t = 0; Date.now = () => epoch + window.__t;
window.__step = (n) => { for (let i = 0; i < n; i++) { window.__t += 16.7; g.step(performance.now() + 1e7 + window.__t, 16.7); }
  return g.scene.getScenes(true).map(s => s.scene.key); };
g.scene.getScene('MainMenuScene').scene.start('MatchScene', { mode: '1vcpu', stageId: 'rooftop-twilight', p1CharacterId: 'red-brawler', p2CharacterId: '<id>' });
```
Jumping scenes before the boot loader finishes shows missing textures (green crossed boxes) — not a real bug.
After a Vite hot reload the harness is gone: re-run it. Take a screenshot after a few extra `__step(3)`.

## Scripted combat checks (inside MatchScene `m`)
```js
const N = {left:false,right:false,crouch:false,block:false,jump:false,light:false,heavy:false,special:false};
window.__script = []; window.__p2block = false;
m.readKeys = () => ({...N, ...(window.__script.shift() || {})});   // P1 input
m.cpu = { update: () => ({...N, block: window.__p2block}) };         // P2 (CPU) input
m.roundTimeMs = 99000; m.p1.posX = 540; m.p2.posX = 760;
window.__script = [{light: true}];   // or heavy / special (set m.p1.meter = 100 first)
```
Measure `p2.health` before/after, count hits for specials (3 for every fighter), block → 0 damage, set a
fighter's health to 1 and land a hit → `currentAnimKey` ends with `-knockdown` and phase `roundEnd`.
Real-time alternative: open `http://localhost:5174` in a Brave tab — but background tabs are throttled too.

## Shipping
Only when the user asks: `git add -A`, commit (describe what changed), `git push origin master`. Vercel's Git
integration deploys production (~15–40 s). Check with the Vercel tool `list_deployments`
(project `prj_NmLvKIoo5hfdKsjqsk68A3kkB1cK`, team `team_LJ3TU2x58VewhyzqrFi5VOU4`) → state READY, then fetch new
asset URLs on https://vibe-fighter-orpin.vercel.app (status 200). The production build does not expose
`__PHASER_GAME__`. `concepts/**/raw|work` stay out of Git.
