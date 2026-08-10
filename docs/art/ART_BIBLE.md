# Ashvale Art Bible

## Visual target

Ashvale uses original clean pixel art for a readable top-down / three-quarter-view action RPG. Readability has priority over detail.

- Default world tile: `32x32 px`.
- Character production frame: `64x64 px`.
- Character root: `x=32`; shared ground baseline: `y=60`.
- Direction row order: `down`, `left`, `up`, `right`.
- Nearest-neighbour filtering only; no smoothing or scale animation.
- Use crisp, connected pixel clusters and a limited palette.
- No detached noise, neighbouring-frame contamination, drifting root, or jumping baseline.

## Current class language

| Class | Primary palette | Required silhouette cue |
| --- | --- | --- |
| Warrior | navy blue, restrained silver, brown leather | heaviest body shape and one-handed sword |
| Archer | forest green and brown leather | light layered clothing, bow and quiver |
| Mage | violet, deep purple, small gold accents | fantasy robe shape, staff and crystal |

All three classes share pixel density, proportions, upper-left lighting, outline weight, frame size, root, and baseline. Their silhouettes and primary colours must remain immediately distinguishable at game scale.

## Animation standard

- `idle`: one static frame per direction.
- `walk`: four frames per direction: contact, passing, opposite contact, passing.
- `attack`: four frames per direction: preparation, action, impact/release, recovery.
- Body translation comes only from Arcade Physics. Animation frames never move the gameplay root.
- Weapons must visibly participate in attacks: sword swing, bow draw/release, staff aim/cast.

## Production asset policy

Generated masters are source material, not runtime textures. The technical asset pipeline may remove chroma-key colour, tiny disconnected artifacts, and normalize placement, but it must not redraw or procedurally invent character pixels. Runtime sheets live in `assets/characters/classes/`.
