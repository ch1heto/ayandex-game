---
name: sprite-animation
description: Create or revise Ashvale character sprite animation from approved references. Use for idle, walk, attack, dodge, skill, hit, or defeat frames that must retain the canonical face, 64x64 cells, root x=32, baseline y=60, four-direction row order, equipment continuity, readable motion phases, and nearest-neighbour animation previews before Phaser integration.
---

# Ashvale Sprite Animation

## Prepare

1. Read `docs/art/ART_BIBLE.md`, `docs/art/CHARACTER_GUIDE.md`, and the approved four-direction character reference.
2. Use `64x64` cells, root `x=32`, baseline `y=60`, and direction order `down`, `left`, `up`, `right`.
3. Preserve the canonical face/head, silhouette, proportions, palette roles, lighting, weapon length, attachment points, cape, quiver, and staff side.
4. Animate from separate exact-size strips with transparent gutters. Never crop a fractional grid or allow poses to overlap neighbouring cells.

## Author readable phases

Keep gameplay root and baseline fixed. Let Phaser movement translate the body; never simulate travel by sliding the figure inside a cell.

### Idle

Use one stable frame per direction.

### Walk

Author four distinct phases per direction:

1. left-foot contact;
2. passing pose;
3. right-foot contact;
4. passing/recovery pose.

Change primarily legs, body counter-motion, cloth, and attached equipment. Reject identical legs, floating, moonwalking, root drift, baseline bounce, face regeneration, and accessories switching sides.

### Attack

Author four distinct phases per direction:

1. preparation;
2. swing, draw, or cast;
3. impact or release;
4. recovery.

Make the Warrior sword travel through the strike. Make the Archer bow, string, hands, and release readable. Keep the Mage staff visibly attached and stable. Reject random pixels behind the body, on the opposite side, or inherited from a neighbouring pose.

## Review motion

1. Assemble production sheets programmatically only from exact `64x64` cells: idle `64x256`, walk `256x256`, attack `256x256`.
2. Create nearest-neighbour enlarged strips and animated GIF or browser previews for every direction and state.
3. Inspect sequences at enlarged and real game scale for sliding, floating, jitter, silhouette popping, weapon disappearance, accessory swaps, and temporal face drift.
4. Load accepted sheets into the development Phaser preview and verify frame order, timing, loop policy, and impact frame `2`.
5. Run `$pixel-sprite-qa` and complete its mandatory visible review before reporting the animation complete or integrating it into runtime.
6. Do not redesign the character or add gameplay mechanics while animating.
