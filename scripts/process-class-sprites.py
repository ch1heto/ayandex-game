"""Technical sprite-sheet normalization for approved class sources.

Exact 64x64 production sheets are copied without resampling. Legacy 4x9 masters
remain supported for Mage and backward compatibility. Selective class processing
prevents an art-only Warrior/Archer pass from rewriting locked Mage assets.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "assets" / "characters" / "classes" / "source"
OUTPUT_ROOT = PROJECT_ROOT / "assets" / "characters" / "classes"
PROJECTILE_OUTPUT_ROOT = PROJECT_ROOT / "assets" / "projectiles"

FRAME_SIZE = 64
ROOT_X = 32
BASELINE_Y = 60
SOURCE_SCALE = 0.32
ROWS = ("down", "left", "up", "right")
CHARACTERS = ("warrior", "archer", "mage")
STATE_COLUMNS = {
    "idle": (0,),
    "walk": (1, 2, 3, 4),
    "attack": (5, 6, 7, 8),
}
MIN_COMPONENT_AREA = 18
MIN_FINAL_COMPONENT_AREA = 8


def connected_components(alpha: Image.Image) -> list[list[tuple[int, int]]]:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] == 0:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if next_x < 0 or next_x >= width or next_y < 0 or next_y >= height:
                        continue
                    next_index = next_y * width + next_x
                    if visited[next_index] or pixels[next_x, next_y] == 0:
                        continue
                    visited[next_index] = 1
                    queue.append((next_x, next_y))
            components.append(component)

    return components


def remove_tiny_islands(frame: Image.Image) -> Image.Image:
    cleaned = frame.copy()
    alpha = cleaned.getchannel("A")
    alpha_pixels = alpha.load()
    for component in connected_components(alpha):
        if len(component) >= MIN_COMPONENT_AREA:
            continue
        for x, y in component:
            alpha_pixels[x, y] = 0
    cleaned.putalpha(alpha)
    return cleaned


def remove_tiny_final_islands(frame: Image.Image) -> Image.Image:
    cleaned = frame.copy()
    alpha = cleaned.getchannel("A")
    alpha_pixels = alpha.load()
    for component in connected_components(alpha):
        if len(component) >= MIN_FINAL_COMPONENT_AREA:
            continue
        for x, y in component:
            alpha_pixels[x, y] = 0
    cleaned.putalpha(alpha)
    return cleaned


def remove_key_fringe(master: Image.Image, character: str) -> Image.Image:
    """Remove only strongly key-colored opaque edge pixels left by image synthesis."""
    cleaned = master.copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            is_magenta_key = character in ("warrior", "archer") and red > 110 and blue > 90 and red > green + 35 and blue > green + 30
            is_green_key = character == "mage" and green > 100 and green > red + 40 and green > blue + 40
            if is_magenta_key or is_green_key:
                pixels[x, y] = (red, green, blue, 0)
    return cleaned


def detect_baseline(alpha: Image.Image) -> int:
    width, height = alpha.size
    pixels = alpha.load()
    minimum_coverage = max(10, round(width * 0.055))
    for y in range(height - 1, -1, -1):
        if sum(1 for x in range(width) if pixels[x, y] > 0) >= minimum_coverage:
            return y
    raise ValueError("Frame has no usable baseline")


def detect_root_x(alpha: Image.Image, baseline: int) -> float:
    width, _ = alpha.size
    pixels = alpha.load()
    foot_pixels: list[int] = []
    for y in range(max(0, baseline - 28), min(alpha.height, baseline + 2)):
        for x in range(width):
            if pixels[x, y] > 0:
                foot_pixels.append(x)
    if not foot_pixels:
        return width / 2
    foot_pixels.sort()
    return float(foot_pixels[len(foot_pixels) // 2])


def primary_component_alpha(alpha: Image.Image) -> Image.Image:
    components = connected_components(alpha)
    if not components:
        raise ValueError("Frame has no primary component")
    primary = max(components, key=len)
    mask = Image.new("L", alpha.size, 0)
    pixels = mask.load()
    for x, y in primary:
        pixels[x, y] = 255
    return mask


def normalize_cell(cell: Image.Image) -> Image.Image:
    cleaned = remove_tiny_islands(cell)
    alpha = cleaned.getchannel("A")
    if alpha.getbbox() is None:
        raise ValueError("Empty authored cell")

    root_alpha = primary_component_alpha(alpha)
    baseline = detect_baseline(root_alpha)
    root_x = detect_root_x(root_alpha, baseline)
    scaled_size = (
        max(1, round(cleaned.width * SOURCE_SCALE)),
        max(1, round(cleaned.height * SOURCE_SCALE)),
    )
    scaled = cleaned.resize(scaled_size, Image.Resampling.NEAREST)
    destination_x = round(ROOT_X - root_x * SOURCE_SCALE)
    destination_y = round(BASELINE_Y - baseline * SOURCE_SCALE)

    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(scaled, (destination_x, destination_y))
    return remove_tiny_final_islands(frame)


def extract_cell(master: Image.Image, row: int, column: int) -> Image.Image:
    left = round(column * master.width / 9)
    right = round((column + 1) * master.width / 9)
    top = round(row * master.height / 4)
    bottom = round((row + 1) * master.height / 4)
    return master.crop((left, top, right, bottom))


def save_if_pixels_changed(image: Image.Image, path: Path) -> None:
    """Avoid rewriting a locked asset when decoded RGBA pixels are unchanged."""
    if path.exists():
        current = Image.open(path).convert("RGBA")
        expected = image.convert("RGBA")
        if current.size == expected.size and visible_rgba_bytes(current) == visible_rgba_bytes(expected):
            return
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def visible_rgba_bytes(image: Image.Image) -> bytes:
    """Normalize irrelevant RGB data beneath alpha=0 before comparisons."""
    normalized = image.convert("RGBA").copy()
    pixels = normalized.load()
    for y in range(normalized.height):
        for x in range(normalized.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return normalized.tobytes()


def save_sheet(character: str, state: str, frames_by_row: list[list[Image.Image]]) -> None:
    columns = len(frames_by_row[0])
    sheet = Image.new("RGBA", (FRAME_SIZE * columns, FRAME_SIZE * len(ROWS)), (0, 0, 0, 0))
    frames_root = OUTPUT_ROOT / character / "frames" / state
    for row, direction in enumerate(ROWS):
        direction_root = frames_root / direction
        direction_root.mkdir(parents=True, exist_ok=True)
        for column, frame in enumerate(frames_by_row[row]):
            sheet.alpha_composite(frame, (column * FRAME_SIZE, row * FRAME_SIZE))
            save_if_pixels_changed(frame, direction_root / f"frame-{column:02d}.png")

    output_dir = OUTPUT_ROOT / character
    output_dir.mkdir(parents=True, exist_ok=True)
    save_if_pixels_changed(sheet, output_dir / f"{state}.png")


def process_exact_character(character: str, production_root: Path) -> None:
    for state, columns in STATE_COLUMNS.items():
        source_path = production_root / f"{state}.png"
        sheet = Image.open(source_path).convert("RGBA")
        expected_size = (FRAME_SIZE * len(columns), FRAME_SIZE * len(ROWS))
        if sheet.size != expected_size:
            raise ValueError(f"Unexpected exact {character} {state} size: {sheet.size}; expected {expected_size}")
        alpha_histogram = sheet.getchannel("A").histogram()
        non_binary = [value for value, count in enumerate(alpha_histogram) if count and value not in (0, 255)]
        if non_binary:
            raise ValueError(f"Non-binary alpha in exact {character} {state}: {non_binary}")
        frames_by_row = [
            [
                sheet.crop(
                    (
                        column * FRAME_SIZE,
                        row * FRAME_SIZE,
                        (column + 1) * FRAME_SIZE,
                        (row + 1) * FRAME_SIZE,
                    )
                )
                for column in range(len(columns))
            ]
            for row in range(len(ROWS))
        ]
        save_sheet(character, state, frames_by_row)


def process_character(character: str) -> None:
    production_root = SOURCE_ROOT / "production" / character
    if all((production_root / f"{state}.png").is_file() for state in STATE_COLUMNS):
        process_exact_character(character, production_root)
        return

    master_path = SOURCE_ROOT / f"{character}-master-alpha.png"
    master = remove_key_fringe(Image.open(master_path).convert("RGBA"), character)
    if master.size != (1536, 1024):
        raise ValueError(f"Unexpected {character} master size: {master.size}")

    for state, columns in STATE_COLUMNS.items():
        frames_by_row = [
            [normalize_cell(extract_cell(master, row, column)) for column in columns]
            for row in range(len(ROWS))
        ]
        save_sheet(character, state, frames_by_row)


def save_projectile(source: Image.Image, name: str, canvas_size: tuple[int, int], visual_width: int) -> None:
    cleaned = remove_tiny_islands(source)
    bounds = cleaned.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"Empty projectile source: {name}")
    cropped = cleaned.crop(bounds)
    visual_height = max(1, round(cropped.height * visual_width / cropped.width))
    resized = cropped.resize((visual_width, visual_height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((canvas_size[0] - visual_width) // 2, (canvas_size[1] - visual_height) // 2),
    )
    PROJECTILE_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    canvas.save(PROJECTILE_OUTPUT_ROOT / f"{name}.png", optimize=True)


def process_projectiles() -> None:
    master = Image.open(SOURCE_ROOT / "projectiles-master-alpha.png").convert("RGBA")
    midpoint = master.width // 2
    save_projectile(master.crop((0, 0, midpoint, master.height)), "arrow", (24, 12), 22)
    save_projectile(master.crop((midpoint, 0, master.width, master.height)), "magic-bolt", (16, 12), 14)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--classes",
        nargs="+",
        choices=CHARACTERS,
        help="Process only the listed classes; projectiles are left untouched.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selected = tuple(args.classes) if args.classes else CHARACTERS
    for character in selected:
        process_character(character)
        print(f"Processed {character}")
    if args.classes is None:
        process_projectiles()
        print("Processed projectiles")


if __name__ == "__main__":
    main()
