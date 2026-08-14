"""Assemble the supplied modular Warrior parts into runtime cutout layers.

Every source part comes from rig-source/. Parts are transformed only with
nearest-neighbour scaling, integer placement and pre-rasterized rotation.
Runtime never rotates/scales individual limbs.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/classes/warrior/rig-source"
OUTPUT = ROOT / "assets/characters/classes/warrior/modular-runtime"
DIRECTIONS = ("front", "left", "back", "right")
FRAME = 128
GAME_FRAME = 64
BASELINE = 120
GAME_BASELINE = 60
TRANSPARENT = (0, 0, 0, 0)
RESAMPLE = Image.Resampling.NEAREST

# Neutral rig: root is (64,120). These are destination pivots/centres on the
# 128px working canvas, not inferred at runtime.
ANCHORS = {
    "root": (64, 120),
    "hip": (64, 80),
    "neck": (64, 35),
    "hand": {
        "front": (43, 74), "left": (67, 73), "back": (77, 71), "right": (69, 73),
    },
}

# Per-direction semantic part choices and integer placement. The order is the
# back-to-front render order and therefore also defines stable limb occlusion.
LAYOUTS = {
    "front": (
        ("scarf_tail", (64, 44), 0.42), ("tabard_back", (64, 78), 0.48),
        ("thigh_left", (51, 87), 0.44), ("thigh_right", (72, 87), 0.44),
        ("shin_left", (50, 103), 0.42), ("shin_right", (73, 103), 0.42),
        ("boot_left", (50, 114), 0.42), ("boot_right", (73, 114), 0.42),
        ("torso", (64, 58), 0.47), ("tabard_front", (64, 77), 0.48),
        ("belt_front", (64, 73), 0.43), ("strap", (64, 57), 0.42),
        ("upper_arm_left", (39, 57), 0.42), ("upper_arm_right", (88, 57), 0.42),
        ("shoulder_left", (39, 48), 0.40), ("shoulder_right", (88, 48), 0.40),
        ("forearm_left", (39, 70), 0.42), ("forearm_right", (89, 70), 0.42),
        ("hand_left", (41, 79), 0.38), ("hand_right", (88, 79), 0.38),
        ("head_base", (64, 28), 0.43), ("face", (64, 29), 0.43),
        ("hair_back", (64, 23), 0.44), ("hair_front", (64, 22), 0.44),
        ("scarf_cowl", (64, 43), 0.43), ("pouch_left", (89, 82), 0.35),
    ),
    "left": (
        ("scarf_tail_long", (78, 51), 0.42), ("tabard_back", (65, 78), 0.47),
        ("thigh_right", (70, 88), 0.43), ("shin_right", (70, 104), 0.42), ("boot_right", (70, 114), 0.42),
        ("thigh_left", (56, 87), 0.43), ("shin_left", (55, 103), 0.42), ("boot_left", (53, 114), 0.42),
        ("torso", (64, 59), 0.47), ("tabard_front", (63, 78), 0.47), ("belt_side", (64, 73), 0.43),
        ("upper_arm_right", (73, 58), 0.42), ("forearm_right", (71, 71), 0.42),
        ("upper_arm_left", (54, 58), 0.42), ("shoulder_left", (51, 49), 0.40),
        ("forearm_left", (61, 72), 0.42), ("hand_left", (67, 77), 0.38),
        ("head_base", (62, 29), 0.43), ("face", (58, 30), 0.43),
        ("hair_back", (65, 23), 0.44), ("hair_front", (61, 23), 0.44), ("scarf_cowl", (64, 43), 0.43),
    ),
    "back": (
        ("scarf_tail", (72, 47), 0.42), ("tabard_back", (64, 76), 0.49),
        ("thigh_left", (51, 87), 0.43), ("thigh_right", (72, 87), 0.43),
        ("shin_left", (50, 103), 0.42), ("shin_right", (73, 103), 0.42),
        ("boot_left", (50, 114), 0.42), ("boot_right", (73, 114), 0.42),
        ("torso", (64, 59), 0.47), ("tabard_front", (64, 78), 0.47), ("belt_front", (64, 73), 0.43),
        ("upper_arm_left", (40, 58), 0.42), ("upper_arm_right", (87, 58), 0.42),
        ("shoulder_left", (39, 49), 0.40), ("shoulder_right", (88, 49), 0.40),
        ("forearm_left", (40, 71), 0.42), ("forearm_right", (88, 71), 0.42),
        ("hand_left", (41, 79), 0.38), ("hand_right", (88, 79), 0.38),
        ("head_base", (64, 29), 0.43), ("hair_back", (64, 22), 0.44), ("hair_front", (64, 23), 0.44),
        ("scarf_cowl", (64, 43), 0.43), ("pouch_right", (89, 82), 0.35),
    ),
    "right": (
        ("scarf_tail_long", (50, 51), 0.42), ("tabard_back", (63, 78), 0.47),
        ("thigh_left", (57, 88), 0.43), ("shin_left", (57, 104), 0.42), ("boot_left", (57, 114), 0.42),
        ("thigh_right", (72, 87), 0.43), ("shin_right", (73, 103), 0.42), ("boot_right", (75, 114), 0.42),
        ("torso", (64, 59), 0.47), ("tabard_front", (65, 78), 0.47), ("belt_side", (64, 73), 0.43),
        ("upper_arm_left", (55, 58), 0.42), ("forearm_left", (57, 71), 0.42),
        ("upper_arm_right", (74, 58), 0.42), ("shoulder_right", (77, 49), 0.40),
        ("forearm_right", (67, 72), 0.42), ("hand_right", (69, 77), 0.38),
        ("head_base", (66, 29), 0.43), ("face", (70, 30), 0.43),
        ("hair_back", (63, 23), 0.44), ("hair_front", (67, 23), 0.44), ("scarf_cowl", (64, 43), 0.43),
    ),
}

WALK_OFFSETS = {
    "front": ((-1, 0, 1, 0, 0), (0, 0, 0, 0, -1), (1, 0, -1, 0, 0), (0, 0, 0, 0, -1)),
    "back": ((-1, 0, 1, 1, 0), (0, 0, 0, 1, -1), (1, 0, -1, 1, 0), (0, 0, 0, 1, -1)),
    "left": ((1, 0, -1, 0, 0), (0, 0, 0, 0, -1), (-1, 0, 1, 0, 0), (0, 0, 0, 0, -1)),
    "right": ((-1, 0, 1, 1, 0), (0, 0, 0, 1, -1), (1, 0, -1, 1, 0), (0, 0, 0, 1, -1)),
}

# Absolute blade directions in screen coordinates: 0=right, 90=down.
# Four authored phases: wind-up, early swing, contact and follow-through/recovery.
ATTACK_ANGLES = {
    "front": (-110, -35, 20, 65),
    "left": (-75, -135, 180, 140),
    "back": (15, -30, -85, -125),
    "right": (-105, -45, 0, 40),
}


def load_part(direction: str, name: str) -> Image.Image:
    return Image.open(SOURCE / direction / f"{name}.png").convert("RGBA")


def scaled(part: Image.Image, scale: float) -> Image.Image:
    size = (max(1, round(part.width * scale)), max(1, round(part.height * scale)))
    return part.resize(size, RESAMPLE)


def paste_center(canvas: Image.Image, part: Image.Image, center: tuple[int, int]) -> None:
    canvas.alpha_composite(part, (round(center[0] - part.width / 2), round(center[1] - part.height / 2)))


def clean(image: Image.Image) -> Image.Image:
    result = Image.new("RGBA", image.size, TRANSPARENT)
    result.alpha_composite(image)
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
    return result


def remove_tiny_islands(image: Image.Image, maximum_area: int = 2) -> Image.Image:
    """Remove alpha islands too small to be intentional at final 64px scale."""
    result = image.copy()
    alpha = result.getchannel("A")
    visible = {(x, y) for y in range(result.height) for x in range(result.width) if alpha.getpixel((x, y))}
    while visible:
        seed = visible.pop()
        component = {seed}
        stack = [seed]
        while stack:
            x, y = stack.pop()
            for neighbour in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbour in visible:
                    visible.remove(neighbour)
                    component.add(neighbour)
                    stack.append(neighbour)
        if len(component) <= maximum_area:
            for x, y in component:
                result.putpixel((x, y), TRANSPARENT)
    return result


def split_neutral(direction: str) -> tuple[Image.Image, Image.Image, Image.Image]:
    body = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    far_leg = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    near_leg = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    leg_names = {"thigh_left", "shin_left", "boot_left", "thigh_right", "shin_right", "boot_right"}
    leg_raise = 12 if direction == "front" else 10
    for name, center, scale in LAYOUTS[direction]:
        part = scaled(load_part(direction, name), scale)
        if name.endswith("left") and name in leg_names:
            paste_center(far_leg, part, (center[0], center[1] - leg_raise))
        elif name.endswith("right") and name in leg_names:
            paste_center(near_leg, part, (center[0], center[1] - leg_raise))
        elif name not in leg_names:
            paste_center(body, part, center)
    return clean(body), clean(far_leg), clean(near_leg)


def place_sword(direction: str, degrees: int) -> Image.Image:
    # The source sword points down-right at about 24 degrees.  Put the grip at
    # the centre of a square working image before rotating; this keeps the grip
    # locked to the hand for every phase instead of orbiting around the blade's
    # bounding box.  Rotation is pre-rasterized here with nearest-neighbour,
    # never performed by Phaser.
    # The weapon itself is direction-neutral.  The front source cell contains
    # the only complete, uncontaminated sword; side/back cells cross their
    # 128px cell boundary and would import neighbouring pixels or clip the tip.
    sword = scaled(load_part("front", "sword_full"), 0.48)
    source_angle = 24
    grip = (round(sword.width * 0.15), round(sword.height * 0.22))
    working_size = FRAME * 2
    pivot = working_size // 2
    working = Image.new("RGBA", (working_size, working_size), TRANSPARENT)
    working.alpha_composite(sword, (pivot - grip[0], pivot - grip[1]))
    rotated = working.rotate(-(degrees - source_angle), resample=RESAMPLE, expand=False)

    layer = Image.new("RGBA", (FRAME, FRAME), TRANSPARENT)
    hand = ANCHORS["hand"][direction]
    layer.alpha_composite(rotated, (hand[0] - pivot, hand[1] - pivot))
    return clean(layer)


def downsample(image: Image.Image) -> Image.Image:
    return remove_tiny_islands(clean(image.resize((GAME_FRAME, GAME_FRAME), RESAMPLE)))


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    body_sheet = Image.new("RGBA", (GAME_FRAME, GAME_FRAME * 4), TRANSPARENT)
    far_sheet = Image.new("RGBA", (GAME_FRAME, GAME_FRAME * 4), TRANSPARENT)
    near_sheet = Image.new("RGBA", (GAME_FRAME, GAME_FRAME * 4), TRANSPARENT)
    sword_idle_sheet = Image.new("RGBA", (GAME_FRAME, GAME_FRAME * 4), TRANSPARENT)
    sword_attack_sheet = Image.new("RGBA", (GAME_FRAME * 4, GAME_FRAME * 4), TRANSPARENT)
    rig_manifest = {"frame": 64, "root": [32, 60], "sourceFrame": 128, "sourceRoot": [64, 120], "directions": {}}

    idle_angles = {"front": 65, "left": 135, "back": 65, "right": 45}
    for row, direction in enumerate(DIRECTIONS):
        body, far_leg, near_leg = split_neutral(direction)
        body_sheet.alpha_composite(downsample(body), (0, row * GAME_FRAME))
        far_sheet.alpha_composite(downsample(far_leg), (0, row * GAME_FRAME))
        near_sheet.alpha_composite(downsample(near_leg), (0, row * GAME_FRAME))
        sword_idle_sheet.alpha_composite(downsample(place_sword(direction, idle_angles[direction])), (0, row * GAME_FRAME))
        for phase, angle in enumerate(ATTACK_ANGLES[direction]):
            sword_attack_sheet.alpha_composite(downsample(place_sword(direction, angle)), (phase * GAME_FRAME, row * GAME_FRAME))
        rig_manifest["directions"][direction] = {"hand": [round(value / 2) for value in ANCHORS["hand"][direction]], "attackAngles": ATTACK_ANGLES[direction], "walkOffsets": WALK_OFFSETS[direction]}

    for name, sheet in {
        "body.png": body_sheet, "leg-far.png": far_sheet, "leg-near.png": near_sheet,
        "sword-idle.png": sword_idle_sheet, "sword-attack.png": sword_attack_sheet,
    }.items():
        clean(sheet).save(OUTPUT / name, optimize=False)
    (OUTPUT / "rig.json").write_text(json.dumps(rig_manifest, indent=2), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    build()
