"""make_manifest.py <spec.json> [--force]

Writes scripts/sprites/characters/<id>.json for a new fighter from a small spec, using the 13-action template
that worked for Muay Thai and the Shaolin Monk (3x2 grids, special 3x3, a different pose per frame, autoSlice).

Refuses to overwrite an existing manifest unless --force: manifests get hand edits (dropFrames, frameOrder,
frameBounds...) during production and regenerating would lose them.

spec.json fields (all strings unless noted):
  id, label, ts (camelCase file name), const (UPPER_SNAKE), date (YYYY-MM-DD, concept folder date)
  description      one dense sentence: body, hair, clothes, colours, weapon
  overflow         parts that tend to leave the cell ("sword blade or sleeves")
  portrait         face/pose for the portrait ("a calm stare, sword raised...")
  portrait_bg      portrait background ("deep blue with mist")
  facing           optional "RIGHT" once the reference shows the fighter facing right
  frameWidth       optional number (256 default 320; weapons 352-384)
  visualWidthCap   optional object, e.g. {"default": 120, "light-punch": 150, "heavy-kick": 170, "special": 190}
  moves            object:
    idle           stance adjective ("light, flowing tai chi")
    block          block pose ("the sword held flat across the body")
    light_label, light, light_hit         HIGH attack (engine: light-punch)
    heavy_label, heavy, heavy_hit         LOW attack (engine: heavy-kick) - aim at legs
    charge_label, charge                  special-charge aura text (never pink/purple)
    special_label, special_fx, hits[3]    three special strikes + effect colours
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]


def actions(c: dict) -> list[dict]:
    walk = lambda back: [
        f"contact: {'back (right) foot placed behind' if back else 'front (left) foot stepping forward'}, guard up",
        "down: weight shifts, knees bend, body dips slightly",
        "passing: the free leg moves past the planted leg",
        "contact, opposite leg (mirror of frame 1)",
        "down, opposite leg (mirror of frame 2)",
        "passing, opposite leg, leading smoothly into frame 1",
    ]
    return [
        dict(action="idle", label="Idle", frames=6, grid="3x2", fps=8, repeat=-1, align="feet",
             note=f"A {c['idle']} fighting stance. The feet stay in the same place in every frame; only the body bobs and breathes.",
             poses=["rest pose in the guard stance", "body dips about 2 pixels, shoulders relax",
                    "lowest point of the breath", "rising back up", "highest point, chest expanded",
                    "returning to the rest pose, very close to frame 1 so the loop is seamless"]),
        dict(action="walk-forward", label="Walk Forward", frames=6, grid="3x2", fps=8, repeat=-1, align="centroid",
             note="A guarded step toward the LEFT. The character stays centred in its cell (walking in place).",
             poses=walk(False)),
        dict(action="walk-backward", label="Walk Backward", frames=6, grid="3x2", fps=8, repeat=-1, align="centroid",
             note="A retreating step: still FACING LEFT toward the enemy, guard up, stepping backward (to the right). The character stays centred in its cell.",
             poses=walk(True)),
        dict(action="crouch", label="Crouch", frames=6, grid="3x2", fps=10, repeat=0, align="feet", scaleFrom=0, visualFrom=-1,
             note="Six clearly DIFFERENT poses going from standing down to kneeling; the feet stay on the same ground line.",
             poses=["standing guard stance exactly as in the reference, full height",
                    "half squat, knees bent, head clearly lower than in frame 1",
                    "dropping to one knee, the back knee almost touching the ground",
                    "kneeling on one knee, guard up, body only about 60 percent as tall as in frame 1",
                    "same kneeling pose (held)", "same kneeling pose (held)"]),
        dict(action="jump", label="Jump", frames=6, grid="3x2", fps=10, repeat=0, align="fixed-y",
             note="The ground line is at the same height in every frame. Frames 1 and 6 have the feet on the ground line; in frames 3, 4 and 5 the whole character is drawn clearly above the ground line. Keep the character horizontally centred in its cell.",
             poses=["anticipation: deep crouch, feet on the ground line", "launch: legs extending, feet leaving the ground",
                    "rising: whole body above the ground line, knees tucked", "apex: highest point, body compact",
                    "falling: legs extending downward", "landing: feet back on the ground line, knees bent absorbing the impact"]),
        dict(action="block-high", label="Block High", frames=6, grid="3x2", fps=10, repeat=0, align="feet", scaleFrom=0,
             note="Feet stay planted. The block pose is held from frame 3 onward.",
             poses=["guard stance, starting to raise the guard", f"{c['block']} in front of the face",
                    f"block held: {c['block']} in front of the face and chest, body braced",
                    "block held (same)", "block held (same)", "block held (same)"]),
        dict(action="block-low", label="Block Low", frames=6, grid="3x2", fps=10, repeat=0, align="feet", scaleFrom=0, visualFrom=-1,
             note="Feet stay on the ground line. Goes from standing to a LOW crouching block held from frame 3 onward.",
             poses=["guard stance, starting to crouch", "crouching low, the guard lowering in front of the knees",
                    "block held: deep low crouch kneeling on one knee, guarding the shins, body only about 60 percent as tall as in frame 1",
                    "same low crouching block", "same low crouching block", "same low crouching block"]),
        dict(action="hit-high", label="Hit High", frames=6, grid="3x2", fps=12, repeat=0, align="feet",
             note="Struck in the face from the LEFT, recoiling backward to the RIGHT; feet stay near the ground line.",
             poses=["impact: head snaps back, eyes shut", "maximum recoil: torso bent far back, one foot sliding",
                    "still leaning back, grimacing", "recovering, weight returning forward",
                    "almost recovered, pained face", "back in the guard stance with a pained face"]),
        dict(action="light-punch", label=c["light_label"], frames=6, grid="3x2", fps=14, repeat=0, align="feet", scaleFrom=0,
             attack={"frames": [2, 3], "bounds": [14, 70, 96, 60]},
             note=f"{c['light']} The strike frames are 3 and 4.",
             poses=["guard stance", "wind-up, shoulders twisting", f"strike: {c['light_hit']}",
                    f"full extension: {c['light_hit']}, a short white impact streak touching it", "pulling back",
                    "recovery to the guard stance"]),
        dict(action="heavy-kick", label=c["heavy_label"], frames=6, grid="3x2", fps=12, repeat=0, align="feet",
             attack={"frames": [2, 3], "bounds": [8, 110, 104, 90]},
             note=f"{c['heavy']} The strike frames are 3 and 4.",
             poses=["guard stance, weight shifting", "wind-up, body turning, the attack chambered",
                    f"strike: {c['heavy_hit']}, a motion arc touching it", f"full extension: {c['heavy_hit']}",
                    "follow-through", "recovery to the guard stance"]),
        dict(action="special-charge", label=c["charge_label"], frames=6, grid="3x2", fps=14, repeat=0, align="feet", scaleFrom=0,
             note=f"Powering up in place; feet stay planted. {c['charge']} The aura always touches the body (no separate floating sparks).",
             poses=["guard stance", "focusing, a faint aura appearing", "aura growing stronger",
                    "aura strong, muscles tense", "peak power, aura blazing", "same as frame 5, aura flickering"]),
        dict(action="special", label=c["special_label"], frames=9, grid="3x3", fps=16, repeat=0, align="feet", scaleFrom=8,
             attackSpans=[{"frames": [2], "bounds": [6, 60, 116, 100]}, {"frames": [4], "bounds": [6, 60, 116, 100]},
                          {"frames": [6], "bounds": [6, 50, 116, 120]}],
             note=f"IMPORTANT: NINE frames in a 3x3 grid (3 columns and 3 ROWS). A three-hit combo toward the LEFT. The strike frames are 3, 5 and 7; frames 4, 6 and 8 are transitions. {c['special_fx']} Effects always touch the fighter or weapon.",
             poses=["wind-up, aura around the body", "rushing forward to the left",
                    f"first hit: {c['hits'][0]} toward the LEFT", "transition, pulling back",
                    f"second hit: {c['hits'][1]} toward the LEFT", "transition, gathering power",
                    f"third hit, the finisher: {c['hits'][2]} toward the LEFT, a large burst", "follow-through",
                    "recovery to the guard stance"]),
        dict(action="knockdown", label="Knockdown", frames=6, grid="3x2", fps=10, repeat=0, align="fixed-y", visualFrom=-1,
             note="Hit from the LEFT, falling backward to the RIGHT, ending lying on the back with the head to the right and the feet to the left. The lying body must fit inside its cell.",
             poses=["hit reaction, head snaps back", "airborne, leaning back at 45 degrees", "falling, body nearly horizontal",
                    "hitting the ground on the back, small dust puff touching the body",
                    "lying flat, head to the right, feet to the left", "lying flat (held pose)"]),
    ]


def mirror(value):
    """Swap left/right in prompt text (for fighters Gemini draws facing right)."""
    if isinstance(value, str):
        swap = {"LEFT": "RIGHT", "RIGHT": "LEFT", "left": "right", "right": "left"}
        return re.sub(r"\b(LEFT|RIGHT|left|right)\b", lambda mt: swap[mt.group(1)], value)
    if isinstance(value, list):
        return [mirror(v) for v in value]
    if isinstance(value, dict):
        return {k: (mirror(v) if k in ("note", "poses") else v) for k, v in value.items()}
    return value


def main() -> None:
    spec_path = Path(sys.argv[1])
    # utf-8-sig: specs written from Windows PowerShell start with a byte-order mark.
    spec = json.loads(spec_path.read_text(encoding="utf-8-sig"))
    out = REPO / "scripts/sprites/characters" / f"{spec['id']}.json"
    if out.exists() and "--force" not in sys.argv:
        sys.exit(f"{out.relative_to(REPO)} exists - it may have hand edits; edit it directly or pass --force")

    acts = actions(spec["moves"])
    facing = spec.get("facing")
    if facing == "RIGHT":
        acts = [mirror(a) for a in acts]
    turn = "right" if facing == "RIGHT" else "left"
    manifest = {
        "id": spec["id"], "label": spec["label"], "tsFile": f"src/game/{spec['ts']}.ts", "constName": spec["const"],
        "assetRoot": f"public/assets/{spec['id']}", "conceptDir": f"concepts/characters/{spec['date']}-{spec['id']}",
        "reference": f"{spec['id']}-ref.png", "anchorUsage": f"{spec['id']} west-facing high-fidelity anchor",
        "background": "magenta", "autoSlice": True, "overflowParts": spec["overflow"],
        "frameWidth": spec.get("frameWidth", 320),
        "visualWidthCap": spec.get("visualWidthCap",
                                   {"default": 120, "light-punch": 140, "heavy-kick": 160, "special": 180, "knockdown": 176}),
        "description": spec["description"], "style": "SNES-era pixel-art fighting-game sprite",
        "portrait": {"prompt": "Now something different: NOT a sprite sheet. Draw ONE single square character-select portrait "
                               "(one image, no grid, no frames) of the same character ({description}), in the same pixel-art "
                               f"style but more detailed: chest-up close-up, the face large with {spec['portrait']}, the head "
                               f"turned three-quarters toward the {turn}, dramatic rim lighting. Solid {spec['portrait_bg']} "
                               "background with a subtle pixel texture, no other characters, no text, no logo, no watermark, no frame."},
    }
    if facing:
        manifest["drawFacing"] = facing
        manifest["portrait"]["flip"] = facing == "RIGHT"
    manifest["actions"] = acts
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote", out.relative_to(REPO))


if __name__ == "__main__":
    main()
