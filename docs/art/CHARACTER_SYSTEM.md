# Character System

## Code structure

- `src/entities/player/PlayerCharacter.ts`: shared state machine (`idle`, `move`, `attack`), normalized movement, facing, class switching, and animation events.
- `src/entities/player/characterAssets.ts`: asset loading, frame mapping, and animation registration.
- `src/entities/player/playerTypes.ts`: class, direction, state, and attack event types.
- `src/data/playerClasses.ts`: movement speed, damage, projectile speed, and range.
- `src/combat/ProjectileSystem.ts`: straight arrow and magic projectile lifecycle/collision.
- `src/entities/TestDummy.ts`: development target and damage readout.

## Test controls

- `WASD`: movement and non-attack facing.
- `LMB`: basic attack toward the cursor position captured at click time.
- `1`: Warrior.
- `2`: Archer.
- `3`: Mage.
- `P` on the development main menu: ArtPreviewScene.

No basic attack is bound to RMB, middle mouse, or mouse wheel.

## Technical source pipeline

The built-in image generation workflow produced original chroma-key master sheets. `scripts/process-class-sprites.py` performs deterministic technical processing only: key-fringe cleanup, connected-component noise removal, nearest-neighbour normalization, root/baseline alignment, per-frame export, and final sheet assembly. It does not draw or redesign the characters.
