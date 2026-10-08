#!/usr/bin/env python3
"""
character.py - build a complete fighter from a manifest.

  reference <manifest> write the prompt that creates the reference image (new
                       characters only; everything else is drawn from it)
  prompts <manifest>   write one Gemini prompt file per action (+ portrait) and
                       a checklist telling you which file to save where
  build   <manifest>   process the raw sheets in <conceptDir>/raw/ into
                       public/assets/<id>/ (sheets, gifs, anchor, portrait) and,
                       once every action is present, generate the fighter's
                       src/game/*.ts from the manifest

Manifests live in scripts/sprites/characters/. Uses sprites.py for the image
work, so the same requirements apply (pip install -r requirements.txt).

Typical flow:
  python scripts/sprites/character.py prompts scripts/sprites/characters/viking-berserker.json
  ... generate each prompt in Gemini, save the image as raw/<action>.png ...
  python scripts/sprites/character.py build scripts/sprites/characters/viking-berserker.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
import sprites  # noqa: E402
from PIL import Image  # noqa: E402

REPO = Path(__file__).resolve().parents[2]

# Guard boxes copied from the shipped fighters; the manifest may override them.
DEFAULT_GUARD = {"block-high": [60, 44, 136, 116], "block-low": [60, 110, 136, 120]}


def load_manifest(path: str) -> dict:
    manifest = json.loads(Path(path).read_text(encoding="utf-8"))
    for a in manifest["actions"]:
        if len(a["poses"]) != a["frames"]:
            raise sprites.SpriteError(f"{a['action']}: {len(a['poses'])} poses but frames={a['frames']}")
        layout = a.get("sliceGrid", a["grid"])
        if layout != "auto":
            c, r = sprites.parse_grid(layout)
            if c * r < a["frames"]:
                raise sprites.SpriteError(f"{a['action']}: grid {layout} is too small for {a['frames']} frames")
    return manifest


# ---------------------------------------------------------------------- prompts


def action_prompt(m: dict, a: dict) -> str:
    cols, rows = sprites.parse_grid(a["grid"])
    parts = [
        f"Using the attached character reference exactly (same design, colours, proportions and {m['style']} look: "
        f"{m['description']}), draw a sprite sheet of the \"{a['label']}\" animation for a 2D fighting game: "
        f"{a['frames']} frames in a {cols}x{rows} grid ({cols} columns, {rows} rows), read left-to-right then "
        "top-to-bottom. Every frame has the same size, the same character scale and the same ground line, and the "
        f"character faces {m.get('drawFacing', 'LEFT')} in a 3/4 side view. {a['note']}",
    ]
    parts += [f"Frame {i}: {pose}." for i, pose in enumerate(a["poses"], start=1)]
    parts.append(
        f"Draw the character small inside its cell: including the {m.get('overflowParts', 'weapon or effects')}, "
        "it takes at most 60 percent of the cell width and 80 percent of the cell height, centred, with plenty of "
        f"empty background around it. No part of the character, {m.get('overflowParts', 'weapon or effects')} may "
        "cross into a neighbouring cell or touch the image edge. Draw only this one "
        "character, no opponent. Flat solid magenta (#ff00ff) background, no shadow, no text, no numbers, "
        "no grid lines, no logo, no watermark."
    )
    return "\n".join(parts)


def reference_prompt(m: dict) -> str:
    return (f"Create a clean full-body reference image for an original {m['style']} character: {m['description']}. "
            "Isolated full-body, 3/4 side view facing LEFT in a ready fighting stance, centred with generous "
            "padding, plain white background, no stage, no HUD, no opponent. Original character only, "
            "no logos, no text, no watermark.")


def write_reference_prompt(m: dict) -> None:
    concept = REPO / m["conceptDir"]
    concept.mkdir(parents=True, exist_ok=True)
    path = concept / "prompts" / "00-reference.txt"
    path.parent.mkdir(exist_ok=True)
    path.write_text(
        f"NO attachment - this prompt creates the reference itself.\n"
        f"SAVE the result as: {m['conceptDir']}/{m['reference']}\n"
        "Check it before generating any action: every other prompt copies this design.\n\n"
        f"----- COPY EVERYTHING BELOW THIS LINE INTO GEMINI -----\n{reference_prompt(m)}\n",
        encoding="utf-8")
    print(f"wrote {path}")


def portrait_prompt(m: dict) -> str:
    return m["portrait"]["prompt"].format(description=m["description"], style=m["style"])


def write_prompts(m: dict) -> None:
    concept = REPO / m["conceptDir"]
    out = concept / "prompts"
    out.mkdir(parents=True, exist_ok=True)
    (concept / "raw").mkdir(exist_ok=True)
    ref = f"{m['conceptDir']}/{m['reference']}"
    rows = []

    def write(n: int, name: str, save: str, meta: str, body: str) -> None:
        text = (f"ATTACH the reference image: {ref}\nSAVE the result as: {m['conceptDir']}/raw/{save}\n"
                f"{meta}\n\n----- COPY EVERYTHING BELOW THIS LINE INTO GEMINI -----\n{body}\n")
        (out / f"{n:02d}-{name}.txt").write_text(text, encoding="utf-8")
        rows.append((n, name, save, meta))

    for i, a in enumerate(m["actions"], start=1):
        write(i, a["action"], f"{a['action']}.png", f"{a['frames']} frames, {a['grid']} grid, {a['fps']} fps",
              action_prompt(m, a))
    write(len(m["actions"]) + 1, "portrait", "portrait.png", "square portrait", portrait_prompt(m))

    lines = [
        f"# {m['label']} - image generation checklist", "",
        "For each row: open gemini.google.com in a NEW chat, attach the reference image, paste the prompt file's",
        "text (below the COPY line), download the result and save it under `raw/` with the exact name.",
        "Do **idle first** and check it before generating the rest: every other action reuses its scale.", "",
        "| # | Prompt file | Save as (in `raw/`) | Info | Done |", "|---|---|---|---|---|",
    ]
    if (out / "00-reference.txt").exists():
        lines.append(f"| 0 | `prompts/00-reference.txt` | `../{m['reference']}` (not in `raw/`) | "
                     "reference - **do this first**, no attachment | [ ] |")
    lines += [f"| {n} | `prompts/{n:02d}-{name}.txt` | `{save}` | {meta} | [ ] |" for n, name, save, meta in rows]
    lines += ["", "When some or all files are saved, run:", "",
              "```", "python scripts/sprites/character.py build scripts/sprites/characters/"
              f"{m['id']}.json", "```", "",
              "`build` is safe to re-run: it processes whatever is in `raw/` and reports what is missing or wrong."]
    (out / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} prompt files + README.md -> {out}")


# ------------------------------------------------------------------------ build


def build_anchor(m: dict, out_dir: Path) -> None:
    ref = Image.open(REPO / m["conceptDir"] / m["reference"])
    keyed = sprites.key_background(ref, "auto", 14.0, 150)
    box = keyed.getbbox()
    if box is None:
        raise sprites.SpriteError("reference has no opaque pixels after keying")
    crop = keyed.crop(box)
    side = 1024
    scale = min(side * 0.9 / crop.width, side * 0.9 / crop.height)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((side - crop.width) // 2, side - crop.height - round(side * 0.05)))
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas.save(out_dir / "anchor-w.png")
    print("wrote anchor-w.png (1024x1024)")


def build_portrait(m: dict, out_dir: Path) -> bool:
    src = REPO / m["conceptDir"] / "raw" / "portrait.png"
    if not src.exists():
        return False
    img = Image.open(src).convert("RGB")
    if m["portrait"].get("flip"):  # portraits are authored facing left (see superCutIn.ts / matchHud.ts)
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img.crop((left, top, left + side, top + side)).resize((1254, 1254), Image.LANCZOS).save(out_dir / "portrait.png")
    print("wrote portrait.png (1254x1254)")
    return True


def build_action(m: dict, a: dict, out_dir: Path) -> dict:
    raw = REPO / m["conceptDir"] / "raw" / f"{a['action']}.png"
    work = REPO / m["conceptDir"] / "work" / a["action"]
    # background "auto" samples the sheet border: the model sometimes paints a darker magenta than asked.
    keyed = sprites.key_background(Image.open(raw), a.get("background", m.get("background", "magenta")), 36.0, 150)
    work.mkdir(parents=True, exist_ok=True)
    keyed.save(work / "keyed.png")
    # sliceGrid: how the returned sheet is actually laid out when the model ignored the requested `grid`
    # ("4x2", or "auto" for uneven rows — pieces are then clustered by position instead of by cell).
    # Manifest-level autoSlice: actions that do not need in-cell x positions (align feet/centroid/fixed-y) are always
    # sliced by position, because the model often returns a different or uneven layout than requested.
    default = "auto" if m.get("autoSlice") and a["align"] in ("feet", "centroid", "fixed-y") else a["grid"]
    slice_grid = a.get("sliceGrid", default)
    grid = None if slice_grid == "auto" else sprites.parse_grid(slice_grid)
    frames, cell = sprites.slice_sheet(keyed, grid, 60, 0.05, True)
    sprites.save_frames(frames, cell, work)
    if slice_grid == "auto" and len(frames) != a["frames"]:
        print(f"note: {a['action']}: found {len(frames)} frames (manifest says {a['frames']}); using what was drawn")
    elif len(frames) != a["frames"]:
        raise sprites.SpriteError(
            f"found {len(frames)} frames, expected {a['frames']} - check {work} (a frame may be missing, merged, "
            "or a stray mark counted as a frame)")
    # dropFrames: 0-based frames the model botched (cut-off weapon, watermark) that are cheaper to drop than
    # to regenerate. Attack frame indices in the manifest refer to the frames that remain.
    # flipFrames: 0-based source frames the model drew facing the wrong way (mirrored in place in their cell).
    for i in a.get("flipFrames", []):
        f = frames[i]
        f["image"] = f["image"].transpose(Image.FLIP_LEFT_RIGHT)
        if f["rel"] is not None and cell:
            f["rel"][0] = cell[0] - f["rel"][0] - f["image"].width
    frames = [f for i, f in enumerate(frames) if i not in set(a.get("dropFrames", []))]
    # frameOrder: re-sequence the kept frames, e.g. to put a non-attack frame between two strikes the model drew
    # back to back (the engine only counts a new hit after an inactive frame). An index may repeat (a transition
    # frame reused between hits), so each entry is a shallow copy.
    if "frameOrder" in a:
        frames = [dict(frames[i]) for i in a["frameOrder"]]
    args = SimpleNamespace(
        action=a["action"], out=str(out_dir), align=a["align"],
        target_height=m.get("targetHeight", sprites.STAND_HEIGHT), scale=None,
        reset_scale=a["action"] == "idle", fps=a["fps"], repeat=a["repeat"], resample="lanczos",
        flip=a.get("flip", m.get("drawFacing") == "RIGHT"), quiet=True, scale_from=a.get("scaleFrom"),
        cell_width=m.get("frameWidth"))
    return sprites.pack(frames, cell, args)


def ts_rect(r) -> str:
    return f"rect({r[0]}, {r[1]}, {r[2]}, {r[3]})"


def capped_visual(m: dict, action: str, visual: tuple) -> tuple:
    """The game derives the hurtbox from defaultVisual (+8px), so a long weapon
    would turn into a hittable hurtbox. Cap the width and centre it on the feet
    so the box follows the body, in the same range as the shipped fighters."""
    caps = m.get("visualWidthCap", {})
    cap = caps.get(action, caps.get("default"))
    x, y, w, h = visual
    if cap and w > cap:
        x, w = round(sprites.feet_x_for(m.get("frameWidth", sprites.CELL)) - cap / 2), cap
    return x, y, w, h


def front_box(info: dict, frames: list[int], body_left: int) -> list[int] | None:
    """Bounding box of what sticks out in front of the body (x < body_left) in the given
    frames of a packed sheet - i.e. the weapon / fist / foot that actually lands the hit."""
    sheet = np.array(Image.open(info["sheet"]))[..., 3] > sprites.ALPHA_T
    cw, ch = info["cell_width"], sprites.CELL
    x0 = y0 = 10**9
    x1 = y1 = -1
    for i in frames:
        cell = sheet[(i // sprites.COLS) * ch:(i // sprites.COLS + 1) * ch, (i % sprites.COLS) * cw:(i % sprites.COLS + 1) * cw]
        front = cell[:, :body_left]
        if front.sum() < 80:
            continue
        # Keep only the heaviest vertical band (the weapon); a front foot or knee forms a separate band.
        counts = front.sum(1)
        bands, start, gap = [], None, 0
        for y, c in enumerate(counts):
            if c >= 3:
                start = y if start is None else start
                gap = 0
            elif start is not None:
                gap += 1
                if gap > 6:
                    bands.append((start, y - gap + 1))
                    start, gap = None, 0
        if start is not None:
            bands.append((start, len(counts)))
        top, bottom = max(bands, key=lambda b: counts[b[0]:b[1]].sum())
        front = front.copy()
        front[:top] = front[bottom:] = False
        ys, xs = np.where(front)
        x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max() + 1), max(y1, ys.max() + 1)
    return None if x1 < 0 else [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


def ts_str(s: str) -> str:
    """A single-quoted TS string literal (labels like "Dragon's Regret" contain quotes)."""
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def action_ts(a: dict, visual, shift: int = 0, info: dict | None = None) -> str:
    """`shift` moves manifest boxes, authored for the standard 256px frame, to the centre of a wider frame.
    With the packed sheet's `info`, attack boxes are measured from the sprite (front_box) instead."""
    def box(r):
        return ts_rect([r[0] + shift, r[1], r[2], r[3]])

    def attack_box(frames, fallback, fixed=None):
        if fixed:  # "frameBounds" in the manifest: hand-set, already in final frame coordinates
            return ts_rect(fixed)
        measured = front_box(info, frames, visual[0] + 8) if info else None
        return ts_rect(measured) if measured else box(fallback)

    fields = [f"action: '{a['action']}'", f"label: {ts_str(a['label'])}", f"file: '{a['action']}.png'",
              f"frames: {info['frames'] if info else a['frames'] - len(a.get('dropFrames', []))}",
              f"frameRate: {a['fps']}",
              f"repeat: {a['repeat']}",
              f"defaultVisual: {ts_rect(visual)}"]
    if a.get("attack"):
        atk = a["attack"]
        fields.append(f"attack: {{ frames: {json.dumps(atk['frames'])}, "
                      f"bounds: {attack_box(atk['frames'], atk['bounds'], atk.get('frameBounds'))} }}")
    if a.get("attackSpans"):
        spans = ",\n      ".join(f"{{ frames: {json.dumps(s['frames'])}, "
                                 f"bounds: {attack_box(s['frames'], s['bounds'], s.get('frameBounds'))} }}"
                                 for s in a["attackSpans"])
        fields.append(f"attackSpans: [\n      {spans}\n    ]")
    guard = a.get("guard") or DEFAULT_GUARD.get(a["action"])
    if guard:
        fields.append(f"guard: {box(guard)}")
    return "  {\n    " + ",\n    ".join(fields) + "\n  }"


