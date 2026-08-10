from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "vertical-slice"
FOREST_OUT = ROOT / "assets" / "environments" / "twilight-glade"
SLIME_OUT = ROOT / "assets" / "enemies" / "moss-slime"
UI_OUT = ROOT / "assets" / "ui" / "hud"
ITEM_OUT = ROOT / "assets" / "items"
TILESET_OUT = ROOT / "assets" / "tilesets"

RESAMPLE = Image.Resampling.NEAREST


def keyed(path: Path, key: tuple[int, int, int]) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            distance = abs(red - key[0]) + abs(green - key[1]) + abs(blue - key[2])
            # GPT Image keeps the requested background visually flat but may
            # introduce small colour drift around the catalog cells. These
            # broad chroma predicates remove that drift while staying outside
            # the actual forest/slime and gold/red/navy UI palettes.
            is_magenta_key = (
                key == (255, 0, 255)
                and red > 145
                and blue > 90
                and green < 125
                and red > green * 1.45
                and blue > green * 1.15
            )
            is_green_key = (
                key == (0, 255, 0)
                and green > 135
                and green > red * 1.22
                and green > blue * 1.22
            )
            alpha = 0 if distance < 92 or is_magenta_key or is_green_key else 255
            pixels[x, y] = (0, 0, 0, 0) if alpha == 0 else (red, green, blue, 255)
    return image


