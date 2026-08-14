"""Deterministically import all supplied character skin archives.

The importer preserves every source file under each skin's raw/ directory,
copies documentation verbatim, and creates only lossless PNG preview strips.
It never draws, resizes, interpolates, or invents animation/direction frames.
"""

from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = ROOT / "assets/imports/skins-raw"
OUTPUT = ROOT / "assets/characters/skins"
TRANSPARENT = (0, 0, 0, 0)
DIRECTIONS = ["left", "right"]


SKINS = [
    {"id": "sushi-warrior", "class": "warrior", "displayName": "Sushi Warrior", "archive": "SushiWarrior.zip", "root": "SushiWarrior", "kind": "gif", "idle": "SushiWarriorIdle.gif", "walk": "SushiWarriorWalk.gif", "attack": "SushiWarriorAttack.gif", "frame": [128, 64], "scale": 0.72, "origin": [0.25, 0.921875], "baseline": 59, "visualCenterX": 32, "attackImpactFrame": 3},
    {"id": "skeleton-warrior", "class": "warrior", "displayName": "Skeleton Warrior", "archive": "SkeletonWarrior.zip", "kind": "sheets", "idle": ["Idle/Idle.png", 96, 96, 4, 0], "walk": ["Walk/Walk.png", 96, 96, 8, 0], "attack": ["Attack/Attack1.png", 96, 96, 8, 0], "frame": [96, 96], "scale": 1.5, "origin": [0.4479166667, 0.6354166667], "baseline": 61, "visualCenterX": 43, "attackImpactFrame": 3},
    {"id": "red-reaper", "class": "warrior", "displayName": "Red Reaper Sample", "archive": "Free Sample.zip", "kind": "grid", "sheet": "Free Sample/Red.png", "idle": [64, 64, 4, 0], "walk": [64, 64, 9, 1], "attack": [64, 64, 8, 3], "frame": [64, 64], "scale": 1.0, "origin": [0.5, 1.0], "baseline": 64, "visualCenterX": 32, "attackImpactFrame": 4},
    {"id": "jrpg-warrior", "class": "warrior", "displayName": "JRPG Warrior", "archive": "JRPG_HEROES.zip", "kind": "jrpg", "unit": "WARRIOR", "frame": [16, 24], "scale": 2.5, "origin": [0.5, 0.96]},
    {"id": "jrpg-assassin", "class": "warrior", "displayName": "JRPG Assassin", "archive": "JRPG_HEROES.zip", "kind": "jrpg", "unit": "ASSASSIN", "frame": [16, 24], "scale": 2.5, "origin": [0.5, 0.96]},
    {"id": "archer-hero", "class": "archer", "displayName": "Archer Hero", "archive": "ArcherHero.zip", "kind": "archer", "frame": [64, 64], "scale": 1.0, "origin": [0.5, 0.828125], "baseline": 53, "visualCenterX": 32, "attackImpactFrame": 5},
    {"id": "jrpg-archer", "class": "archer", "displayName": "JRPG Archer", "archive": "JRPG_HEROES.zip", "kind": "jrpg", "unit": "ARCHER", "frame": [16, 24], "scale": 2.5, "origin": [0.5, 0.96]},
    {"id": "little-mage", "class": "mage", "displayName": "Little Mage", "archive": "Little Mage1-1.zip", "root": "Little Mage", "kind": "little-mage", "frame": [16, 16], "scale": 2.0, "origin": [0.4375, 1.0], "baseline": 16, "visualCenterX": 7, "attackImpactFrame": 2},
    {"id": "jrpg-mage", "class": "mage", "displayName": "JRPG Mage", "archive": "JRPG_HEROES.zip", "kind": "jrpg", "unit": "MAGE", "frame": [16, 24], "scale": 2.5, "origin": [0.5, 0.96]},
]


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> list[str]:
    files: list[str] = []
    for entry in archive.infolist():
        if entry.is_dir() or entry.filename.startswith("__MACOSX/"):
            continue
        target = (destination / entry.filename).resolve()
        if destination.resolve() not in target.parents:
            raise RuntimeError(f"Unsafe ZIP path: {entry.filename}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.read(entry))
        files.append(entry.filename)
    return files


def save_strip(frames: list[Image.Image], path: Path) -> tuple[int, int, int]:
    rgba = [frame.convert("RGBA") for frame in frames]
    width, height = rgba[0].size
    if any(frame.size != (width, height) for frame in rgba):
        raise RuntimeError(f"Mixed frame sizes for {path}")
    strip = Image.new("RGBA", (width * len(rgba), height), TRANSPARENT)
    for index, frame in enumerate(rgba):
        strip.alpha_composite(frame, (index * width, 0))
    strip.save(path, optimize=False)
    return width, height, len(rgba)


def gif_frames(path: Path) -> list[Image.Image]:
    with Image.open(path) as image:
        return [image.seek(index) or image.convert("RGBA") for index in range(image.n_frames)]


def crop_sheet(path: Path, width: int, height: int, count: int, row: int = 0) -> list[Image.Image]:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
    return [rgba.crop((index * width, row * height, (index + 1) * width, (row + 1) * height)) for index in range(count)]


def create_previews(skin: dict[str, object], raw: Path, destination: Path) -> dict[str, object]:
    kind = skin["kind"]
    states: dict[str, tuple[int, int, int]] = {}
    if kind == "gif":
        root = raw / str(skin["root"])
        for state in ("idle", "walk", "attack"):
            states[state] = save_strip(gif_frames(root / str(skin[state])), destination / f"preview-{state}.png")
    elif kind == "sheets":
        for state in ("idle", "walk", "attack"):
            relative, width, height, count, row = skin[state]
            states[state] = save_strip(crop_sheet(raw / relative, width, height, count, row), destination / f"preview-{state}.png")
    elif kind == "grid":
        for state in ("idle", "walk", "attack"):
            width, height, count, row = skin[state]
            states[state] = save_strip(crop_sheet(raw / str(skin["sheet"]), width, height, count, row), destination / f"preview-{state}.png")
    elif kind == "archer":
        source = raw / "Final"
        states["idle"] = save_strip(crop_sheet(source / "Idle and running.png", 64, 64, 2, 0), destination / "preview-idle.png")
        states["walk"] = save_strip(crop_sheet(source / "Idle and running.png", 64, 64, 8, 1), destination / "preview-walk.png")
        states["attack"] = save_strip(crop_sheet(source / "Normal Attack.png", 64, 64, 8, 0), destination / "preview-attack.png")
    elif kind == "little-mage":
        source = raw / "Little Mage"
        state_paths = {"idle": source / "Idle/Idle.gif", "walk": source / "Run/Run.gif", "attack": source / "Attack/StaffCrystal/AttackCrystal.gif"}
        for state, path in state_paths.items():
            states[state] = save_strip(gif_frames(path), destination / f"preview-{state}.png")
    elif kind == "jrpg":
        unit = str(skin["unit"])
        source = raw / f"JRPG_HEROES/JRPG_{unit}"
        movement = source / f"{unit}_SPRITE/{unit}_SHEET.png"
        combat = source / f"{unit}_COMBAT_SPRITE/{unit}_COMBAT_SPRITE-SHEET.png"
        states["idle"] = save_strip(crop_sheet(movement, 16, 24, 1), destination / "preview-idle.png")
        states["walk"] = save_strip(crop_sheet(movement, 16, 24, 16), destination / "preview-walk.png")
        states["attack"] = save_strip(crop_sheet(combat, 80, 112, 3), destination / "preview-attack.png")
    else:
        raise RuntimeError(f"Unknown import kind: {kind}")
    return {
        state: {"sheet": f"preview-{state}.png", "frameWidth": width, "frameHeight": height, "frames": count, "frameRate": 8 if state != "attack" else 10}
        for state, (width, height, count) in states.items()
    }


def documentation_files(files: list[str]) -> list[str]:
    tokens = ("license", "readme", "read me", "credit", "attribution", "changelog")
    return [path for path in files if any(token in path.lower() for token in tokens)]


def write_original_skin(class_id: str) -> None:
    destination = OUTPUT / class_id / f"original-{class_id}"
    destination.mkdir(parents=True, exist_ok=True)
    source = ROOT / f"assets/characters/classes/{class_id}"
    idle = crop_sheet(source / "idle.png", 64, 64, 1, 0)
    walk = crop_sheet(source / "walk.png", 64, 64, 4, 0)
    attack = crop_sheet(source / "attack.png", 64, 64, 4, 0)
    animations = {}
    for state, frames in (("idle", idle), ("walk", walk), ("attack", attack)):
        width, height, count = save_strip(frames, destination / f"preview-{state}.png")
        animations[state] = {"sheet": f"preview-{state}.png", "frameWidth": width, "frameHeight": height, "frames": count, "frameRate": 9 if state != "attack" else 12}
    manifest = {
        "id": f"original-{class_id}", "class": class_id, "displayName": f"Original {class_id.title()}",
        "sourcePack": "Ashvale original class assets", "frameWidth": 64, "frameHeight": 64,
        "displayScale": 1, "origin": [0.5, 0.9375], "baseline": 60,
        "supportedDirections": ["down", "left", "up", "right"], "animations": animations,
        "compatibility": "FULL_4DIR", "runtimeStatus": "PORTRAIT_ONLY", "sourceFilesPreserved": True,
        "notes": "Class-selection portrait source only. Explicitly forbidden as a gameplay skin.",
    }
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for class_id in ("warrior", "archer", "mage"):
        write_original_skin(class_id)
    archive_cache: dict[str, tuple[Path, list[str]]] = {}
    for skin in SKINS:
        archive_name = str(skin["archive"])
        archive_path = ARCHIVES / archive_name
        destination = OUTPUT / str(skin["class"]) / str(skin["id"])
        raw = destination / "raw"
        raw.mkdir(parents=True, exist_ok=True)
        if archive_name not in archive_cache:
            archive_cache[archive_name] = (archive_path, [])
        with zipfile.ZipFile(archive_path) as archive:
            files = safe_extract(archive, raw)
        animations = create_previews(skin, raw, destination)
        if skin["id"] == "little-mage":
            animations["idle"].update({"rootX": 7, "baseline": 16})
            animations["walk"].update({"rootX": 7, "baseline": 16})
            animations["attack"].update({"rootX": 11, "baseline": 32})
        docs = documentation_files(files)
        notice = destination / "SOURCE-NOTICE.md"
        notice.write_text(
            f"# {skin['displayName']}\n\nSource archive: `{archive_name}`.\n\n"
            + ("Preserved documentation:\n" + "\n".join(f"- `raw/{path}`" for path in docs) if docs else "The supplied archive contained no LICENSE, README, credits, or attribution file. No license terms were invented."),
            encoding="utf-8",
        )
        frame_width, frame_height = skin["frame"]
        manifest = {
            "id": skin["id"], "class": skin["class"], "displayName": skin["displayName"],
            "sourcePack": archive_name, "frameWidth": frame_width, "frameHeight": frame_height,
            "displayScale": skin["scale"], "origin": skin["origin"],
            "baseline": skin.get("baseline", round(frame_height * skin["origin"][1])),
            "visualCenterX": skin.get("visualCenterX", frame_width / 2),
            "attackImpactFrame": skin.get("attackImpactFrame", 2),
            "supportedDirections": DIRECTIONS, "animations": animations,
            "compatibility": "SIDE_VIEW_ONLY", "runtimeStatus": "EXCLUDED" if str(skin["id"]).startswith("jrpg-") else "GAMEPLAY",
            "sourceFilesPreserved": True, "documentationFiles": [f"raw/{path}" for path in docs],
            "notes": "Original asset is green and has no up/down frames; excluded from selectors." if str(skin["id"]).startswith("jrpg-") else "DEV gameplay enabled. Vertical movement reuses the last horizontal animation; no up/down frames were invented.",
        }
        (destination / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"{skin['id']}: {len(files)} preserved files, docs={len(docs)}")


if __name__ == "__main__":
    main()
