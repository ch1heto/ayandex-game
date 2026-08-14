import Phaser from 'phaser';

type SmokePuff = {
  pieces: Phaser.GameObjects.Rectangle[];
  timer: Phaser.Time.TimerEvent;
};

type SmokeLayer = {
  offsetX: number;
  offsetY: number;
  size: number;
  color: number;
  alpha: number;
  risePerStep: number;
  drift: number;
  delaySteps: number;
};

const SMOKE_STEP_MS = 80;
const SMOKE_STEPS = 16;

// Dense core, softer middle and sparse high wisps give the plume volume while
// every rectangle remains locked to whole pixels with hard, unfiltered edges.
const SMOKE_LAYERS: readonly SmokeLayer[] = [
  { offsetX: -4, offsetY: 0, size: 10, color: 0x696863, alpha: .93, risePerStep: 2.35, drift: .5, delaySteps: 0 },
  { offsetX: 4, offsetY: -1, size: 9, color: 0x88857f, alpha: .88, risePerStep: 2.5, drift: .62, delaySteps: 0 },
  { offsetX: -6, offsetY: -4, size: 8, color: 0xa7a39a, alpha: .78, risePerStep: 2.8, drift: .78, delaySteps: 1 },
  { offsetX: 5, offsetY: -7, size: 7, color: 0x7b7a75, alpha: .7, risePerStep: 3.05, drift: .94, delaySteps: 2 },
  { offsetX: -2, offsetY: -10, size: 6, color: 0xbeb9ae, alpha: .59, risePerStep: 3.3, drift: 1.08, delaySteps: 3 },
  { offsetX: 3, offsetY: -13, size: 4, color: 0xd0cabf, alpha: .48, risePerStep: 3.55, drift: 1.18, delaySteps: 4 },
];

/** Layered hard-edged pixel smoke anchored to the restored forge chimney. */
export class ForgeSmokeEmitter {
  private spawnTimer?: Phaser.Time.TimerEvent;
  private readonly puffs = new Set<SmokePuff>();
  private running = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly depth: number,
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.spawnPuff();
    this.scheduleNext(320);
  }

  public destroy(): void {
    this.running = false;
    this.spawnTimer?.remove(false);
    this.spawnTimer = undefined;
    this.puffs.forEach((puff) => {
      puff.timer.remove(false);
      puff.pieces.forEach((piece) => piece.destroy());
    });
    this.puffs.clear();
  }

  private scheduleNext(delay: number): void {
    this.spawnTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.running) return;
      this.spawnPuff();
      this.scheduleNext(Phaser.Math.Between(390, 540));
    });
  }

  private spawnPuff(): void {
    const driftDirection = Phaser.Math.RND.sign();
    const phase = Phaser.Math.Between(0, 4);
    const pieces = SMOKE_LAYERS.map((layer) => this.scene.add.rectangle(
      this.x + layer.offsetX,
      this.y + layer.offsetY,
      layer.size,
      layer.size,
      layer.color,
      layer.alpha,
    ).setDepth(this.depth).setVisible(layer.delaySteps === 0));
    let step = 0;
    const timer = this.scene.time.addEvent({
      delay: SMOKE_STEP_MS,
      repeat: SMOKE_STEPS - 1,
      callback: () => {
        step += 1;
        SMOKE_LAYERS.forEach((layer, index) => {
          const piece = pieces[index];
          const localStep = step - layer.delaySteps;
          if (localStep < 0) return;
          const localDuration = SMOKE_STEPS - layer.delaySteps;
          const progress = Phaser.Math.Clamp(localStep / localDuration, 0, 1);
          const widening = Math.floor(progress * (layer.size * .9 + index));
          const sideways = driftDirection * Math.round(progress * layer.drift * 7)
            + Math.round(Math.sin((localStep + phase + index) * .72) * (1 + index * .22));
          piece
            .setVisible(true)
            .setPosition(
              Math.round(this.x + layer.offsetX + sideways),
              Math.round(this.y + layer.offsetY - localStep * layer.risePerStep),
            )
            .setDisplaySize(layer.size + widening, layer.size + widening)
            .setAlpha(layer.alpha * Math.max(0, 1 - progress * progress));
        });
        if (step < SMOKE_STEPS) return;
        pieces.forEach((piece) => piece.destroy());
        this.puffs.delete(puff);
      },
    });
    const puff: SmokePuff = { pieces, timer };
    this.puffs.add(puff);
  }
}
