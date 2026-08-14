"""Validate imported skin manifests, source preservation, sheets, and alpha."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SKINS = ROOT / "assets/characters/skins"
REPORT = ROOT / "artifacts/character-qa/imported-skins-report.json"


def alpha_stats(image: Image.Image) -> tuple[int, int]:
    partial = hidden = 0
    for red, green, blue, alpha in image.convert("RGBA").get_flattened_data():
        partial += int(0 < alpha < 255)
        hidden += int(alpha == 0 and (red or green or blue))
    return partial, hidden


def main() -> None:
    records: list[dict[str, object]] = []
    errors: list[str] = []
    ids: set[str] = set()
    for manifest_path in sorted(SKINS.glob("*/*/manifest.json")):
        skin_dir = manifest_path.parent
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        skin_id = manifest["id"]
        if skin_id in ids:
            errors.append(f"duplicate id: {skin_id}")
        ids.add(skin_id)
        state_records: dict[str, object] = {}
        for state in ("idle", "walk", "attack"):
            config = manifest["animations"][state]
            path = skin_dir / config["sheet"]
            if not path.exists():
                errors.append(f"{skin_id}/{state}: missing {path.name}")
                continue
            with Image.open(path) as image:
                expected = (config["frameWidth"] * config["frames"], config["frameHeight"])
                if image.size != expected:
                    errors.append(f"{skin_id}/{state}: size {image.size}, expected {expected}")
                partial, hidden = alpha_stats(image)
                if hidden:
                    errors.append(f"{skin_id}/{state}: hiddenRgb={hidden}")
                state_records[state] = {"size": list(image.size), "frames": config["frames"], "partialAlpha": partial, "hiddenRgb": hidden}
        docs = manifest.get("documentationFiles", [])
        for relative in docs:
            if not (skin_dir / relative).exists():
                errors.append(f"{skin_id}: missing documentation {relative}")
        if manifest["compatibility"] == "FULL_4DIR" and len(manifest["supportedDirections"]) != 4:
            errors.append(f"{skin_id}: FULL_4DIR without four directions")
        if manifest["runtimeStatus"] == "GAMEPLAY" and not all(manifest["animations"].get(state) for state in ("idle", "walk", "attack")):
            errors.append(f"{skin_id}: gameplay skin lacks a usable animation state")
        if skin_id.startswith("original-") and manifest["runtimeStatus"] != "PORTRAIT_ONLY":
            errors.append(f"{skin_id}: original art must be portrait-only")
        if skin_id.startswith("jrpg-") and manifest["runtimeStatus"] != "EXCLUDED":
            errors.append(f"{skin_id}: green JRPG source must be excluded")
        records.append({
            "id": skin_id, "class": manifest["class"], "source": manifest["sourcePack"],
            "directions": manifest["supportedDirections"], "compatibility": manifest["compatibility"],
            "runtimeStatus": manifest["runtimeStatus"], "documentationFiles": docs,
            "states": state_records,
        })
    report = {"decision": "PASS" if not errors else "FAIL", "skins": records, "errors": errors}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
