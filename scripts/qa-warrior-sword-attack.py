"""Technical checks and review artifacts for the weapon-only Warrior attack."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/characters/classes/warrior/procedural"
OUTPUT = ROOT / "artifacts/qa/warrior-sword-attack"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 64
PHASES = 6
SCALE = 6


def cell(sheet: Image.Image, column: int, row: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def components(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    remaining = {(x, y) for y in range(FRAME) for x in range(FRAME) if alpha.getpixel((x, y))}
    sizes: list[int] = []
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


def composite(direction: str, phase: int, sheets: dict[str, Image.Image]) -> Image.Image:
    row = DIRECTIONS.index(direction)
    result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    result.alpha_composite(cell(sheets["attack-body"], 0, row))
    result.alpha_composite(cell(sheets["sword-attack"], phase, row))
    result.alpha_composite(cell(sheets["attack-hand"], 0, row))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    names = ("attack-body", "attack-hand", "sword-attack")
    sheets = {name: Image.open(ASSETS / f"{name}.png").convert("RGBA") for name in names}
    failures: list[str] = []
    assets: dict[str, object] = {}
    for name, image in sheets.items():
        pixels = list(image.getdata())
        values = {
            "size": image.size,
            "partialAlpha": sum(pixel[3] not in (0, 255) for pixel in pixels),
            "hiddenRgb": sum(pixel[3] == 0 and any(pixel[:3]) for pixel in pixels),
            "purplePixels": sum(pixel[3] and pixel[0] >= 28 and pixel[2] >= 40 and pixel[0] > pixel[1] * 1.55 + 5 and pixel[2] > pixel[1] * 1.55 + 5 for pixel in pixels),
        }
        assets[name] = values
        if values["partialAlpha"] or values["hiddenRgb"] or values["purplePixels"]:
            failures.append(f"{name}: alpha or purple contamination")

    contact = Image.new("RGBA", (PHASES * FRAME * SCALE, 4 * FRAME * SCALE + 22), (16, 18, 25, 255))
    draw = ImageDraw.Draw(contact)
    report_frames: dict[str, object] = {}
    direction_gifs: dict[str, list[Image.Image]] = {direction: [] for direction in DIRECTIONS}
    for row, direction in enumerate(DIRECTIONS):
        frames = []
        for phase in range(PHASES):
            frame = composite(direction, phase, sheets)
            bbox = frame.getchannel("A").getbbox()
            bottom = bbox[3] - 1 if bbox else None
            islands = components(frame)
            detached = sum(size for size in islands[1:] if size <= 2)
            if bottom != 59:
                failures.append(f"{direction}/{phase}: baseline={bottom}")
            if detached:
                failures.append(f"{direction}/{phase}: detached={detached}")
            frames.append({"phase": phase, "bbox": bbox, "bottom": bottom, "components": islands, "detachedPixels": detached})
            panel = background()
            enlarged = frame.resize((FRAME * SCALE, FRAME * SCALE), Image.Resampling.NEAREST)
            panel.alpha_composite(enlarged)
            contact.alpha_composite(panel, (phase * FRAME * SCALE, row * FRAME * SCALE + 22))
            draw.text((phase * FRAME * SCALE + 4, row * FRAME * SCALE + 4), f"{direction} {phase}", fill="white")
            direction_gifs[direction].append(panel.convert("P", palette=Image.Palette.ADAPTIVE))
        report_frames[direction] = frames
    contact.save(OUTPUT / "contact.png")
    for direction, frames in direction_gifs.items():
        frames[0].save(OUTPUT / f"{direction}.gif", save_all=True, append_images=frames[1:], duration=58, loop=0, disposal=2)

    report = {"contract": {"frame": 64, "rootX": 32, "baselineY": 60}, "assets": assets, "frames": report_frames, "failures": failures, "passed": not failures}
    (OUTPUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": not failures, "failures": failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
