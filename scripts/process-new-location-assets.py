from __future__ import annotations

from pathlib import Path
from collections import deque

from PIL import Image, ImageDraw

from asset_alpha import clean_chroma_source, normalize_transparent_rgb


ROOT = Path(__file__).resolve().parents[1]
RESAMPLE = Image.Resampling.NEAREST


def crop_content(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = normalize_transparent_rgb(image.crop(box))
    bbox = crop.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"Empty crop: {box}")
    return crop.crop(bbox)


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / image.width, size[1] / image.height)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(target, RESAMPLE)


def canvas(image: Image.Image, size: tuple[int, int], baseline: int) -> Image.Image:
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    result.alpha_composite(image, ((size[0] - image.width) // 2, baseline - image.height))
    return normalize_transparent_rgb(result)


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalize_transparent_rgb(image).save(path, optimize=True)


def remove_residual_magenta(image: Image.Image) -> Image.Image:
    source = normalize_transparent_rgb(image)
    pixels = source.load()
    candidates = {
        (x, y) for y in range(source.height) for x in range(source.width)
        if pixels[x, y][3] and pixels[x, y][0] >= 55 and pixels[x, y][2] >= 55
        and min(pixels[x, y][0], pixels[x, y][2]) - pixels[x, y][1] >= 38
    }
    result = source.copy(); output = result.load()
    for x, y in candidates:
        replacement = None
        for radius in range(1, 12):
            neighbours = [(nx, ny) for ny in range(max(0, y-radius), min(source.height, y+radius+1)) for nx in range(max(0, x-radius), min(source.width, x+radius+1)) if abs(nx-x)+abs(ny-y)==radius and pixels[nx,ny][3] and (nx,ny) not in candidates]
            if neighbours:
                nx, ny = neighbours[0]; replacement = pixels[nx, ny]; break
        output[x, y] = replacement if replacement else (0, 0, 0, 0)
    return normalize_transparent_rgb(result)


def remove_tiny_components(image: Image.Image, maximum_size: int = 2) -> Image.Image:
    result = normalize_transparent_rgb(image).copy()
    alpha = result.getchannel("A")
    opaque = {(x, y) for y in range(result.height) for x in range(result.width) if alpha.getpixel((x, y))}
    pixels = result.load()
    while opaque:
        start = opaque.pop()
        queue = deque([start])
        component = [start]
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
                    component.append(point)
        if len(component) <= maximum_size:
            for x, y in component:
                pixels[x, y] = (0, 0, 0, 0)
    return normalize_transparent_rgb(result)


def process_hub() -> None:
    source = normalize_transparent_rgb(Image.open(ROOT / "assets/source/hub/hub-buildings-master.png").convert("RGBA"))
    specs = {
        "forge-ruined": ((0, 55, 420, 670), (160, 132)),
        "forge-restored": ((395, 45, 845, 690), (160, 132)),
        "infirmary-ruined": ((830, 50, 1260, 690), (160, 132)),
        "infirmary-restored": ((1240, 45, 1715, 690), (160, 132)),
        "restoration-board": ((1695, 90, 2172, 650), (112, 92)),
    }
    for name, (box, target) in specs.items():
        save(fit(crop_content(source, box), target), ROOT / f"assets/environments/ashvale-hub/props/{name}.png")


def process_spider() -> None:
    source = clean_chroma_source(
        Image.open(ROOT / "assets/source/spider-zone/spider-master-chroma.png").convert("RGBA"),
        (239, 9, 245),
    )
    states = ("idle", "move", "attack", "death")
    for row, state in enumerate(states):
        frames = []
        for column in range(4):
            raw = crop_content(source, (column * 384, row * 256, (column + 1) * 384, (row + 1) * 256))
            frame = remove_residual_magenta(canvas(fit(raw, (58, 52)), (64, 64), 58))
            save(frame, ROOT / f"assets/enemies/ember-spider/frames/{state}/frame-{column:02d}.png")
            frames.append(frame)
        strip = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            strip.alpha_composite(frame, (index * 64, 0))
        save(strip, ROOT / f"assets/enemies/ember-spider/{state}.png")

    props_source = clean_chroma_source(
        Image.open(ROOT / "assets/source/spider-zone/biome-props-master-chroma.png").convert("RGBA"),
        (242, 4, 241),
    )
    props = {
        "ember-rock-a": ((0, 0, 384, 500), (84, 72)),
        "ember-rock-b": ((384, 0, 768, 500), (84, 68)),
        "dead-tree": ((768, 0, 1152, 520), (112, 138)),
        "thorn-bush": ((1152, 0, 1536, 510), (84, 76)),
        "web-large": ((0, 500, 520, 1024), (116, 98)),
        "web-small": ((500, 500, 880, 1024), (74, 64)),
        "burnt-stump": ((820, 500, 1220, 1024), (72, 72)),
        "ember-plant": ((1160, 500, 1536, 1024), (62, 70)),
    }
    for name, (box, target) in props.items():
        cleaned = remove_tiny_components(remove_residual_magenta(fit(crop_content(props_source, box), target)))
        save(cleaned, ROOT / f"assets/environments/spider-hollow/props/{name}.png")


def build_tilesets() -> None:
    hub = Image.new("RGBA", (32 * 4, 32), (0, 0, 0, 255))
    spider = Image.new("RGBA", (32 * 4, 32), (0, 0, 0, 255))
    for index in range(4):
        tile = Image.new("RGBA", (32, 32), (67 + index * 3, 68 + index * 2, 61 + index * 2, 255))
        draw = ImageDraw.Draw(tile)
        for y in range(0, 32, 8):
            offset = 4 if (y // 8) % 2 else 0
            draw.line((0, y, 31, y), fill=(43, 46, 43, 255))
            for x in range(offset, 32, 12):
                draw.line((x, y, x, min(31, y + 7)), fill=(45, 48, 44, 255))
        hub.alpha_composite(tile, (index * 32, 0))

        dark = Image.new("RGBA", (32, 32), (30 + index * 2, 27 + index, 25 + index, 255))
        dark_draw = ImageDraw.Draw(dark)
        for x, y in ((5, 6), (17, 9), (26, 22), (10, 27)):
            dark_draw.rectangle((x, y, x + 2, y + 1), fill=(72, 44, 28, 255))
        if index == 3:
            dark_draw.line((0, 16, 31, 16), fill=(112, 56, 24, 255), width=1)
        spider.alpha_composite(dark, (index * 32, 0))
    save(hub, ROOT / "assets/tilesets/ashvale-hub.png")
    save(spider, ROOT / "assets/tilesets/spider-hollow.png")


if __name__ == "__main__":
    process_hub()
    process_spider()
    build_tilesets()
    print("New location assets processed with nearest-neighbour sampling.")
