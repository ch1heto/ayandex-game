"""Assemble approved Warrior/Archer art into exact 64x64 production sheets.

Generated chroma-key images are only art-direction intermediates. This script
consumes their alpha-cleaned variants, snaps every output pixel to binary alpha,
anchors feet at (32, 60), and writes exact integer-grid production sources.
"""

from __future__ import annotations

from pathlib import Path
from collections import deque
from statistics import median

from PIL import Image

from asset_alpha import despill_transparent_edges, normalize_transparent_rgb


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "assets" / "characters" / "classes" / "source"
RUNTIME_ROOT = PROJECT_ROOT / "assets" / "characters" / "classes"
PRODUCTION_ROOT = SOURCE_ROOT / "production"
BASE_ROOT = SOURCE_ROOT / "base"

FRAME_SIZE = 64
ROOT_X = 32
BASELINE_Y = 60
DIRECTIONS = ("down", "left", "up", "right")


def binary_alpha(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    alpha = result.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    result.putalpha(alpha)
    return normalize_transparent_rgb(result)


def connected_components(image: Image.Image) -> list[list[tuple[int, int]]]:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y] == 0 or (x, y) in visited:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for neighbour in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    next_x, next_y = neighbour
                    if not (0 <= next_x < image.width and 0 <= next_y < image.height):
                        continue
                    if neighbour in visited or pixels[next_x, next_y] == 0:
                        continue
                    visited.add(neighbour)
                    queue.append(neighbour)
            components.append(component)
    return components


def component_bounds(component: list[tuple[int, int]]) -> tuple[int, int, int, int]:
    return (
        min(x for x, _ in component),
        min(y for _, y in component),
        max(x for x, _ in component) + 1,
        max(y for _, y in component) + 1,
    )


def bounds_gap(first: tuple[int, int, int, int], second: tuple[int, int, int, int]) -> int:
    horizontal = max(0, first[0] - second[2], second[0] - first[2])
    vertical = max(0, first[1] - second[3], second[1] - first[3])
    return max(horizontal, vertical)


def clean_source_components(image: Image.Image) -> Image.Image:
    """Drop only distant neighbour-cell contamination from generated grids."""
    source = binary_alpha(image)
    components = connected_components(source)
    if not components:
        raise ValueError("Empty sprite source cell")
    primary = max(components, key=len)
    primary_bounds = component_bounds(primary)
    minimum_large_area = max(64, round(len(primary) * 0.05))
    keep = [
        component
        for component in components
        if component is primary
        or bounds_gap(component_bounds(component), primary_bounds) <= 16
        or len(component) >= minimum_large_area
    ]
    mask = Image.new("L", source.size, 0)
    mask_pixels = mask.load()
    for component in keep:
        for x, y in component:
            mask_pixels[x, y] = 255
    source.putalpha(mask)
    return source


def exact_grid_cells(image: Image.Image, columns: int, rows: int) -> list[list[Image.Image]]:
    """Pad an intermediate to an integer grid before taking exact cell crops."""
    pad_width = (-image.width) % columns
    pad_height = (-image.height) % rows
    padded = Image.new("RGBA", (image.width + pad_width, image.height + pad_height), (0, 0, 0, 0))
    padded.alpha_composite(image.convert("RGBA"), (0, 0))
    cell_width = padded.width // columns
    cell_height = padded.height // rows
    return [
        [
            padded.crop(
                (
                    column * cell_width,
                    row * cell_height,
                    (column + 1) * cell_width,
                    (row + 1) * cell_height,
                )
            )
            for column in range(columns)
        ]
        for row in range(rows)
    ]


def opaque_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Empty sprite source cell")
    return bounds


def canonical_scale(cells: list[list[Image.Image]], target_height: int) -> float:
    heights = [opaque_bounds(cell)[3] - opaque_bounds(cell)[1] for row in cells for cell in row]
    return target_height / float(median(heights))


def normalize(cell: Image.Image, scale: float) -> Image.Image:
    source = clean_source_components(cell)
    left, top, right, bottom = opaque_bounds(source)
    cropped = source.crop((left, top, right, bottom))
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.NEAREST,
    )
    resized = binary_alpha(resized)

    alpha = resized.getchannel("A")
    pixels = alpha.load()
    foot_band_top = max(0, resized.height - max(4, round(resized.height * 0.16)))
    foot_x = [
        x
        for y in range(foot_band_top, resized.height)
        for x in range(resized.width)
        if pixels[x, y] > 0
    ]
    local_root = median(foot_x) if foot_x else resized.width / 2

    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    destination_x = round(ROOT_X - local_root)
    destination_y = BASELINE_Y - resized.height + 1
    frame.alpha_composite(resized, (destination_x, destination_y))
    return binary_alpha(frame)


