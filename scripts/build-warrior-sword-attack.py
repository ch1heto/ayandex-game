"""Build the Warrior weapon-only attack layers.

The attack body is always the existing canonical idle cutout.  This script
extracts one stable sword-hand layer from that same reference and rasterizes
six crisp, fully-opaque sword angles around the hand pivot.  No full-body
attack frame enters the output.
"""

from __future__ import annotations

import math
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/classes/warrior/frames/idle"
OUTPUT = ROOT / "assets/characters/classes/warrior/procedural"
DIRECTIONS = ("down", "left", "up", "right")
FRAME = 64
PHASES = 6
TRANSPARENT = (0, 0, 0, 0)

# These attachment points and angles are mirrored in
# src/entities/player/warriorSwordAttack.ts for melee sweep geometry.
PIVOTS = {
    "down": (22, 43),
    "left": (36, 44),
    "up": (41, 43),
    "right": (36, 44),
}
ANGLES = {
    "down": (-125, -90, -55, -20, 10, 30),
    "left": (-105, -130, -155, 180, 160, 145),
    "up": (-155, -130, -105, -80, -55, -35),
    "right": (-75, -45, -20, 0, 20, 35),
}

# Only the old idle sword is removed from one otherwise untouched source frame.
# The arm, head, torso and legs stay byte-for-byte stable across all phases.
IDLE_WEAPON_MASKS = {
    "down": (
        ((13, 61), (15, 48), (20, 43), (26, 43), (27, 49), (20, 62)),
    ),
    "left": (
        ((12, 62), (13, 55), (30, 44), (38, 43), (40, 49), (23, 63)),
    ),
    "up": (
        ((38, 43), (46, 42), (51, 62), (41, 63)),
    ),
    "right": (
        ((34, 43), (41, 42), (58, 58), (58, 63), (48, 63), (36, 49)),
    ),
}

# A compact hand/gauntlet cap overlays the sword hilt, keeping the pivot
# visually connected while the rest of the body remains unchanged.
HAND_MASKS = {
    "down": ((18, 36), (27, 36), (29, 47), (22, 49), (18, 45)),
    "left": ((31, 37), (42, 37), (43, 48), (36, 49), (31, 45)),
    "up": ((37, 35), (45, 35), (45, 48), (39, 49), (37, 44)),
    "right": ((29, 36), (40, 36), (41, 48), (35, 49), (29, 44)),
}

OUTLINE = (14, 21, 34, 255)
BLADE_SHADOW = (126, 143, 163, 255)
BLADE_MID = (205, 217, 229, 255)
BLADE_LIGHT = (247, 250, 252, 255)
GUARD_LIGHT = (183, 164, 112, 255)
GRIP = (91, 55, 35, 255)


def point(pivot: tuple[int, int], angle: float, distance: float, side: float = 0) -> tuple[int, int]:
    dx = math.cos(angle)
    dy = math.sin(angle)
    px = -dy
    py = dx
    return round(pivot[0] + dx * distance + px * side), round(pivot[1] + dy * distance + py * side)


def sword_frame(pivot: tuple[int, int], degrees: int) -> Image.Image:
    angle = math.radians(degrees)
    image = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    draw = ImageDraw.Draw(image)

    # Grip and pommel sit behind the hand pivot.
    draw.line((point(pivot, angle, -6), point(pivot, angle, 2)), fill=OUTLINE, width=4)
    draw.line((point(pivot, angle, -5), point(pivot, angle, 1)), fill=GRIP, width=2)
    pommel = point(pivot, angle, -7)
    draw.rectangle((pommel[0] - 1, pommel[1] - 1, pommel[0] + 1, pommel[1] + 1), fill=OUTLINE)

    # A short guard makes the pivot and the hand connection readable.
    guard_a = point(pivot, angle, 2, -4)
    guard_b = point(pivot, angle, 2, 4)
    draw.line((guard_a, guard_b), fill=OUTLINE, width=3)
    draw.line((guard_a, guard_b), fill=GUARD_LIGHT, width=1)

    # Pre-rasterized blade: no runtime transform, smoothing or partial alpha.
    outline_poly = (
        point(pivot, angle, 2, -3),
        point(pivot, angle, 23, -2),
        point(pivot, angle, 27, 0),
        point(pivot, angle, 23, 2),
        point(pivot, angle, 2, 3),
    )
    draw.polygon(outline_poly, fill=OUTLINE)
    blade_poly = (
        point(pivot, angle, 4, -2),
        point(pivot, angle, 23, -1),
        point(pivot, angle, 25, 0),
        point(pivot, angle, 22, 1),
        point(pivot, angle, 4, 2),
    )
    draw.polygon(blade_poly, fill=BLADE_MID)
    draw.line((point(pivot, angle, 5, -1), point(pivot, angle, 22, -1)), fill=BLADE_LIGHT, width=1)
    draw.line((point(pivot, angle, 6, 1), point(pivot, angle, 21, 1)), fill=BLADE_SHADOW, width=1)

    pixels = image.load()
    for y in range(FRAME):
        for x in range(FRAME):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
    return image


