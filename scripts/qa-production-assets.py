"""Read-only visual and alpha QA for first-location production PNG assets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

from asset_alpha import suspicious_edge_pixels


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "production-asset-qa"
ASSETS = [
    *(ROOT / "assets" / "environments" / "twilight-glade" / "props").glob("*.png"),
    *(ROOT / "assets" / "environments" / "twilight-glade" / "tiles").glob("*.png"),
    ROOT / "assets" / "environments" / "twilight-glade" / "leaf-particle.png",
    *(ROOT / "assets" / "enemies" / "moss-slime").glob("*.png"),
    ROOT / "assets" / "items" / "coin.png",
    ROOT / "assets" / "projectiles" / "arrow.png",
    ROOT / "assets" / "projectiles" / "magic-bolt.png",
    *(ROOT / "assets" / "ui" / "hud").glob("*.png"),
]
SCALE = 4


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    result = Image.new("RGBA", size, (34, 39, 46, 255))
    draw = ImageDraw.Draw(result)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(52, 58, 68, 255))
    return result


def save_slime_preview() -> None:
    strip = Image.open(ROOT / "assets" / "enemies" / "moss-slime" / "move.png").convert("RGBA")
    frames = [strip.crop((index * 64, 0, (index + 1) * 64, 64)) for index in range(4)]
    enlarged = [frame.resize((512, 512), Image.Resampling.NEAREST) for frame in frames]
    enlarged[0].save(
        OUTPUT / "moss-slime-move.gif",
        save_all=True,
        append_images=enlarged[1:],
        duration=140,
        loop=0,
        disposal=2,
    )


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    previews: list[tuple[str, Image.Image]] = []
    errors = 0
    warnings = 0
    for path in sorted(ASSETS):
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        partial_alpha = sum(alpha.histogram()[1:255])
        hidden_rgb = sum(1 for red, green, blue, value in image.get_flattened_data() if value == 0 and (red or green or blue))
        magenta = suspicious_edge_pixels(image, (255, 0, 255))
        green = suspicious_edge_pixels(image, (0, 255, 0))
        if partial_alpha or hidden_rgb:
            errors += 1
        if magenta or green:
            warnings += 1
        records.append({
            "path": path.relative_to(ROOT).as_posix(),
            "size": image.size,
            "partial_alpha": partial_alpha,
            "hidden_rgb": hidden_rgb,
            "suspicious_magenta_edge": magenta,
            "suspicious_green_edge": green,
        })
        previews.append((path.stem, image))

    cell_width, cell_height = 560, 620
    columns = 4
    rows = (len(previews) + columns - 1) // columns
    sheet = checker((columns * cell_width, rows * cell_height))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(previews):
        column, row = index % columns, index // columns
        x, y = column * cell_width, row * cell_height
        enlarged = image.resize((image.width * SCALE, image.height * SCALE), Image.Resampling.NEAREST)
        max_width, max_height = cell_width - 24, cell_height - 44
        if enlarged.width > max_width or enlarged.height > max_height:
            factor = min(max_width / enlarged.width, max_height / enlarged.height)
            target = (max(1, int(enlarged.width * factor)), max(1, int(enlarged.height * factor)))
            enlarged = enlarged.resize(target, Image.Resampling.NEAREST)
        sheet.alpha_composite(enlarged, (x + (cell_width - enlarged.width) // 2, y + 30))
        draw.text((x + 8, y + 8), name, fill="white")
    sheet.save(OUTPUT / "first-location-contact-sheet.png", optimize=True)
    save_slime_preview()
    report = {"summary": {"errors": errors, "diagnostic_warnings": warnings}, "assets": records, "visual_review_required": True}
    (OUTPUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Production asset errors: {errors}; diagnostic warnings: {warnings}")
    print(f"Review: {OUTPUT / 'first-location-contact-sheet.png'}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
