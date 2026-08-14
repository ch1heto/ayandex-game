"""Shared, conservative alpha and chroma-spill helpers for Ashvale assets."""

from __future__ import annotations

from collections import deque

from PIL import Image


Pixel = tuple[int, int, int, int]
Rgb = tuple[int, int, int]


def normalize_transparent_rgb(image: Image.Image) -> Image.Image:
    """Make fully transparent pixels deterministic and safe for resampling."""
    result = image.convert("RGBA").copy()
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            elif alpha != 255:
                pixels[x, y] = (red, green, blue, 255 if alpha >= 128 else 0)
    return result


def _looks_like_key(pixel: Pixel, key: Rgb, *, core: bool) -> bool:
    red, green, blue, alpha = pixel
    if alpha == 0:
        return False
    distance = abs(red - key[0]) + abs(green - key[1]) + abs(blue - key[2])
    if key == (255, 0, 255):
        dominance = min(red, blue) - green
        if core:
            return distance <= 118 or (red >= 150 and blue >= 125 and dominance >= 62)
        # Edge spill can be very dark after nearest-neighbour reduction. The
        # dual red/blue dominance keeps brown, navy, and green art out while
        # still catching the purple halo left at opaque silhouette pixels.
        return red >= 55 and blue >= 55 and dominance >= 38
    if key == (0, 255, 0):
        dominance = green - max(red, blue)
        if core:
            return distance <= 118 or (green >= 145 and dominance >= 58)
        return green >= 88 and dominance >= 36
    return distance <= (118 if core else 150)


def _touches_transparency(image: Image.Image, x: int, y: int) -> bool:
    pixels = image.load()
    return any(
        not (0 <= next_x < image.width and 0 <= next_y < image.height)
        or pixels[next_x, next_y][3] == 0
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
    )


def remove_edge_connected_chroma(image: Image.Image, key: Rgb) -> Image.Image:
    """Remove only key-like pixels connected to the image border.

    Generated catalog boards use one continuous flat background. Flooding from
    the border keeps similarly coloured interior artwork intact while removing
    the background and its darker key-colour drift.
    """
    source = image.convert("RGBA")
    pixels = source.load()
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    border = (
        [(x, 0) for x in range(source.width)]
        + [(x, source.height - 1) for x in range(source.width)]
        + [(0, y) for y in range(source.height)]
        + [(source.width - 1, y) for y in range(source.height)]
    )
    for point in border:
        if point in visited or not _looks_like_key(pixels[point], key, core=True):
            continue
        visited.add(point)
        queue.append(point)

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            point = (next_x, next_y)
            if point in visited or not (0 <= next_x < source.width and 0 <= next_y < source.height):
                continue
            if not _looks_like_key(pixels[point], key, core=True):
                continue
            visited.add(point)
            queue.append(point)

    result = source.copy()
    result_pixels = result.load()
    for x, y in visited:
        result_pixels[x, y] = (0, 0, 0, 0)
    return normalize_transparent_rgb(result)


def despill_transparent_edges(image: Image.Image, key: Rgb) -> Image.Image:
    """Recolour only key-like opaque boundary pixels from nearby object art."""
    result = normalize_transparent_rgb(image)
    for _ in range(8):
        cleaned, changed = _despill_one_edge_layer(result, key)
        result = cleaned
        if changed == 0:
            break
    return normalize_transparent_rgb(result)


def _despill_one_edge_layer(image: Image.Image, key: Rgb) -> tuple[Image.Image, int]:
    source = normalize_transparent_rgb(image)
    source_pixels = source.load()
    result = source.copy()
    result_pixels = result.load()
    candidates = [
        (x, y)
        for y in range(source.height)
        for x in range(source.width)
        if _touches_transparency(source, x, y)
        and _looks_like_key(source_pixels[x, y], key, core=False)
    ]
    candidate_set = set(candidates)

    for x, y in candidates:
        replacement: Pixel | None = None
        for radius in range(1, 5):
            neighbours = [
                (next_x, next_y)
                for next_y in range(max(0, y - radius), min(source.height, y + radius + 1))
                for next_x in range(max(0, x - radius), min(source.width, x + radius + 1))
                if abs(next_x - x) + abs(next_y - y) == radius
                and source_pixels[next_x, next_y][3] == 255
                and (next_x, next_y) not in candidate_set
            ]
            if neighbours:
                next_x, next_y = min(neighbours, key=lambda point: abs(point[0] - x) + abs(point[1] - y))
                replacement = source_pixels[next_x, next_y]
                break
        if replacement is not None:
            result_pixels[x, y] = replacement
    return normalize_transparent_rgb(result), len(candidates)


def clean_chroma_source(image: Image.Image, key: Rgb) -> Image.Image:
    return despill_transparent_edges(remove_edge_connected_chroma(image, key), key)


def remove_strong_key_edge_artifacts(image: Image.Image, key: Rgb) -> Image.Image:
    """Remove only highly saturated key-colour islands on transparent edges.

    This is intentionally stricter than despill and is suitable only for assets
    whose art contract excludes the key colour entirely.
    """
    result = normalize_transparent_rgb(image)
    for _ in range(8):
        source = result.copy()
        source_pixels = source.load()
        candidates = []
        for y in range(source.height):
            for x in range(source.width):
                red, green, blue, alpha = source_pixels[x, y]
                if alpha == 0 or not _touches_transparency(source, x, y):
                    continue
                if key == (255, 0, 255):
                    strong = red >= 75 and blue >= 75 and min(red, blue) - green >= 55
                else:
                    strong = green >= 90 and green - max(red, blue) >= 55
                if strong:
                    candidates.append((x, y))
        if not candidates:
            break
        result_pixels = result.load()
        for x, y in candidates:
            result_pixels[x, y] = (0, 0, 0, 0)
    return normalize_transparent_rgb(result)


def replace_strong_key_artifacts(image: Image.Image, key: Rgb) -> Image.Image:
    """Replace saturated key pixels anywhere in art known not to use the key."""
    source = normalize_transparent_rgb(image)
    source_pixels = source.load()
    result = source.copy()
    result_pixels = result.load()
    candidates: set[tuple[int, int]] = set()
    for y in range(source.height):
        for x in range(source.width):
            red, green, blue, alpha = source_pixels[x, y]
            if alpha == 0:
                continue
            if key == (255, 0, 255):
                strong = red >= 75 and blue >= 75 and min(red, blue) - green >= 55
            else:
                strong = green >= 90 and green - max(red, blue) >= 55
            if strong:
                candidates.add((x, y))

    for x, y in candidates:
        replacement: Pixel | None = None
        for radius in range(1, 9):
            neighbours = [
                (next_x, next_y)
                for next_y in range(max(0, y - radius), min(source.height, y + radius + 1))
                for next_x in range(max(0, x - radius), min(source.width, x + radius + 1))
                if abs(next_x - x) + abs(next_y - y) == radius
                and source_pixels[next_x, next_y][3] == 255
                and (next_x, next_y) not in candidates
            ]
            if neighbours:
                next_x, next_y = min(neighbours, key=lambda point: abs(point[0] - x) + abs(point[1] - y))
                replacement = source_pixels[next_x, next_y]
                break
        if replacement is not None:
            result_pixels[x, y] = replacement
    return normalize_transparent_rgb(result)


def suspicious_edge_pixels(image: Image.Image, key: Rgb) -> int:
    source = normalize_transparent_rgb(image)
    pixels = source.load()
    return sum(
        1
        for y in range(source.height)
        for x in range(source.width)
        if _touches_transparency(source, x, y) and _looks_like_key(pixels[x, y], key, core=False)
    )
