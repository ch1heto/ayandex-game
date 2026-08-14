# Twilight Glade vertical-slice source prompts

These three source boards were generated with the built-in GPT Image workflow and then processed deterministically by `scripts/process-vertical-slice-assets.py`. Runtime assets use edge-connected chroma removal, conservative contour despill, normalized transparent RGB, and nearest-neighbour resizing. Chroma is a migration fallback; future corrected sources should prefer true transparent source art where available.

## Forest environment board

Original fantasy forest asset board for "Twilight Glade": four grass tiles, two dirt/path tiles, a pond, two trees, two bushes, two rocks, a stump, flowers, and ferns. Clean hand-pixeled three-quarter top-down RPG art, cool dusk-green ambient palette, upper-left warm light, isolated on flat `#ff00ff`, no text, no commercial-game copying.

## Moss Slime board

Original small moss-green forest slime with amber eyes and a leaf sprout. Five animation rows: idle (4), move (4), attack (4), hurt (2), death (4). Stable scale/root/baseline, hard pixel clusters, isolated on flat `#ff00ff`, no text or detached noise. The current source contains violet key spill around the lower contour; production processing removes that edge contamination while preserving the moss/amber design.

## Coin and HUD board

Original gold coin spin (4 frames), full/empty heart, compact bronze/navy health-bar frame, and coin HUD emblem. Crisp small pixel-art UI, isolated on flat `#00ff00`, no text or watermark.
