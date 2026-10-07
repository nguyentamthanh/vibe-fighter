"""Turn a generated visual-effect sheet into a game spritesheet.

    # glowing light effects drawn on BLACK, rendered in game with additive blending (nothing is keyed)
    python scripts/sprites/effect.py RAW.png --grid 3x2 --frames 6 --cell 256x320 --out public/assets/vfx/NAME.png
    # solid objects drawn on MAGENTA (#ff00ff): keyed to real transparency like the fighter sprites
    python scripts/sprites/effect.py RAW.png --key magenta --grid 3x2 --frames 6 --cell 256x384 --out ...
    # size a second sheet so its core is as tall as an earlier sheet's core
    python scripts/sprites/effect.py RAW.png ... --match public/assets/vfx/OTHER.json

Every frame keeps its position inside its cell (the model is asked to draw the effect at the same spot), so
the union of all frames is scaled once and the core (the effect body without stray sparks) is anchored at the
bottom-centre of the output cell: loops do not jitter. Gemini's corner sparkle watermark is filled in first.
Writes NAME.png (frames left to right), NAME.json (cell size, core height, bottom padding) and NAME-preview.gif.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import sprites
from sprites import parse_grid

NOISE = 22  # black mode: max channel below this is treated as black
CORE = 70  # black mode: max channel above this counts as the effect body when measuring its size
PAD = 6

# Gemini's sparkle watermark: centre offset from the bottom-right corner and radius, for a 1024px-wide image.
WATERMARK_OFFSET = (87, 88)
WATERMARK_RADIUS = 19


def remove_watermark(rgb: np.ndarray) -> None:
    """Gemini stamps a small semi-transparent white sparkle at a fixed spot near the bottom-right corner, often
    on top of the effect itself. Fill that disc from the surrounding colours (repeated 4-neighbour averaging),
    in place."""
    h, w = rgb.shape[:2]
    k = w / 1024
    cx, cy = w - WATERMARK_OFFSET[0] * k, h - WATERMARK_OFFSET[1] * k
    radius = WATERMARK_RADIUS * k
    y0, x0 = max(0, round(cy - radius * 2)), max(0, round(cx - radius * 2))
    region = rgb[y0:, x0:].astype(np.float32)
    ys, xs = np.mgrid[0:region.shape[0], 0:region.shape[1]]
    grown = (xs + x0 - cx) ** 2 + (ys + y0 - cy) ** 2 <= radius ** 2
    fill = region.copy()
    fill[grown] = 0
    known = ~grown
    for _ in range(80):
        padded = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode="edge")
        weights = np.pad(known.astype(np.float32), 1, mode="constant")
        total = (padded[:-2, 1:-1] * weights[:-2, 1:-1, None] + padded[2:, 1:-1] * weights[2:, 1:-1, None]
                 + padded[1:-1, :-2] * weights[1:-1, :-2, None] + padded[1:-1, 2:] * weights[1:-1, 2:, None])
        count = weights[:-2, 1:-1] + weights[2:, 1:-1] + weights[1:-1, :-2] + weights[1:-1, 2:]
        update = grown & (count > 0)
        fill[update] = total[update] / count[update, None]
        known = known | update
    rgb[y0:, x0:] = np.clip(fill, 0, 255).astype(np.uint8)


def clean_black(rgb: np.ndarray, grid: tuple[int, int]) -> np.ndarray:
    """Black mode: crush near-black noise and erase faint straight grid lines at the expected cell boundaries."""
    out = rgb.copy()
    out[out.max(axis=2) < NOISE] = 0
    h, w = out.shape[:2]
    cols, rows = grid
    band = max(3, round(10 * w / 2816))
    for k in range(1, cols):
        x = round(k * w / cols)
        for xi in range(max(0, x - band), min(w, x + band + 1)):
            if (out[:, xi].max(axis=1) > 0).mean() > 0.5:
                out[:, xi] = 0
    for k in range(1, rows):
        y = round(k * h / rows)
        for yi in range(max(0, y - band), min(h, y + band + 1)):
            if (out[yi, :].max(axis=1) > 0).mean() > 0.5:
                out[yi, :] = 0
    return out


def clear_boundary_lines(rgba: np.ndarray, grid: tuple[int, int]) -> None:
    """Magenta mode: clear a grid line the model drew on a cell boundary. Only the expected boundaries are
    checked (sprites.remove_grid_lines also hunts for lines anywhere, which would cut through a tall object
    that nearly fills the sheet height)."""
    h, w = rgba.shape[:2]
    opaque = rgba[..., 3] > 24
    band = max(2, round(4 * w / 1024))
    for axis, count in ((1, grid[0]), (0, grid[1])):
        size = w if axis == 1 else h
        for k in range(1, count):
            at = round(k * size / count)
            lo, hi = max(0, at - band), min(size, at + band + 1)
            line = opaque[:, lo:hi] if axis == 1 else opaque[lo:hi, :]
            if line.mean(axis=axis).max() > 0.6:
                if axis == 1:
                    rgba[:, lo:hi, 3] = 0
                else:
                    rgba[lo:hi, :, 3] = 0


def masks(cell: np.ndarray, key: str) -> tuple[np.ndarray, np.ndarray]:
    """(anything visible, the solid core) masks of one RGBA cell."""
    if key == "magenta":
        alpha = cell[..., 3]
        # Opening drops thin sparks and rings so the core is the object itself.
        core = ndimage.binary_opening(alpha > 128, iterations=3)
        return alpha > 24, core
    brightest = cell[..., :3].max(axis=2)
    return brightest > 0, brightest > CORE


def bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def union(boxes: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("raw")
    ap.add_argument("--grid", required=True)
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--cell", default="256x320", help="output frame size WxH")
    ap.add_argument("--out", required=True)
    ap.add_argument("--key", choices=["black", "magenta"], default="black")
    ap.add_argument("--match", help="JSON of an earlier effect whose core height this sheet should match")
    ap.add_argument("--fps", type=int, default=10)
    args = ap.parse_args()

    grid = parse_grid(args.grid)
    cell_w, cell_h = (int(v) for v in args.cell.lower().split("x"))
    rgb = np.asarray(Image.open(args.raw).convert("RGB")).astype(np.uint8).copy()
    remove_watermark(rgb)

    if args.key == "magenta":
        rgba = np.array(sprites.key_background(Image.fromarray(rgb), "magenta", 36.0, 150))
        clear_boundary_lines(rgba, grid)
        # Pixel-art edges: drop the half-transparent rim (it keeps a green cast after un-mixing the magenta).
        solid = ndimage.binary_erosion(rgba[..., 3] >= 128)
        rgba[..., 3] = np.where(solid, 255, 0).astype(np.uint8)
    else:
        rgba = np.dstack([clean_black(rgb, grid), np.full(rgb.shape[:2], 255, np.uint8)])
    h, w = rgba.shape[:2]
    cols, rows = grid

    cells = []
    for i in range(args.frames):
        c, r = i % cols, i // cols
        x0, x1 = round(c * w / cols), round((c + 1) * w / cols)
        y0, y1 = round(r * h / rows), round((r + 1) * h / rows)
        cells.append(rgba[y0:y1, x0:x1])

    # Cells can differ by a pixel; crop all to the smallest so cell-relative coordinates line up.
    ch = min(c.shape[0] for c in cells)
    cw = min(c.shape[1] for c in cells)
    cells = [c[:ch, :cw] for c in cells]

    full, core = [], []
    for cell in cells:
        any_mask, core_mask = masks(cell, args.key)
        full.append(bbox(any_mask))
        core.append(bbox(core_mask))
    if any(b is None for b in full) or any(b is None for b in core):
        raise SystemExit("an empty frame was found - check the grid / frame count")
    ux0, uy0, ux1, uy1 = union(full)
    cx0, cy0, cx1, cy1 = union(core)
    core_h = cy1 - cy0

    if args.match:
        scale = json.loads(Path(args.match).read_text())["coreHeight"] / core_h
    else:
        scale = min((cell_w - 2 * PAD) / (ux1 - ux0), (cell_h - 2 * PAD) / (uy1 - uy0))

    # Anchor: core bottom-centre lands on the bottom-centre of the output cell.
    anchor_x, anchor_y = (cx0 + cx1) / 2, cy1
    sheet = Image.new("RGBA", (cell_w * args.frames, cell_h), (0, 0, 0, 0))
    frames = []
    clipped = 0
    for i, c in enumerate(cells):
        # Premultiplied resize, so transparent magenta pixels do not bleed into the edges.
        img = Image.fromarray(c, "RGBA").convert("RGBa").resize((round(cw * scale), round(ch * scale)), Image.LANCZOS)
        img = img.convert("RGBA")
        dx = round(cell_w / 2 - anchor_x * scale)
        dy = round(cell_h - PAD - anchor_y * scale)
        frame = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        frame.paste(img, (dx, dy))
        # Count visible pixels that fell outside the cell (a sign the scale / cell size is too tight).
        visible = masks(np.asarray(img), args.key)[1]
        ys, xs = np.mgrid[0:visible.shape[0], 0:visible.shape[1]]
        inside = (xs + dx >= 0) & (xs + dx < cell_w) & (ys + dy >= 0) & (ys + dy < cell_h)
        clipped += int((visible & ~inside).sum())
        arr = np.asarray(frame).copy()
        if args.key == "black":
            arr[arr[..., :3].max(axis=2) < NOISE, :3] = 0
        frame = Image.fromarray(arr, "RGBA")
        sheet.paste(frame, (i * cell_w, 0))
        frames.append(frame)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    (sheet if args.key == "magenta" else sheet.convert("RGB")).save(out)
    meta_out = {"cellWidth": cell_w, "cellHeight": cell_h, "frames": args.frames, "key": args.key,
                "coreHeight": round(core_h * scale), "bottomPad": PAD, "scale": round(scale, 4)}
    out.with_suffix(".json").write_text(json.dumps(meta_out, indent=2))

    def preview_frame(frame: Image.Image) -> Image.Image:
        background = Image.new("RGBA", frame.size, (34, 34, 46, 255))
        background.alpha_composite(frame)
        return background.convert("P", palette=Image.ADAPTIVE)

    previews = [preview_frame(f) for f in frames]
    previews[0].save(out.with_name(out.stem + "-preview.gif"), save_all=True, append_images=previews[1:],
                     duration=round(1000 / args.fps), loop=0)
    print(f"wrote {out} ({sheet.width}x{sheet.height}, {args.frames} frames, scale {scale:.3f}, "
          f"core height {meta_out['coreHeight']}px, clipped px {clipped})")


if __name__ == "__main__":
    main()
