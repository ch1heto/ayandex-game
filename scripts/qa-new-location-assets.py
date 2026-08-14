from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    *sorted((ROOT / "assets/environments/ashvale-hub/props").glob("*.png")),
    *sorted((ROOT / "assets/environments/spider-hollow/props").glob("*.png")),
    *sorted((ROOT / "assets/enemies/ember-spider").glob("*.png")),
    ROOT / "assets/tilesets/ashvale-hub.png",
    ROOT / "assets/tilesets/spider-hollow.png",
]


def tiny_components(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    opaque = {(x, y) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x, y))}
    tiny = 0
    while opaque:
        start = opaque.pop()
        queue = deque([start])
        size = 1
        while queue:
            x, y = queue.popleft()
            for point in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1),
                (x - 1, y),                     (x + 1, y),
                (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                if point in opaque:
                    opaque.remove(point)
                    queue.append(point)
                    size += 1
        if size == 1:
            tiny += 1
    return tiny


def inspect(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    pixels = list(image.getdata())
    return {
        "path": str(path.relative_to(ROOT)),
        "size": image.size,
        "partialAlpha": sum(1 for *_, a in pixels if 0 < a < 255),
        "hiddenRgb": sum(1 for r, g, b, a in pixels if a == 0 and (r or g or b)),
        "magentaFringe": sum(1 for r, g, b, a in pixels if a and r > 150 and b > 150 and g < 70),
        "singlePixelComponents": tiny_components(image),
    }


def contact_sheet() -> Path:
    sheet = Image.new("RGBA", (1400, 840), (24, 22, 20, 255))
    draw = ImageDraw.Draw(sheet)
    groups = [
        ("HUB — RUINED / RESTORED", TARGETS[:5], 24, 28, 2),
        ("SPIDER PROPS", TARGETS[5:13], 24, 330, 2),
        ("EMBER SPIDER — IDLE / MOVE / ATTACK / DEATH", TARGETS[13:17], 24, 610, 2),
    ]
    for label, paths, start_x, y, scale in groups:
        draw.text((start_x, y), label, fill=(235, 218, 177, 255))
        x = start_x
        for path in paths:
            image = Image.open(path).convert("RGBA")
            enlarged = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
            sheet.alpha_composite(enlarged, (x, y + 24))
            draw.text((x, y + 28 + enlarged.height), path.stem, fill=(200, 184, 154, 255))
            x += enlarged.width + 24
    output = ROOT / "artifacts/new-location-assets-contact-final.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    return output


if __name__ == "__main__":
    report = [inspect(path) for path in TARGETS]
    errors = [item for item in report if item["partialAlpha"] or item["hiddenRgb"] or item["magentaFringe"] or item["singlePixelComponents"]]
    print(json.dumps({"decision": "PASS" if not errors else "FAIL", "assets": len(report), "errors": errors, "contact": str(contact_sheet())}, indent=2))
    raise SystemExit(1 if errors else 0)
