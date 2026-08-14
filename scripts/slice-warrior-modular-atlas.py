"""Slice the supplied Warrior modular atlas into named transparent rig parts.

The atlas is an 8x20 grid of 128px source cells.  Parts retain the source
pixel data and are cropped to their alpha bounds with a two-pixel gutter.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ATLAS = Path(r"V:\Musor_trash_TZshki\warrior_codex_assets\warrior_codex_assets\warrior_detailed_modular_rig_atlas_128.png")
OUTPUT = ROOT / "assets/characters/classes/warrior/rig-source"
BUNDLED_ATLAS = OUTPUT / "warrior-modular-atlas-128.png"
CELL = 128
GUTTER = 2
TRANSPARENT = (0, 0, 0, 0)

DIRECTION_ROWS = {"front": 0, "left": 5, "back": 10, "right": 15}

# Semantic cell names repeat predictably for each of the four direction blocks.
CELL_NAMES = {
    (0, 0): "head_base",
    (1, 0): "face",
    (2, 0): "hair_front",
    (3, 0): "hair_back",
    (4, 0): "ear",
    (5, 0): "neck",
    (6, 0): "scarf_cowl",
    (7, 0): "scarf_tail",
    (0, 1): "scarf_tail_short",
    (1, 1): "scarf_tail_long",
    (2, 1): "torso",
    (3, 1): "tabard_front",
    (4, 1): "tabard_back",
    (5, 1): "belt_side",
    (6, 1): "belt_front",
    (7, 1): "strap",
    (0, 2): "shoulder_left",
    (1, 2): "shoulder_right",
    (2, 2): "upper_arm_left",
    (3, 2): "forearm_left",
    (4, 2): "hand_left",
    (5, 2): "upper_arm_right",
    (6, 2): "forearm_right",
    (7, 2): "hand_right",
    (0, 3): "waist",
    (1, 3): "thigh_left",
    (2, 3): "shin_left",
    (3, 3): "boot_left",
    (4, 3): "thigh_right",
    (5, 3): "shin_right",
    (6, 3): "boot_right",
    (7, 3): "pouch_right",
    (0, 4): "pouch_left",
    (1, 4): "tabard_left",
    (2, 4): "tabard_right",
    (3, 4): "sword_full",
    (4, 4): "sword_blade",
    (5, 4): "sword_hilt",
}


def crop_part(cell: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]] | None:
    bbox = cell.getchannel("A").getbbox()
    if bbox is None:
        return None
    left = max(0, bbox[0] - GUTTER)
    top = max(0, bbox[1] - GUTTER)
    right = min(CELL, bbox[2] + GUTTER)
    bottom = min(CELL, bbox[3] + GUTTER)
    part = cell.crop((left, top, right, bottom))
    clean = Image.new("RGBA", part.size, TRANSPARENT)
    clean.alpha_composite(part)
    pixels = clean.load()
    for y in range(clean.height):
        for x in range(clean.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255) if alpha else TRANSPARENT
    return clean, (left, top, right, bottom)


def main() -> None:
    atlas_path = ATLAS if ATLAS.exists() else BUNDLED_ATLAS
    atlas = Image.open(atlas_path).convert("RGBA")
    if atlas.size != (1024, 2560):
        raise SystemExit(f"Unexpected atlas size: {atlas.size}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if atlas_path != BUNDLED_ATLAS:
        shutil.copyfile(atlas_path, BUNDLED_ATLAS)
    manifest: dict[str, object] = {
        "inputAtlas": str(ATLAS),
        "bundledAtlas": BUNDLED_ATLAS.name,
        "cellSize": CELL,
        "parts": {},
    }
    for direction, base_row in DIRECTION_ROWS.items():
        direction_dir = OUTPUT / direction
        direction_dir.mkdir(parents=True, exist_ok=True)
        entries = {}
        for (column, local_row), name in CELL_NAMES.items():
            row = base_row + local_row
            cell = atlas.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))
            sliced = crop_part(cell)
            if sliced is None:
                continue
            image, bbox = sliced
            path = direction_dir / f"{name}.png"
            image.save(path, optimize=False)
            entries[name] = {"file": str(path.relative_to(OUTPUT)).replace("\\", "/"), "cell": [column, row], "bbox": bbox, "size": image.size}
        manifest["parts"][direction] = entries
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Sliced {sum(len(value) for value in manifest['parts'].values())} parts to {OUTPUT}")


if __name__ == "__main__":
    main()
