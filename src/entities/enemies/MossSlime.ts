import Phaser from 'phaser';

import { MOSS_SLIME_CONFIG } from '../../data/enemies';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import { MOSS_SLIME_ROOT_Y, MossSlimeAnimation } from './mossSlimeAssets';

export type MossSlimeState = 'idle' | 'wander' | 'chase' | 'attack' | 'hurt' | 'dead';

type DeathHandler = (slime: MossSlime, x: number, y: number) => void;

const ATTACK_IMPACT_FRAME = 2;

export class MossSlime {
  public readonly visual: Phaser.Physics.Arcade.Sprite;
  public readonly spawnX: number;
  public readonly spawnY: number;

  private readonly body: Phaser.Physics.Arcade.Body;
  private state: MossSlimeState = 'idle';
  private health = MOSS_SLIME_CONFIG.maxHealth;
  private nextDecisionAt = 0;
  private nextAttackAt = 0;
  private hurtUntil = 0;
  private impactTriggered = false;
  private wanderDirection = new Phaser.Math.Vector2();

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly player: PlayerCharacter,
    private readonly onDeath: DeathHandler,
  ) {
    this.spawnX = x;
    this.spawnY = y;
    this.visual = scene.physics.add.sprite(x, y, MossSlimeAnimation.Idle, 0)
      .setOrigin(0.5, MOSS_SLIME_ROOT_Y)
      .setDepth(Math.floor(y));
    this.visual.setData('mossSlime', this);
    this.body = this.visual.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setCollideWorldBounds(true);
    this.body.setSize(34, 18).setOffset(15, 40);
    this.body.setBounce(0.05);
    this.visual.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.play(MossSlimeAnimation.Idle);
    this.scheduleDecision(scene.time.now, 500, 1300);
  }

  public update(time: number): void {
    this.visual.setDepth(Math.floor(this.visual.y));
    if (this.state === 'dead' || this.state === 'attack') return;

    if (this.state === 'hurt') {
      if (time < this.hurtUntil) return;
      this.body.setVelocity(0, 0);
      this.state = 'chase';
    }

    const playerDistance = Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.player.x, this.player.y);
    const homeDistance = Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.spawnX, this.spawnY);
    const mayContinueChase = this.state === 'chase' && playerDistance <= MOSS_SLIME_CONFIG.disengageRange;

    if (playerDistance <= MOSS_SLIME_CONFIG.attackRange && time >= this.nextAttackAt) {
      this.startAttack();
      return;
    }

    if (playerDistance <= MOSS_SLIME_CONFIG.detectionRange || mayContinueChase) {
      this.chasePlayer(playerDistance);
      return;
    }

    if (homeDistance > 12) {
      this.moveToward(this.spawnX, this.spawnY, MOSS_SLIME_CONFIG.moveSpeed * 0.8);
      this.setState('wander', MossSlimeAnimation.Move);
      return;
    }

    this.updateWander(time, homeDistance);
  }

  public takeDamage(damage: number, sourceX: number, sourceY: number): boolean {
    if (this.state === 'dead') return false;
    this.health = Math.max(0, this.health - damage);
    if (this.health === 0) {
      this.die();
      return true;
    }

    this.state = 'hurt';
    this.impactTriggered = false;
    this.hurtUntil = this.scene.time.now + MOSS_SLIME_CONFIG.hurtDurationMs;
    const knockback = new Phaser.Math.Vector2(this.visual.x - sourceX, this.visual.y - sourceY);
    if (knockback.lengthSq() > 0) knockback.normalize().scale(MOSS_SLIME_CONFIG.knockbackSpeed);
    this.body.setVelocity(knockback.x, knockback.y);
    this.play(MossSlimeAnimation.Hurt);
    this.visual.setTint(0xfff1bc).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(75, () => {
      if (this.visual.active) this.visual.clearTint();
    });
    return true;
  }

  public get currentState(): MossSlimeState { return this.state; }
  public get currentHealth(): number { return this.health; }
  public get maxHealth(): number { return MOSS_SLIME_CONFIG.maxHealth; }
  public get x(): number { return this.visual.x; }
  public get y(): number { return this.visual.y; }

  public applyKnockback(sourceX: number, sourceY: number, speed: number): void {
    if (this.state === 'dead') return;
    const direction = new Phaser.Math.Vector2(this.visual.x - sourceX, this.visual.y - sourceY);
    if (direction.lengthSq() > 0) direction.normalize().scale(speed);
    this.body.setVelocity(direction.x, direction.y);
  }

  public destroy(): void {
    this.visual.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.visual.destroy();
  }

  private chasePlayer(distance: number): void {
    this.state = 'chase';
    if (distance <= MOSS_SLIME_CONFIG.attackRange * 0.8) {
      this.body.setVelocity(0, 0);
      this.play(MossSlimeAnimation.Idle);
      return;
    }
    this.moveToward(this.player.x, this.player.y, MOSS_SLIME_CONFIG.moveSpeed);
    this.play(MossSlimeAnimation.Move);
  }

  private updateWander(time: number, homeDistance: number): void {
    if (this.state === 'wander' && time < this.nextDecisionAt) {
      if (homeDistance > MOSS_SLIME_CONFIG.territoryRange) {
        this.moveToward(this.spawnX, this.spawnY, MOSS_SLIME_CONFIG.moveSpeed * 0.75);
      } else {
        this.body.setVelocity(
          this.wanderDirection.x * MOSS_SLIME_CONFIG.moveSpeed * 0.55,
          this.wanderDirection.y * MOSS_SLIME_CONFIG.moveSpeed * 0.55,
        );
      }
      this.play(MossSlimeAnimation.Move);
      return;
    }

    if (this.state === 'idle' && time < this.nextDecisionAt) {
      this.body.setVelocity(0, 0);
      this.play(MossSlimeAnimation.Idle);
      return;
    }

    if (Phaser.Math.RND.frac() < 0.58) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.wanderDirection.set(Math.cos(angle), Math.sin(angle));
      this.state = 'wander';
      this.scheduleDecision(time, 650, 1250);
      return;
    }

    this.state = 'idle';
    this.body.setVelocity(0, 0);
    this.play(MossSlimeAnimation.Idle);
    this.scheduleDecision(time, 800, 1650);
  }

  private startAttack(): void {
    this.state = 'attack';
    this.impactTriggered = false;
    this.body.setVelocity(0, 0);
    this.visual.setFlipX(this.player.x < this.visual.x);
    this.play(MossSlimeAnimation.Attack, true);
  }

  private die(): void {
    this.state = 'dead';
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.impactTriggered = true;
    this.visual.clearTint();
    this.play(MossSlimeAnimation.Death, true);
  }

  private moveToward(x: number, y: number, speed: number): void {
    const direction = new Phaser.Math.Vector2(x - this.visual.x, y - this.visual.y);
    if (direction.lengthSq() === 0) {
      this.body.setVelocity(0, 0);
      return;
    }
    direction.normalize().scale(speed);
    this.body.setVelocity(direction.x, direction.y);
    if (Math.abs(direction.x) > 2) this.visual.setFlipX(direction.x < 0);
  }

  private setState(state: MossSlimeState, animation: string): void {
    this.state = state;
    this.play(animation);
  }

  private scheduleDecision(time: number, minDelay: number, maxDelay: number): void {
    this.nextDecisionAt = time + Phaser.Math.Between(minDelay, maxDelay);
  }

  private play(key: string, ignoreIfPlaying = true): void {
    this.visual.play(key, ignoreIfPlaying);
  }

  private handleAnimationUpdate(animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (this.state !== 'attack' || this.impactTriggered || animation.key !== MossSlimeAnimation.Attack) return;
    if (Number(frame.textureFrame) !== ATTACK_IMPACT_FRAME) return;
    this.impactTriggered = true;
    const distance = Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.player.x, this.player.y);
    if (distance <= MOSS_SLIME_CONFIG.attackRange + 8) {
      this.player.takeDamage(MOSS_SLIME_CONFIG.attackDamage, this.visual.x, this.visual.y);
    }
  }

  private handleAnimationComplete(animation: Phaser.Animations.Animation): void {
    if (animation.key === MossSlimeAnimation.Death && this.state === 'dead') {
      const x = this.visual.x;
      const y = this.visual.y;
      this.onDeath(this, x, y);
      this.destroy();
      return;
    }
    if (animation.key !== MossSlimeAnimation.Attack || this.state !== 'attack') return;
    this.nextAttackAt = this.scene.time.now + MOSS_SLIME_CONFIG.attackCooldownMs;
    this.state = 'chase';
    this.play(MossSlimeAnimation.Idle);
  }
}
