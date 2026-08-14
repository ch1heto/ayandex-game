"""Inventory character skin ZIP archives without changing their contents."""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/imports/skins-raw"
REPORT = ROOT / "artifacts/character-qa/skin-archive-inventory.json"
IMAGE_SUFFIXES = {".png", ".gif"}
DOCUMENT_NAMES = ("license", "readme", "read me", "credit", "attribution", "changelog")


def inspect_image(data: bytes, suffix: str) -> dict[str, object]:
    with Image.open(io.BytesIO(data)) as image:
        result: dict[str, object] = {
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "frames": getattr(image, "n_frames", 1),
        }
        if suffix == ".gif":
            result["durationsMs"] = [
                int(image.seek(index) or image.info.get("duration", 0))
                for index in range(getattr(image, "n_frames", 1))
            ]
        return result


def main() -> None:
    archives: list[dict[str, object]] = []
    for archive_path in sorted(SOURCE.glob("*.zip")):
        archive: dict[str, object] = {
            "archive": archive_path.name,
            "bytes": archive_path.stat().st_size,
            "entries": [],
            "documentation": [],
        }
        with zipfile.ZipFile(archive_path) as handle:
            for entry in handle.infolist():
                if entry.is_dir() or entry.filename.startswith("__MACOSX/"):
                    continue
                suffix = Path(entry.filename).suffix.lower()
                item: dict[str, object] = {"path": entry.filename, "bytes": entry.file_size}
                if suffix in IMAGE_SUFFIXES:
                    try:
                        item["image"] = inspect_image(handle.read(entry), suffix)
                    except Exception as error:  # Preserve and report unreadable source files.
                        item["imageError"] = str(error)
                archive["entries"].append(item)
                lowered = entry.filename.lower()
                if any(token in lowered for token in DOCUMENT_NAMES):
                    archive["documentation"].append(entry.filename)
        archives.append(archive)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({"archives": archives}, indent=2), encoding="utf-8")
    print(REPORT)
    for archive in archives:
        images = [item for item in archive["entries"] if "image" in item]
        print(f"{archive['archive']}: {len(archive['entries'])} files, {len(images)} images")
        for item in images:
            image = item["image"]
            print(f"  {item['path']}: {image['width']}x{image['height']} {image['format']} frames={image['frames']}")
        print(f"  docs: {archive['documentation'] or 'NONE'}")


if __name__ == "__main__":
    main()
