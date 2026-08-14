"""Strict technical and visual QA for the Warrior procedural cutout."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/characters/classes/warrior/procedural"
OUTPUT = ROOT / "artifacts/qa/warrior-procedural"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 64
SCALE = 6

VERTICAL = ((-1, -2, 1, 0, 0), (0, 0, 0, 0, -1), (1, 0, -1, -2, 0), (0, 0, 0, 0, -1))
WALK = {
    "down": VERTICAL,
    "up": VERTICAL,
    "left": ((2, -2, -1, 0, 0), (0, 0, 0, 0, -1), (-2, 0, 1, -2, 0), (0, 0, 0, 0, -1)),
    "right": ((0, 0, 1, 0, 0), (0, 0, 0, 0, -1), (2, 0, -1, -2, 0), (0, 0, 0, 0, -1)),
}


def cell(sheet: Image.Image, column: int, row: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def shifted(image: Image.Image, x: int, y: int) -> Image.Image:
    result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    result.alpha_composite(image, (x, y))
    return result


def composite(direction: str, state: str, phase: int, sheets: dict[str, Image.Image]) -> Image.Image:
    row = DIRECTIONS.index(direction)
    far_x = far_y = near_x = near_y = body_y = 0
    if state == "walk":
        far_x, far_y, near_x, near_y, body_y = WALK[direction][phase]
    result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    result.alpha_composite(shifted(cell(sheets["leg-far"], 0, row), far_x, far_y))
    result.alpha_composite(shifted(cell(sheets["leg-near"], 0, row), near_x, near_y))
    result.alpha_composite(shifted(cell(sheets["body"], 0, row), 0, body_y))
    weapon_phase = phase if state == "attack" else 3
    result.alpha_composite(shifted(cell(sheets["weapon-arm"], weapon_phase, row), 0, body_y if state != "attack" else 0))
    return result


def components(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    remaining = {(x, y) for y in range(FRAME) for x in range(FRAME) if alpha.getpixel((x, y))}
    sizes: list[int] = []
    while remaining:
        start = remaining.pop()
        queue = deque([start])
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


def checker() -> Image.Image:
    result = Image.new("RGBA", (FRAME * SCALE, FRAME * SCALE), (20, 22, 30, 255))
    draw = ImageDraw.Draw(result)
    tile = 4 * SCALE
    for y in range(0, result.height, tile):
        for x in range(0, result.width, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(25, 29, 38, 255))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheets = {name: Image.open(ASSETS / f"{name}.png").convert("RGBA") for name in ("body", "leg-far", "leg-near", "weapon-arm")}
    expected = {"body": (64, 256), "leg-far": (64, 256), "leg-near": (64, 256), "weapon-arm": (256, 256)}
    report: dict[str, object] = {"assets": {}, "states": {}, "contract": {"frame": 64, "rootX": 32, "baselineY": 60}}

    for name, image in sheets.items():
        pixels = list(image.getdata())
        partial = sum(pixel[3] not in (0, 255) for pixel in pixels)
        hidden_rgb = sum(pixel[3] == 0 and any(pixel[:3]) for pixel in pixels)
        purple = sum(
            pixel[3] and pixel[0] >= 28 and pixel[2] >= 40 and pixel[0] > pixel[1] * 1.55 + 5 and pixel[2] > pixel[1] * 1.55 + 5
            for pixel in pixels
        )
        report["assets"][name] = {
            "size": image.size,
            "expectedSize": expected[name],
            "partialAlpha": partial,
            "hiddenRgb": hidden_rgb,
            "purplePixels": purple,
        }

    preview_frames: list[Image.Image] = []
    for state in ("idle", "walk", "attack"):
        sheet = Image.new("RGBA", (4 * FRAME * SCALE, 4 * FRAME * SCALE + 24), (16, 18, 25, 255))
        sheet_draw = ImageDraw.Draw(sheet)
        state_report: dict[str, object] = {}
        for row, direction in enumerate(DIRECTIONS):
            frame_reports = []
            for phase in range(4):
                frame = composite(direction, state, phase, sheets)
                alpha_bbox = frame.getchannel("A").getbbox()
                bottom = alpha_bbox[3] - 1 if alpha_bbox else None
                component_sizes = components(frame)
                small_components = [size for size in component_sizes[1:] if size <= 2]
                frame_reports.append({"phase": phase, "bbox": alpha_bbox, "bottom": bottom, "components": component_sizes, "detachedPixels": sum(small_components)})
                backdrop = checker()
                backdrop.alpha_composite(frame.resize((FRAME * SCALE, FRAME * SCALE), Image.Resampling.NEAREST))
                sheet.alpha_composite(backdrop, (phase * FRAME * SCALE, row * FRAME * SCALE + 24))
                sheet_draw.text((phase * FRAME * SCALE + 4, row * FRAME * SCALE + 5), f"{direction} {phase}", fill=(240, 243, 248, 255))
            state_report[direction] = frame_reports
        report["states"][state] = state_report
        sheet.save(OUTPUT / f"{state}-contact-sheet.png")

    # One synchronized four-direction preview for fast motion inspection.
    for state, delay in (("idle", 320), ("walk", 112), ("attack", 85)):
        frames = []
        for phase in range(4):
            strip = Image.new("RGBA", (4 * FRAME * SCALE, FRAME * SCALE), (18, 20, 28, 255))
            for index, direction in enumerate(DIRECTIONS):
                frame = composite(direction, state, phase, sheets).resize((FRAME * SCALE, FRAME * SCALE), Image.Resampling.NEAREST)
                strip.alpha_composite(frame, (index * FRAME * SCALE, 0))
            frames.append(strip.convert("P", palette=Image.Palette.ADAPTIVE))
        frames[0].save(OUTPUT / f"{state}-preview.gif", save_all=True, append_images=frames[1:], duration=delay, loop=0, disposal=2)
        preview_frames.extend(frames)

    failures = []
    for name, values in report["assets"].items():
        if values["size"] != values["expectedSize"]:
            failures.append(f"{name}: dimensions")
        for field in ("partialAlpha", "hiddenRgb", "purplePixels"):
            if values[field] != 0:
                failures.append(f"{name}: {field}={values[field]}")
    for state, directions in report["states"].items():
        for direction, frames in directions.items():
            bottoms = {frame["bottom"] for frame in frames}
            if bottoms != {59}:
                failures.append(f"{state}/{direction}: baseline={sorted(bottoms)}")
            for frame in frames:
                if frame["detachedPixels"]:
                    failures.append(f"{state}/{direction}/{frame['phase']}: detached={frame['detachedPixels']}")
    report["failures"] = failures
    report["passed"] = not failures
    (OUTPUT / "qa-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": not failures, "failures": failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
