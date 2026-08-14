"""Assemble four native-scale Warrior base poses from the supplied cutout atlas.

This script never draws or synthesizes pixels.  It extracts the single connected
source component nearest each atlas cell, translates it by integer coordinates,
and uses only lossless flip/quarter-turn operations where a facing needs them.
No source part is rescaled and the final alpha is strictly binary.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "assets/characters/classes/warrior/rig-source/warrior-modular-atlas-128.png"
OUTPUT = ROOT / "assets/characters/classes/warrior/base-4dir"
QA_OUTPUT = ROOT / "artifacts/character-qa/warrior-base-4dir"

CELL = 128
FRAME = 320
ROOT_X = 160
BASELINE = 304
GUTTER = 2
TRANSPARENT = (0, 0, 0, 0)

DIRECTION_ROWS = {"down": 0, "left": 5, "up": 10, "right": 15}
CELL_NAMES = {
    (0, 0): "head_base", (1, 0): "face", (2, 0): "hair_front", (3, 0): "hair_back",
    (4, 0): "ear", (5, 0): "neck", (6, 0): "scarf_cowl", (7, 0): "scarf_tail",
    (0, 1): "scarf_tail_short", (1, 1): "scarf_tail_long", (2, 1): "torso",
    (3, 1): "tabard_front", (4, 1): "tabard_back", (5, 1): "belt_side",
    (6, 1): "belt_front", (7, 1): "strap", (0, 2): "shoulder_left",
    (1, 2): "shoulder_right", (2, 2): "upper_arm_left", (3, 2): "forearm_left",
    (4, 2): "hand_left", (5, 2): "upper_arm_right", (6, 2): "forearm_right",
    (7, 2): "hand_right", (0, 3): "waist", (1, 3): "thigh_left",
    (2, 3): "shin_left", (3, 3): "boot_left", (4, 3): "thigh_right",
    (5, 3): "shin_right", (6, 3): "boot_right", (7, 3): "pouch_right",
    (0, 4): "pouch_left", (1, 4): "tabard_left", (2, 4): "tabard_right",
    (3, 4): "sword_full", (4, 4): "sword_blade", (5, 4): "sword_hilt",
}

# Integer destination centres on a 256px source canvas.  Render order is back
# to front.  These poses use direction-authored atlas parts, never mirrored
# body art.  Alternative atlas pieces that would duplicate the same anatomy
# (waist, split tabards, spare scarf tails, separate blade/hilt) are omitted.
LAYOUTS = {
    "down": [
        ("scarf_tail", (128, 88)), ("tabard_back", (128, 156)),
        ("thigh_left", (102, 174)), ("thigh_right", (144, 174)),
        ("shin_left", (100, 206)), ("shin_right", (146, 206)),
        ("boot_left", (100, 228)), ("boot_right", (146, 228)),
        ("upper_arm_left", (78, 114)), ("forearm_left", (78, 140)), ("hand_left", (82, 158)),
        ("upper_arm_right", (176, 114)), ("forearm_right", (178, 140)), ("hand_right", (176, 158)),
        ("torso", (128, 116)), ("tabard_front", (128, 154)), ("belt_front", (128, 146)),
        ("strap", (128, 114)), ("shoulder_left", (78, 96)), ("shoulder_right", (176, 96)),
        ("hair_back", (128, 46)), ("head_base", (128, 56)), ("face", (128, 58)),
        ("hair_front", (128, 44)), ("scarf_cowl", (128, 86)), ("pouch_left", (178, 164)),
    ],
    "left": [
        ("scarf_tail_long", (156, 102)), ("tabard_back", (130, 156)),
        ("thigh_right", (140, 176)), ("shin_right", (140, 208)), ("boot_right", (140, 228)),
        ("upper_arm_right", (146, 116)), ("forearm_right", (142, 142)),
        ("torso", (128, 118)),
        ("thigh_left", (112, 174)), ("shin_left", (110, 206)), ("boot_left", (106, 228)),
        ("tabard_front", (126, 156)), ("belt_side", (128, 146)),
        ("upper_arm_left", (108, 116)), ("forearm_left", (122, 144)), ("hand_left", (134, 154)),
        ("shoulder_left", (102, 98)),
        ("hair_back", (130, 46)), ("head_base", (124, 58)), ("face", (116, 60)),
        ("hair_front", (122, 46)), ("scarf_cowl", (128, 86)),
    ],
    "up": [
        ("scarf_tail", (144, 94)), ("tabard_back", (128, 152)),
        ("thigh_left", (102, 174)), ("thigh_right", (144, 174)),
        ("shin_left", (100, 206)), ("shin_right", (146, 206)),
        ("boot_left", (100, 228)), ("boot_right", (146, 228)),
        ("upper_arm_left", (80, 116)), ("forearm_left", (80, 142)), ("hand_left", (82, 158)),
        ("upper_arm_right", (174, 116)), ("forearm_right", (176, 142)), ("hand_right", (176, 158)),
        ("torso", (128, 118)), ("tabard_front", (128, 156)), ("belt_front", (128, 146)),
        ("shoulder_left", (78, 98)), ("shoulder_right", (176, 98)),
        ("head_base", (128, 58)), ("face", (128, 60)), ("hair_back", (128, 44)),
        ("hair_front", (128, 46)), ("scarf_cowl", (128, 86)), ("pouch_right", (178, 164)),
    ],
    "right": [
        ("scarf_tail_long", (100, 102)), ("tabard_back", (126, 156)),
        ("thigh_left", (114, 176)), ("shin_left", (114, 208)), ("boot_left", (114, 228)),
        ("upper_arm_left", (110, 116)), ("forearm_left", (114, 142)),
        ("torso", (128, 118)),
        ("thigh_right", (144, 174)), ("shin_right", (146, 206)), ("boot_right", (150, 228)),
        ("tabard_front", (130, 156)), ("belt_side", (128, 146)),
        ("upper_arm_right", (148, 116)), ("forearm_right", (134, 144)), ("hand_right", (138, 154)),
        ("shoulder_right", (154, 98)),
        ("hair_back", (126, 46)), ("head_base", (132, 58)), ("face", (140, 60)),
        ("hair_front", (134, 46)), ("scarf_cowl", (128, 86)),
    ],
}

# Direction-authored boots have slightly different transparent crops.  These
# integer offsets normalize the visible ground contact to baseline y=304.
DIRECTION_Y_OFFSETS = {"down": -15, "left": -12, "up": -9, "right": -10}
COWL_Y_OFFSETS = {"down": 24, "left": 20, "up": 16, "right": 20}


def alpha_components(image: Image.Image) -> list[list[tuple[int, int]]]:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size
    unseen = {(x, y) for y in range(height) for x in range(width) if pixels[x, y]}
    components: list[list[tuple[int, int]]] = []
    while unseen:
        seed = unseen.pop()
        queue = deque([seed])
        component = [seed]
        while queue:
            x, y = queue.popleft()
            for nx, ny in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1), (x - 1, y),
                (x + 1, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                point = (nx, ny)
                if point in unseen:
                    unseen.remove(point)
                    queue.append(point)
                    component.append(point)
        components.append(component)
    return components


def extract_parts(atlas: Image.Image) -> dict[str, dict[str, Image.Image]]:
    components = alpha_components(atlas)
    result: dict[str, dict[str, Image.Image]] = {}
    for direction, base_row in DIRECTION_ROWS.items():
        result[direction] = {}
        for (column, local_row), name in CELL_NAMES.items():
            target = ((column + 0.5) * CELL, (base_row + local_row + 0.5) * CELL)
            nearby = [
                component for component in components
                if min(x for x, _ in component) < (column + 1.5) * CELL
                and max(x for x, _ in component) > (column - 0.5) * CELL
                and min(y for _, y in component) < (base_row + local_row + 1.5) * CELL
                and max(y for _, y in component) > (base_row + local_row - 0.5) * CELL
            ]
            component = min(
                nearby,
                key=lambda points: min((x - target[0]) ** 2 + (y - target[1]) ** 2 for x, y in points),
            )
            left = min(x for x, _ in component)
            top = min(y for _, y in component)
            right = max(x for x, _ in component) + 1
            bottom = max(y for _, y in component) + 1
            part = Image.new("RGBA", (right - left + GUTTER * 2, bottom - top + GUTTER * 2), TRANSPARENT)
            src = atlas.load()
            dst = part.load()
            for x, y in component:
                red, green, blue, _ = src[x, y]
                dst[x - left + GUTTER, y - top + GUTTER] = (red, green, blue, 255)
            result[direction][name] = part
    return result


def paste_center(canvas: Image.Image, part: Image.Image, center: tuple[int, int]) -> None:
    x = center[0] - part.width // 2
    y = center[1] - part.height // 2
    canvas.alpha_composite(part, (x, y))


def assemble(direction: str, parts: dict[str, dict[str, Image.Image]]) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    if direction == "up":
        # The side/back sword cells cross cell boundaries.  The complete front
        # sword is reused and quarter-turned exactly, behind the body.
        sword = parts["down"]["sword_full"].transpose(Image.Transpose.ROTATE_90)
        paste_center(canvas, sword, (224, 182 + DIRECTION_Y_OFFSETS[direction]))
    for name, center in LAYOUTS[direction]:
        part = parts[direction][name]
        # The layout was authored on a compact 256px board.  A fixed integer
        # translation provides native-scale gutters and moves the sole pixel
        # ground contact to baseline - 1.  The cowl receives an extra integer
        # drop so that the authored eyes and face remain readable.
        translated = (
            center[0] + 32,
            center[1] + 48 + DIRECTION_Y_OFFSETS[direction] + (COWL_Y_OFFSETS[direction] if name == "scarf_cowl" else 0),
        )
        paste_center(canvas, part, translated)

    # Side-view swords are the corresponding authored side parts.  The left
    # blade is losslessly mirrored so its tip follows the facing silhouette.
    if direction in {"down", "left", "right"}:
        sword = parts["down"]["sword_full"]
        if direction == "left":
            sword = sword.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        grip_centres = {"down": (82, 160), "left": (108, 160), "right": (138, 160)}
        # Source hilt lies close to the left edge; these integer centres keep it
        # in contact with the authored hand while preserving the whole blade.
        sword_centres = {"down": (130, 174), "left": (64, 174), "right": (190, 174)}
        sword_center = sword_centres[direction]
        paste_center(
            canvas,
            sword,
            (sword_center[0] + 32, sword_center[1] + 48 + DIRECTION_Y_OFFSETS[direction]),
        )
    return canvas


def alpha_stats(image: Image.Image) -> dict[str, int]:
    partial = hidden_rgb = magenta = 0
    for red, green, blue, alpha in image.get_flattened_data():
        partial += int(0 < alpha < 255)
        hidden_rgb += int(alpha == 0 and (red != 0 or green != 0 or blue != 0))
        magenta += int(alpha > 0 and red >= 170 and blue >= 170 and green <= 90)
    return {"partialAlpha": partial, "hiddenRgb": hidden_rgb, "magenta": magenta}


def component_sizes(image: Image.Image) -> list[int]:
    return sorted((len(points) for points in alpha_components(image)), reverse=True)


def make_contact(frames: dict[str, Image.Image]) -> None:
    scale = 2
    cell = FRAME * scale
    contact = Image.new("RGBA", (cell * 4, cell), (20, 23, 32, 255))
    draw = ImageDraw.Draw(contact)
    for column, direction in enumerate(("down", "left", "up", "right")):
        enlarged = frames[direction].resize((cell, cell), Image.Resampling.NEAREST)
        contact.alpha_composite(enlarged, (column * cell, 0))
        draw.line((column * cell, BASELINE * scale, (column + 1) * cell - 1, BASELINE * scale), fill=(70, 190, 110, 255))
        draw.line((column * cell + ROOT_X * scale, 0, column * cell + ROOT_X * scale, cell - 1), fill=(70, 110, 190, 180))
    contact.save(QA_OUTPUT / "contact-sheet-2x.png", optimize=False)


def main() -> None:
    atlas = Image.open(ATLAS).convert("RGBA")
    if atlas.size != (1024, 2560):
        raise SystemExit(f"Unexpected atlas size: {atlas.size}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    QA_OUTPUT.mkdir(parents=True, exist_ok=True)
    parts = extract_parts(atlas)
    frames = {direction: assemble(direction, parts) for direction in DIRECTION_ROWS}

    sheet = Image.new("RGBA", (FRAME * 4, FRAME), TRANSPARENT)
    report: dict[str, object] = {
        "sourceAtlas": str(ATLAS.relative_to(ROOT)).replace("\\", "/"),
        "frameSize": [FRAME, FRAME], "root": [ROOT_X, BASELINE],
        "directionOrder": ["down", "left", "up", "right"], "scaleOperations": 0,
        "frames": {},
    }
    for column, direction in enumerate(("down", "left", "up", "right")):
        frame = frames[direction]
        path = OUTPUT / f"warrior-{direction}.png"
        frame.save(path, optimize=False)
        sheet.alpha_composite(frame, (column * FRAME, 0))
        bbox = frame.getchannel("A").getbbox()
        report["frames"][direction] = {
            **alpha_stats(frame), "bbox": list(bbox) if bbox else None,
            "bottomPixel": bbox[3] - 1 if bbox else None,
            "borderContact": bool(bbox and (bbox[0] == 0 or bbox[1] == 0 or bbox[2] == FRAME or bbox[3] == FRAME)),
            "detachedComponentsAtMost2Px": sum(size <= 2 for size in component_sizes(frame)),
        }
    sheet.save(OUTPUT / "warrior-4dir-sheet.png", optimize=False)
    (OUTPUT / "contract.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    make_contact(frames)
    (QA_OUTPUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