def split_runtime_sheet(character: str, state: str, columns: int) -> list[list[Image.Image]]:
    sheet = Image.open(RUNTIME_ROOT / character / f"{state}.png").convert("RGBA")
    expected = (FRAME_SIZE * columns, FRAME_SIZE * len(DIRECTIONS))
    if sheet.size != expected:
        raise ValueError(f"Unexpected {character} {state} size: {sheet.size}; expected {expected}")
    return [
        [
            sheet.crop(
                (
                    column * FRAME_SIZE,
                    row * FRAME_SIZE,
                    (column + 1) * FRAME_SIZE,
                    (row + 1) * FRAME_SIZE,
                )
            )
            for column in range(columns)
        ]
        for row in range(len(DIRECTIONS))
    ]


def save_production_sheet(character: str, state: str, frames: list[list[Image.Image]]) -> None:
    columns = len(frames[0])
    sheet = Image.new("RGBA", (FRAME_SIZE * columns, FRAME_SIZE * len(DIRECTIONS)), (0, 0, 0, 0))
    for row in range(len(DIRECTIONS)):
        if len(frames[row]) != columns:
            raise ValueError(f"Ragged frame grid for {character} {state}")
        for column, frame in enumerate(frames[row]):
            if frame.size != (FRAME_SIZE, FRAME_SIZE):
                raise ValueError(f"Non-64x64 frame for {character} {state} r{row} c{column}")
            sheet.alpha_composite(binary_alpha(frame), (column * FRAME_SIZE, row * FRAME_SIZE))

    output_root = PRODUCTION_ROOT / character
    output_root.mkdir(parents=True, exist_ok=True)
    sheet.save(output_root / f"{state}.png", optimize=True)


