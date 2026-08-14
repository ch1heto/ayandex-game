"""Strict QA and review artifact generation for Warrior and Archer cutouts."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts/qa/cutout-characters"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 64
SCALE = 6

VERTICAL = ((-1, -2, 1, 0, 0), (0, 0, 0, 0, -1), (1, 0, -1, -2, 0), (0, 0, 0, 0, -1))
WALK = {
    "warrior": {
        "down": VERTICAL,
        "left": ((2, -2, -1, 0, 0), (0, 0, 0, 0, -1), (-2, 0, 1, -2, 0), (0, 0, 0, 0, -1)),
        "up": VERTICAL,
        "right": ((0, 0, 1, 0, 0), (0, 0, 0, 0, -1), (2, 0, -1, -2, 0), (0, 0, 0, 0, -1)),
    },
    "archer": {
        "down": VERTICAL,
        "left": ((2, -2, -1, 0, 0), (0, 0, 0, 0, -1), (-2, 2, 1, 0, 0), (0, 0, 0, 0, -1)),
        "up": VERTICAL,
        "right": ((0, 0, 1, 0, 0), (0, 0, 0, 0, -1), (2, 0, -1, -2, 0), (0, 0, 0, 0, -1)),
    },
}


def cell(sheet: Image.Image, column: int, row: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def shifted(image: Image.Image, x: int, y: int) -> Image.Image:
    result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    result.alpha_composite(image, (x, y))
    return result


def composite(character: str, direction: str, state: str, phase: int, sheets: dict[str, Image.Image]) -> Image.Image:
    row = DIRECTIONS.index(direction)
    far_x = far_y = near_x = near_y = body_y = 0
    if state == "walk":
        far_x, far_y, near_x, near_y, body_y = WALK[character][direction][phase]
    result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    result.alpha_composite(shifted(cell(sheets["leg-far"], 0, row), far_x, far_y))
    result.alpha_composite(shifted(cell(sheets["leg-near"], 0, row), near_x, near_y))
    result.alpha_composite(shifted(cell(sheets["body"], 0, row), 0, body_y))
    weapon = "weapon-arm" if character == "warrior" else "bow-arm"
    weapon_phase = phase if state == "attack" else 3
    result.alpha_composite(shifted(cell(sheets[weapon], weapon_phase, row), 0, body_y if state != "attack" else 0))
    return result


def components(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    remaining = {(x, y) for y in range(FRAME) for x in range(FRAME) if alpha.getpixel((x, y))}
    sizes = []
    while remaining:
        queue = deque([remaining.pop()])
        size = 0
        while queue:
            x, y = queue.popleft()
            size += 1
            for ny in range(max(0, y - 1), min(FRAME, y + 2)):
                for nx in range(max(0, x - 1), min(FRAME, x + 2)):
                    if (nx, ny) in remaining:
                        remaining.remove((nx, ny))
                        queue.append((nx, ny))
        sizes.append(size)
    return sorted(sizes, reverse=True)


def background() -> Image.Image:
    result = Image.new("RGBA", (FRAME * SCALE, FRAME * SCALE), (20, 22, 30, 255))
    draw = ImageDraw.Draw(result)
    tile = 4 * SCALE
    for y in range(0, result.height, tile):
        for x in range(0, result.width, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(26, 29, 38, 255))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {"contract": {"frame": 64, "rootX": 32, "baselineY": 60}, "characters": {}}
    failures: list[str] = []
    for character in ("warrior", "archer"):
        asset_dir = ROOT / f"assets/characters/classes/{character}/procedural"
        names = ("body", "leg-far", "leg-near", "weapon-arm" if character == "warrior" else "bow-arm")
        sheets = {name: Image.open(asset_dir / f"{name}.png").convert("RGBA") for name in names}
        char_report: dict[str, object] = {"assets": {}, "states": {}}
        for name, image in sheets.items():
            pixels = list(image.getdata())
            values = {
                "size": image.size,
                "partialAlpha": sum(pixel[3] not in (0, 255) for pixel in pixels),
                "hiddenRgb": sum(pixel[3] == 0 and any(pixel[:3]) for pixel in pixels),
                "purplePixels": sum(pixel[3] and pixel[0] >= 28 and pixel[2] >= 40 and pixel[0] > pixel[1] * 1.55 + 5 and pixel[2] > pixel[1] * 1.55 + 5 for pixel in pixels),
            }
            char_report["assets"][name] = values
            if values["partialAlpha"] or values["hiddenRgb"] or values["purplePixels"]:
                failures.append(f"{character}/{name}: alpha or purple contamination")

        for state in ("idle", "walk", "attack"):
            contact = Image.new("RGBA", (4 * FRAME * SCALE, 4 * FRAME * SCALE + 22), (16, 18, 25, 255))
            draw = ImageDraw.Draw(contact)
            animation_frames = []
            state_report = {}
            for row, direction in enumerate(DIRECTIONS):
                direction_report = []
                for phase in range(4):
                    frame = composite(character, direction, state, phase, sheets)
                    bbox = frame.getchannel("A").getbbox()
                    bottom = bbox[3] - 1 if bbox else None
                    islands = components(frame)
                    detached = sum(size for size in islands[1:] if size <= 2)
                    direction_report.append({"phase": phase, "bbox": bbox, "bottom": bottom, "components": islands, "detachedPixels": detached})
                    if bottom != 59:
                        failures.append(f"{character}/{state}/{direction}/{phase}: baseline={bottom}")
                    if detached:
                        failures.append(f"{character}/{state}/{direction}/{phase}: detached={detached}")
                    panel = background()
                    panel.alpha_composite(frame.resize((FRAME * SCALE, FRAME * SCALE), Image.Resampling.NEAREST))
                    contact.alpha_composite(panel, (phase * FRAME * SCALE, row * FRAME * SCALE + 22))
                    draw.text((phase * FRAME * SCALE + 4, row * FRAME * SCALE + 4), f"{direction} {phase}", fill="white")
                state_report[direction] = direction_report
            char_report["states"][state] = state_report
            contact.save(OUTPUT / f"{character}-{state}-contact.png")

            for phase in range(4):
                strip = Image.new("RGBA", (4 * FRAME * SCALE, FRAME * SCALE), (18, 20, 28, 255))
                for index, direction in enumerate(DIRECTIONS):
                    frame = composite(character, direction, state, phase, sheets).resize((FRAME * SCALE, FRAME * SCALE), Image.Resampling.NEAREST)
                    strip.alpha_composite(frame, (index * FRAME * SCALE, 0))
                animation_frames.append(strip.convert("P", palette=Image.Palette.ADAPTIVE))
            duration = 340 if state == "idle" else 112 if state == "walk" else 95
            animation_frames[0].save(OUTPUT / f"{character}-{state}.gif", save_all=True, append_images=animation_frames[1:], duration=duration, loop=0, disposal=2)
        report["characters"][character] = char_report

    report["failures"] = failures
    report["passed"] = not failures
    (OUTPUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": not failures, "failures": failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
