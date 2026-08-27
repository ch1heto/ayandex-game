import Phaser from 'phaser';

const FIRE_STATES: readonly (readonly { x: number; y: number; w: number; h: number; color: number }[])[] = [
  [{ x: -7, y: 2, w: 15, h: 8, color: 0xc83e19 }, { x: -3, y: -5, w: 9, h: 10, color: 0xf07b21 }, { x: 0, y: -10, w: 5, h: 9, color: 0xffc84d }, { x: 2, y: 0, w: 5, h: 5, color: 0xffec8a }],
  [{ x: -7, y: 2, w: 15, h: 8, color: 0xb93518 }, { x: -5, y: -6, w: 8, h: 11, color: 0xef6b1d }, { x: -1, y: -13, w: 5, h: 11, color: 0xffb638 }, { x: 1, y: -3, w: 6, h: 7, color: 0xffe980 }],
  [{ x: -7, y: 2, w: 15, h: 8, color: 0xc64319 }, { x: 0, y: -8, w: 9, h: 13, color: 0xf47a20 }, { x: 3, y: -15, w: 5, h: 10, color: 0xffc344 }, { x: -1, y: -2, w: 6, h: 7, color: 0xffef91 }],
  [{ x: -7, y: 2, w: 15, h: 8, color: 0xb93617 }, { x: -4, y: -10, w: 10, h: 15, color: 0xeb641c }, { x: -5, y: -17, w: 5, h: 10, color: 0xffb137 }, { x: 0, y: -4, w: 6, h: 8, color: 0xffe67b }],
  [{ x: -7, y: 2, w: 15, h: 8, color: 0xc74318 }, { x: -1, y: -7, w: 10, h: 12, color: 0xf37b22 }, { x: 1, y: -12, w: 6, h: 9, color: 0xffc74b }, { x: -3, y: -1, w: 7, h: 6, color: 0xffed8b }],
];

/** Hard-edged runtime fire for the restored forge; nothing is created until start(). */
export class ForgeFireEffects {
  private fireTimer?: Phaser.Time.TimerEvent;
  private emberTimer?: Phaser.Time.TimerEvent;
  private readonly firePieces: Phaser.GameObjects.Rectangle[] = [];
  private readonly embers = new Set<Phaser.GameObjects.Rectangle>();
  private light?: Phaser.GameObjects.Rectangle;
  private state = 0;
  private running = false;

  public constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number, private readonly depth: number) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.light = this.scene.add.rectangle(this.x, this.y - 5, 45, 31, 0xe06b25, .11).setDepth(this.depth);
    FIRE_STATES[0].forEach(() => this.firePieces.push(this.scene.add.rectangle(this.x, this.y, 1, 1, 0xffffff).setDepth(this.depth + 1)));
    this.renderState();
    this.fireTimer = this.scene.time.addEvent({ delay: 110, loop: true, callback: () => { this.state = (this.state + 1) % FIRE_STATES.length; this.renderState(); } });
    this.emberTimer = this.scene.time.addEvent({ delay: 520, loop: true, callback: () => this.spawnEmber() });
  }

  public destroy(): void {
    this.running = false; this.fireTimer?.remove(false); this.emberTimer?.remove(false);
    this.firePieces.forEach((piece) => piece.destroy()); this.firePieces.length = 0;
    this.embers.forEach((ember) => ember.destroy()); this.embers.clear(); this.light?.destroy(); this.light = undefined;
  }

  private renderState(): void {
    const state = FIRE_STATES[this.state];
    state.forEach((shape, index) => this.firePieces[index].setPosition(Math.round(this.x + shape.x), Math.round(this.y + shape.y)).setSize(shape.w, shape.h).setFillStyle(shape.color, 1));
    this.light?.setAlpha(this.state % 2 === 0 ? .11 : .075).setSize(this.state % 2 === 0 ? 45 : 41, this.state % 2 === 0 ? 31 : 29);
  }

  private spawnEmber(): void {
    if (!this.running || Phaser.Math.Between(0, 2) === 0) return;
    const ember = this.scene.add.rectangle(this.x + Phaser.Math.Between(-9, 9), this.y - 12, 2, 2, 0xffb53b).setDepth(this.depth + 2);
    this.embers.add(ember);
    const drift = Phaser.Math.Between(-7, 7); const rise = Phaser.Math.Between(17, 29);
    this.scene.tweens.add({ targets: ember, x: Math.round(ember.x + drift), y: Math.round(ember.y - rise), alpha: 0, duration: 420, ease: 'Stepped', easeParams: [5], onComplete: () => { this.embers.delete(ember); ember.destroy(); } });
  }
}
