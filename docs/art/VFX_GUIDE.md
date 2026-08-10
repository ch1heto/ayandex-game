# Ashvale VFX Guide

## Principles

- Build VFX from crisp, pixel-art-compatible shapes, palette ramps, and whole-pixel placement.
- Use effects to reinforce timing, impact, and direction without obscuring actors, projectiles, telegraphs, or hazards.
- Keep particles short-lived, limited in count, and scaled to the strength of the action.
- Match the established lighting, palette contrast, and 3-quarter perspective.

## Future categories

| Category | Purpose | Readability rule |
| --- | --- | --- |
| Sword slash | Communicate melee arc and timing | Leave enemy silhouette and attack origin visible. |
| Hit spark | Confirm a successful hit | Use a brief, compact burst at the contact point. |
| Dodge dust | Ground a dodge and movement burst | Keep it low to the ground and behind the actor. |
| Enemy hit | Show damage response | Avoid a full-screen flash or persistent overlay. |
| Enemy death | Mark defeat and cleanup | Fade quickly; do not hide loot or nearby hazards. |
| Loot pickup | Confirm collection and reward | Use a small upward motion and readable colour cue. |

Prefer Phaser particles or effects only when they preserve performance and gameplay clarity. Do not turn combat into visual noise.
