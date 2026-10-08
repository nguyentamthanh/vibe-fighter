"""pj.py <fighter-id> <prompt-number>

Prints the prompt file name and the prompt as a JSON string literal, ready to paste into
document.execCommand('insertText', false, <here>) in the Gemini tab. Adjusts the generated prompt for an
ongoing chat: the reference is "attached above", and old poses from earlier sheets must not be repeated.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
cid, num = sys.argv[1], sys.argv[2].zfill(2)
m = json.loads((REPO / "scripts/sprites/characters" / f"{cid}.json").read_text(encoding="utf-8-sig"))
f = next((REPO / m["conceptDir"] / "prompts").glob(f"{num}-*.txt"))
text = f.read_text(encoding="utf-8")
marker = "----- COPY EVERYTHING BELOW THIS LINE INTO GEMINI -----\n"
text = text.split(marker, 1)[1] if marker in text else text
text = " ".join(text.split()).replace("the the ", "the ")
text = text.replace("Using the attached character reference exactly",
                    "Using the character reference image attached above exactly")
text = text.replace("Draw the character small inside its cell",
                    "All frames belong to this animation only: do not repeat poses from earlier sheets in this chat. "
                    "Draw the character small inside its cell")
print(f.name)
print(json.dumps(text, ensure_ascii=False))