def paste_patch(reference: Image.Image, target: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Replace one exact pixel rectangle without resampling either frame."""
    result = target.copy().convert("RGBA")
    clear = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    result.paste(clear, (box[0], box[1]))
    result.alpha_composite(reference.crop(box), (box[0], box[1]))
    return binary_alpha(result)


def remove_tiny_final_islands(image: Image.Image, maximum_area: int = 8) -> Image.Image:
    result = image.copy().convert("RGBA")
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    for component in connected_components(result):
        if len(component) > maximum_area:
            continue
        for x, y in component:
            alpha_pixels[x, y] = 0
    result.putalpha(alpha)
    return binary_alpha(result)


def stabilize_lower_body(
    image: Image.Image,
    body_box: tuple[int, int, int, int],
    maximum_shift: int = 4,
) -> Image.Image:
    """Rigidly align the foot plant without ever separating body parts.

    Root detection is deliberately restricted to the central lower body so a
    long sword or bow cannot pull registration toward the weapon silhouette.
    The whole connected pose moves together; ``body_box`` remains in the
    signature to document the reviewed lower-body region at each call site.
    """
    source = binary_alpha(image)
    alpha = source.getchannel("A")
    pixels = alpha.load()
    central_x = range(16, 49)
    lower_pixels = [(x, y) for y in range(40, FRAME_SIZE) for x in central_x if pixels[x, y] > 0]
    if not lower_pixels:
        raise ValueError("Cannot stabilize a frame without central lower-body pixels")
    baseline = max(y for _, y in lower_pixels)
    foot_x = [x for x, y in lower_pixels if max(40, baseline - 10) <= y <= baseline]
    local_root = round(median(foot_x))
    offset_x = ROOT_X - local_root
    offset_y = BASELINE_Y - baseline
    if abs(offset_x) > maximum_shift or abs(offset_y) > maximum_shift:
        raise ValueError(
            f"Unsafe lower-body registration shift ({offset_x}, {offset_y}); maximum is {maximum_shift}"
        )
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Cannot stabilize an empty frame")
    shifted_bounds = (
        bounds[0] + offset_x,
        bounds[1] + offset_y,
        bounds[2] + offset_x,
        bounds[3] + offset_y,
    )
    if shifted_bounds[0] < 0 or shifted_bounds[1] < 0 or shifted_bounds[2] > FRAME_SIZE or shifted_bounds[3] > FRAME_SIZE:
        raise ValueError(f"Rigid registration would clip the pose: {shifted_bounds}")
    result = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    result.alpha_composite(source, (offset_x, offset_y))
    return binary_alpha(result)


def assemble_archer() -> None:
    idle = exact_grid_cells(Image.open(BASE_ROOT / "archer" / "idle.png"), 1, 4)
    walk = exact_grid_cells(Image.open(BASE_ROOT / "archer" / "walk.png"), 4, 4)
    attack = exact_grid_cells(Image.open(BASE_ROOT / "archer" / "attack.png"), 4, 4)
    canonical_cells = exact_grid_cells(
        Image.open(SOURCE_ROOT / "archer-canonical-2x2-alpha.png"), 2, 2
    )
    walk_cells = exact_grid_cells(Image.open(SOURCE_ROOT / "archer-walk-4x4-alpha.png"), 4, 4)
    attack_cells = exact_grid_cells(Image.open(SOURCE_ROOT / "archer-attack-4x4-alpha.png"), 4, 4)
    idle_scale = canonical_scale(canonical_cells, target_height=51)
    walk_scale = canonical_scale(walk_cells, target_height=51)
    attack_scale = canonical_scale(attack_cells, target_height=51)

    # Canonical direction order is down, left, up, right in reading order.
    idle_sources = [canonical_cells[0][0], canonical_cells[0][1], canonical_cells[1][0], canonical_cells[1][1]]
    # The exact approved base keeps identity and equipment placement stable.
    # Generated sources remain available for explicit future art revisions but
    # are not re-normalized on every pipeline run.

    # Lock the canonical idle head across animation frames. Boxes are kept
    # central and above the arm line so the bow/draw silhouettes stay authored.
    head_boxes = (
        (21, 9, 44, 28),
        (21, 9, 43, 28),
        (20, 9, 45, 29),
        (22, 9, 43, 28),
    )
    lower_body_boxes = (
        (14, 39, 51, 64),
        (14, 40, 51, 64),
        (14, 40, 51, 64),
        (14, 40, 51, 64),
    )
    for row, box in enumerate(lower_body_boxes):
        walk[row] = [canonical_walk_frame(idle[row][0], frame, box) for frame in walk[row]]
    walk = [[stabilize_lower_body(frame, (14, 40, 51, 64)) for frame in row] for row in walk]
    attack = [[stabilize_lower_body(frame, (12, 40, 57, 64)) for frame in row] for row in attack]
    for row, box in enumerate(head_boxes):
        walk[row] = [paste_patch(idle[row][0], frame, box) for frame in walk[row]]
        attack[row] = [paste_patch(idle[row][0], frame, box) for frame in attack[row]]
    walk = [[remove_tiny_final_islands(frame) for frame in row] for row in walk]
    attack = [[remove_tiny_final_islands(frame) for frame in row] for row in attack]
    save_production_sheet("archer", "idle", idle)
    save_production_sheet("archer", "walk", walk)
    save_production_sheet("archer", "attack", attack)


def canonical_walk_frame(
    canonical: Image.Image,
    authored: Image.Image,
    box: tuple[int, int, int, int],
) -> Image.Image:
    """Keep the approved body fixed and copy only the authored lower-body pose."""
    result = canonical.copy().convert("RGBA")
    clear = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    result.paste(clear, (box[0], box[1]))
    result.alpha_composite(authored.crop(box), (box[0], box[1]))
    return binary_alpha(result)


def neutralize_warrior_purple_spill(image: Image.Image) -> Image.Image:
    """Restore silver pixels where the old magenta board tinted Warrior metal."""
    result = normalize_transparent_rgb(image)
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            # Warrior's approved palette contains navy and neutral silver, not
            # red/blue-dominant violet. Requiring both channels above green
            # avoids the blue hair, cape and armour cloth.
            if red >= 55 and blue >= 55 and min(red, blue) - green >= 10:
                neutral = round((red + green + blue) / 3)
                pixels[x, y] = (neutral, neutral, min(255, neutral + 4), alpha)
    return normalize_transparent_rgb(result)


def shift_inside_frame(image: Image.Image, offset_x: int) -> Image.Image:
    """Move a pose minimally inside its fixed 64x64 cell to avoid clipping."""
    result = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    result.alpha_composite(image.convert("RGBA"), (offset_x, 0))
    return binary_alpha(result)


def assemble_warrior() -> None:
    idle = exact_grid_cells(Image.open(BASE_ROOT / "warrior" / "idle.png"), 1, 4)
    attack = exact_grid_cells(Image.open(BASE_ROOT / "warrior" / "attack.png"), 4, 4)
    # The legacy second attack phase contains a baked white swoosh detached
    # from the physical blade. Use the clean authored impact pose as the swing
    # hold so the visible weapon itself carries the motion.
    for row in attack:
        row[1] = row[2].copy()
    authored_cells = exact_grid_cells(Image.open(SOURCE_ROOT / "warrior-walk-4x4-alpha.png"), 4, 4)
    face_cells = exact_grid_cells(Image.open(SOURCE_ROOT / "warrior-face-reference-alpha.png"), 2, 2)

    current_heights = [opaque_bounds(frame)[3] - opaque_bounds(frame)[1] for row in idle for frame in row]
    authored_heights = [opaque_bounds(cell)[3] - opaque_bounds(cell)[1] for row in authored_cells for cell in row]
    scale = float(median(current_heights)) / float(median(authored_heights))
    authored_walk = [[normalize(cell, scale) for cell in row] for row in authored_cells]

    face_scale = canonical_scale(face_cells, target_height=round(median(current_heights)))
    face_sources = [face_cells[0][0], face_cells[0][1], face_cells[1][0], face_cells[1][1]]
    face_reference = [[normalize(face_sources[row], face_scale)] for row in range(4)]

    # Polish only the visible face pixels in the approved down/left idle poses.
    idle[0][0] = paste_patch(face_reference[0][0], idle[0][0], (25, 18, 42, 32))
    idle[1][0] = paste_patch(face_reference[1][0], idle[1][0], (24, 18, 38, 31))

    result_walk: list[list[Image.Image]] = []
    for row in range(4):
        lower_body_box = (14, 43, 51, 64)
        result_walk.append([
            canonical_walk_frame(idle[row][0], authored_walk[row][column], lower_body_box)
            for column in range(4)
        ])

    warrior_head_boxes = (
        (21, 12, 44, 32),
        (22, 12, 42, 31),
        (20, 12, 44, 31),
        (20, 12, 44, 32),
    )
    result_walk = [[stabilize_lower_body(frame, (12, 42, 53, 64)) for frame in row] for row in result_walk]
    for row, box in enumerate(warrior_head_boxes):
        result_walk[row] = [paste_patch(idle[row][0], frame, box) for frame in result_walk[row]]

    attack_head_boxes = (
        (20, 10, 45, 32),
        (20, 10, 44, 32),
        (19, 10, 45, 32),
        (20, 10, 44, 32),
    )
    # Attack masters used a weapon-weighted registration estimate. Re-anchor
    # only boots/lower cloth so the canonical head, torso and sword arc retain
    # their authored locations while every planted foot resolves to (32, 60).
    attack = [[stabilize_lower_body(frame, (12, 42, 53, 64)) for frame in row] for row in attack]
    attack[0][1] = shift_inside_frame(attack[0][1], -1)
    attack[0][2] = shift_inside_frame(attack[0][2], -1)
    attack[3][1] = shift_inside_frame(attack[3][1], -1)
    attack[3][2] = shift_inside_frame(attack[3][2], -1)
    for row, box in enumerate(attack_head_boxes):
        attack[row] = [paste_patch(idle[row][0], frame, box) for frame in attack[row]]

    idle = [[neutralize_warrior_purple_spill(despill_transparent_edges(frame, (255, 0, 255))) for frame in row] for row in idle]
    result_walk = [[
        neutralize_warrior_purple_spill(
            despill_transparent_edges(remove_tiny_final_islands(frame), (255, 0, 255))
        )
        for frame in row
    ] for row in result_walk]
    attack = [[
        neutralize_warrior_purple_spill(
            despill_transparent_edges(remove_tiny_final_islands(frame), (255, 0, 255))
        )
        for frame in row
    ] for row in attack]

    save_production_sheet("warrior", "idle", idle)
    save_production_sheet("warrior", "walk", result_walk)
    save_production_sheet("warrior", "attack", attack)
    save_production_sheet("warrior", "face-reference", face_reference)


def main() -> None:
    assemble_warrior()
    assemble_archer()
    print(f"Wrote exact production sheets under {PRODUCTION_ROOT}")


if __name__ == "__main__":
    main()
