"""boxes.py <ts-file> <asset-dir> <out.png> <action> [<action>...]

Draws the visual (cyan), guard (green) and attack (red) boxes of the given actions on their frames, one row per
action, so you can check that attack boxes cover the fist/foot/weapon that lands the hit.
"""
import re, sys
from pathlib import Path
from PIL import Image, ImageDraw

ts, assets, out, actions = Path(sys.argv[1]).read_text(), Path(sys.argv[2]), sys.argv[3], sys.argv[4:]
fw = int(m.group(1)) if (m := re.search(r"frameWidth: (\d+)", ts)) else 256
rows = []
for action in actions:
    block = ts.split(f"action: '{action}'")[1].split("\n  }")[0]
    rect = lambda s: tuple(int(v) for v in re.search(s + r".*?rect\((\d+), (\d+), (\d+), (\d+)\)", block, re.S).groups())
    visual = rect("defaultVisual")
    attacks = {}
    for fr, box in re.findall(r"frames: \[([\d, ]+)\], bounds: rect\(([\d, ]+)\)", block):
        for f in fr.split(","):
            attacks[int(f)] = tuple(int(v) for v in box.split(","))
    guard = rect("guard") if "guard:" in block else None
    frames = int(re.search(r"frames: (\d+)", block).group(1))
    sheet = Image.open(assets / f"{action}.png")
    row = []
    for i in range(frames):
        cell = sheet.crop(((i % 5) * fw, (i // 5) * 256, (i % 5 + 1) * fw, (i // 5 + 1) * 256))
        bg = Image.new("RGBA", cell.size, (40, 40, 60, 255)); bg.alpha_composite(cell)
        d = ImageDraw.Draw(bg)
        x, y, w, h = visual; d.rectangle([x, y, x + w, y + h], outline=(0, 200, 255))
        if guard: x, y, w, h = guard; d.rectangle([x, y, x + w, y + h], outline=(80, 255, 80))
        if i in attacks: x, y, w, h = attacks[i]; d.rectangle([x, y, x + w, y + h], outline=(255, 40, 40), width=2)
        d.text((4, 4), f"{action} {i}", fill=(255, 255, 255))
        row.append(bg)
    rows.append(row)
W = max(len(r) for r in rows) * fw
img = Image.new("RGB", (W, 256 * len(rows)), (20, 20, 30))
for j, r in enumerate(rows):
    for i, c in enumerate(r):
        img.paste(c.convert("RGB"), (i * fw, j * 256))
img.save(out)
