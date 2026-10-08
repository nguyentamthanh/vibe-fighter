"""take.py <manifest> <action> [--no-move]

Builds one action of a fighter and writes a preview PNG (sheet on a dark background) to concepts/_previews/.
Without --no-move it first moves the newest Gemini download (~/Downloads/Gemini_Generated_Image_*.png, < 10 min
old) into raw/<action>.png (or the reference file). With the clipboard workflow (clip.ps1) use --no-move.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]
PREVIEWS = REPO / "concepts" / "_previews"


def build_and_preview(manifest: str, m: dict, action: str) -> None:
    r = subprocess.run([sys.executable, "scripts/sprites/character.py", "build", manifest, "--only", action],
                       cwd=REPO, capture_output=True, text=True)
    print("\n".join(line for line in (r.stdout + r.stderr).splitlines()
                    if line.strip() and not line.startswith(("wrote anchor", "Not complete", "Next:"))))
    sheet = REPO / m["assetRoot"] / f"{action}.png"
    if sheet.exists():
        PREVIEWS.mkdir(parents=True, exist_ok=True)
        im = Image.open(sheet)
        bg = Image.new("RGBA", im.size, (40, 40, 60, 255))
        bg.alpha_composite(im)
        out = PREVIEWS / f"{m['id']}-{action}.png"
        bg.convert("RGB").save(out)
        print("preview:", out)


def main() -> None:
    manifest, action = sys.argv[1], sys.argv[2]
    m = json.loads((REPO / manifest).read_text(encoding="utf-8-sig"))
    if "--no-move" in sys.argv[3:]:
        build_and_preview(manifest, m, action)
        return

    downloads = Path.home() / "Downloads"
    for _ in range(20):
        files = sorted(downloads.glob("Gemini_Generated_Image_*.png"), key=lambda p: p.stat().st_mtime)
        if files and time.time() - files[-1].stat().st_mtime < 600:
            break
        time.sleep(1)
    else:
        sys.exit("no fresh Gemini download found")

    raw = REPO / m["conceptDir"] / (m["reference"] if action == "reference" else f"raw/{action}.png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    files[-1].replace(raw)
    print("moved", files[-1].name, "->", raw.relative_to(REPO), Image.open(raw).size)
    if action not in ("reference", "portrait"):
        build_and_preview(manifest, m, action)


if __name__ == "__main__":
    main()
