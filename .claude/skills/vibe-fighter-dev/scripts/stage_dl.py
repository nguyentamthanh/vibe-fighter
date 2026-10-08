"""stage_dl.py <stage-id> [height]
stage_dl.py <stage-id> --from-raw [height]   (reprocess the saved raw/source.png instead of a new download)

Saves a Gemini stage background (after clicking "Download full size image"): takes the newest
~/Downloads/Gemini_Generated_Image_*.png (< 10 min old), keeps the full-size original in
concepts/stages/<stage-id>/raw/source.png (git-ignored), fills Gemini's corner watermark, scales a copy to `height` px tall (default 900, like the
existing stages), writes public/assets/backgrounds/<stage-id>-stage.png, removes the download, and prints the
size plus where the floor's front edge is likely to be (the row with the strongest horizontal edge in the
lower half), so the stage's `groundFraction` can be set.
"""
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / "scripts" / "sprites"))
from effect import WATERMARK_OFFSET, WATERMARK_RADIUS  # noqa: E402


def patch_watermark(rgb: np.ndarray) -> None:
    """Covers Gemini's corner sparkle with the pixels just to its left (a feathered copy), so the pixel-art
    floor texture continues instead of the blur that effect.remove_watermark leaves. In place."""
    h, w = rgb.shape[:2]
    k = w / 1024
    cx, cy = w - WATERMARK_OFFSET[0] * k, h - WATERMARK_OFFSET[1] * k
    radius = WATERMARK_RADIUS * k * 1.25
    shift = round(radius * 2.4)
    y0, y1 = max(0, round(cy - radius)), min(h, round(cy + radius) + 1)
    x0, x1 = max(shift, round(cx - radius)), min(w, round(cx + radius) + 1)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / radius
    alpha = np.clip((1.15 - dist) / 0.3, 0, 1)[..., None]
    target = rgb[y0:y1, x0:x1].astype(np.float32)
    source = rgb[y0:y1, x0 - shift:x1 - shift].astype(np.float32)
    rgb[y0:y1, x0:x1] = (source * alpha + target * (1 - alpha)).round().astype(np.uint8)


args = [a for a in sys.argv[1:] if a != "--from-raw"]
from_raw = "--from-raw" in sys.argv
stage_id = args[0]
height = int(args[1]) if len(args) > 1 else 900
raw = REPO / "concepts" / "stages" / stage_id / "raw" / "source.png"

if from_raw:
    src = None
    im = Image.open(raw).convert("RGB")
else:
    files = sorted(Path.home().joinpath("Downloads").glob("Gemini_Generated_Image_*.png"),
                   key=lambda p: p.stat().st_mtime)
    if not files or time.time() - files[-1].stat().st_mtime > 600:
        sys.exit("no Gemini download from the last 10 minutes (click 'Download full size image' first)")
    src = files[-1]
    im = Image.open(src).convert("RGB")
    raw.parent.mkdir(parents=True, exist_ok=True)
    im.save(raw)
# Gemini's corner sparkle watermark sits on the floor of a stage: fill it from the surrounding pixels.
rgb = np.array(im)
patch_watermark(rgb)
im = Image.fromarray(rgb)

stage = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
out = REPO / "public" / "assets" / "backgrounds" / f"{stage_id}-stage.png"
stage.save(out, optimize=True)
if src:
    src.unlink()

gray = np.asarray(stage.convert("L"), dtype=np.float32)
edges = np.abs(np.diff(gray, axis=0)).mean(axis=1)
lower = range(height // 2, height - 20)
best = sorted(lower, key=lambda y: edges[y], reverse=True)[:5]
print(f"saved {src.name if src else raw.name} ->{out.relative_to(REPO)} {stage.width}x{stage.height} ({out.stat().st_size // 1024} KB)")
print("strongest horizontal edges (fraction of height):", ", ".join(f"{y / height:.3f}" for y in sorted(best)))
