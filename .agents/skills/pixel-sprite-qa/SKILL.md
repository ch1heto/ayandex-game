---
name: pixel-sprite-qa
description: Perform strict visual and technical QA for Ashvale 64x64 character sprites before runtime integration. Use after character generation, edits, animation, normalization, or idle/walk/attack sheet assembly to detect layout, alpha, root, baseline, detached-pixel, chroma-fringe, neighbour-contamination, face-consistency, equipment-continuity, and motion-readability failures with enlarged contact sheets and animated previews.
---

# Ashvale Pixel Sprite QA

Do not modify artwork. Diagnose, generate review artifacts, and block integration when evidence is uncertain.

## Read the production contract

1. Read `docs/art/ART_BIBLE.md`, `docs/art/CHARACTER_GUIDE.md`, and `docs/art/CHARACTER_SYSTEM.md`.
2. Inspect the approved four-direction reference and the source strips used for the candidate.
3. Require `64x64` cells, root `x=32`, baseline `y=60`, rows `down`, `left`, `up`, `right`, idle `1`, walk `4`, and attack `4` frames per direction.
4. Reject any source grid whose dimensions do not divide evenly by its declared rows and columns. Treat the legacy `1536x1024` 4-by-9 layout as migration-only, not an acceptable new source format.

## Run non-destructive technical checks

Run:

```powershell
python scripts/qa-character-sprites.py
```

Use the project Python runtime containing Pillow if `python` is unavailable. Review the console result and `artifacts/character-qa/report.json`.

Check dimensions, frame counts, alpha, empty frames, root and baseline signals, border contact, connected components, detached islands, and suspicious magenta/green edge pixels. Treat chroma findings only as diagnostic signals. Never automatically delete a wide color range: valid Mage purple, Warrior blue, Archer green, spell effects, and highlights can resemble a key colour.

Never equate zero technical findings with visual acceptance.

## Perform mandatory visible review

Open every generated enlarged contact sheet and motion preview. Do not say `QA passed`, `failures=0`, or approve runtime integration until Codex has actually viewed the artifacts.

Inspect each direction and state at least for:

- `FACE`: same face/head shape and features across idle, walk, and attack;
- `FEET`: fixed root/baseline, distinct walk phases, no sliding, floating, or identical legs;
- `WEAPON`: readable motion and no jumping, disappearance, or side swap;
- `CAPE`, `QUIVER`, `STAFF`: stable attachment, silhouette, and side;
- `OUTLINE`: no stray pixels, fringe, chroma spill, detached clusters, holes, or neighbour contamination.

Compare idle, all walk phases, and all attack phases side by side. Play walk and attack previews rather than judging isolated frames only. Inspect suspicious pixels behind the character and on the side opposite the weapon or accessory.

## Apply state-specific gates

- Walk must read as contact, passing, opposite contact, passing/recovery while the root remains fixed.
- Attack must read as preparation, action, impact/release, recovery.
- Warrior sword must move through the strike.
- Archer bow, string, hands, arrow release, and quiver continuity must remain readable.
- Mage staff must stay attached while the cast reads clearly.

If any visual result is ambiguous, fail the candidate and request a focused fix. Record exact class, state, direction, frame, region, and observed defect.

## Report the decision

Separate the report into:

1. technical errors;
2. diagnostic warnings;
3. visible findings by `FACE`, `FEET`, `WEAPON`, `CAPE/QUIVER/STAFF`, and `OUTLINE`;
4. final `PASS` or `FAIL` decision.

Issue `PASS` only after technical checks succeed and visible review finds no blocking defect. Keep generated files under `artifacts/character-qa/`; do not commit them.