def content_crop(image: Image.Image, rect: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(rect)
    bbox = crop.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"No opaque pixels in crop {rect}")
    return crop.crop(bbox)


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    source = alpha.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for y in range(image.height):
        for x in range(image.width):
            if source[x, y] == 0 or (x, y) in visited:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for offset_y in (-1, 0, 1):
                    for offset_x in (-1, 0, 1):
                        neighbour = (current_x + offset_x, current_y + offset_y)
                        if (
                            neighbour in visited
                            or not 0 <= neighbour[0] < image.width
                            or not 0 <= neighbour[1] < image.height
                            or source[neighbour[0], neighbour[1]] == 0
                        ):
                            continue
                        visited.add(neighbour)
                        queue.append(neighbour)
            components.append(component)
    if not components:
        return image
    largest = max(components, key=len)
    mask = Image.new("L", image.size, 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = 255
    cleaned = image.copy()
    cleaned.putalpha(mask)
    return cleaned.crop(mask.getbbox())


def fit_nearest(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / image.width, height / image.height)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(target, RESAMPLE)


def place_on_canvas(
    image: Image.Image,
    size: tuple[int, int],
    baseline: int,
    center_x: int | None = None,
) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    center = size[0] // 2 if center_x is None else center_x
    x = center - image.width // 2
    y = baseline - image.height
    canvas.alpha_composite(image, (x, y))
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def assemble_strip(frames: Iterable[Image.Image]) -> Image.Image:
    frame_list = list(frames)
    width, height = frame_list[0].size
    sheet = Image.new("RGBA", (width * len(frame_list), height), (0, 0, 0, 0))
    for index, frame in enumerate(frame_list):
        sheet.alpha_composite(frame, (index * width, 0))
    return sheet


def process_forest() -> None:
    source = keyed(SOURCE / "twilight-glade-master-chroma.png", (255, 0, 255))

    tile_rects = {
        "grass-1": (66, 66, 304, 304),
        "grass-2": (364, 66, 595, 304),
        "grass-3": (650, 66, 880, 304),
        "grass-4": (948, 66, 1173, 304),
        # Dirt swatches in the source board include a grass border. Cropping
        # the authored center yields a full-bleed tile so adjacent path cells
        # form one continuous trail instead of parallel green seams.
        "dirt-1": (105, 405, 270, 580),
        "dirt-2": (405, 405, 565, 580),
    }
    tiles: list[Image.Image] = []
    for name, rect in tile_rects.items():
        tile = source.crop(rect).convert("RGB").resize((32, 32), RESAMPLE).convert("RGBA")
        save(tile, FOREST_OUT / "tiles" / f"{name}.png")
        tiles.append(tile)

    atlas = Image.new("RGBA", (32 * len(tiles), 32), (0, 0, 0, 0))
    for index, tile in enumerate(tiles):
        atlas.alpha_composite(tile, (index * 32, 0))
    save(atlas, TILESET_OUT / "twilight-glade.png")

    prop_specs = {
        "pond": ((640, 360, 888, 625), (128, 128)),
        "tree-a": ((905, 340, 1235, 705), (128, 144)),
        "tree-b": ((35, 635, 375, 990), (128, 144)),
        "bush-a": ((430, 690, 655, 925), (64, 56)),
        "bush-b": ((690, 690, 910, 925), (64, 56)),
        "rock-a": ((940, 720, 1228, 956), (72, 58)),
        "rock-b": ((50, 990, 378, 1205), (72, 54)),
        "stump": ((430, 995, 690, 1228), (56, 54)),
        "fern": ((748, 1000, 880, 1195), (28, 36)),
        "sprout": ((875, 995, 980, 1115), (24, 26)),
        "flowers-white": ((970, 995, 1100, 1115), (28, 26)),
        "flowers-gold": ((845, 1090, 985, 1228), (28, 28)),
        "flowers-violet": ((985, 1085, 1135, 1228), (28, 28)),
    }
    for name, (rect, target) in prop_specs.items():
        prop = content_crop(source, rect)
        save(fit_nearest(prop, *target), FOREST_OUT / "props" / f"{name}.png")

    leaf = content_crop(source, (895, 1005, 955, 1065))
    save(fit_nearest(leaf, 5, 5), FOREST_OUT / "leaf-particle.png")


def process_slime() -> None:
    source = keyed(SOURCE / "moss-slime-master-chroma.png", (255, 0, 255))
    states = {"idle": 4, "move": 4, "attack": 4, "hurt": 2, "death": 4}
    cell_width = source.width / 4
    cell_height = source.height / 5
    crops: dict[str, list[Image.Image]] = {}

    for row, (state, count) in enumerate(states.items()):
        state_crops: list[Image.Image] = []
        for column in range(count):
            rect = (
                round(column * cell_width),
                round(row * cell_height),
                round((column + 1) * cell_width),
                round((row + 1) * cell_height),
            )
            crop = content_crop(source, rect)
            state_crops.append(crop if state == "death" else keep_largest_component(crop))
        crops[state] = state_crops

    all_frames = [frame for frames in crops.values() for frame in frames]
    global_scale = min(52 / max(frame.width for frame in all_frames), 42 / max(frame.height for frame in all_frames))

    for state, frames in crops.items():
        normalized: list[Image.Image] = []
        for index, frame in enumerate(frames):
            resized = frame.resize(
                (max(1, round(frame.width * global_scale)), max(1, round(frame.height * global_scale))),
                RESAMPLE,
            )
            canvas = place_on_canvas(resized, (64, 64), baseline=58)
            save(canvas, SLIME_OUT / "frames" / state / f"frame-{index:02d}.png")
            normalized.append(canvas)
        save(assemble_strip(normalized), SLIME_OUT / f"{state}.png")


def process_coin_and_hud() -> None:
    source = keyed(SOURCE / "coin-hud-master-chroma.png", (0, 255, 0))
    coin_rects = [
        (150, 130, 475, 470),
        (550, 130, 830, 470),
        (930, 130, 1100, 470),
        (1210, 130, 1505, 470),
    ]
    coin_crops = [content_crop(source, rect) for rect in coin_rects]
    coin_scale = min(14 / max(crop.width for crop in coin_crops), 14 / max(crop.height for crop in coin_crops))
    coin_frames: list[Image.Image] = []
    for index, crop in enumerate(coin_crops):
        resized = crop.resize(
            (max(1, round(crop.width * coin_scale)), max(1, round(crop.height * coin_scale))),
            RESAMPLE,
        )
        canvas = place_on_canvas(resized, (16, 16), baseline=15)
        save(canvas, ITEM_OUT / "coins" / "frames" / f"frame-{index:02d}.png")
        coin_frames.append(canvas)
    save(assemble_strip(coin_frames), ITEM_OUT / "coin.png")

    hud_specs = {
        "heart-full": ((80, 520, 370, 830), (18, 18)),
        "heart-empty": ((390, 520, 670, 830), (18, 18)),
        "health-frame": ((700, 530, 1345, 830), (128, 24)),
        "coin-icon": ((1390, 530, 1645, 830), (18, 18)),
    }
    for name, (rect, target) in hud_specs.items():
        crop = content_crop(source, rect)
        resized = fit_nearest(crop, *target)
        canvas = Image.new("RGBA", target, (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((target[0] - resized.width) // 2, (target[1] - resized.height) // 2))
        save(canvas, UI_OUT / f"{name}.png")


def main() -> None:
    process_forest()
    process_slime()
    process_coin_and_hud()
    print("Vertical-slice assets processed with nearest-neighbour sampling.")


if __name__ == "__main__":
    main()