def clean_authored_layer(image: Image.Image) -> Image.Image:
    result = image.copy()
    source = image.load()
    pixels = result.load()
    contaminated = []
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = source[x, y]
            if alpha and red >= 28 and blue >= 40 and red > green * 1.55 + 5 and blue > green * 1.55 + 5:
                contaminated.append((x, y))
    for x, y in contaminated:
        neighbours = []
        for radius in (1, 2):
            for ny in range(max(0, y - radius), min(image.height, y + radius + 1)):
                for nx in range(max(0, x - radius), min(image.width, x + radius + 1)):
                    candidate = source[nx, ny]
                    red, green, blue, alpha = candidate
                    purple = alpha and red >= 28 and blue >= 40 and red > green * 1.55 + 5 and blue > green * 1.55 + 5
                    if alpha == 255 and not purple:
                        neighbours.append(candidate)
            if neighbours:
                break
        pixels[x, y] = Counter(neighbours).most_common(1)[0][0] if neighbours else TRANSPARENT
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
    return result


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    body_sheet = Image.new("RGBA", (FRAME, FRAME * 4), TRANSPARENT)
    hand_sheet = Image.new("RGBA", (FRAME, FRAME * 4), TRANSPARENT)
    sword_sheet = Image.new("RGBA", (FRAME * PHASES, FRAME * 4), TRANSPARENT)

    for row, direction in enumerate(DIRECTIONS):
        idle = Image.open(SOURCE / direction / "frame-00.png").convert("RGBA")
        weapon_mask = Image.new("L", idle.size, 0)
        weapon_draw = ImageDraw.Draw(weapon_mask)
        for polygon in IDLE_WEAPON_MASKS[direction]:
            weapon_draw.polygon(polygon, fill=255)
        body = idle.copy()
        body_alpha = body.getchannel("A")
        inverse = Image.eval(weapon_mask, lambda value: 255 - value)
        body.putalpha(Image.composite(body_alpha, Image.new("L", idle.size, 0), inverse))
        body_sheet.alpha_composite(clean_authored_layer(body), (0, row * FRAME))

        hand_mask = Image.new("L", idle.size, 0)
        ImageDraw.Draw(hand_mask).polygon(HAND_MASKS[direction], fill=255)
        hand = Image.new("RGBA", idle.size, TRANSPARENT)
        hand.paste(idle, (0, 0), hand_mask)
        hand_sheet.alpha_composite(clean_authored_layer(hand), (0, row * FRAME))

        for phase, degrees in enumerate(ANGLES[direction]):
            sword_sheet.alpha_composite(sword_frame(PIVOTS[direction], degrees), (phase * FRAME, row * FRAME))

    body_sheet.save(OUTPUT / "attack-body.png", optimize=False)
    hand_sheet.save(OUTPUT / "attack-hand.png", optimize=False)
    sword_sheet.save(OUTPUT / "sword-attack.png", optimize=False)
    print(OUTPUT / "attack-body.png")
    print(OUTPUT / "attack-hand.png")
    print(OUTPUT / "sword-attack.png")


if __name__ == "__main__":
    build()
