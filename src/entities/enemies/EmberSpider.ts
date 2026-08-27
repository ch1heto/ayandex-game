import Phaser from 'phaser';
import { EnemyModifiers } from './EnemyModifiers';
import type { EliteAffix } from '../../data/elites';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import { EmberSpiderAnimation } from './emberSpiderAssets';

const COMBAT_HURTBOX_WIDTH = 56;
const COMBAT_HURTBOX_HEIGHT = 38;
const COMBAT_HURTBOX_OFFSET_Y = -22;

export class EmberSpider {
  public readonly visual: Phaser.Physics.Arcade.Sprite;
  public readonly hurtbox: Phaser.GameObjects.Zone;
  private health: number;
  public readonly modifiers: EnemyModifiers;
  private state: 'idle' | 'chase' | 'attack' | 'dead' = 'idle';
  private nextAttackAt = 0;
  private impact = false;

  public constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly player: PlayerCharacter, private readonly onDeath: (spider: EmberSpider, x: number, y: number) => void, private readonly onEngage: (spider: EmberSpider) => void = () => undefined, public readonly elite?: EliteAffix, health = 58) {
    this.visual = scene.physics.add.sprite(x, y, EmberSpiderAnimation.Idle).setOrigin(0.5, 58 / 64).setDepth(Math.floor(y));
    this.visual.setData('emberSpider', this); const body = this.visual.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false).setCollideWorldBounds(true).setSize(42, 21).setOffset(11, 37);
    this.modifiers = new EnemyModifiers(scene, this.visual, health, elite); this.health = this.modifiers.maxHealth;
    this.hurtbox = scene.add.zone(x, y + COMBAT_HURTBOX_OFFSET_Y, COMBAT_HURTBOX_WIDTH, COMBAT_HURTBOX_HEIGHT);
    scene.physics.add.existing(this.hurtbox);
    const hurtboxBody = this.hurtbox.body as Phaser.Physics.Arcade.Body;
    hurtboxBody.setAllowGravity(false).setImmovable(true).setSize(COMBAT_HURTBOX_WIDTH, COMBAT_HURTBOX_HEIGHT);
    hurtboxBody.moves = false;
    this.hurtbox.setData('emberSpider', this);
    this.visual.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame, this); this.visual.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onComplete, this); this.visual.play(EmberSpiderAnimation.Idle);
  }
  public update(time: number): void {
    this.syncHurtbox();
    this.modifiers.update(time);
    if (this.modifiers.staggered && this.state !== 'dead') { this.visual.setVelocity(0); return; }
    this.visual.setDepth(Math.floor(this.visual.y)); if (this.state === 'dead' || this.state === 'attack') return;
    const distance = Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.player.x, this.player.y);
    if (distance < 43 && time >= this.nextAttackAt) { this.state = 'attack'; this.impact = false; this.visual.setVelocity(0).play(EmberSpiderAnimation.Attack, true); return; }
    if (distance < 210) { this.state = 'chase'; this.scene.physics.moveToObject(this.visual, this.player.physicsRoot, 57 * this.modifiers.speedMultiplier); this.visual.setFlipX(this.player.x < this.visual.x).play(EmberSpiderAnimation.Move, true); }
    else { this.state = 'idle'; this.visual.setVelocity(0).play(EmberSpiderAnimation.Idle, true); }
  }
  public takeDamage(damage: number, sourceX: number, sourceY: number): boolean {
    if (this.state === 'dead') return false; this.health = Math.max(0, this.health - damage); this.onEngage(this);
    if (!this.health) { this.state = 'dead'; (this.visual.body as Phaser.Physics.Arcade.Body).enable = false; (this.hurtbox.body as Phaser.Physics.Arcade.Body).enable = false; this.hurtbox.setActive(false); this.visual.setVelocity(0).play(EmberSpiderAnimation.Death, true); return true; }
    const push = new Phaser.Math.Vector2(this.visual.x - sourceX, this.visual.y - sourceY).normalize().scale(65); this.visual.setVelocity(push.x, push.y).setTint(0xffc08a).setTintMode(Phaser.TintModes.FILL); this.scene.time.delayedCall(70, () => this.visual.active && this.visual.clearTint()); return true;
  }
  public applyKnockback(sourceX: number, sourceY: number, speed: number): void {
    if (this.state === 'dead') return;
    const direction = new Phaser.Math.Vector2(this.visual.x - sourceX, this.visual.y - sourceY);
    if (direction.lengthSq() > 0) direction.normalize().scale(speed);
    this.visual.setVelocity(direction.x, direction.y);
  }
  public get isBoss(): boolean { return false; }
  public get bossPhase(): number { return 1; }
  public get currentHealth(): number { return this.health; }
  public get maxHealth(): number { return this.modifiers.maxHealth; }
  public destroy(): void { this.visual.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame, this); this.visual.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onComplete, this); this.modifiers.destroy(); this.hurtbox.destroy(); this.visual.destroy(); }
  protected syncHurtbox(): void { (this.hurtbox.body as Phaser.Physics.Arcade.Body).reset(this.visual.x, this.visual.y + COMBAT_HURTBOX_OFFSET_Y); }
  private onFrame(animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void { if (this.state !== 'attack' || this.impact || animation.key !== EmberSpiderAnimation.Attack || Number(frame.textureFrame) !== 2) return; this.impact = true; if (Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.player.x, this.player.y) <= 50 && this.player.takeDamage(Math.round(14 * this.modifiers.damageMultiplier), this.visual.x, this.visual.y)) this.onEngage(this); }
  private onComplete(animation: Phaser.Animations.Animation): void { if (animation.key === EmberSpiderAnimation.Death && this.state === 'dead') { this.onDeath(this, this.visual.x, this.visual.y); this.destroy(); return; } if (animation.key === EmberSpiderAnimation.Attack && this.state === 'attack') { this.state = 'chase'; this.nextAttackAt = this.scene.time.now + 1200; } }
}
