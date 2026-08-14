from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/ui/skills"
SIZE = 32


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def save(image: Image.Image, name: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT / name, optimize=True)


def warrior() -> None:
    image, draw = canvas()
    draw.polygon([(5, 24), (8, 20), (23, 5), (27, 5), (27, 9), (12, 24)], fill="#5b351d")
    draw.polygon([(8, 19), (21, 6), (26, 6), (26, 9), (12, 23)], fill="#eee0b4")
    draw.polygon([(12, 18), (21, 9), (24, 9), (15, 18)], fill="#fff4ca")
    draw.rectangle((5, 22, 16, 25), fill="#d79b3e")
    draw.rectangle((8, 25, 11, 29), fill="#7b4422")
    draw.rectangle((11, 5, 13, 11), fill="#ffdb63")
    draw.rectangle((7, 8, 18, 10), fill="#f2a735")
    save(image, "heavy-slash.png")


def archer() -> None:
    image, draw = canvas()
    draw.line((6, 4, 18, 16, 6, 28), fill="#5b2f19", width=3)
    draw.line((7, 4, 9, 16, 7, 28), fill="#d8ad5a", width=1)
    draw.line((8, 5, 20, 16, 8, 27), fill="#eadfb1", width=1)
    draw.line((8, 16, 27, 16), fill="#f1e4b6", width=2)
    draw.polygon([(28, 16), (23, 12), (23, 20)], fill="#f2bf52")
    draw.polygon([(10, 16), (6, 13), (6, 19)], fill="#b86829")
    save(image, "piercing-shot.png")


def mage() -> None:
    image, draw = canvas()
    draw.rectangle((13, 3, 18, 28), fill="#4b246f")
    draw.rectangle((3, 13, 28, 18), fill="#4b246f")
    draw.rectangle((8, 8, 23, 23), fill="#713ca0")
    draw.rectangle((11, 5, 20, 26), fill="#a968d1")
    draw.rectangle((5, 11, 26, 20), fill="#a968d1")
    draw.rectangle((11, 11, 20, 20), fill="#e5baff")
    draw.rectangle((14, 13, 22, 17), fill="#fff0ff")
    draw.rectangle((4, 4, 6, 6), fill="#ead1ff")
    draw.rectangle((25, 7, 27, 9), fill="#d495ff")
    draw.rectangle((5, 25, 7, 27), fill="#c779fa")
    save(image, "magic-burst.png")


if __name__ == "__main__":
    warrior()
    archer()
    mage()
    print(f"Skill icons built in {OUTPUT}")
