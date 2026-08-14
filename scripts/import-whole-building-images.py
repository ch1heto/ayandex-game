from __future__ import annotations

from collections import deque
from pathlib import Path
from shutil import copyfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RESAMPLE = Image.Resampling.NEAREST
SOURCES = {
    "forge-ruined": Path(r"C:\Users\vanse\AppData\Local\Temp\codex-clipboard-bcfba6c6-5eb4-4361-922c-bc62e00d1e3f.png"),
    "infirmary-ruined": Path(r"C:\Users\vanse\AppData\Local\Temp\codex-clipboard-8594d225-71b5-453d-b529-86811fe4109c.png"),
    "forge-restored": Path(r"C:\Users\vanse\AppData\Local\Temp\codex-clipboard-22fe991f-4725-4046-a4d2-f0d361320072.png"),
    "infirmary-restored": Path(r"C:\Users\vanse\AppData\Local\Temp\codex-clipboard-dfcef6e0-4451-46e2-aea4-f0b6d4122074.png"),
}


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    # All four supplied images use a connected dark blue vignette. Restricting
    # removal to border-connected cool pixels preserves dark roof/door cavities.
    return max(red, green, blue) <= 72 and blue >= red + 4 and blue >= green


def remove_connected_background(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not is_background(pixels[x, y]):
            continue
        visited.add((x, y))
        pixels[x, y] = (0, 0, 0, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Building extraction produced an empty image")
    cropped = image.crop(bbox)
    # Runtime assets use one opaque/transparent pixel grid with zeroed hidden RGB.
    data = []
    for red, green, blue, alpha in cropped.getdata():
        data.append((red, green, blue, 255) if alpha else (0, 0, 0, 0))
    cropped.putdata(data)
    return cropped


def fit_whole(image: Image.Image, maximum: tuple[int, int]) -> Image.Image:
    scale = min(maximum[0] / image.width, maximum[1] / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, RESAMPLE)


def main() -> None:
    source_dir = ROOT / "assets/source/hub/whole-buildings"
    output_dir = ROOT / "assets/environments/ashvale-hub/whole-buildings"
    source_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, source_path in SOURCES.items():
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        copyfile(source_path, source_dir / f"{name}-source.png")
        building = fit_whole(remove_connected_background(Image.open(source_path)), (400, 368))
        building.save(output_dir / f"{name}.png", optimize=True)
        print(f"{name}: {building.width}x{building.height}")


if __name__ == "__main__":
    main()
