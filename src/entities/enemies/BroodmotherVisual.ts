import Phaser from 'phaser';
import idle from '../../../assets/bosses/ashen-broodmother/runtime/idle.png';
import attack from '../../../assets/bosses/ashen-broodmother/runtime/attack.png';
import phase from '../../../assets/bosses/ashen-broodmother/runtime/phase.png';
import idleGlow from '../../../assets/bosses/ashen-broodmother/runtime/idle-glow.png';
import attackGlow from '../../../assets/bosses/ashen-broodmother/runtime/attack-glow.png';
import phaseGlow from '../../../assets/bosses/ashen-broodmother/runtime/phase-glow.png';
import { broodmotherMotion, type BroodmotherAction, type BroodmotherPose } from './broodmotherMotion';
const assets = { idle, attack, phase, 'idle-glow': idleGlow, 'attack-glow': attackGlow, 'phase-glow': phaseGlow };
export function preloadBroodmotherVisual(scene: Phaser.Scene): void {
  for (const [name, url] of Object.entries(assets)) if (!scene.textures.exists('broodmother-' + name)) scene.load.image('broodmother-' + name, url);
}
/** Three preloaded poses and matching emissive masks. The inherited spider stays an invisible physics/death proxy. */
export class BroodmotherVisual {
  private readonly body: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly embers: Phaser.GameObjects.Graphics;
  private pose: BroodmotherPose = 'idle';
  private lastAction: BroodmotherAction = 'idle';
  private lastPhase = 1;
  private specialUntil: number;
  private recoveryUntil = 0;
  private venomAt = -Infinity;
  private hitUntil = 0;
  private deathAt?: number;
  public constructor(scene: Phaser.Scene) {
    for (const name of Object.keys(assets)) scene.textures.get('broodmother-' + name).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.body = scene.add.image(0, 0, 'broodmother-idle').setOrigin(.5, 168 / 192).setName('ashen-broodmother-art');
    this.glow = scene.add.image(0, 0, 'broodmother-idle-glow').setOrigin(.5, 168 / 192).setBlendMode(Phaser.BlendModes.ADD);
    this.shadow = scene.add.graphics(); this.embers = scene.add.graphics();
    this.specialUntil = scene.time.now + 1000;
  }
  public hit(now: number): void { this.hitUntil = now + 80; }
  public update(now: number, x: number, y: number, action: BroodmotherAction, actionUntil: number, phase: number, alive: boolean, flip: boolean): void {
    if (phase !== this.lastPhase) { this.specialUntil = now + 650; this.lastPhase = phase; }
    if (action !== this.lastAction) {
      if (this.lastAction === 'lunge') this.recoveryUntil = now + 180;
      if (this.lastAction === 'venom-windup') this.venomAt = now;
      this.lastAction = action;
    }
    if (!alive && this.deathAt === undefined) this.deathAt = now;
    const motion = broodmotherMotion({ time: now, action, actionUntil, phase, specialUntil: this.specialUntil, recoveryUntil: this.recoveryUntil, venomAt: this.venomAt, deathAt: this.deathAt });
    if (motion.pose !== this.pose) {
      this.pose = motion.pose; this.body.setTexture('broodmother-' + this.pose); this.glow.setTexture('broodmother-' + this.pose + '-glow');
    }
    const depth = Math.floor(y), px = Math.round(x), py = Math.round(y) + motion.bob;
    for (const image of [this.body, this.glow]) image.setPosition(px, py).setScale(motion.scaleX, motion.scaleY).setAngle(motion.angle).setFlipX(this.pose === 'attack' && flip);
    this.body.setDepth(depth).setAlpha(motion.alpha);
    this.glow.setDepth(depth + 1).setAlpha((now < this.hitUntil ? .85 : motion.glow) * motion.alpha);
    this.shadow.clear().setPosition(px, Math.round(y) - 7).setDepth(depth - 1).setScale(motion.shadowScale).setAlpha(motion.alpha);
    this.shadow.fillStyle(0x080c14, .38).fillRect(-44, -7, 88, 14).fillRect(-34, -11, 68, 22).fillRect(-22, -14, 44, 28);
    this.embers.clear().setPosition(px, Math.round(y)).setDepth(depth + 2);
    if (alive) for (let i = 0; i < (phase === 3 ? 5 : phase + 1); i++) {
      const age = (now / 24 + i * 19) % 58;
      this.embers.fillStyle(i % 2 ? 0xf4aa39 : 0xdd5422, (1 - age / 58) * .65)
        .fillRect(Math.round(Math.sin(i * 7 + now / 1800) * 55), Math.round(-35 - age), 2, 2);
    }
  }
  public destroy(): void { this.body.destroy(); this.glow.destroy(); this.shadow.destroy(); this.embers.destroy(); }
}
