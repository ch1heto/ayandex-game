---
name: pixel-character
description: Create or revise Ashvale pixel-art character concepts, canonical four-direction references, and production-ready character source art. Use for character generation or edits that must preserve the approved 64x64 frame contract, identity, face, equipment, palette, root, baseline, transparent source layout, and downstream idle, walk, or attack consistency.
---

# Ashvale Pixel Character

## Establish the contract

1. Read `docs/art/ART_BIBLE.md` and `docs/art/CHARACTER_GUIDE.md` completely.
2. Inspect the approved character references and current runtime sprites before creating or editing art.
3. Use original top-down / three-quarter-view pixel art with crisp connected clusters, limited palette, upper-left lighting, and readable silhouettes.
4. Target a `64x64` production frame with root `x=32`, ground baseline `y=60`, and direction order `down`, `left`, `up`, `right`.
5. Preserve one identity, height, body proportions, outline weight, palette roles, lighting, weapon, and accessory placement across directions and states.

## Build stable source art

1. Treat an approved four-direction neutral reference as the source of truth. Create it before production poses if none exists.
2. Lock one canonical face and head for each direction. Reuse those pixels through idle, walk, and attack; do not regenerate the face independently in every frame.
3. Keep class cues stable: Warrior sword and navy/silver mass, Archer bow/quiver and forest-green layers, Mage staff and violet robe.
4. Prefer direct transparency whenever the image workflow supports it.
5. Use chroma key only as a fallback. Isolate key cleanup from legitimate Mage purple, Warrior blue, and Archer green; never apply a broad hue deletion.

## Choose an integer source layout

Prefer separate, reviewable source units:

- one canonical four-direction reference;
- one idle frame per direction;
- one four-frame walk strip per direction;
- one four-frame attack strip per direction.

Require exact integer cell dimensions and generous transparent gutters. Keep figures from touching or overlapping neighbouring cells. If a single master sheet is unavoidable, require its width and height to divide evenly by the declared column and row counts. Do not use the legacy `1536x1024` 4-by-9 master layout for new work because its columns are fractional.

## Gate production use

1. Review each source at nearest-neighbour enlargement and at real game scale.
2. Reject stray pixels, fringe, chroma spill, detached clusters, neighbour contamination, identity drift, face changes, accessory swaps, or unstable equipment attachment.
3. Do not integrate or call the art complete until `$pixel-sprite-qa` has performed both technical checks and mandatory visual review.
4. Keep concept work separate from gameplay changes and unrelated classes.
