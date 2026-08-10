# Archer

The canonical Archer is the original green-and-leather class in `assets/characters/classes/archer/`.

- Light readable silhouette.
- Forest-green layered clothing.
- Wooden bow visible in every state.
- Quiver and arrows identify the class from the back and side.

`idle.png` contains one frame per direction; `walk.png` and `attack.png` contain four frames per direction. The third attack frame releases `assets/projectiles/arrow.png`. Projectile velocity is a normalized vector from the bow muzzle to the stored click position, with constant speed `350` and maximum range `430` world pixels. It is destroyed on hit and can damage a target only once.
