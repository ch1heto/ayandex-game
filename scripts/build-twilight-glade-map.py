from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "maps" / "twilight-glade.json"
TILE_SIZE = 32
WIDTH = 40
HEIGHT = 22


def property_list(**values: object) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    for name, value in values.items():
        value_type = "bool" if isinstance(value, bool) else "string"
        result.append({"name": name, "type": value_type, "value": value})
    return result


def point_object(object_id: int, name: str, class_name: str, x: int, y: int, **properties: object) -> dict[str, object]:
    return {
        "id": object_id,
        "name": name,
        "type": class_name,
        "point": True,
        "x": x,
        "y": y,
        "rotation": 0,
        "visible": True,
        "properties": property_list(**properties),
    }


def rect_object(object_id: int, name: str, x: int, y: int, width: int, height: int) -> dict[str, object]:
    return {
        "id": object_id,
        "name": name,
        "type": "collision",
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "rotation": 0,
        "visible": True,
    }


def build_ground() -> list[int]:
    data: list[int] = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            selector = (x * 11 + y * 7 + x * y * 3) % 29
            data.append(1 + (selector % 4 if selector in (0, 7) else 0))
    return data


def build_path() -> list[int]:
    data = [0] * (WIDTH * HEIGHT)

    def paint(x: int, y: int) -> None:
        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
            data[y * WIDTH + x] = 6 if (x * 5 + y * 3) % 11 == 0 else 5

    for x in range(1, WIDTH - 1):
        center = 11 + (1 if x < 8 else -1 if x > 31 else 0)
        for y in range(center - 1, center + 2):
            paint(x, y)

    for y in range(2, HEIGHT - 1):
        center = 20 + (1 if y < 7 else 0)
        for x in range(center - 1, center + 2):
            paint(x, y)

    for y in range(8, 15):
        for x in range(17, 24):
            if (x - 20) ** 2 + (y - 11) ** 2 <= 14:
                paint(x, y)
    return data


def build_objects() -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    props: list[dict[str, object]] = []
    collisions: list[dict[str, object]] = []
    spawns: list[dict[str, object]] = []
    object_id = 1

    tree_points = [
        (96, 150, "tree-a"), (220, 132, "tree-b"), (365, 138, "tree-a"),
        (510, 126, "tree-b"), (800, 130, "tree-a"), (950, 134, "tree-b"),
        (1125, 150, "tree-a"), (82, 330, "tree-b"), (74, 520, "tree-a"),
        (1210, 328, "tree-a"), (1204, 535, "tree-b"), (120, 696, "tree-b"),
        (310, 688, "tree-a"), (485, 700, "tree-b"), (795, 698, "tree-a"),
        (1035, 690, "tree-b"), (1190, 690, "tree-a"), (360, 365, "tree-a"),
        (910, 430, "tree-b"),
    ]
    for x, y, texture in tree_points:
        props.append(point_object(object_id, texture, "tree", x, y, texture=texture))
        object_id += 1
        collisions.append(rect_object(object_id, f"{texture}-trunk", x - 11, y - 21, 22, 19))
        object_id += 1

    rock_points = [
        (245, 305, "rock-a"), (535, 590, "rock-b"), (740, 525, "rock-a"),
        (1110, 355, "rock-b"), (180, 610, "rock-b"), (825, 245, "rock-a"),
    ]
    for x, y, texture in rock_points:
        props.append(point_object(object_id, texture, "rock", x, y, texture=texture))
        object_id += 1
        collisions.append(rect_object(object_id, f"{texture}-body", x - 24, y - 23, 48, 21))
        object_id += 1

    decorative_points = [
        (155, 260, "bush-a", "bush"), (295, 470, "bush-b", "bush"),
        (430, 510, "bush-a", "bush"), (630, 150, "bush-b", "bush"),
        (720, 650, "bush-a", "bush"), (1010, 335, "bush-b", "bush"),
        (1145, 610, "bush-a", "bush"), (570, 245, "stump", "stump"),
        (335, 590, "stump", "stump"), (690, 470, "fern", "plant"),
        (455, 280, "fern", "plant"), (1060, 460, "flowers-gold", "plant"),
        (615, 590, "flowers-white", "plant"), (275, 390, "flowers-white", "plant"),
        (760, 335, "sprout", "plant"), (1040, 640, "flowers-white", "plant"),
    ]
    for x, y, texture, class_name in decorative_points:
        props.append(point_object(object_id, texture, class_name, x, y, texture=texture))
        object_id += 1
        if class_name == "stump":
            collisions.append(rect_object(object_id, f"{texture}-body", x - 16, y - 12, 32, 12))
            object_id += 1

    props.append(point_object(object_id, "forest-pond", "ground", 1045, 235, texture="pond", ground=True))
    object_id += 1
    collisions.append(rect_object(object_id, "forest-pond-water", 987, 177, 116, 116))
    object_id += 1

    spawns.append(point_object(object_id, "player", "player-spawn", 640, 356))
    object_id += 1
    slime_points = [(220, 215), (395, 180), (1020, 145), (955, 520), (1045, 560), (875, 610), (255, 555)]
    for index, (x, y) in enumerate(slime_points):
        spawns.append(point_object(object_id, f"moss-slime-{index + 1}", "moss-slime-spawn", x, y))
        object_id += 1

    return props, collisions, spawns


def main() -> None:
    props, collisions, spawns = build_objects()
    map_data = {
        "compressionlevel": -1,
        "height": HEIGHT,
        "infinite": False,
        "layers": [
            {
                "id": 1,
                "name": "Ground",
                "type": "tilelayer",
                "width": WIDTH,
                "height": HEIGHT,
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "data": build_ground(),
            },
            {
                "id": 2,
                "name": "Paths",
                "type": "tilelayer",
                "width": WIDTH,
                "height": HEIGHT,
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "data": build_path(),
            },
            {"id": 3, "name": "WorldObjects", "type": "objectgroup", "objects": props, "opacity": 1, "visible": True},
            {"id": 4, "name": "Collision", "type": "objectgroup", "objects": collisions, "opacity": 1, "visible": True},
            {"id": 5, "name": "Spawns", "type": "objectgroup", "objects": spawns, "opacity": 1, "visible": True},
        ],
        "nextlayerid": 6,
        "nextobjectid": max(object_data["id"] for object_data in props + collisions + spawns) + 1,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.11.2",
        "tileheight": TILE_SIZE,
        "tilesets": [
            {
                "firstgid": 1,
                "name": "twilight-glade",
                "columns": 6,
                "image": "../assets/tilesets/twilight-glade.png",
                "imageheight": 32,
                "imagewidth": 192,
                "margin": 0,
                "spacing": 0,
                "tilecount": 6,
                "tileheight": 32,
                "tilewidth": 32,
            }
        ],
        "tilewidth": TILE_SIZE,
        "type": "map",
        "version": "1.10",
        "width": WIDTH,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(map_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({WIDTH}x{HEIGHT} tiles).")


if __name__ == "__main__":
    main()
