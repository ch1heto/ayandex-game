"""Build Archer cutout assets from canonical idle and attack references.

The face, torso, cape and quiver always come from the same idle reference. Only
semantic legs and the bow/arms layer change at runtime.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
IDLE_SOURCE = ROOT / "assets/characters/classes/archer/frames/idle"
ATTACK_SOURCE = ROOT / "assets/characters/classes/archer/frames/attack"
OUTPUT = ROOT / "assets/characters/classes/archer/procedural"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 64
TRANSPARENT = (0, 0, 0, 0)

# Semantic masks remove the low bow and both weapon arms while preserving the
# stable head, torso, cape and quiver.
IDLE_WEAPON_MASKS: dict[str, tuple[tuple[tuple[int, int], ...], ...]] = {
    "down": (
        ((17, 32), (28, 32), (30, 52), (23, 56), (17, 53)),
        ((38, 31), (48, 31), (49, 49), (42, 54), (40, 54), (37, 42)),
    ),
    "left": (
        ((17, 35), (31, 35), (36, 51), (28, 55), (17, 52)),
        ((29, 31), (43, 31), (45, 52), (35, 55), (28, 47)),
    ),
    "up": (
        ((15, 33), (26, 33), (28, 51), (20, 55), (15, 48)),
        ((38, 33), (48, 33), (49, 56), (40, 57), (37, 45)),
    ),
    "right": (
        ((28, 31), (42, 31), (45, 52), (34, 55), (27, 45)),
        ((35, 35), (50, 35), (51, 54), (42, 56), (34, 48)),
    ),
}

LEG_MASKS: dict[str, tuple[tuple[int, int, int, int], tuple[int, int, int, int]]] = {
    "down": ((23, 53, 31, 60), (32, 53, 41, 60)),
    "left": ((20, 53, 30, 60), (31, 53, 40, 60)),
    "up": ((23, 53, 30, 60), (31, 53, 40, 60)),
    # The far boot is hidden by perspective in the source right view. Reuse
    # the clean visible boot for both animated layers; offsets reveal the step.
    "right": ((25, 53, 35, 60), (25, 53, 35, 60)),
}

TORSO_RESTORE: dict[str, tuple[tuple[int, int], ...]] = {
    "down": ((27, 29), (39, 29), (40, 52), (25, 52)),
    "left": ((27, 29), (40, 29), (41, 52), (26, 52)),
    "up": ((26, 28), (39, 28), (40, 52), (24, 52)),
    "right": ((27, 29), (40, 29), (42, 52), (26, 52)),
}

ANTICIPATION_SHIFT = {
    "down": (0, 3),
    "left": (2, 2),
    "up": (0, 3),
    "right": (-2, 2),
}

# Only draw/release phases use attack sources. Broad semantic polygons include
# bow, string, arrow and both hands but exclude the independently stable face,
# cape and quiver.
ATTACK_MASKS: dict[str, tuple[tuple[tuple[int, int], ...], tuple[tuple[int, int], ...]]] = {
    "down": (
        ((13, 27), (27, 25), (32, 27), (55, 17), (58, 19), (57, 47), (45, 50), (37, 39), (15, 39)),
        ((20, 27), (37, 25), (42, 27), (56, 24), (57, 26), (55, 51), (43, 52), (37, 40), (20, 40)),
    ),
    "left": (
        ((7, 27), (31, 27), (38, 29), (44, 12), (49, 12), (49, 48), (39, 49), (30, 40), (7, 40)),
        ((7, 27), (31, 27), (38, 29), (44, 12), (49, 12), (49, 48), (39, 49), (30, 40), (7, 40)),
    ),
    "up": (
        ((12, 13), (26, 13), (27, 28), (42, 28), (44, 42), (31, 43), (22, 38), (12, 45)),
        ((12, 13), (26, 13), (27, 28), (42, 28), (44, 42), (31, 43), (22, 38), (12, 45)),
    ),
    "right": (
        ((17, 27), (37, 27), (43, 17), (50, 17), (50, 49), (40, 49), (34, 40), (17, 40)),
        ((17, 27), (38, 27), (43, 17), (50, 17), (50, 49), (40, 49), (34, 40), (17, 40)),
    ),
}


def masked(source: Image.Image, polygons: tuple[tuple[tuple[int, int], ...], ...]) -> tuple[Image.Image, Image.Image]:
    mask = Image.new("L", source.size, 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    result = Image.new("RGBA", source.size, TRANSPARENT)
    result.paste(source, (0, 0), mask)
    return result, mask


def subtract(source: Image.Image, mask: Image.Image) -> Image.Image:
    result = source.copy()
    alpha = result.getchannel("A")
    inverse = Image.eval(mask, lambda value: 255 - value)
    result.putalpha(Image.composite(alpha, Image.new("L", source.size, 0), inverse))
    return result


def is_magenta(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and red >= 28 and blue >= 40 and red > green * 1.55 + 5 and blue > green * 1.55 + 5


def clean(image: Image.Image) -> Image.Image:
    result = image.copy()
    source = image.load()
    pixels = result.load()
    contaminated = [(x, y) for y in range(image.height) for x in range(image.width) if is_magenta(source[x, y])]
    for x, y in contaminated:
        neighbours: list[tuple[int, int, int, int]] = []
        for radius in (1, 2):
            for ny in range(max(0, y - radius), min(image.height, y + radius + 1)):
                for nx in range(max(0, x - radius), min(image.width, x + radius + 1)):
                    candidate = source[nx, ny]
                    if candidate[3] == 255 and not is_magenta(candidate):
                        neighbours.append(candidate)
            if neighbours:
                break
        pixels[x, y] = Counter(neighbours).most_common(1)[0][0] if neighbours else TRANSPARENT
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
    return result


def shifted(image: Image.Image, offset: tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", image.size, TRANSPARENT)
    result.alpha_composite(image, offset)
    return result


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheets = {
        "body": Image.new("RGBA", (FRAME, FRAME * 4), TRANSPARENT),
        "leg-far": Image.new("RGBA", (FRAME, FRAME * 4), TRANSPARENT),
        "leg-near": Image.new("RGBA", (FRAME, FRAME * 4), TRANSPARENT),
        "bow-arm": Image.new("RGBA", (FRAME * 4, FRAME * 4), TRANSPARENT),
    }

    for row, direction in enumerate(DIRECTIONS):
        idle = Image.open(IDLE_SOURCE / direction / "frame-00.png").convert("RGBA")
        idle_weapon, weapon_mask = masked(idle, IDLE_WEAPON_MASKS[direction])

        far_box, near_box = LEG_MASKS[direction]
        far_mask = Image.new("L", idle.size, 0)
        near_mask = Image.new("L", idle.size, 0)
        ImageDraw.Draw(far_mask).rectangle(far_box, fill=255)
        ImageDraw.Draw(near_mask).rectangle(near_box, fill=255)
        far_leg = Image.new("RGBA", idle.size, TRANSPARENT)
        near_leg = Image.new("RGBA", idle.size, TRANSPARENT)
        far_leg.paste(idle, (0, 0), far_mask)
        near_leg.paste(idle, (0, 0), near_mask)

        lower_cut = Image.new("L", idle.size, 0)
        lower_draw = ImageDraw.Draw(lower_cut)
        lower_draw.rectangle((far_box[0], max(52, far_box[1]), far_box[2], far_box[3]), fill=255)
        lower_draw.rectangle((near_box[0], max(52, near_box[1]), near_box[2], near_box[3]), fill=255)
        body = subtract(subtract(idle, weapon_mask), lower_cut)
        torso_mask = Image.new("L", idle.size, 0)
        ImageDraw.Draw(torso_mask).polygon(TORSO_RESTORE[direction], fill=255)
        body.paste(idle, (0, 0), torso_mask)

        sheets["body"].alpha_composite(body, (0, row * FRAME))
        sheets["leg-far"].alpha_composite(far_leg, (0, row * FRAME))
        sheets["leg-near"].alpha_composite(near_leg, (0, row * FRAME))
        sheets["bow-arm"].alpha_composite(idle_weapon, (3 * FRAME, row * FRAME))

        attack_layers: dict[int, Image.Image] = {}
        for phase in (1, 2):
            attack = Image.open(ATTACK_SOURCE / direction / f"frame-{phase:02d}.png").convert("RGBA")
            weapon, _ = masked(attack, (ATTACK_MASKS[direction][phase - 1],))
            attack_layers[phase] = weapon
            sheets["bow-arm"].alpha_composite(weapon, (phase * FRAME, row * FRAME))
        anticipation = shifted(attack_layers[1], ANTICIPATION_SHIFT[direction])
        sheets["bow-arm"].alpha_composite(anticipation, (0, row * FRAME))

    for name, sheet in sheets.items():
        path = OUTPUT / f"{name}.png"
        normalized = Image.new("RGBA", sheet.size, TRANSPARENT)
        for row in range(4):
            source_cell = sheet.crop((0, row * FRAME, sheet.width, row * FRAME + FRAME))
            normalized.alpha_composite(source_cell, (0, row * FRAME - 1))
        clean(normalized).save(path, optimize=False)
        print(path)


if __name__ == "__main__":
    build()
