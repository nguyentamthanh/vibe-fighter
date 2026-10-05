# Muay Thai - image generation checklist

For each row: open gemini.google.com in a NEW chat, attach the reference image, paste the prompt file's
text (below the COPY line), download the result and save it under `raw/` with the exact name.
Do **idle first** and check it before generating the rest: every other action reuses its scale.

| # | Prompt file | Save as (in `raw/`) | Info | Done |
|---|---|---|---|---|
| 0 | `prompts/00-reference.txt` | `../muay-thai-ref.png` (not in `raw/`) | reference - **do this first**, no attachment | [ ] |
| 1 | `prompts/01-idle.txt` | `idle.png` | 6 frames, 3x2 grid, 8 fps | [ ] |
| 2 | `prompts/02-walk-forward.txt` | `walk-forward.png` | 6 frames, 3x2 grid, 8 fps | [ ] |
| 3 | `prompts/03-walk-backward.txt` | `walk-backward.png` | 6 frames, 3x2 grid, 8 fps | [ ] |
| 4 | `prompts/04-crouch.txt` | `crouch.png` | 6 frames, 3x2 grid, 10 fps | [ ] |
| 5 | `prompts/05-jump.txt` | `jump.png` | 6 frames, 3x2 grid, 10 fps | [ ] |
| 6 | `prompts/06-block-high.txt` | `block-high.png` | 6 frames, 3x2 grid, 10 fps | [ ] |
| 7 | `prompts/07-block-low.txt` | `block-low.png` | 6 frames, 3x2 grid, 10 fps | [ ] |
| 8 | `prompts/08-hit-high.txt` | `hit-high.png` | 6 frames, 3x2 grid, 12 fps | [ ] |
| 9 | `prompts/09-light-punch.txt` | `light-punch.png` | 6 frames, 3x2 grid, 14 fps | [ ] |
| 10 | `prompts/10-heavy-kick.txt` | `heavy-kick.png` | 6 frames, 3x2 grid, 12 fps | [ ] |
| 11 | `prompts/11-special-charge.txt` | `special-charge.png` | 6 frames, 3x2 grid, 14 fps | [ ] |
| 12 | `prompts/12-special.txt` | `special.png` | 9 frames, 3x3 grid, 16 fps | [ ] |
| 13 | `prompts/13-knockdown.txt` | `knockdown.png` | 6 frames, 3x2 grid, 10 fps | [ ] |
| 14 | `prompts/14-portrait.txt` | `portrait.png` | square portrait | [ ] |

When some or all files are saved, run:

```
python scripts/sprites/character.py build scripts/sprites/characters/muay-thai.json
```

`build` is safe to re-run: it processes whatever is in `raw/` and reports what is missing or wrong.
