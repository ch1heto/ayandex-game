# Warrior

## Visual source of truth

The canonical Warrior is the original navy-and-silver class in `assets/characters/classes/warrior/`. It replaces the former LPC Warrior and every earlier Warrior sheet.

- Heavy readable silhouette.
- Dark navy clothing.
- Restrained silver armour highlights.
- Brown leather boots and belt.
- One-handed steel sword present in idle, walk, and attack.

## Runtime sheets

- `idle.png`: `1 x 4` cells.
- `walk.png`: `4 x 4` cells.
- `attack.png`: `4 x 4` cells.

The attack uses preparation, swing, impact, and recovery. The actual sword changes position through the arc. On the third frame, a `26x26` Arcade hitbox is placed `40` world pixels from the root in the locked cardinal direction. One target receives one hit from that attack.
