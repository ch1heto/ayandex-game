"""Build deterministic Warrior-only cutout assets from the approved idle references.

The stable head/torso always comes from the same idle frame.  Only semantic lower
leg and weapon-arm masks are separated; no rectangular head/body compositing and
no generated full-body frames are used.
"""

from __future__ import annotations

from pathlib import Path
from collections import Counter

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/classes/warrior/frames/idle"
ATTACK_SOURCE = ROOT / "assets/characters/classes/warrior/frames/attack"
OUTPUT = ROOT / "assets/characters/classes/warrior/procedural"
DIRECTIONS = ("down", "left", "up", "right")
FRAME_SIZE = 64

TRANSPARENT = (0, 0, 0, 0)
# Polygons follow the weapon arm rather than cutting a rectangular body patch.
WEAPON_MASKS: dict[str, tuple[tuple[tuple[int, int], ...], ...]] = {
    "down": (
        ((18, 36), (31, 36), (32, 48), (26, 51), (18, 48)),
        ((17, 47), (28, 44), (28, 52), (23, 61), (17, 61)),
    ),
    "left": (
        ((32, 37), (44, 37), (45, 48), (39, 51), (32, 48)),
        ((17, 53), (35, 42), (42, 43), (42, 50), (25, 61), (17, 61)),
    ),
    "up": (
        ((37, 35), (45, 35), (46, 49), (39, 51), (37, 46)),
        ((39, 43), (45, 43), (46, 61), (39, 61)),
    ),
    "right": (
        ((29, 36), (42, 36), (43, 49), (36, 51), (29, 47)),
        ((31, 43), (39, 42), (47, 52), (47, 61), (40, 61), (30, 49)),
    ),
}

# Existing attack art is used only as a source for the semantic weapon limb.  The
# head, torso, hips and legs from those full-body frames never enter the runtime
# composite. Phase 2 uses the authored follow-through pose instead of repeating
# the impact frame.
ATTACK_WEAPON_MASKS: dict[str, dict[int, tuple[tuple[int, int], ...]]] = {
    "down": {
        0: ((4, 7), (18, 7), (18, 30), (33, 32), (34, 44), (22, 44), (14, 39), (4, 39)),
        1: ((14, 28), (32, 29), (38, 33), (63, 33), (63, 47), (36, 47), (27, 42), (14, 39)),
        3: ((20, 27), (43, 27), (58, 43), (58, 63), (39, 63), (32, 49), (20, 44)),
    },
    "left": {
        0: ((28, 28), (36, 27), (38, 12), (47, 12), (47, 45), (34, 45), (28, 39)),
        1: ((4, 30), (35, 30), (47, 34), (47, 46), (29, 46), (24, 43), (4, 43)),
        3: ((5, 29), (43, 29), (44, 63), (19, 63), (19, 50), (5, 45)),
    },
    "up": {
        0: ((31, 28), (37, 27), (37, 7), (48, 7), (48, 47), (34, 47), (31, 41)),
        1: ((31, 28), (41, 28), (63, 15), (63, 29), (47, 42), (39, 47), (31, 43)),
        3: ((32, 29), (48, 29), (51, 63), (35, 63), (35, 48), (32, 43)),
    },
    "right": {
        0: ((16, 12), (26, 12), (27, 28), (35, 29), (35, 40), (29, 45), (16, 45)),
        1: ((17, 34), (29, 30), (60, 30), (60, 43), (40, 43), (35, 46), (17, 46)),
        3: ((28, 28), (60, 28), (60, 63), (39, 63), (35, 49), (28, 44)),
    },
}

# Legs start behind a retained three-pixel hip overlap, so the cutout seam stays
# covered during the one-pixel upper-body bob.
LEG_MASKS: dict[str, tuple[tuple[int, int, int, int], tuple[int, int, int, int]]] = {
    "down": ((26, 47, 36, 63), (35, 47, 46, 63)),
    "left": ((27, 48, 35, 63), (34, 48, 44, 63)),
    "up": ((20, 48, 34, 63), (33, 48, 45, 63)),
    "right": ((23, 48, 35, 63), (34, 48, 46, 63)),
}


def copy_masked(source: Image.Image, mask: Image.Image) -> Image.Image:
    result = Image.new("RGBA", source.size, TRANSPARENT)
    result.paste(source, (0, 0), mask)
    return result


def subtract_mask(source: Image.Image, mask: Image.Image) -> Image.Image:
    result = source.copy()
    alpha = result.getchannel("A")
    alpha_mask = Image.eval(mask, lambda value: 255 - value)
    alpha = Image.composite(alpha, Image.new("L", source.size, 0), alpha_mask)
    result.putalpha(alpha)
    return result