def pick_visual(m: dict, a: dict, info: dict) -> tuple:
    # visualFrom: take the hurtbox from one frame (e.g. -1 = the held crouch / lying pose) instead of the
    # union of all frames, which would include the standing start pose.
    raw = info["boxes"][a["visualFrom"]] if "visualFrom" in a else info["visual"]
    return capped_visual(m, a["action"], raw)


def write_ts(m: dict, infos: dict[str, dict]) -> Path:
    const = m["constName"]
    asset_url = "/" + m["assetRoot"].removeprefix("public/")
    frame_width = m.get("frameWidth", sprites.CELL)
    shift = (frame_width - sprites.CELL) // 2
    body = ",\n".join(action_ts(a, pick_visual(m, a, infos[a["action"]]), shift, infos[a["action"]])
                       for a in m["actions"])
    frame_width_line = f"  frameWidth: {frame_width},\n" if frame_width != sprites.CELL else ""
    text = f"""import type {{ CharacterDefinition }} from './hero';
import {{ buildFighterCharacter, rect, type FighterActionSpec }} from './fighterCharacter';

// Generated by scripts/sprites/character.py from scripts/sprites/characters/{m['id']}.json.
// defaultVisual comes from the packed sheets, width-capped so the hurtbox follows the
// body rather than the weapon (visualWidthCap / visualFrom in the manifest). Attack boxes
// are measured from what sticks out in front of the body on the strike frames; guard
// boxes are copied from the shipped fighters. Tune by hand after playtesting.

export const {const}_CHARACTER_ID = '{m['id']}';

const {const}_ACTIONS: FighterActionSpec[] = [
{body}
];

export const {const}_CHARACTER: CharacterDefinition = buildFighterCharacter({{
  id: {const}_CHARACTER_ID,
  label: {ts_str(m['label'])},
  assetRoot: '{asset_url}',
  anchorUsage: '{m['anchorUsage']}',
{frame_width_line}  actions: {const}_ACTIONS
}});
"""
    path = REPO / m["tsFile"]
    path.write_text(text, encoding="utf-8")
    return path


