"""Read-only checks and visual-review artifacts for Ashvale class sprites.

This helper never edits source or runtime art. Automated findings are signals;
visible review of the generated contact sheets and animations is mandatory.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageDraw


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "assets" / "characters" / "classes"
DEFAULT_OUTPUT = PROJECT_ROOT / "artifacts" / "character-qa"
DEFAULT_SOURCE = PROJECT_ROOT / "assets" / "characters" / "classes" / "source" / "production"
CLASSES = ("warrior", "archer", "mage")
DIRECTIONS = ("down", "left", "up", "right")
STATES = {"idle": 1, "walk": 4, "attack": 4}
FRAME_SIZE = 64
ROOT_X = 32
BASELINE_Y = 60
PREVIEW_SCALE = 8
FACE_CROP = (16, 4, 48, 36)


@dataclass
class Finding:
    severity: str
    frame: str
    check: str
    message: str


def connected_components(alpha: Image.Image) -> list[list[tuple[int, int]]]:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] == 0:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if visited[next_index] or pixels[next_x, next_y] == 0:
                        continue
                    visited[next_index] = 1
                    queue.append((next_x, next_y))
            components.append(component)
    return components


def checker(size: tuple[int, int], cell: int = 8) -> Image.Image:
    image = Image.new("RGBA", size, (42, 45, 54, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(58, 62, 72, 255))
    return image


def composite_preview(frame: Image.Image, scale: int = PREVIEW_SCALE) -> Image.Image:
    enlarged = frame.resize((FRAME_SIZE * scale, FRAME_SIZE * scale), Image.Resampling.NEAREST)
    background = checker(enlarged.size, scale)
    background.alpha_composite(enlarged)
    draw = ImageDraw.Draw(background)
    draw.line((ROOT_X * scale, 0, ROOT_X * scale, enlarged.height), fill=(255, 214, 64, 150), width=1)
    draw.line((0, BASELINE_Y * scale, enlarged.width, BASELINE_Y * scale), fill=(64, 220, 255, 180), width=1)
    return background


def split_sheet(sheet: Image.Image, columns: int) -> dict[tuple[str, int], Image.Image]:
    return {
        (direction, column): sheet.crop(
            (column * FRAME_SIZE, row * FRAME_SIZE, (column + 1) * FRAME_SIZE, (row + 1) * FRAME_SIZE)
        )
        for row, direction in enumerate(DIRECTIONS)
        for column in range(columns)
    }


def suspicious_chroma(frame: Image.Image) -> tuple[int, int]:
    pixels = frame.load()
    magenta = 0
    green = 0
    for y in range(frame.height):
        for x in range(frame.width):
            red, channel_green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            edge = any(
                0 <= nx < frame.width
                and 0 <= ny < frame.height
                and pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if not edge:
                continue
            if red > 105 and blue > 90 and red > channel_green + 35 and blue > channel_green + 30:
                magenta += 1
            if channel_green > 100 and channel_green > red + 40 and channel_green > blue + 40:
                green += 1
    return magenta, green


def analyze_frame(frame: Image.Image, label: str) -> tuple[list[Finding], dict[str, float | int | None]]:
    findings: list[Finding] = []
    alpha = frame.getchannel("A")
    if any(alpha.histogram()[1:255]):
        findings.append(Finding("error", label, "alpha", "contains partial-alpha pixels"))
    hidden_rgb = sum(1 for red, green, blue, value in frame.get_flattened_data() if value == 0 and (red or green or blue))
    if hidden_rgb:
        findings.append(Finding("error", label, "hidden-rgb", f"{hidden_rgb} transparent pixel(s) retain RGB colour"))
    if alpha.getbbox() is None:
        findings.append(Finding("error", label, "empty", "frame contains no opaque pixels"))
        return findings, {"baseline": None, "root_x": None, "components": 0}

    components = sorted(connected_components(alpha), key=len, reverse=True)
    primary = components[0]
    primary_bottom = max(y for _, y in primary)
    foot_pixels = [x for x, y in primary if primary_bottom - 12 <= y <= primary_bottom]
    root_x = float(sorted(foot_pixels)[len(foot_pixels) // 2]) if foot_pixels else float(ROOT_X)
    if abs(primary_bottom - BASELINE_Y) > 1:
        findings.append(Finding("warning", label, "baseline", f"primary baseline y={primary_bottom}; expected about {BASELINE_Y}"))
    if abs(root_x - ROOT_X) > 3:
        findings.append(Finding("warning", label, "root", f"lower-body median x={root_x:.1f}; expected about {ROOT_X}"))

    small_components = [len(component) for component in components[1:] if len(component) <= 8]
    if small_components:
        findings.append(Finding("warning", label, "detached", f"{len(small_components)} detached component(s) of 8 pixels or fewer"))

    edge_pixels = sum(
        1 for x, y in primary if x in (0, FRAME_SIZE - 1) or y in (0, FRAME_SIZE - 1)
    )
    if edge_pixels:
        findings.append(Finding("warning", label, "frame-edge", f"{edge_pixels} primary pixel(s) touch a cell edge; inspect clipping/contamination"))

    magenta, green = suspicious_chroma(frame)
    if magenta or green:
        findings.append(
            Finding("warning", label, "chroma-signal", f"edge candidates magenta={magenta}, green={green}; inspect, never auto-delete")
        )
    return findings, {"baseline": primary_bottom, "root_x": round(root_x, 2), "components": len(components)}


def difference_ratio(first: Image.Image, second: Image.Image, box: tuple[int, int, int, int]) -> float:
    first_pixels = list(first.crop(box).get_flattened_data())
    second_pixels = list(second.crop(box).get_flattened_data())
    return sum(a != b for a, b in zip(first_pixels, second_pixels)) / max(1, len(first_pixels))


def check_temporal_stability(
    character: str,
    states: dict[str, dict[tuple[str, int], Image.Image]],
) -> list[Finding]:
    findings: list[Finding] = []
    if character not in ("warrior", "archer"):
        return findings
    upper_body_boxes = {
        "warrior": (16, 6, 49, 43),
        "archer": (14, 6, 51, 40),
    }
    face_boxes = {
        "warrior": ((21, 12, 44, 32), (22, 12, 42, 31), (20, 12, 44, 31), (20, 12, 44, 32)),
        "archer": ((21, 9, 44, 28), (21, 9, 43, 28), (20, 9, 45, 29), (22, 9, 43, 28)),
    }
    for direction_index, direction in enumerate(DIRECTIONS):
        idle = states["idle"][(direction, 0)]
        face_box = face_boxes[character][direction_index]
        face_differences = [
            difference_ratio(idle, states[state][(direction, index)], face_box)
            for state in ("walk", "attack")
            for index in range(4)
        ]
        maximum_face_difference = max(face_differences)
        if maximum_face_difference > 0.01:
            findings.append(Finding(
                "warning",
                f"{character}/{direction}",
                "face-instability",
                f"maximum idle-to-animation face difference {maximum_face_difference:.1%}",
            ))

        upper_box = upper_body_boxes[character]
        walk_differences = [
            difference_ratio(idle, states["walk"][(direction, index)], upper_box)
            for index in range(4)
        ]
        maximum_walk_difference = max(walk_differences)
        threshold = 0.035
        if maximum_walk_difference > threshold:
            findings.append(Finding(
                "warning",
                f"{character}/walk/{direction}",
                "silhouette-instability",
                f"upper-body pixel difference reaches {maximum_walk_difference:.1%}",
            ))
    return findings


def check_exact_sources(source_root: Path, characters: tuple[str, ...]) -> list[Finding]:
    findings: list[Finding] = []
    for character in characters:
        character_root = source_root / character
        if not character_root.exists():
            continue
        for state, columns in STATES.items():
            path = character_root / f"{state}.png"
            if not path.exists():
                findings.append(Finding("error", f"source/{character}/{state}", "missing", f"missing {path}"))
                continue
            image = Image.open(path).convert("RGBA")
            expected = (FRAME_SIZE * columns, FRAME_SIZE * len(DIRECTIONS))
            if image.size != expected:
                findings.append(Finding("error", f"source/{character}/{state}", "source-grid", f"size {image.size}; expected {expected}"))
    return findings


def save_direction_strip(output: Path, character: str, state: str, direction: str, frames: list[Image.Image]) -> None:
    width = FRAME_SIZE * PREVIEW_SCALE * len(frames)
    strip = Image.new("RGBA", (width, FRAME_SIZE * PREVIEW_SCALE))
    for index, frame in enumerate(frames):
        strip.alpha_composite(composite_preview(frame), (index * FRAME_SIZE * PREVIEW_SCALE, 0))
    strip.save(output / f"{character}-{state}-{direction}.png", optimize=True)


def save_state_gif(output: Path, character: str, state: str, frames: dict[tuple[str, int], Image.Image], count: int) -> None:
    phases: list[Image.Image] = []
    for phase in range(count):
        canvas = Image.new("RGBA", (FRAME_SIZE * PREVIEW_SCALE * 2, FRAME_SIZE * PREVIEW_SCALE * 2))
        for index, direction in enumerate(DIRECTIONS):
            canvas.alpha_composite(
                composite_preview(frames[(direction, phase)]),
                ((index % 2) * FRAME_SIZE * PREVIEW_SCALE, (index // 2) * FRAME_SIZE * PREVIEW_SCALE),
            )
        phases.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE))
    phases[0].save(
        output / f"{character}-{state}.gif",
        save_all=True,
        append_images=phases[1:],
        duration=140 if state == "walk" else 110,
        loop=0,
        disposal=2,
    )


def save_face_contact_sheet(
    output: Path, all_frames: dict[str, dict[str, dict[tuple[str, int], Image.Image]]]
) -> None:
    crop_width = FACE_CROP[2] - FACE_CROP[0]
    crop_height = FACE_CROP[3] - FACE_CROP[1]
    label_width = 160
    header_height = 24
    headers = ("idle", "walk0", "walk1", "walk2", "walk3", "atk0", "atk1", "atk2", "atk3")
    rows = len(all_frames) * len(DIRECTIONS)
    size = (label_width + len(headers) * crop_width * PREVIEW_SCALE, header_height + rows * crop_height * PREVIEW_SCALE)
    sheet = checker(size)
    draw = ImageDraw.Draw(sheet)
    for column, header in enumerate(headers):
        draw.text((label_width + column * crop_width * PREVIEW_SCALE + 4, 6), header, fill="white")
    row = 0
    for character, states in all_frames.items():
        for direction in DIRECTIONS:
            y = header_height + row * crop_height * PREVIEW_SCALE
            draw.text((8, y + 8), f"{character} {direction}", fill="white")
            sequence = [states["idle"][(direction, 0)]]
            sequence.extend(states["walk"][(direction, index)] for index in range(4))
            sequence.extend(states["attack"][(direction, index)] for index in range(4))
            for column, frame in enumerate(sequence):
                crop = frame.crop(FACE_CROP).resize((crop_width * PREVIEW_SCALE, crop_height * PREVIEW_SCALE), Image.Resampling.NEAREST)
                sheet.alpha_composite(crop, (label_width + column * crop_width * PREVIEW_SCALE, y))
            row += 1
    sheet.save(output / "face-contact-sheet.png", optimize=True)


def load_and_check(input_root: Path, output: Path, characters: tuple[str, ...]) -> tuple[list[Finding], dict, dict]:
    findings: list[Finding] = []
    all_frames: dict[str, dict[str, dict[tuple[str, int], Image.Image]]] = {}
    metrics: dict[str, object] = {}
    for character in characters:
        all_frames[character] = {}
        metrics[character] = {}
        for state, columns in STATES.items():
            path = input_root / character / f"{state}.png"
            label = f"{character}/{state}"
            if not path.exists():
                findings.append(Finding("error", label, "missing", f"missing sheet: {path}"))
                continue
            source = Image.open(path)
            has_alpha = "A" in source.getbands() or "transparency" in source.info
            expected_size = (FRAME_SIZE * columns, FRAME_SIZE * len(DIRECTIONS))
            if source.size != expected_size:
                findings.append(Finding("error", label, "dimensions", f"size {source.size}; expected {expected_size}"))
            if not has_alpha:
                findings.append(Finding("error", label, "alpha", f"mode {source.mode} has no transparency channel"))
            if source.size != expected_size:
                continue
            frames = split_sheet(source.convert("RGBA"), columns)
            all_frames[character][state] = frames
            state_metrics: dict[str, object] = {}
            for direction in DIRECTIONS:
                direction_frames = [frames[(direction, index)] for index in range(columns)]
                save_direction_strip(output, character, state, direction, direction_frames)
                direction_metrics = []
                for index, frame in enumerate(direction_frames):
                    frame_findings, frame_metrics = analyze_frame(frame, f"{label}/{direction}/{index}")
                    findings.extend(frame_findings)
                    direction_metrics.append(frame_metrics)
                baselines = [item["baseline"] for item in direction_metrics if item["baseline"] is not None]
                roots = [item["root_x"] for item in direction_metrics if item["root_x"] is not None]
                if baselines and max(baselines) - min(baselines) > 1:
                    findings.append(Finding("warning", f"{label}/{direction}", "baseline-drift", f"spread {max(baselines) - min(baselines)} px"))
                if roots and max(roots) - min(roots) > 3:
                    findings.append(Finding("warning", f"{label}/{direction}", "root-drift", f"spread {max(roots) - min(roots):.1f} px"))
                state_metrics[direction] = direction_metrics
            metrics[character][state] = state_metrics
            if state in ("walk", "attack"):
                save_state_gif(output, character, state, frames, columns)
        if set(STATES).issubset(all_frames[character]):
            findings.extend(check_temporal_stability(character, all_frames[character]))
    return findings, all_frames, metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="class sprite root")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="review artifact directory")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="exact production source root")
    parser.add_argument("--classes", nargs="+", choices=CLASSES, default=list(CLASSES))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    findings, all_frames, metrics = load_and_check(args.input.resolve(), output, tuple(args.classes))
    findings.extend(check_exact_sources(args.source.resolve(), tuple(args.classes)))
    if all(set(STATES).issubset(states) for states in all_frames.values()):
        save_face_contact_sheet(output, all_frames)

    errors = [finding for finding in findings if finding.severity == "error"]
    warnings = [finding for finding in findings if finding.severity == "warning"]
    report = {
        "contract": {"frame_size": [64, 64], "root_x": ROOT_X, "baseline_y": BASELINE_Y, "directions": DIRECTIONS, "states": STATES},
        "summary": {"technical_errors": len(errors), "diagnostic_warnings": len(warnings)},
        "findings": [asdict(finding) for finding in findings],
        "metrics": metrics,
        "visual_review_required": True,
    }
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    for finding in findings:
        print(f"[{finding.severity.upper()}] {finding.frame}: {finding.check}: {finding.message}")
    print(f"Technical errors: {len(errors)}; diagnostic warnings: {len(warnings)}")
    print(f"Review artifacts: {output}")
    print("TECHNICAL CHECKS COMPLETE - VISIBLE REVIEW IS STILL REQUIRED; THIS IS NOT A QA PASS")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
