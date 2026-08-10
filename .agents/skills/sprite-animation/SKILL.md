---
name: sprite-animation
description: Create and validate Ashvale character sprite sheets and animations from approved character designs. Use for idle, walk, attack, dodge, skill, hit, or defeat sprite animation work that must retain consistent frames, pivots, and Phaser preview validation.
---

# Ashvale Sprite Animation

1. Read `docs/art/ART_BIBLE.md`, `docs/art/CHARACTER_GUIDE.md`, and the approved character design/reference images before animating.
2. Use only an approved character design. Do not alter the hero's face, silhouette, proportions, equipment, palette roles, or lighting during animation.
3. Use the approved 48×64 px frame and shared centre-bottom ground pivot in every frame and direction.
4. Keep foot baseline, body height, collision-facing footprint, weapon length, and attachment points aligned. Check every frame as a strip and in motion.
5. Export consistently ordered sprite sheets with documented frame dimensions, directions, animation names, frame rate, and loop policy.
6. Load the sheet into a development-only Phaser preview and test at real logical game scale before reporting it complete.
7. Fix frame jitter, pivot drift, outline shifts, scale changes, and unreadable weapon arcs before handoff.
8. Do not redesign the character or add gameplay mechanics while creating animation assets.
