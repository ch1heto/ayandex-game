# Mage

The canonical Mage is the original violet-and-gold class in `assets/characters/classes/mage/`.

- Fantasy robe silhouette.
- Violet and deep-purple palette with restrained gold trim.
- Staff and compact violet crystal visible in every state.

`idle.png` contains one frame per direction; `walk.png` and `attack.png` contain four frames per direction. The third attack frame releases `assets/projectiles/magic-bolt.png` from the staff-side muzzle. The bolt travels directly toward the stored click position at constant speed `300`, has no gravity or homing, and expires after `390` world pixels or its first hit.
