"""Render nearest-neighbour contact sheets for visual archive classification."""

from __future__ import annotations

import json
import math
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/imports/skins-raw"
OUTPUT = ROOT / "artifacts/character-qa/skin-archive-contacts"
BACKGROUND = (21, 24, 34, 255)


SELECTED = {
    "ArcherHero.zip": ["Final/Idle and running.png", "Final/Normal Attack.png", "Final/High Attack.png"],
    "Free Sample.zip": ["Free Sample/Red.png"],
    "JRPG_HEROES.zip": [
        "JRPG_HEROES/JRPG_WARRIOR/WARRIOR_SPRITE/WARRIOR_SHEET.png",
        "JRPG_HEROES/JRPG_WARRIOR/WARRIOR_COMBAT_SPRITE/WARRIOR_COMBAT_SPRITE-SHEET.png",
        "JRPG_HEROES/JRPG_ARCHER/ARCHER_SPRITE/ARCHER_SHEET.png",
        "JRPG_HEROES/JRPG_ARCHER/ARCHER_COMBAT_SPRITE/ARCHER_COMBAT_SPRITE-SHEET.png",
        "JRPG_HEROES/JRPG_MAGE/MAGE_SPRITE/MAGE_SHEET.png",
        "JRPG_HEROES/JRPG_MAGE/MAGE_COMBAT_SPRITE/MAGE_COMBAT_SPRITE-SHEET.png",
        "JRPG_HEROES/JRPG_ASSASSIN/ASSASSIN_SPRITE/ASSASSIN_SHEET.png",
    ],
    "Little Mage1-1.zip": [
        "Little Mage/Idle/Idle.gif", "Little Mage/Run/Run.gif",
        "Little Mage/Attack/StaffCrystal/AttackCrystal.gif", "Little Mage/Dying/Dying.gif",
    ],
    "SkeletonWarrior.zip": ["Idle/Idle.png", "Walk/Walk.png", "Attack/Attack1.png", "Death/Death.png"],
    "SushiWarrior.zip": [
        "SushiWarrior/SushiWarriorIdle.gif", "SushiWarrior/SushiWarriorWalk.gif",
        "SushiWarrior/SushiWarriorAttack.gif", "SushiWarrior/SushiWarriorLose.gif",
    ],
}


def frames(image: Image.Image) -> list[Image.Image]:
    count = getattr(image, "n_frames", 1)
    return [image.seek(index) or image.convert("RGBA") for index in range(count)]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, list[str]] = {}
    for archive_name, paths in SELECTED.items():
        archive_path = SOURCE / archive_name
        output_dir = OUTPUT / Path(archive_name).stem
        output_dir.mkdir(parents=True, exist_ok=True)
        manifest[archive_name] = []
        with zipfile.ZipFile(archive_path) as archive:
            for index, path in enumerate(paths):
                with archive.open(path) as source:
                    image = Image.open(source)
                    items = frames(image)
                max_width = max(item.width for item in items)
                max_height = max(item.height for item in items)
                scale = max(1, min(4, 256 // max(max_width, max_height)))
                columns = min(8, len(items))
                rows = math.ceil(len(items) / columns)
                label_height = 18
                sheet = Image.new("RGBA", (columns * max_width * scale, rows * max_height * scale + label_height), BACKGROUND)
                draw = ImageDraw.Draw(sheet)
                draw.text((4, 4), path, fill=(230, 234, 241, 255))
                for frame_index, item in enumerate(items):
                    x = (frame_index % columns) * max_width * scale
                    y = label_height + (frame_index // columns) * max_height * scale
                    sheet.alpha_composite(item.resize((item.width * scale, item.height * scale), Image.Resampling.NEAREST), (x, y))
                output_path = output_dir / f"{index:02d}-{Path(path).stem}.png"
                sheet.save(output_path, optimize=False)
                manifest[archive_name].append(str(output_path.relative_to(ROOT)).replace("\\", "/"))
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
