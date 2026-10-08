#!/usr/bin/env python3
"""
sprites.py - turn an AI-generated sprite sheet into a game-ready fighter sheet.

Pipeline (each stage is also a sub-command):

  key    remove the flat background (white / chroma) -> real alpha
  slice  split the raw sheet into one crop per frame, tolerant of weapons /
         effects that overflow into a neighbouring cell
  pack   normalise scale, anchor every frame to the shared ground line and pack
         into <action>.png (256x256 cells, 5 columns, row-major) + preview gif
  run    key + slice + pack in one go (the usual entry point)

Conventions are measured from the shipped fighters (red-brawler, green-boxer,
jiujitsu-fighter): 256x256 cells, feet on row 227, feet centre at x=125,
standing height ~196px, character facing WEST (left).

Requires: pip install pillow numpy scipy

Example:
  python scripts/sprites/sprites.py run \
      concepts/characters/2026-09-17-viking/idle-raw.png \
      --action idle --grid 4x2 --out public/assets/viking-berserker
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

CELL = 256  # frame height, and the default frame width
COLS = 5  # every shipped sheet is 5 frames wide; Phaser derives columns from width
GROUND_Y = 227  # last opaque row of a standing/crouching fighter
FEET_X = 125
STAND_HEIGHT = 196
ALPHA_T = 24


def feet_x_for(cell_width: int) -> int:
    """Feet centre for a frame width (125 for the standard 256px frame, i.e. 3px left of the anchor)."""
    return cell_width // 2 - 3

# fps / repeat per action, taken from redBrawler.ts so a new fighter feels alike.
ACTION_DEFAULTS = {
    "idle": (8, -1),
    "walk-forward": (8, -1),
    "walk-backward": (8, -1),
    "crouch": (10, 0),
    "jump": (10, 0),
    "block-high": (10, 0),
    "block-low": (10, 0),
    "hit-high": (12, 0),
    "light-punch": (14, 0),
    "heavy-kick": (12, 0),
    "heavy-punch": (12, 0),
    "special-charge": (14, 0),
    "special": (16, 0),
    "knockdown": (10, 0),
}


class SpriteError(Exception):
    pass


# --------------------------------------------------------------------------- key


def parse_bg(bg: str, arr: np.ndarray) -> np.ndarray:
    if bg == "auto":
        rgb = arr[..., :3]
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        return np.median(border, axis=0)
    if bg == "white":
        return np.array([255.0, 255.0, 255.0])
    if bg == "magenta":
        return np.array([255.0, 0.0, 255.0])
    if bg.startswith("#") and len(bg) == 7:
        return np.array([int(bg[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    raise SpriteError(f"--bg must be auto|white|magenta|#rrggbb, got {bg!r}")


def key_background(img: Image.Image, bg: str = "auto", tol: float = 36.0, holes: int = 0) -> Image.Image:
    """Flood-fill the background from the border, then matte the edge pixels.

    Only background connected to the image border is removed, so white that is
    *inside* the character (eyes, highlights, bandages) survives. Pass
    holes=<min pixel area> to also remove large enclosed pockets (e.g. the gap
    between an arm and a weapon shaft).
    """
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    if (arr[..., 3] < 250).mean() > 0.05:
        return img.convert("RGBA")  # already has real transparency

    color = parse_bg(bg, arr)
    dist = np.sqrt(((arr[..., :3] - color) ** 2).sum(-1))
    cand = dist <= tol
    lab, n = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    remove = np.zeros(n + 1, dtype=bool)
    remove[border] = True
    if holes:
        remove |= np.bincount(lab.ravel(), minlength=n + 1) >= holes
    remove[0] = False
    bgmask = remove[lab]

    # Edge matte: solve p = a*c + (1-a)*bg for the 2px ring around the background.
    ring = ndimage.binary_dilation(bgmask, iterations=2) & ~bgmask
    a = np.clip((dist - tol) / (tol * 1.5), 0.0, 1.0)
    out = arr.copy()
    m = ring & (a < 1.0)
    safe = np.maximum(a[m], 0.05)[:, None]
    out[m, :3] = np.clip((arr[m, :3] - (1 - safe) * color) / safe, 0, 255)
    out[..., 3] = 255.0
    out[m, 3] = a[m] * 255.0
    out[bgmask, 3] = 0.0
    if color[0] > 200 and color[2] > 200 and color[1] < 60:
        despill_magenta(out)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def despill_magenta(out: np.ndarray) -> None:
    """Remove magenta left behind by a magenta key: saturated magenta pockets
    (gaps inside the axe, sparks the model tinted pink) become transparent, and
    the 2px rim around transparency loses its magenta cast. Dark purples (e.g. a
    ninja jacket) stay untouched: they are neither bright nor on the rim."""
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    hot = (r >= 150) & (b >= 150) & (g <= 0.6 * np.minimum(r, b))
    # Darker magenta the model paints as a "ground shadow" under the feet. Purple cloth keeps
    # far more green relative to red/blue, so it is not caught.
    lo, hi = np.minimum(r, b), np.maximum(r, b)
    hot |= (lo >= 80) & (g <= 0.3 * lo) & (hi - lo <= 0.35 * hi)
    out[hot, 3] = 0.0
    clear = out[..., 3] < 8
    rim = ndimage.binary_dilation(clear, iterations=2) & ~clear
    spill = np.clip(np.minimum(r, b) - g, 0, None) * rim
    out[..., 0] -= spill
    out[..., 2] -= spill


# ------------------------------------------------------------------------ slice


def parse_grid(text: str) -> tuple[int, int]:
    try:
        c, r = text.lower().split("x")
        return int(c), int(r)
    except ValueError as exc:
        raise SpriteError(f"--grid must look like 4x2 (columns x rows), got {text!r}") from exc


def remove_grid_lines(rgba: np.ndarray, grid: tuple[int, int] | None = None, core: float = 0.97,
                      band: int | None = None) -> int:
    """Clear grid/separator lines the model drew despite being asked not to.

    A line is a full-height column (or full-width row) that is >= `core` opaque;
    no character spans 97% of the whole sheet. With a known `grid`, the expected
    cell boundaries are also checked with a much lower bar (>= 30% opaque within
    a few px): on small sheets a 1px line blends into the magenta and is partly
    keyed away, so it never reaches `core`. A `band` strip (about 10px at 2816px
    wide, scaled with the image) on each side of a line is cleared as well: its
    anti-aliased fringe otherwise glues the feet (drawn right on the line) to the
    sheet border and every frame's crop swells to the whole cell. When lines are
    found, the same band is cleared along the image border, where the model draws
    a frame around the grid. Returns the number of rows + columns cleared.
    """
    cleared = 0
    opaque = rgba[..., 3] > ALPHA_T
    covers = [opaque.mean(0), opaque.mean(1)]
    band = band or max(3, round(10 * rgba.shape[1] / 2816))
    lines: list[list[int]] = [list(np.where(c >= core)[0]) for c in covers]
    if grid:
        for axis, count in ((0, grid[0]), (1, grid[1])):
            size = len(covers[axis])
            for k in range(1, count):
                at = round(k * size / count)
                window = covers[axis][max(0, at - band) : at + band + 1]
                if window.size and window.max() >= 0.3:
                    lines[axis].append(max(0, at - band) + int(window.argmax()))
    if not any(lines):
        return 0
    for axis in (0, 1):  # axis 0 -> columns, axis 1 -> rows
        cover = covers[axis]
        kill = np.zeros(len(cover), dtype=bool)
        kill[:band] = kill[-band:] = True
        for i in lines[axis]:
            kill[max(0, i - band) : i + band + 1] = True
        if axis == 0:
            rgba[:, kill, 3] = 0
        else:
            rgba[kill, :, 3] = 0
        cleared += int(kill.sum())
    return cleared


def remove_line_runs(rgba: np.ndarray, min_frac: float = 0.2) -> int:
    """Clear dark, 1-2px straight runs at least `min_frac` of the sheet long — grid/separator lines of any
    layout (the model sometimes draws uneven rows, e.g. 4 frames over 3). Character outlines are never that
    straight and long. Returns the number of pixels cleared."""
    rgb = rgba[..., :3].astype(np.int32)
    dark = (rgba[..., 3] > ALPHA_T) & (rgb.sum(-1) < 3 * 90)
    height, width = dark.shape
    line = np.zeros_like(dark)
    # Only THIN dark pixels can belong to a line: a horizontal line is at most 2 px tall, a vertical one at most
    # 2 px wide. Without this, every column of a black garment (Hắc Long's trousers) counted as a vertical "line"
    # and the leg was erased.
    thin_rows = dark & ~ndimage.binary_opening(dark, structure=np.ones((3, 1), dtype=bool))
    thin_cols = dark & ~ndimage.binary_opening(dark, structure=np.ones((1, 3), dtype=bool))
    for structure, length, along, thin in (([[0, 0, 0], [1, 1, 1], [0, 0, 0]], width, 1, thin_rows),
                                            ([[0, 1, 0], [0, 1, 0], [0, 1, 0]], height, 0, thin_cols)):
        lab, _ = ndimage.label(thin, structure=np.array(structure))
        for i, sl in enumerate(ndimage.find_objects(lab), start=1):
            if sl[along].stop - sl[along].start >= min_frac * length:
                line[sl] |= lab[sl] == i
    if not line.any():
        return 0
    line = ndimage.binary_dilation(line, iterations=2)
    rgba[line, 3] = 0
    return int(line.sum())


def slice_sheet(img: Image.Image, grid: tuple[int, int] | None, attach: int, min_frac: float,
                watermark: bool) -> tuple[list[dict], tuple[int, int] | None]:
    """Split a keyed sheet into frames. Returns (frames, cell_size).

    grid mode  : every connected piece is assigned to the cell holding its
                 centre, so a weapon overflowing into the next cell still
                 belongs to its own frame. In-cell position is preserved
                 (needed for --align fixed).
    auto mode  : no grid; pieces are clustered into rows/columns by position.
    """
    rgba = np.array(img.convert("RGBA"))
    height, width = rgba.shape[:2]
    if (lines := remove_grid_lines(rgba, grid)):
        print(f"removed grid lines ({lines} rows/columns)")
    if (runs := remove_line_runs(rgba)):
        print(f"removed line runs ({runs} px)")
    lab, n = ndimage.label(rgba[..., 3] > ALPHA_T, structure=np.ones((3, 3)))
    if n == 0:
        raise SpriteError("nothing opaque found - did the background key step work?")
    areas = np.bincount(lab.ravel(), minlength=n + 1)
    biggest = int(areas[1:].max())

    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        x0, x1, y0, y1 = sl[1].start, sl[1].stop, sl[0].start, sl[0].stop
        comps.append({"id": i, "box": (x0, y0, x1, y1), "area": int(areas[i])})

    def is_speck(c):
        return c["area"] < max(6, 0.0005 * biggest)

    def in_watermark(c):
        x0, y0, x1, y1 = c["box"]
        return watermark and (x0 + x1) / 2 > 0.9 * width and (y0 + y1) / 2 > 0.9 * height and c["area"] < 0.03 * biggest

    def is_line_debris(c):
        # leftover fringe of a removed grid line: a long, thin, separate sliver
        x0, y0, x1, y1 = c["box"]
        w, h = x1 - x0, y1 - y0
        # long thin sliver, or any separate 1-3px-thin scrap (a broken grid line on small sheets)
        return (min(w, h) <= 16 and max(w, h) >= 0.2 * min(width, height)) or (min(w, h) <= 3 and max(w, h) >= 6)

    comps = [c for c in comps if not is_speck(c) and not in_watermark(c) and not is_line_debris(c)]

    groups: list[list[dict]]
    cell = None
    origins: list[tuple[int, int] | None]
    if grid:
        cols, rows = grid
        cw, ch = width / cols, height / rows
        cell = (round(cw), round(ch))
        bucket: dict[tuple[int, int], list[dict]] = defaultdict(list)
        for c in comps:
            x0, y0, x1, y1 = c["box"]
            col = min(int(((x0 + x1) / 2) // cw), cols - 1)
            row = min(int(((y0 + y1) / 2) // ch), rows - 1)
            bucket[(row, col)].append(c)
        keys = sorted(bucket)
        groups = [bucket[k] for k in keys]
        origins = [(round(k[1] * cw), round(k[0] * ch)) for k in keys]
        occupied = [k[0] * cols + k[1] for k in keys]
        if occupied != list(range(len(occupied))):
            print("warning: empty cell(s) between frames - frame numbering skips them", file=sys.stderr)
    else:
        big = [c for c in comps if c["area"] >= min_frac * biggest]
        small = [c for c in comps if c["area"] < min_frac * biggest]
        if not big:
            raise SpriteError("no frame-sized piece found; lower --min-frac")

        def gap(a, b):
            dx = max(a[0] - b[2], b[0] - a[2], 0)
            dy = max(a[1] - b[3], b[1] - a[3], 0)
            return math.hypot(dx, dy)

        members = {c["id"]: [c] for c in big}
        for s in small:
            best = min(big, key=lambda b: gap(s["box"], b["box"]))
            if gap(s["box"], best["box"]) <= attach:
                members[best["id"]].append(s)
        heights = sorted(c["box"][3] - c["box"][1] for c in big)
        row_gap = 0.5 * heights[len(heights) // 2]
        rows_l: list[list[dict]] = []
        for c in sorted(big, key=lambda c: (c["box"][1] + c["box"][3]) / 2):
            cy = (c["box"][1] + c["box"][3]) / 2
            if rows_l and abs(cy - np.mean([(r["box"][1] + r["box"][3]) / 2 for r in rows_l[-1]])) <= row_gap:
                rows_l[-1].append(c)
            else:
                rows_l.append([c])
        ordered = []
        origins = []
        for r in rows_l:
            # Each row's ground line is its lowest foot: in-row vertical offsets survive (jump / knockdown), so
            # align "fixed-y" works without a grid. Horizontal in-cell positions are unknown (x offset 0).
            ground = max(m_["box"][3] for c in r for m_ in members[c["id"]])
            for c in sorted(r, key=lambda c: (c["box"][0] + c["box"][2]) / 2):
                ordered.append(c)
                origins.append((min(m_["box"][0] for m_ in members[c["id"]]), ground))
        groups = [members[c["id"]] for c in ordered]

    frames = []
    for members_, origin in zip(groups, origins):
        x0 = min(c["box"][0] for c in members_)
        y0 = min(c["box"][1] for c in members_)
        x1 = max(c["box"][2] for c in members_)
        y1 = max(c["box"][3] for c in members_)
        keep = np.isin(lab[y0:y1, x0:x1], [c["id"] for c in members_])
        crop = rgba[y0:y1, x0:x1].copy()
        crop[~keep] = 0
        frames.append({
            "image": Image.fromarray(crop, "RGBA"),
            "bbox": [x0, y0, x1, y1],
            "rel": None if origin is None else [x0 - origin[0], y0 - origin[1]],
        })
    return frames, cell


def save_frames(frames: list[dict], cell, work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    for old in work.glob("frame-*.png"):
        old.unlink()
    meta = {"cell": cell, "frames": []}
    for i, f in enumerate(frames, start=1):
        name = f"frame-{i:02d}.png"
        f["image"].save(work / name)
        meta["frames"].append({"file": name, "bbox": f["bbox"], "rel": f["rel"]})
    (work / "frames.json").write_text(json.dumps(meta, indent=2))


def load_frames(work: Path) -> tuple[list[dict], tuple[int, int] | None]:
    meta_path = work / "frames.json"
    if not meta_path.exists():
        raise SpriteError(f"{meta_path} not found - run the slice stage first")
    meta = json.loads(meta_path.read_text())
    frames = [{"image": Image.open(work / m["file"]).convert("RGBA"), "bbox": m["bbox"], "rel": m["rel"]}
              for m in meta["frames"]]
    return frames, (tuple(meta["cell"]) if meta["cell"] else None)


# ------------------------------------------------------------------------- pack


def feet_of(crop: Image.Image) -> tuple[float, int]:
    """(feet centre x, last opaque row) in crop-local pixels."""
    a = np.array(crop)[..., 3] > ALPHA_T
    rows = np.where(a.sum(1) >= 3)[0]
    if not len(rows):
        rows = np.where(a.any(1))[0]
    bottom = int(rows[-1])
    band_top = max(0, bottom - max(4, int(0.06 * a.shape[0])))
    xs = np.where(a[band_top : bottom + 1].any(0))[0]
    return float(xs.mean()), bottom


def mass_x(crop: Image.Image) -> float:
    a = (np.array(crop)[..., 3] > ALPHA_T).sum(0)
    return float((a * np.arange(len(a))).sum() / a.sum())


def resolve_scale(frames, cell, args, out_dir: Path) -> float:
    """Pick the scale that makes this sheet's character the same size as in idle.

    Generated sheets differ in resolution and grid, and the model fills each
    cell, so a fixed scale is wrong. In order of preference:
      --scale                explicit
      scale_from=<frame>     that frame is a neutral standing pose: scale it to target height
      cell height            idle's scale x idle cell height / this cell height
    The first sheet (idle, or --reset-scale) defines the base saved in scale.json.
    """
    if args.scale is not None:
        return args.scale
    scale_file = out_dir / "scale.json"
    cell_h = cell[1] if cell else None
    if args.reset_scale or not scale_file.exists():
        heights = sorted(f["image"].height for f in frames)
        scale = args.target_height / heights[len(heights) // 2]
        out_dir.mkdir(parents=True, exist_ok=True)
        scale_file.write_text(json.dumps({"scale": scale, "cellHeight": cell_h, "from": args.action,
                                          "targetHeight": args.target_height}, indent=2))
        print(f"scale {scale:.4f} computed from '{args.action}' and saved to {scale_file} "
              f"(the base for the character's other actions; pass --scale or --reset-scale to change)")
        return scale
    base = json.loads(scale_file.read_text())
    stand = getattr(args, "scale_from", None)
    if stand is not None:
        scale = args.target_height / frames[stand]["image"].height
        print(f"scale {scale:.4f} from standing frame {stand}")
        return scale
    if cell_h and base.get("cellHeight"):
        return base["scale"] * base["cellHeight"] / cell_h
    return base["scale"]


def pack(frames, cell, args) -> Path:
    out_dir = Path(args.out)
    resample = {"lanczos": Image.LANCZOS, "nearest": Image.NEAREST, "box": Image.BOX}[args.resample]
    scale = resolve_scale(frames, cell, args, out_dir)

    if args.flip:
        for f in frames:
            f["image"] = f["image"].transpose(Image.FLIP_LEFT_RIGHT)
            if f["rel"] is not None and cell:
                f["rel"][0] = cell[0] - f["rel"][0] - f["image"].width

    if args.align == "fixed" and cell is None:
        print("note: position-sliced sheet has no in-cell x offsets; using align fixed-y")
        args.align = "fixed-y"
    if args.align in ("fixed", "fixed-y"):
        if any(f["rel"] is None for f in frames):
            raise SpriteError(f"--align {args.align} needs slice --grid (in-cell positions); use feet|centroid otherwise")
        fx0, by0 = feet_of(frames[0]["image"])
        ref = (frames[0]["rel"][0] + fx0, frames[0]["rel"][1] + by0 + 1)

    cw = getattr(args, "cell_width", None) or CELL  # frame width; height is always CELL
    feet_x = feet_x_for(cw)
    n = len(frames)
    rows = math.ceil(n / COLS)
    sheet = Image.new("RGBA", (COLS * cw, rows * CELL), (0, 0, 0, 0))
    cells: list[Image.Image] = []
    report = []
    union = [cw, CELL, 0, 0]

    for i, f in enumerate(frames):
        crop = f["image"]
        w, h = crop.size
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        scaled = crop.resize((nw, nh), resample)
        if args.align in ("fixed", "fixed-y"):
            oy = round(GROUND_Y + 1 + (f["rel"][1] - ref[1]) * scale)
            if args.align == "fixed":
                ox = round(feet_x + (f["rel"][0] - ref[0]) * scale)
            else:  # keep the drawn height, but centre each frame on its body mass horizontally
                ox = round(feet_x - mass_x(crop) * scale)
        else:
            ax, bottom = feet_of(crop) if args.align == "feet" else (mass_x(crop), feet_of(crop)[1])
            ox = round(feet_x - ax * scale)
            oy = round(GROUND_Y + 1 - (bottom + 1) * scale)

        canvas = Image.new("RGBA", (cw, CELL), (0, 0, 0, 0))
        if ox < cw and oy < CELL and ox + nw > 0 and oy + nh > 0:
            src_box = (max(-ox, 0), max(-oy, 0), min(nw, cw - ox), min(nh, CELL - oy))
            canvas.alpha_composite(scaled, (max(ox, 0), max(oy, 0)), src_box)
        clipped = int((np.array(scaled)[..., 3] > ALPHA_T).sum() - (np.array(canvas)[..., 3] > ALPHA_T).sum())
        a = np.array(canvas)[..., 3] > ALPHA_T
        if a.any():
            ys, xs = np.where(a.any(1))[0], np.where(a.any(0))[0]
            union = [min(union[0], xs[0]), min(union[1], ys[0]), max(union[2], xs[-1] + 1), max(union[3], ys[-1] + 1)]
            report.append((i, xs[0], ys[0], xs[-1] + 1 - xs[0], ys[-1] + 1 - ys[0], clipped))
        cells.append(canvas)
        sheet.alpha_composite(canvas, ((i % COLS) * cw, (i // COLS) * CELL))

    out_dir.mkdir(parents=True, exist_ok=True)
    sheet_path = out_dir / f"{args.action}.png"
    sheet.save(sheet_path)
    make_preview(cells, out_dir / f"{args.action}-preview.gif", args.fps, feet_x)

    print(f"\nframe  x    y    w    h   clipped-px   (scale {scale:.3f}, align {args.align})")
    for i, x, y, w, h, clipped in report:
        flag = "  <-- CLIPPED: lower --target-height / --scale" if clipped > 20 else ""
        print(f"{i:>4}  {x:>3}  {y:>3}  {w:>3}  {h:>3}   {clipped:>6}{flag}")
    print(f"\nwrote {sheet_path}  ({sheet.width}x{sheet.height}, {n} frames)")
    print(f"wrote {out_dir / (args.action + '-preview.gif')}\n")
    visual = (int(union[0]), int(union[1]), int(union[2] - union[0]), int(union[3] - union[1]))
    if not getattr(args, "quiet", False):
        print("Paste into the fighter's action list (refine defaultVisual/attack boxes afterwards):")
        print("  {")
        print(f"    action: '{args.action}',")
        print(f"    label: '{args.action.replace('-', ' ').title()}',")
        print(f"    file: '{args.action}.png',")
        print(f"    frames: {n},")
        print(f"    frameRate: {args.fps},")
        print(f"    repeat: {args.repeat},")
        print(f"    defaultVisual: rect({visual[0]}, {visual[1]}, {visual[2]}, {visual[3]})")
        print("  },")
    return {"sheet": sheet_path, "frames": n, "visual": visual, "cell_width": cw,
            "boxes": [tuple(int(v) for v in r[1:5]) for r in report],
            "clipped": sum(r[5] for r in report)}


def make_preview(cells: list[Image.Image], path: Path, fps: int, feet_x: int = FEET_X) -> None:
    frames = []
    for c in cells:
        bg = Image.new("RGBA", c.size, (34, 34, 46, 255))
        d = ImageDraw.Draw(bg)
        d.line([(0, GROUND_Y + 1), (c.width, GROUND_Y + 1)], fill=(255, 0, 120, 255))
        d.line([(feet_x, GROUND_Y - 6), (feet_x, GROUND_Y + 6)], fill=(0, 255, 200, 255))
        bg.alpha_composite(c)
        frames.append(bg.convert("P", palette=Image.ADAPTIVE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, disposal=2)


# -------------------------------------------------------------------------- cli


def add_pack_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--action", required=True, help="action name, e.g. idle, walk-forward, light-punch")
    p.add_argument("--out", required=True, help="fighter asset dir, e.g. public/assets/viking-berserker")
    p.add_argument("--align", choices=["feet", "centroid", "fixed", "fixed-y"], default="feet",
                   help="feet: per-frame feet on ground line (idle/block/hit/crouch). "
                        "centroid: like feet but centres on body mass (walk cycles). "
                        "fixed: keep in-cell motion relative to frame 1 (attacks/knockdown; needs --grid). "
                        "fixed-y: keep the drawn vertical motion only, centre horizontally (jump)")
    p.add_argument("--target-height", type=float, default=STAND_HEIGHT, help="standing height in px (default %(default)s)")
    p.add_argument("--scale", type=float, help="explicit scale; overrides scale.json")
    p.add_argument("--reset-scale", action="store_true", help="recompute scale.json from this action")
    p.add_argument("--fps", type=int, help="playback rate (default per action)")
    p.add_argument("--repeat", type=int, help="-1 loop, 0 once (default per action)")
    p.add_argument("--resample", choices=["lanczos", "nearest", "box"], default="lanczos")
    p.add_argument("--flip", action="store_true", help="mirror frames (use if the source faces east/right)")


def add_key_slice_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--bg", default="auto", help="auto|white|magenta|#rrggbb")
    p.add_argument("--tol", type=float, default=36.0, help="background colour tolerance")
    p.add_argument("--holes", type=int, default=0, help="also drop enclosed bg pockets >= N px")
    p.add_argument("--grid", help="CxR grid the sheet was generated on, e.g. 4x2 (recommended)")
    p.add_argument("--attach", type=int, default=60, help="auto mode: attach specks within N px to a frame")
    p.add_argument("--min-frac", type=float, default=0.05, help="auto mode: min frame area vs largest piece")
    p.add_argument("--no-watermark-filter", action="store_true", help="keep specks in the bottom-right corner")
    p.add_argument("--expect", type=int, help="fail unless exactly N frames are found")


def finish_pack_args(args) -> None:
    fps, rep = ACTION_DEFAULTS.get(args.action, (10, 0))
    args.fps = args.fps or fps
    args.repeat = rep if args.repeat is None else args.repeat


def do_slice(keyed: Image.Image, args, work: Path):
    grid = parse_grid(args.grid) if args.grid else None
    frames, cell = slice_sheet(keyed, grid, args.attach, args.min_frac, not args.no_watermark_filter)
    if args.expect and len(frames) != args.expect:
        raise SpriteError(
            f"found {len(frames)} frames, expected {args.expect}. "
            "Use --grid CxR, tune --attach/--min-frac, or check the frame crops in " + str(work))
    save_frames(frames, cell, work)
    print(f"sliced {len(frames)} frames -> {work}")
    return frames, cell


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    k = sub.add_parser("key", help="remove flat background -> RGBA png")
    k.add_argument("input")
    k.add_argument("output")
    k.add_argument("--bg", default="auto")
    k.add_argument("--tol", type=float, default=36.0)
    k.add_argument("--holes", type=int, default=0)

    s = sub.add_parser("slice", help="split a keyed sheet into frame crops")
    s.add_argument("input")
    s.add_argument("work", help="output dir for frame-NN.png + frames.json")
    add_key_slice_args(s)

    pk = sub.add_parser("pack", help="pack frame crops into <action>.png")
    pk.add_argument("work", help="dir produced by slice")
    add_pack_args(pk)

    r = sub.add_parser("run", help="key + slice + pack")
    r.add_argument("input", help="raw generated sheet")
    r.add_argument("--work", help="intermediate dir (default: <input>-work/<action>)")
    add_key_slice_args(r)
    add_pack_args(r)

    args = ap.parse_args(argv)
    try:
        if args.cmd == "key":
            key_background(Image.open(args.input), args.bg, args.tol, args.holes).save(args.output)
            print(f"wrote {args.output}")
        elif args.cmd == "slice":
            do_slice(Image.open(args.input).convert("RGBA"), args, Path(args.work))
        elif args.cmd == "pack":
            finish_pack_args(args)
            frames, cell = load_frames(Path(args.work))
            pack(frames, cell, args)
        else:
            finish_pack_args(args)
            src = Path(args.input)
            work = Path(args.work) if args.work else src.with_name(src.stem + "-work") / args.action
            keyed = key_background(Image.open(src), args.bg, args.tol, args.holes)
            work.mkdir(parents=True, exist_ok=True)
            keyed.save(work / "keyed.png")
            frames, cell = do_slice(keyed, args, work)
            pack(frames, cell, args)
    except SpriteError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