def build(m: dict, only: set[str] | None, force_ts: bool) -> int:
    out_dir = REPO / m["assetRoot"]
    out_dir.mkdir(parents=True, exist_ok=True)
    build_anchor(m, out_dir)
    have_portrait = build_portrait(m, out_dir)

    results: dict[str, str] = {}
    infos: dict[str, dict] = {}
    for a in sorted(m["actions"], key=lambda a: a["action"] != "idle"):  # idle first: it sets the scale
        name = a["action"]
        if only and name not in only:
            continue
        raw = REPO / m["conceptDir"] / "raw" / f"{name}.png"
        if not raw.exists():
            results[name] = "missing raw file"
            continue
        print(f"\n=== {name} ===")
        try:
            info = build_action(m, a, out_dir)
            infos[name] = info
            results[name] = "ok" if info["clipped"] <= 20 else f"ok, but {info['clipped']}px clipped at the cell edge"
        except sprites.SpriteError as exc:
            results[name] = f"FAILED: {exc}"

    print("\n=== summary ===")
    width = max(len(n) for n in results) if results else 0
    for name, status in results.items():
        print(f"  {name:<{width}}  {status}")
    print(f"  {'portrait':<{width}}  {'ok' if have_portrait else 'missing raw file'}")

    complete = (not only and len(infos) == len(m["actions"]) and have_portrait
                and all(r.startswith("ok") for r in results.values()))
    ts_path = REPO / m["tsFile"]
    if complete and (force_ts or not ts_path.exists()):
        print(f"\nwrote {write_ts(m, infos).relative_to(REPO)}")
        print("Next: register it (hero.ts CHARACTER_DEFINITIONS, CharacterSelectScene SELECTABLE_FIGHTER_IDS), "
              "then npm run typecheck && npm run dev.")
    elif complete:
        print(f"\n{m['tsFile']} already exists - pass --force-ts to regenerate (this overwrites hand-tuned boxes).")
    else:
        todo = [n for n, s in results.items() if s != "ok" and not s.startswith("ok,")]
        print(f"\nNot complete yet ({len(m['actions']) - len(infos)} action(s) left"
              f"{'' if have_portrait else ', portrait missing'}); the TypeScript file is generated only when "
              "everything is built. Remaining: " + ", ".join(todo + ([] if have_portrait else ["portrait"])))
    return 1 if any(s.startswith("FAILED") for s in results.values()) else 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("prompts")
    p.add_argument("manifest")
    rf = sub.add_parser("reference", help="write the prompt that creates the character's reference image")
    rf.add_argument("manifest")
    b = sub.add_parser("build")
    b.add_argument("manifest")
    b.add_argument("--only", help="comma-separated actions to (re)build")
    b.add_argument("--force-ts", action="store_true", help="overwrite the generated .ts file")
    args = ap.parse_args(argv)
    try:
        m = load_manifest(args.manifest)
        if args.cmd == "reference":
            write_reference_prompt(m)
            return 0
        if args.cmd == "prompts":
            if not (REPO / m["conceptDir"] / m["reference"]).exists():
                print(f"warning: reference {m['conceptDir']}/{m['reference']} not found yet - "
                      "run `character.py reference` and generate it first", file=sys.stderr)
            write_prompts(m)
            return 0
        only = set(args.only.split(",")) if args.only else None
        return build(m, only, args.force_ts)
    except sprites.SpriteError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
