---
name: combat-vfx
description: Design and implement readable, pixel-compatible Ashvale combat VFX. Use for sword slashes, hit sparks, dodge dust, enemy hit/death, loot pickup, Phaser particles, and screen feedback that must preserve gameplay readability.
---

# Ashvale Combat VFX

1. Read `docs/art/VFX_GUIDE.md` and `docs/art/ART_BIBLE.md` completely before designing or implementing an effect.
2. Use pixel-art-compatible shapes, palettes, whole-pixel placement, and the established upper-left lighting language.
3. Prioritize readability: VFX must clarify timing, impact, direction, and reward without covering actors, projectiles, hazards, enemy telegraphs, or UI.
4. Keep particle counts, lifetime, spread, and screen coverage proportional to action strength. Avoid persistent overlays and visual noise.
5. Prefer Phaser particles or effects only when they improve the result and remain within browser performance limits.
6. Test effects in the real Phaser scene at game scale, including dense combat conditions, before calling them complete.
7. Work only on requested categories. Do not add unrelated combat mechanics, animations, or characters.
