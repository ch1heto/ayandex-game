"""Render and strictly inspect the Warrior modular runtime sheets."""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "assets/characters/classes/warrior/modular-runtime"
SOURCE = ROOT / "assets/characters/classes/warrior/rig-source"
QA = ROOT / "artifacts/qa/warrior-modular"
FRAME = 64
ROOT_X = 32
BASELINE = 60
TRANSPARENT = (0, 0, 0, 0)
DIRECTIONS = ("down", "left", "up", "right")
WALK_POSES = {
    "down": ((-1, 0, 1, 0, 0), (0, 0, 0, 0, -1), (1, 0, -1, 0, 0), (0, 0, 0, 0, -1)),
    "left": ((1, 0, -1, 0, 0), (0, 0, 0, 0, -1), (-1, 0, 1, 0, 0), (0, 0, 0, 0, -1)),
    "up": ((-1, 0, 1, 1, 0), (0, 0, 0, 1, -1), (1, 0, -1, 1, 0), (0, 0, 0, 1, -1)),
    "right": ((-1, 0, 1, 1, 0), (0, 0, 0, 1, -1), (1, 0, -1, 1, 0), (0, 0, 0, 1, -1)),
}


def frame(sheet: Image.Image, column: int, row: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def paste(layer: Image.Image, part: Image.Image, dx: int = 0, dy: int = 0) -> None:
    layer.alpha_composite(part, (dx, dy))


def compose(row: int, state: str, phase: int, sheets: dict[str, Image.Image]) -> Image.Image:
    result = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    body_y = 0
    far_x = far_y = near_x = near_y = 0
    if state == "walk":
        far_x, far_y, near_x, near_y, body_y = WALK_POSES[DIRECTIONS[row]][phase]
    paste(result, frame(sheets["far"], 0, row), far_x, far_y)
    paste(result, frame(sheets["near"], 0, row), near_x, near_y)
    paste(result, frame(sheets["body"], 0, row), 0, body_y)
    if state == "attack":
        paste(result, frame(sheets["attack"], phase, row))
    else:
        paste(result, frame(sheets["idleSword"], 0, row), 0, body_y)
    return result


def alpha_stats(image: Image.Image) -> tuple[int, int, int]:
    partial = hidden_rgb = purple = 0
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if 0 < alpha < 255:
                partial += 1
            if alpha == 0 and (red or green or blue):
                hidden_rgb += 1
            # Chroma/magenta fringe signature. Dark blue-violet hair is an authored
            # palette colour and is intentionally not treated as key spill.
            if alpha and red >= 140 and blue >= 140 and green <= 105 and abs(red - blue) <= 80:
                purple += 1
    return partial, hidden_rgb, purple


def components(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    visible = {(x, y) for y in range(FRAME) for x in range(FRAME) if alpha.getpixel((x, y))}
    sizes = []
    while visible:
        queue = deque([visible.pop()])
        size = 0
        while queue:
            x, y = queue.popleft()
            size += 1
            for neighbour in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbour in visible:
                    visible.remove(neighbour)
                    queue.append(neighbour)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def make_contact(frames: list[list[Image.Image]], path: Path) -> None:
    scale = 4
    cell = FRAME * scale
    sheet = Image.new("RGBA", (len(frames[0]) * cell, len(frames) * cell), (21, 24, 35, 255))
    draw = ImageDraw.Draw(sheet)
    for row, items in enumerate(frames):
        for column, item in enumerate(items):
            enlarged = item.resize((cell, cell), Image.Resampling.NEAREST)
            sheet.alpha_composite(enlarged, (column * cell, row * cell))
            draw.line((column * cell, row * cell + BASELINE * scale, (column + 1) * cell - 1, row * cell + BASELINE * scale), fill=(58, 110, 82, 150), width=1)
            draw.line((column * cell + ROOT_X * scale, row * cell, column * cell + ROOT_X * scale, (row + 1) * cell - 1), fill=(64, 80, 120, 100), width=1)
    sheet.save(path)


def make_preview(frames: list[Image.Image], path: Path, duration: int) -> None:
    enlarged = [item.resize((FRAME * 4, FRAME * 4), Image.Resampling.NEAREST) for item in frames]
    enlarged[0].save(path, save_all=True, append_images=enlarged[1:], duration=duration, loop=0, disposal=2)


def nearest_layer_gap(image_a: Image.Image, image_b: Image.Image) -> int:
    points_a = [(x, y) for y in range(FRAME) for x in range(FRAME) if image_a.getpixel((x, y))[3]]
    points_b = [(x, y) for y in range(FRAME) for x in range(FRAME) if image_b.getpixel((x, y))[3]]
    return min(abs(ax - bx) + abs(ay - by) for ax, ay in points_a for bx, by in points_b)


def main() -> None:
    QA.mkdir(parents=True, exist_ok=True)
    sheets = {
        "body": Image.open(RUNTIME / "body.png").convert("RGBA"),
        "far": Image.open(RUNTIME / "leg-far.png").convert("RGBA"),
        "near": Image.open(RUNTIME / "leg-near.png").convert("RGBA"),
        "idleSword": Image.open(RUNTIME / "sword-idle.png").convert("RGBA"),
        "attack": Image.open(RUNTIME / "sword-attack.png").convert("RGBA"),
    }
    expected = {"body": (64, 256), "far": (64, 256), "near": (64, 256), "idleSword": (64, 256), "attack": (256, 256)}
    for name, image in sheets.items():
        if image.size != expected[name]:
            raise SystemExit(f"{name}: expected {expected[name]}, got {image.size}")

    contacts: dict[str, list[list[Image.Image]]] = {}
    all_frames = []
    for state in ("idle", "walk", "attack"):
        contacts[state] = []
        for row in range(4):
            frames = [compose(row, state, phase, sheets) for phase in range(4)]
            contacts[state].append(frames)
            all_frames.extend((state, DIRECTIONS[row], phase, item) for phase, item in enumerate(frames))
            if state in ("walk", "attack"):
                make_preview(frames, QA / f"{state}-{DIRECTIONS[row]}.gif", 112 if state == "walk" else 164)
        make_contact(contacts[state], QA / f"{state}-contact.png")

    source_parts = sorted(path for direction in ("front", "left", "back", "right") for path in (SOURCE / direction).glob("*.png"))
    if len(source_parts) != 152:
        raise SystemExit(f"expected 152 sliced parts, got {len(source_parts)}")
    source_partial = source_hidden_rgb = source_purple = 0
    for path in source_parts:
        p, h, m = alpha_stats(Image.open(path).convert("RGBA"))
        source_partial += p
        source_hidden_rgb += h
        source_purple += m

    partial = hidden_rgb = purple = 0
    tiny_islands = 0
    baseline_errors = []
    attachment_gaps = []
    for state, direction, phase, image in all_frames:
        p, h, m = alpha_stats(image)
        partial += p
        hidden_rgb += h
        purple += m
        tiny_islands += sum(1 for size in components(image) if size <= 2)
        feet = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
        row = DIRECTIONS.index(direction)
        far_x = far_y = near_x = near_y = 0
        if state == "walk":
            far_x, far_y, near_x, near_y, _ = WALK_POSES[direction][phase]
        paste(feet, frame(sheets["far"], 0, row), far_x, far_y)
        paste(feet, frame(sheets["near"], 0, row), near_x, near_y)
        bbox = feet.getchannel("A").getbbox()
        if bbox is None or bbox[3] - 1 != BASELINE - 1:
            baseline_errors.append(f"{state}/{direction}/{phase}:{None if bbox is None else bbox[3] - 1}")
        body_frame = frame(sheets["body"], 0, row)
        for layer_name, layer_frame in (("far", frame(sheets["far"], 0, row)), ("near", frame(sheets["near"], 0, row))):
            gap = nearest_layer_gap(body_frame, layer_frame)
            if gap > 1:
                attachment_gaps.append(f"{state}/{direction}/{phase}/{layer_name}:{gap}")
        sword_frame = frame(sheets["attack"], phase, row) if state == "attack" else frame(sheets["idleSword"], 0, row)
        sword_gap = nearest_layer_gap(body_frame, sword_frame)
        if sword_gap > 1:
            attachment_gaps.append(f"{state}/{direction}/{phase}/sword:{sword_gap}")

    manifest = json.loads((RUNTIME / "rig.json").read_text(encoding="utf-8"))
    visual_reaches = []
    manifest_directions = ("front", "left", "back", "right")
    for row, direction in enumerate(manifest_directions):
        hand_x, hand_y = manifest["directions"][direction]["hand"]
        for phase, angle_degrees in enumerate(manifest["directions"][direction]["attackAngles"]):
            radians = math.radians(angle_degrees)
            attack_frame = frame(sheets["attack"], phase, row)
            reach = max(
                (x - hand_x) * math.cos(radians) + (y - hand_y) * math.sin(radians)
                for y in range(FRAME) for x in range(FRAME) if attack_frame.getpixel((x, y))[3]
            )
            visual_reaches.append(reach)

    report = {
        "slicedParts": len(source_parts),
        "sourcePartialAlphaPixels": source_partial,
        "sourceHiddenRgbPixels": source_hidden_rgb,
        "sourcePurpleArtifactPixels": source_purple,
        "frames": len(all_frames),
        "root": [ROOT_X, BASELINE],
        "partialAlphaPixels": partial,
        "hiddenRgbPixels": hidden_rgb,
        "purpleArtifactPixels": purple,
        "tinyDetachedIslands": tiny_islands,
        "baselineErrors": baseline_errors,
        "attachmentGaps": attachment_gaps,
        "stableBodyFramesPerDirection": 1,
        "visualSwordReachPixels": [round(min(visual_reaches), 1), round(max(visual_reaches), 1)],
        "gameplaySwordReachPixels": 25,
    }
    (QA / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if (source_partial or source_hidden_rgb or source_purple or partial or hidden_rgb or purple
            or tiny_islands or baseline_errors or attachment_gaps
            or min(visual_reaches) < 22 or max(visual_reaches) > 28):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
