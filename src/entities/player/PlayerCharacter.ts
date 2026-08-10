import Phaser from 'phaser';

import { PLAYER_CLASS_CONFIGS, type PlayerClassConfig } from '../../data/playerClasses';
import {
  CHARACTER_ROOT_Y,
  DIRECTION_ROW,
  attackAnimationKey,
  idleFrame,
  idleTextureKey,
  walkAnimationKey,
} from './characterAssets';
import type { AttackImpact, Direction, PlayerClassId, PlayerState } from './playerTypes';

type AttackImpactHandler = (impact: AttackImpact) => void;
type HealthChangedHandler = (health: number, maxHealth: number) => void;

const ATTACK_IMPACT_FRAME = 2;

export class PlayerCharacter {
  public readonly visual: Phaser.GameObjects.Sprite;

  private readonly body: Phaser.Physics.Arcade.Body;
  private classId: PlayerClassId = 'warrior';
  private facing: Direction = 'down';
  private state: PlayerState = 'idle';
  private activeAttackKey = '';
  private aimX = 0;
  private aimY = 1;
  private targetX = 0;
  private targetY = 0;
  private impactTriggered = false;
  private health = PLAYER_CLASS_CONFIGS.warrior.maxHealth;
  private invulnerableUntil = 0;
  private knockbackUntil = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly onAttackImpact: AttackImpactHandler,
    private readonly onHealthChanged: HealthChangedHandler = () => undefined,
  ) {
    this.visual = scene.add.sprite(x, y, idleTextureKey(this.classId), idleFrame(this.facing))
      .setOrigin(0.5, CHARACTER_ROOT_Y)
      .setDepth(10);
    scene.physics.add.existing(this.visual);
    this.body = this.visual.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(18, 13).setOffset(23, 47);
    this.body.setCollideWorldBounds(true);
    this.visual.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.playIdle();
    this.onHealthChanged(this.health, this.maxHealth);
  }

  public move(up: boolean, down: boolean, left: boolean, right: boolean): void {
    this.visual.setDepth(Math.floor(this.visual.y));
    if (this.health <= 0) {
      this.body.setVelocity(0, 0);
      return;
    }
    if (this.scene.time.now < this.knockbackUntil) return;
    if (this.state === 'attack') {
      this.body.setVelocity(0, 0);
      return;
    }

    const intent = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));
    if (intent.lengthSq() === 0) {
      this.body.setVelocity(0, 0);
      this.state = 'idle';
      this.playIdle();
      return;
    }

    this.facing = this.resolveMovementFacing(intent);
    intent.normalize().scale(this.config.moveSpeed);
    this.body.setVelocity(intent.x, intent.y);
    this.state = 'move';
    this.visual.play(walkAnimationKey(this.classId, this.facing), true);
  }

  public attack(worldX: number, worldY: number): boolean {
    if (this.state === 'attack' || this.health <= 0 || this.scene.time.now < this.knockbackUntil) return false;
    const aim = new Phaser.Math.Vector2(worldX - this.x, worldY - this.y);
    if (aim.lengthSq() === 0) return false;
    aim.normalize();

    this.aimX = aim.x;
    this.aimY = aim.y;
    this.targetX = worldX;
    this.targetY = worldY;
    this.facing = this.resolveFacing(aim);
    this.state = 'attack';
    this.body.setVelocity(0, 0);
    this.impactTriggered = false;
    this.activeAttackKey = attackAnimationKey(this.classId, this.facing);
    this.visual.play(this.activeAttackKey, true);
    return true;
  }

  public switchClass(classId: PlayerClassId): void {
    if (classId === this.classId) return;
    const previousMaxHealth = this.maxHealth;
    const healthRatio = previousMaxHealth > 0 ? this.health / previousMaxHealth : 1;
    this.classId = classId;
    this.health = Math.max(1, Math.round(this.maxHealth * healthRatio));
    this.state = 'idle';
    this.activeAttackKey = '';
    this.impactTriggered = false;
    this.body.setVelocity(0, 0);
    this.playIdle();
    this.onHealthChanged(this.health, this.maxHealth);
  }

  public takeDamage(damage: number, sourceX: number, sourceY: number): boolean {
    const now = this.scene.time.now;
    if (this.health <= 0 || now < this.invulnerableUntil) return false;
    this.health = Math.max(0, this.health - damage);
    this.invulnerableUntil = now + 650;
    this.knockbackUntil = now + 115;
    const knockback = new Phaser.Math.Vector2(this.x - sourceX, this.y - sourceY);
    if (knockback.lengthSq() > 0) knockback.normalize().scale(120);
    this.body.setVelocity(knockback.x, knockback.y);
    this.visual.setTint(0xffd6c7).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(75, () => {
      if (this.visual.active) this.visual.clearTint();
    });
    this.onHealthChanged(this.health, this.maxHealth);
    return true;
  }

  public restoreFullHealth(): void {
    this.health = this.maxHealth;
    this.invulnerableUntil = this.scene.time.now + 800;
    this.knockbackUntil = 0;
    this.body.setVelocity(0, 0);
    this.state = 'idle';
    this.playIdle();
    this.onHealthChanged(this.health, this.maxHealth);
  }

  public setPosition(x: number, y: number): void {
    this.visual.setPosition(x, y);
    this.body.reset(x, y);
    this.visual.setDepth(Math.floor(y));
  }

  public get x(): number { return this.visual.x; }
  public get y(): number { return this.visual.y; }
  public get activeClass(): PlayerClassId { return this.classId; }
  public get direction(): Direction { return this.facing; }
  public get currentState(): PlayerState { return this.state; }
  public get config(): PlayerClassConfig { return PLAYER_CLASS_CONFIGS[this.classId]; }
  public get currentHealth(): number { return this.health; }
  public get maxHealth(): number { return this.config.maxHealth; }

  public destroy(): void {
    this.visual.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.visual.destroy();
  }

  private playIdle(): void {
    this.visual.stop();
    this.visual.setTexture(idleTextureKey(this.classId), idleFrame(this.facing));
  }

  private handleAnimationUpdate(animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (this.state !== 'attack' || this.impactTriggered || animation.key !== this.activeAttackKey) return;
    const expectedFrame = DIRECTION_ROW[this.facing] * 4 + ATTACK_IMPACT_FRAME;
    if (Number(frame.textureFrame) !== expectedFrame) return;
    this.impactTriggered = true;
    this.onAttackImpact({
      classId: this.classId,
      kind: this.config.attackKind,
      facing: this.facing,
      aimX: this.aimX,
      aimY: this.aimY,
      targetX: this.targetX,
      targetY: this.targetY,
      rootX: this.x,
      rootY: this.y,
    });
  }

  private handleAnimationComplete(animation: Phaser.Animations.Animation): void {
    if (this.state !== 'attack' || animation.key !== this.activeAttackKey) return;
    this.state = 'idle';
    this.activeAttackKey = '';
    this.playIdle();
  }

  private resolveMovementFacing(direction: Phaser.Math.Vector2): Direction {
    if (direction.x !== 0 && direction.y !== 0) {
      if ((this.facing === 'left' && direction.x < 0) || (this.facing === 'right' && direction.x > 0)) return this.facing;
      if ((this.facing === 'up' && direction.y < 0) || (this.facing === 'down' && direction.y > 0)) return this.facing;
      return direction.x < 0 ? 'left' : 'right';
    }
    return this.resolveFacing(direction);
  }

  private resolveFacing(direction: Phaser.Math.Vector2): Direction {
    if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x < 0 ? 'left' : 'right';
    return direction.y < 0 ? 'up' : 'down';
  }
}
