# Ashvale Character Guide

## Canonical base classes

The current source of truth is the original three-class set under `assets/characters/classes/`. Former LPC and AI Warrior assets are retired and must not be restored to runtime.

| Class | Idle | Walk | Basic attack |
| --- | --- | --- | --- |
| Warrior | static, 4 directions | 4 frames/direction | 4-frame sword slash + melee hitbox |
| Archer | static, 4 directions | 4 frames/direction | 4-frame bow release + arrow projectile |
| Mage | static, 4 directions | 4 frames/direction | 4-frame staff cast + magic projectile |

Every sheet uses `64x64` cells, four direction rows in the order `down`, `left`, `up`, `right`, root `x=32`, and baseline `y=60`.

## Runtime contract

- WASD drives normalized Arcade Physics movement.
- Movement determines facing while not attacking.
- Mouse movement alone never changes facing.
- LMB snapshots the mouse world position, selects the nearest cardinal facing, and locks that facing through the attack.
- RMB, middle mouse, and mouse wheel have no combat binding.
- Attack impact/release occurs on authored frame index `2` (third frame).
- On animation completion, the player returns to the correct static idle or starts walking on the next update.

## QA

`ArtPreviewScene` shows one selected class at large `1.5x` and real game `1x` scale. Use `1`, `2`, and `3` to switch between Warrior, Archer, and Mage. Each state is shown in all four directions against a 32px grid with visible baselines.
