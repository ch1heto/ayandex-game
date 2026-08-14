from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
TILE = 32
WIDTH = 120
HEIGHT = 64
HUB_X = 60
HUB_Y = 32
RNG = random.Random(0xA57A1E)


def stable_noise(x: int, y: int) -> float:
    value = (x * 73856093) ^ (y * 19349663) ^ 0x51A7
    value = (value * 1664525 + 1013904223) & 0xFFFFFFFF
    return value / 0xFFFFFFFF


def distance_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    segment_x, segment_y = bx - ax, by - ay
    length_squared = segment_x * segment_x + segment_y * segment_y
    if length_squared == 0:
        return math.hypot(px - ax, py - ay)
    amount = max(0.0, min(1.0, ((px - ax) * segment_x + (py - ay) * segment_y) / length_squared))
    return math.hypot(px - (ax + segment_x * amount), py - (ay + segment_y * amount))


def irregular_stone(seed: int) -> Image.Image:
    rng = random.Random(seed)
    base = [(73, 76, 70), (78, 80, 72), (68, 72, 67), (82, 82, 73)][seed % 4]
    tile = Image.new("RGBA", (TILE, TILE), (*base, 255))
    draw = ImageDraw.Draw(tile)
    points = []
    for row in range(3):
        for column in range(3):
            cx = column * 12 + rng.randint(-4, 4)
            cy = row * 12 + rng.randint(-4, 4)
            radius_x = rng.randint(7, 12)
            radius_y = rng.randint(6, 11)
            polygon = []
            for index in range(8):
                angle = math.tau * index / 8
                polygon.append((
                    round(cx + math.cos(angle) * radius_x * rng.uniform(.72, 1.05)),
                    round(cy + math.sin(angle) * radius_y * rng.uniform(.72, 1.05)),
                ))
            shade = rng.randint(-8, 8)
            fill = tuple(max(0, min(255, channel + shade)) for channel in base)
            draw.polygon(polygon, fill=(*fill, 255), outline=(43, 47, 43, 255))
            points.append((cx, cy))
    for cx, cy in points:
        if rng.random() < .65:
            draw.point((max(0, min(31, cx + 2)), max(0, min(31, cy - 2))), fill=(113, 111, 91, 255))
    return tile


def build_tileset() -> None:
    atlas = Image.new("RGBA", (16 * TILE, TILE), (0, 0, 0, 255))
    glade = [
        ROOT / f"assets/environments/twilight-glade/tiles/grass-{index}.png"
        for index in range(1, 5)
    ] + [
        ROOT / f"assets/environments/twilight-glade/tiles/dirt-{index}.png"
        for index in range(1, 3)
    ]
    for index, path in enumerate(glade):
        atlas.alpha_composite(Image.open(path).convert("RGBA"), (index * TILE, 0))
    for index in range(4):
        atlas.alpha_composite(irregular_stone(index), ((6 + index) * TILE, 0))
    for index in range(2):
        source = Image.open(glade[4 + index]).convert("RGBA")
        draw = ImageDraw.Draw(source)
        for _ in range(13):
            x, y = RNG.randrange(32), RNG.randrange(32)
            draw.point((x, y), fill=(76, 76 + index * 5, 55, 255))
        atlas.alpha_composite(source, ((10 + index) * TILE, 0))
    spider = Image.open(ROOT / "assets/tilesets/spider-hollow.png").convert("RGBA")
    for index in range(4):
        atlas.alpha_composite(spider.crop((index * 32, 0, (index + 1) * 32, 32)), ((12 + index) * TILE, 0))
    output = ROOT / "assets/tilesets/ashvale-world.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)


