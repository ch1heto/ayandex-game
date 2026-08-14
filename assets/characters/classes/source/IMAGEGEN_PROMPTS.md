# Image generation record

Mode: built-in GPT Image workflow. Use case: `stylized-concept`.

## Shared character prompt contract

Create an original production pixel-art RPG class sheet on a perfectly flat chroma-key background. Use true crisp pixel clusters, a limited palette, upper-left lighting, no anti-aliasing, no text, no shadows, no detached noise, and no copied commercial design. Exact layout: four direction rows (`down`, `left`, `up`, `right`) and nine columns: one static idle, four walk phases, and four basic-attack phases. Keep one identity, scale, root, and baseline across all 36 figures. Intended runtime cell size is `64x64`.

## Warrior prompt

Heavy original warrior; navy clothing, restrained silver armour, brown leather, one-handed steel sword. Sword must visibly move through preparation, swing, impact, and recovery in every direction.

## Archer prompt

Light original archer in forest-green layered clothing with leather bracers/boots, readable face, wooden bow, and quiver. Attack phases: raise, visibly draw a nocked arrow, release, recovery.

## Mage prompt

Original fantasy mage in violet/deep-purple robes with small gold accents and a crystal staff. Attack phases: aim staff, gather compact energy at the tip, release, recovery; no large explosion.

## Projectile prompt

Two isolated right-facing pixel assets on a flat green chroma-key background: a slim wooden arrow with steel tip and pale fletching, and a compact violet-white diamond-shaped magic bolt with a very short tail. No extra objects, particles, text, or shadows.

## Face and walk polish edit (2026-08-11)

Mode: built-in GPT Image edit workflow. Use case: `precise-object-edit`.

Shared edit contract: use the existing alpha master as the edit target and exact source of truth. Preserve the `1536x1024` canvas, `4 x 9` layout, approved identity, proportions, silhouette, clothing, weapon, palette, lighting, root, and baseline. Polish only the facial pixel clusters so the eyes are small, deliberate, and readable at runtime `64x64`; remove random black facial blotches; keep one identity through idle, walk, and attack. Keep crisp connected pixel clusters with no anti-aliasing, smoothing, detached pixels, alpha islands, horizontal body drift, text, or watermark. Generate Warrior and Archer on flat `#ff00ff`; generate Mage on flat `#00ff00`; remove the key locally with a hard alpha edge.

- Warrior: change leg motion only in walk down, left, and up to contact / passing / opposite contact / recovery. Preserve the already-approved right walk and all attack motion.
- Archer: change only lower-leg motion in all four walk directions. Keep the quiver, strap, and arrows attached to the same left side of the back in all four walk-down frames; never swap sides or change form.
- Mage: change leg motion only in walk left. Preserve down, up, and right. Keep the staff visible and fixed to the hand through all four left-walk frames.

## Warrior targeted polish and Archer rebuild (2026-08-12)

This is the active production workflow for Warrior and Archer. Mage is approved and locked; do not regenerate, normalize, or rewrite any Mage source or runtime file.

The built-in image workflow did not provide reliable direct transparency for this pass, so flat magenta was used only as a documented technical fallback for the large generation intermediates. Each `*-raw.png` was converted locally to its paired `*-alpha.png` with border-key sampling, soft matte, edge contraction, and despill. Runtime and `source/production` files use transparent binary alpha and contain no magenta candidates after QA. Do not ship or load the raw intermediates at runtime.

### Warrior

- `warrior-face-reference-*`: four-direction face/eye reference only. Preserve the existing hair, navy clothing, silver armour, sword, proportions, and silhouette.
- `warrior-walk-4x4-*`: contact / passing / opposite contact / recovery reference. Integrate only lower-body footwork for down, left, and up.
- Preserve walk right. Preserve attack motion; only confirmed fringe/artifact pixels may be repaired.

### Archer

- `archer-canonical-2x2-*`: canonical down, left, up, right idle identity.
- `archer-walk-4x4-*`: four directions by four true walk phases.
- `archer-attack-4x4-*`: four directions by preparation, draw, release, recovery. Release remains frame 2; no flying projectile is drawn into the body sprite.
- Forest-green clothing, leather equipment, bow, quiver, strap, and arrow placement remain continuous. The canonical idle head is reused across animation frames.

### Exact production layout

`scripts/assemble-class-sprite-art.py` removes neighbour-cell contamination, snaps binary alpha, locks root `x=32` and baseline `y=60`, applies the approved targeted patches, and writes exact integer-cell sources:

- `source/production/<class>/idle.png` = `64x256`;
- `source/production/<class>/walk.png` = `256x256`;
- `source/production/<class>/attack.png` = `256x256`.

The rebuilt Archer never uses the legacy fractional `1536x1024` 4x9 master. `scripts/process-class-sprites.py --classes warrior archer` consumes the exact production sheets and deliberately leaves Mage and projectiles untouched.
