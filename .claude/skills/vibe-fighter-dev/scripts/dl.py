"""dl.py <manifest> <action|reference|portrait>

Fallback for clip.ps1 when the Windows clipboard cannot be read (OpenClipboard -> access denied): click Gemini's
"Download full size image" button instead, then run this. It takes the newest
~/Downloads/Gemini_Generated_Image_*.png (must be < 10 min old), scales it to 1024 px wide (the size the copy
button gave, so scale.json stays valid), writes it where clip.ps1 would, and removes the download.
"""
import json
import sys
import time
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]
manifest, action = sys.argv[1], sys.argv[2]
m = json.loads((REPO / manifest).read_text(encoding="utf-8-sig"))
concept = REPO / m["conceptDir"]
out = concept / m["reference"] if action == "reference" else concept / "raw" / f"{action}.png"

files = sorted(Path.home().joinpath("Downloads").glob("Gemini_Generated_Image_*.png"), key=lambda p: p.stat().st_mtime)
if not files or time.time() - files[-1].stat().st_mtime > 600:
    sys.exit("no Gemini download from the last 10 minutes (click 'Download full size image' first)")
src = files[-1]
im = Image.open(src).convert("RGB")
if im.width != 1024:
    im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
out.parent.mkdir(parents=True, exist_ok=True)
im.save(out)
src.unlink()
print(f"saved {src.name} {im.width}x{im.height} -> {out.relative_to(REPO)}")
