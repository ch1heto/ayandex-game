# Approved runtime bases

These exact integer-grid sheets are the immutable pre-assembly inputs for
Warrior and Archer. They prevent repeated pipeline runs from consuming their
own normalized output and accumulating registration or alpha changes.

- cells: `64x64`;
- rows: `down`, `left`, `up`, `right`;
- root: `x=32`;
- baseline: `y=60`.

PixelLab candidates are reviewed under `artifacts/pixellab-candidates/` and are
never copied here or into runtime until they pass the character sprite QA.