def tile_for(x: int, y: int) -> int:
    noise = stable_noise(x, y)
    nx = (x - HUB_X) / 14.5
    ny = (y - HUB_Y) / 9.2
    hub_distance = nx * nx + ny * ny
    angle = math.atan2(ny, nx)
    organic_edge = 1 + math.sin(angle * 3.0) * .08 + math.cos(angle * 5.0) * .05 + (noise - .5) * .22
    hub_path_distance = min(
        distance_to_segment(x, y, 60, 38, 60, 46),
        distance_to_segment(x, y, 60, 38, 52, 35),
        distance_to_segment(x, y, 60, 38, 68, 35),
    )
    path_width = 1.15 + stable_noise(x + 31, y + 17) * .8
    if hub_distance < organic_edge * 1.08 and hub_path_distance < path_width:
        if stable_noise(x + 3, y + 29) > .18:
            return 11 + int(noise * 2)
    if hub_distance < organic_edge * .78:
        return 7 + int(noise * 4)  # Tiled gid 7..10: irregular stone
    if hub_distance < organic_edge * 1.18:
        stone_chance = max(0.0, min(1.0, (organic_edge * 1.18 - hub_distance) / .40))
        if noise < stone_chance * .46:
            return 7 + int(stable_noise(y, x + 13) * 4)
        if stable_noise(x + 7, y + 19) < .67:
            return 11 + int(noise * 2)  # dirt/grass transition ring

    spider_edge = 79 + round(math.sin(y * .43) * 3 + (stable_noise(y, x) - .5) * 7)
    if x >= spider_edge + 6:
        return 13 + int(noise * 4)  # dark soil
    if x >= spider_edge - 5:
        blend = (x - (spider_edge - 5)) / 11
        if noise < blend:
            return 13 + int(stable_noise(y, x + 9) * 4)
        return 11 + int(noise * 2)

    path_y = HUB_Y + math.sin(x * .18) * 1.7
    path_half_width = 2.2 + stable_noise(x, 7) * 1.8
    if abs(y - path_y) < path_half_width:
        return 5 + int(noise * 2)
    return 1 + int(noise * 4)


def point_object(identifier: int, name: str, kind: str, x: int, y: int, texture: str | None = None) -> dict:
    result = {"id": identifier, "name": name, "type": kind, "point": True, "x": x, "y": y, "rotation": 0, "visible": True, "properties": []}
    if texture:
        result["properties"] = [{"name": "texture", "type": "string", "value": texture}]
    return result


def rect_object(identifier: int, name: str, x: int, y: int, width: int, height: int) -> dict:
    return {"id": identifier, "name": name, "type": "collision", "x": x, "y": y, "width": width, "height": height, "rotation": 0, "visible": True}


PROP_FOOTPRINTS: dict[str, tuple[int, int]] = {
    "tree-a": (22, 19),
    "tree-b": (22, 19),
    "rock-a": (52, 24),
    "rock-b": (52, 22),
    "stump": (30, 14),
}


