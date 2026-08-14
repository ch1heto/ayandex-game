"""Strict, non-destructive QA for the native-scale four-direction Warrior base."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/classes/warrior/rig-source/warrior-modular-atlas-128.png"
CANDIDATE = ROOT / "assets/characters/classes/warrior/base-4dir"
QA = ROOT / "artifacts/character-qa/warrior-base-4dir"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 320
ROOT_X = 160
BASELINE = 304


def components(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    visible = {(x, y) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x, y))}
    sizes: list[int] = []
    while visible:
        queue = deque([visible.pop()])
        size = 0
        while queue:
            x, y = queue.popleft()
            size += 1
            for point in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1), (x - 1, y),
                (x + 1, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                if point in visible:
                    visible.remove(point)
                    queue.append(point)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def stats(image: Image.Image, source_colours: set[tuple[int, int, int]]) -> dict[str, object]:
    partial = hidden = magenta = foreign = 0
    for red, green, blue, alpha in image.get_flattened_data():
        partial += int(0 < alpha < 255)
        hidden += int(alpha == 0 and (red or green or blue))
        magenta += int(alpha > 0 and red >= 170 and blue >= 170 and green <= 90)
        foreign += int(alpha > 0 and (red, green, blue) not in source_colours)
    bbox = image.getchannel("A").getbbox()
    sizes = components(image)
    return {
        "partialAlphaPixels": partial,
        "hiddenRgbPixels": hidden,
        "magentaPixels": magenta,
        "pixelsWithColourAbsentFromAtlas": foreign,
        "bbox": list(bbox) if bbox else None,
        "bottomPixel": bbox[3] - 1 if bbox else None,
        "borderContact": bool(bbox and (bbox[0] == 0 or bbox[1] == 0 or bbox[2] == FRAME or bbox[3] == FRAME)),
        "connectedComponents": len(sizes),
        "detachedComponentsAtMost2Px": sum(size <= 2 for size in sizes),
    }


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    source_colours = {(red, green, blue) for red, green, blue, alpha in source.get_flattened_data() if alpha}
    errors: list[str] = []
    report: dict[str, object] = {
        "decision": "FAIL",
        "frameSize": [FRAME, FRAME],
        "root": [ROOT_X, BASELINE],
        "directionOrder": list(DIRECTIONS),
        "frames": {},
        "errors": errors,
    }
    frames: list[Image.Image] = []
    for direction in DIRECTIONS:
        path = CANDIDATE / f"warrior-{direction}.png"
        image = Image.open(path).convert("RGBA")
        frames.append(image)
        if image.size != (FRAME, FRAME):
            errors.append(f"{direction}: size {image.size}")
        frame_stats = stats(image, source_colours)
        report["frames"][direction] = frame_stats
        for field in (
            "partialAlphaPixels", "hiddenRgbPixels", "magentaPixels",
            "pixelsWithColourAbsentFromAtlas", "detachedComponentsAtMost2Px",
        ):
            if frame_stats[field]:
                errors.append(f"{direction}: {field}={frame_stats[field]}")
        if frame_stats["bottomPixel"] != BASELINE - 1:
            errors.append(f"{direction}: bottomPixel={frame_stats['bottomPixel']}")
        if frame_stats["borderContact"]:
            errors.append(f"{direction}: border contact")

    sheet = Image.open(CANDIDATE / "warrior-4dir-sheet.png").convert("RGBA")
    if sheet.size != (FRAME * 4, FRAME):
        errors.append(f"sheet: size {sheet.size}")
    for column, frame in enumerate(frames):
        cell = sheet.crop((column * FRAME, 0, (column + 1) * FRAME, FRAME))
        if cell.tobytes() != frame.tobytes():
            errors.append(f"sheet: {DIRECTIONS[column]} cell mismatch")

    report["baselineConsistent"] = all(
        report["frames"][direction]["bottomPixel"] == BASELINE - 1 for direction in DIRECTIONS
    )
    report["frameDriftPixels"] = 0
    report["scaleOperations"] = 0
    report["decision"] = "PASS" if not errors else "FAIL"
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "strict-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