def is_magenta_fringe(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and red >= 28 and blue >= 40 and red > green * 1.55 + 5 and blue > green * 1.55 + 5


def remove_magenta_fringe(image: Image.Image) -> Image.Image:
    """Replace edge-contaminated purple pixels with adjacent authored colors."""
    result = image.copy()
    source_pixels = image.load()
    result_pixels = result.load()
    contaminated = [
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if is_magenta_fringe(source_pixels[x, y])
    ]
    for x, y in contaminated:
        neighbours: list[tuple[int, int, int, int]] = []
        for radius in (1, 2):
            for ny in range(max(0, y - radius), min(image.height, y + radius + 1)):
                for nx in range(max(0, x - radius), min(image.width, x + radius + 1)):
                    candidate = source_pixels[nx, ny]
                    if candidate[3] == 255 and not is_magenta_fringe(candidate):
                        neighbours.append(candidate)
            if neighbours:
                break
        result_pixels[x, y] = Counter(neighbours).most_common(1)[0][0] if neighbours else TRANSPARENT
    return result


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    body_sheet = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE * 4), TRANSPARENT)
    far_leg_sheet = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE * 4), TRANSPARENT)
    near_leg_sheet = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE * 4), TRANSPARENT)
    weapon_sheet = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * 4), TRANSPARENT)

    for row, direction in enumerate(DIRECTIONS):
        source = Image.open(SOURCE / direction / "frame-00.png").convert("RGBA")
        weapon_mask = Image.new("L", source.size, 0)
        weapon_mask_draw = ImageDraw.Draw(weapon_mask)
        for polygon in WEAPON_MASKS[direction]:
            weapon_mask_draw.polygon(polygon, fill=255)

        far_mask = Image.new("L", source.size, 0)
        near_mask = Image.new("L", source.size, 0)
        ImageDraw.Draw(far_mask).rectangle(LEG_MASKS[direction][0], fill=255)
        ImageDraw.Draw(near_mask).rectangle(LEG_MASKS[direction][1], fill=255)

        # Keep three overlap rows in the body; only y >= 50 is subtracted.
        lower_cut = Image.new("L", source.size, 0)
        lower_cut_draw = ImageDraw.Draw(lower_cut)
        far_box, near_box = LEG_MASKS[direction]
        lower_cut_draw.rectangle((far_box[0], max(50, far_box[1]), far_box[2], far_box[3]), fill=255)
        lower_cut_draw.rectangle((near_box[0], max(50, near_box[1]), near_box[2], near_box[3]), fill=255)

        body = subtract_mask(subtract_mask(source, weapon_mask), lower_cut)
        far_leg = copy_masked(source, far_mask)
        near_leg = copy_masked(source, near_mask)
        idle_weapon = copy_masked(source, weapon_mask)

        body_sheet.alpha_composite(body, (0, row * FRAME_SIZE))
        far_leg_sheet.alpha_composite(far_leg, (0, row * FRAME_SIZE))
        near_leg_sheet.alpha_composite(near_leg, (0, row * FRAME_SIZE))
        weapon_sheet.alpha_composite(idle_weapon, (3 * FRAME_SIZE, row * FRAME_SIZE))

        source_phases = (3, 1, 0) if direction == "up" else (0, 1, 3)
        for phase, source_phase in enumerate(source_phases):
            attack_source = Image.open(ATTACK_SOURCE / direction / f"frame-{source_phase:02d}.png").convert("RGBA")
            attack_mask = Image.new("L", attack_source.size, 0)
            ImageDraw.Draw(attack_mask).polygon(ATTACK_WEAPON_MASKS[direction][source_phase], fill=255)
            weapon = copy_masked(attack_source, attack_mask)
            weapon_sheet.alpha_composite(weapon, (phase * FRAME_SIZE, row * FRAME_SIZE))

    outputs = {
        "body.png": body_sheet,
        "leg-far.png": far_leg_sheet,
        "leg-near.png": near_leg_sheet,
        "weapon-arm.png": weapon_sheet,
    }
    weapon_pixels = weapon_sheet.load()
    for row in range(4):
        for y in range(row * FRAME_SIZE + 60, row * FRAME_SIZE + FRAME_SIZE):
            for x in range(weapon_sheet.width):
                weapon_pixels[x, y] = TRANSPARENT
    for name, image in outputs.items():
        # Enforce the runtime contract: transparent pixels carry no RGB and every
        # visible pixel is fully opaque.
        cleaned = Image.new("RGBA", image.size, TRANSPARENT)
        cleaned.alpha_composite(remove_magenta_fringe(image))
        pixels = cleaned.load()
        for y in range(cleaned.height):
            for x in range(cleaned.width):
                red, green, blue, alpha = pixels[x, y]
                pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
        cleaned.save(OUTPUT / name, optimize=False)
        print(OUTPUT / name)


if __name__ == "__main__":
    build()