def build_map() -> None:
    objects = []
    collisions = []
    spawns = []
    next_id = 1

    def prop(name: str, texture: str, x: int, y: int, footprint: tuple[int, int] | None = None) -> None:
        nonlocal next_id
        objects.append(point_object(next_id, name, "prop", x, y, texture)); next_id += 1
        resolved_footprint = footprint or PROP_FOOTPRINTS.get(texture)
        if resolved_footprint:
            width, height = resolved_footprint
            collisions.append(rect_object(next_id, f"{name}-footprint", x - width // 2, y - height, width, height)); next_id += 1

    # The western biome preserves the established Twilight Glade language while
    # opening a broad walkable corridor toward the central hub.
    west_props = [
        ("tree-a", 125, 205), ("tree-b", 360, 145), ("tree-a", 670, 185),
        ("tree-b", 955, 150), ("tree-a", 1190, 260), ("tree-b", 150, 590),
        ("tree-a", 470, 700), ("tree-b", 930, 650), ("tree-a", 1160, 760),
        ("rock-a", 260, 390), ("rock-b", 790, 470), ("rock-a", 1040, 900),
        ("stump", 520, 320), ("stump", 1110, 520),
    ]
    for index, (texture, x, y) in enumerate(west_props):
        prop(f"west-{texture}-{index}", texture, x, y)
    for index, (texture, x, y) in enumerate([
        ("bush-a", 310, 580), ("bush-b", 730, 240), ("fern", 880, 790),
        ("flowers-gold", 560, 850), ("flowers-white", 1060, 360), ("sprout", 1280, 610),
    ]): prop(f"west-detail-{index}", texture, x, y)

    # The east uses only the already-integrated Spider Hollow props.
    east_props = [
        ("dead-tree", 2740, 230, (48, 32)), ("ember-rock-a", 3060, 290, (58, 26)),
        ("dead-tree", 3470, 360, (48, 32)), ("ember-rock-b", 3260, 740, (58, 26)),
        ("thorn-bush", 2820, 820, (44, 20)), ("burnt-stump", 3560, 900, (42, 19)),
        ("web-large", 2960, 560, None), ("web-small", 3380, 610, None),
        ("ember-plant", 3160, 470, None), ("ember-plant", 3650, 660, None),
    ]
    for index, (texture, x, y, footprint) in enumerate(east_props):
        prop(f"east-{texture}-{index}", texture, x, y, footprint)

    # Sparse existing props frame the settlement without blocking its paths.
    hub_props = [
        ("rock-a", 1460, 1190, None), ("flowers-white", 1510, 1290, None),
        ("stump", 1585, 1365, (26, 12)), ("fern", 1730, 1370, None),
        ("flowers-gold", 2075, 1380, None), ("rock-b", 2275, 1280, None),
        ("sprout", 2370, 1180, None), ("bush-a", 2300, 1370, None),
    ]
    for index, (texture, x, y, footprint) in enumerate(hub_props):
        prop(f"hub-{texture}-{index}", texture, x, y, footprint)

    spawns.append(point_object(next_id, "player", "player-spawn", HUB_X * TILE, (HUB_Y + 8) * TILE)); next_id += 1
    for index, (x, y) in enumerate([(280, 270), (520, 520), (760, 310), (970, 540), (1210, 400), (1140, 820), (430, 850)]):
        spawns.append(point_object(next_id, f"slime-{index}", "moss-slime-spawn", x, y)); next_id += 1
    for index, (x, y) in enumerate([(2700, 360), (2910, 690), (3120, 410), (3310, 840), (3540, 520), (3650, 920), (3180, 1030)]):
        spawns.append(point_object(next_id, f"spider-{index}", "ember-spider-spawn", x, y)); next_id += 1

    layers = [
        {"id": 1, "name": "Ground", "type": "tilelayer", "width": WIDTH, "height": HEIGHT, "x": 0, "y": 0, "opacity": 1, "visible": True, "data": [tile_for(x, y) for y in range(HEIGHT) for x in range(WIDTH)]},
        {"id": 2, "name": "WorldObjects", "type": "objectgroup", "objects": objects, "opacity": 1, "visible": True},
        {"id": 3, "name": "Collision", "type": "objectgroup", "objects": collisions, "opacity": 1, "visible": True},
        {"id": 4, "name": "Spawns", "type": "objectgroup", "objects": spawns, "opacity": 1, "visible": True},
    ]
    document = {
        "compressionlevel": -1, "height": HEIGHT, "width": WIDTH, "infinite": False,
        "orientation": "orthogonal", "renderorder": "right-down", "tileheight": TILE, "tilewidth": TILE,
        "tiledversion": "1.11.2", "type": "map", "version": "1.10", "layers": layers,
        "nextlayerid": 5, "nextobjectid": next_id,
        "tilesets": [{"firstgid": 1, "name": "ashvale-world", "columns": 16, "image": "../assets/tilesets/ashvale-world.png", "imageheight": 32, "imagewidth": 512, "margin": 0, "spacing": 0, "tilecount": 16, "tileheight": 32, "tilewidth": 32}],
    }
    output = ROOT / "maps/ashvale-world.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    build_tileset()
    build_map()
    print(f"Ashvale world built: {WIDTH * TILE}x{HEIGHT * TILE}px")
