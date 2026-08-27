import Phaser from 'phaser';
import { combatTargets } from '../../combat/CombatTargets';
import { DODGE_CONFIG, DodgeState } from '../../data/dodge';

import { GAMEPLAY_SKINS_BY_CLASS, getCharacterSkin } from '../../data/characterSkins';
import { PLAYER_CLASS_CONFIGS, type PlayerClassConfig } from '../../data/playerClasses';
import { PLAYER_RESOURCES } from '../../data/playerResources';
import { EMPTY_STATS, type ItemStats } from '../../data/equipment';
import {
  characterAnimationKey,
  characterTextureKey,
  firstGameplaySkin,
  idleFrameForSkin,
} from './characterAssets';
import type { AttackImpact, Direction, PlayerClassId, PlayerState } from './playerTypes';

type AttackImpactHandler = (impact: AttackImpact) => void;
type HealthChangedHandler = (health: number, maxHealth: number) => void;
type ManaChangedHandler = (mana: number, maxMana: number) => void;

const WORLD_CHARACTER_RENDER_SCALE = 1.15;

export class PlayerCharacter {
  public readonly targetId = 'player';
  public readonly targetType = 'player' as const;
  public readonly priority = 1.2;
  private readonly dodgeState = new DodgeState();
  private dodgeX = 0;
  private dodgeY = 0;
  public readonly visual: Phaser.GameObjects.Sprite;
  private readonly root: Phaser.GameObjects.Zone;
  private readonly body: Phaser.Physics.Arcade.Body;
  private classId: PlayerClassId;
  private skinId: string;
  private facing: Direction = 'down';
  private horizontalFacing: Extract<Direction, 'left' | 'right'> = 'right';
  private state: PlayerState = 'idle';
  private activeAttackKey = '';
  private aimX = 0;
  private aimY = 1;
  private targetX = 0;
  private targetY = 0;
  private impactTriggered = false;
  private pendingSkillId?: string;
  private health: number;
  private mana: number = PLAYER_RESOURCES.maxMana;
  private lastManaSpendAt = Number.NEGATIVE_INFINITY;
  private invulnerableUntil = 0;
  private knockbackUntil = 0;
  private bonuses: ItemStats = { ...EMPTY_STATS };

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    selectedClass: PlayerClassId,
    selectedSkin: string,
    private readonly onAttackImpact: AttackImpactHandler,
    private readonly onHealthChanged: HealthChangedHandler = () => undefined,
    private readonly onManaChanged: ManaChangedHandler = () => undefined,
  ) {
    this.classId = selectedClass;
    this.skinId = this.requireGameplaySkin(selectedClass, selectedSkin);
    this.health = PLAYER_CLASS_CONFIGS[this.classId].maxHealth;
    const skin = getCharacterSkin(this.skinId);
    this.root = scene.add.zone(x, y, 18, 13).setOrigin(0.5, 1);
    scene.physics.add.existing(this.root);
    this.body = this.root.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false).setSize(18, 13).setOffset(0, 0);
    this.visual = scene.add.sprite(x, y, characterTextureKey(this.skinId, 'idle'), idleFrameForSkin(this.skinId, this.facing))
      .setOrigin(skin.origin.x, skin.origin.y)
      .setScale(skin.displayScale * WORLD_CHARACTER_RENDER_SCALE)
      .setDepth(10);
    combatTargets(scene).add(this);
    this.applyVisualState('idle');
    this.body.setCollideWorldBounds(true);
    this.visual.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.playIdle();
    this.onHealthChanged(this.health, this.maxHealth);
    this.onManaChanged(this.mana, this.maxMana);
  }

  public updateResources(time: number, delta: number): void {
    if (this.mana >= this.maxMana || time - this.lastManaSpendAt < PLAYER_RESOURCES.manaRegenDelayMs) return;
    const previous = this.mana;
    this.mana = Math.min(this.maxMana, this.mana + (PLAYER_RESOURCES.manaRegenPerSecond + this.bonuses.manaRegen) * delta / 1000);
    if (Math.floor(previous) !== Math.floor(this.mana) || this.mana === this.maxMana) this.onManaChanged(this.mana, this.maxMana);
  }

  public move(up: boolean, down: boolean, left: boolean, right: boolean): void {
    this.syncVisual();
    if (this.health <= 0) { this.body.setVelocity(0, 0); return; }
    if (this.dodging) { this.body.setVelocity(this.dodgeX, this.dodgeY); return; }
    if (this.scene.time.now < this.knockbackUntil) return;
    if (this.state === 'attack') {
      this.body.setVelocity(0, 0);
      return;
    }
    const intent = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));
    if (intent.lengthSq() === 0) {
      this.body.setVelocity(0, 0); this.state = 'idle'; this.playIdle(); return;
    }
    this.facing = this.resolveMovementFacing(intent);
    if (intent.x < 0) this.horizontalFacing = 'left';
    if (intent.x > 0) this.horizontalFacing = 'right';
    intent.normalize().scale(this.config.moveSpeed * (1 + this.bonuses.movementSpeed));
    this.body.setVelocity(intent.x, intent.y);
    this.state = 'move';
    const visualDirection = this.visualDirection;
    this.applyVisualState('walk');
    this.applyHorizontalFlip(visualDirection);
    this.visual.play(characterAnimationKey(this.skinId, 'walk', visualDirection), true);
  }

  public attack(worldX: number, worldY: number): boolean {
    if (this.dodging || this.state === 'attack' || this.health <= 0 || this.scene.time.now < this.knockbackUntil) return false;
    const aim = new Phaser.Math.Vector2(worldX - this.x, worldY - this.y);
    if (aim.lengthSq() === 0) return false;
    aim.normalize();
    this.aimX = aim.x; this.aimY = aim.y; this.targetX = worldX; this.targetY = worldY;
    this.facing = this.resolveFacing(aim);
    if (this.facing === 'left' || this.facing === 'right') this.horizontalFacing = this.facing;
    this.state = 'attack'; this.body.setVelocity(0, 0); this.impactTriggered = false;
    const visualDirection = this.visualDirection;
    this.applyVisualState('attack');
    this.applyHorizontalFlip(visualDirection);
    this.activeAttackKey = characterAnimationKey(this.skinId, 'attack', visualDirection);
    this.visual.play(this.activeAttackKey, true);
    return true;
  }

  public useSkillAttack(worldX: number, worldY: number, skillId: string): boolean {
    if (!this.attack(worldX, worldY)) return false;
    this.pendingSkillId = skillId;
    return true;
  }

  public switchClass(classId: PlayerClassId, selectedSkin?: string): boolean {
    const skinId = selectedSkin ?? firstGameplaySkin(classId);
    if (!skinId) return false;
    const previousMaxHealth = this.maxHealth;
    const healthRatio = previousMaxHealth > 0 ? this.health / previousMaxHealth : 1;
    this.classId = classId;
    this.skinId = this.requireGameplaySkin(classId, skinId);
    this.health = Math.max(1, Math.round(this.maxHealth * healthRatio));
    this.resetVisualState();
    this.playIdle();
    this.onHealthChanged(this.health, this.maxHealth);
    return true;
  }

  public switchSkin(skinId: string): boolean {
    const skin = getCharacterSkin(skinId);
    if (skin.classId !== this.classId || skin.runtimeStatus !== 'GAMEPLAY') return false;
    this.skinId = skin.id;
    this.resetVisualState();
    this.playIdle();
    return true;
  }

  public takeDamage(damage: number, sourceX: number, sourceY: number): boolean {
    const now = this.scene.time.now;
    if (this.health <= 0 || this.dodgeState.invulnerable(now) || now < this.invulnerableUntil) return false;
    this.health = Math.max(0, this.health - damage);
    this.invulnerableUntil = now + 650; this.knockbackUntil = now + 115;
    const knockback = new Phaser.Math.Vector2(this.x - sourceX, this.y - sourceY);
    if (knockback.lengthSq() > 0) knockback.normalize().scale(120);
    this.body.setVelocity(knockback.x, knockback.y);
    this.visual.setTint(0xffd6c7).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(75, () => { if (this.visual.active) this.visual.clearTint(); });
    this.onHealthChanged(this.health, this.maxHealth);
    return true;
  }

  public restoreFullHealth(): void {
    this.health = this.maxHealth; this.invulnerableUntil = this.scene.time.now + 800; this.knockbackUntil = 0;
    this.body.setVelocity(0, 0); this.state = 'idle'; this.playIdle(); this.onHealthChanged(this.health, this.maxHealth);
  }

  public restoreHealth(amount: number): boolean {
    if (this.health >= this.maxHealth || amount <= 0) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.onHealthChanged(this.health, this.maxHealth);
    return true;
  }

  public restoreMana(amount: number): boolean {
    if (this.mana >= this.maxMana || amount <= 0) return false;
    this.mana = Math.min(this.maxMana, this.mana + amount);
    this.onManaChanged(this.mana, this.maxMana);
    return true;
  }

  public spendMana(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.mana < amount) return false;
    this.mana -= amount;
    this.lastManaSpendAt = this.scene.time.now;
    this.onManaChanged(this.mana, this.maxMana);
    return true;
  }

  public setPosition(x: number, y: number): void {
    this.root.setPosition(x, y); this.body.reset(x, y); this.syncVisual();
  }

  public syncVisual(): void {
    this.visual.setPosition(this.root.x, this.root.y).setDepth(Math.floor(this.root.y));
  }

  public dodge(moveX: number, moveY: number, aimX: number, aimY: number): boolean {
    if (!this.alive || this.scene.time.now < this.knockbackUntil || !this.dodgeState.start(this.scene.time.now)) return false;
    this.resetVisualState(false);
    const direction = new Phaser.Math.Vector2(moveX, moveY);
    if (!direction.lengthSq()) direction.set(aimX, aimY);
    if (!direction.lengthSq()) direction.set(this.aimX, this.aimY);
    direction.normalize().scale(DODGE_CONFIG.speed);
    this.dodgeX = direction.x; this.dodgeY = direction.y;
    this.body.setVelocity(this.dodgeX, this.dodgeY);
    if (this.classId === 'archer') {
      this.facing = this.resolveMovementFacing(direction);
      if (direction.x) this.horizontalFacing = direction.x < 0 ? 'left' : 'right';
      this.state = 'move'; this.applyVisualState('walk'); this.applyHorizontalFlip(this.visualDirection);
      this.visual.play(characterAnimationKey(this.skinId, 'walk', this.visualDirection), true);
    } else this.playIdle();
    return true;
  }
  public cancelDodge(): void { this.dodgeState.cancel(); }
  public get alive(): boolean { return this.root.active && this.health > 0; }
  public get dodging(): boolean { return this.dodgeState.active(this.scene.time.now); }
  public get dodgeCooldown(): number { return this.dodgeState.cooldown(this.scene.time.now); }
  public get x(): number { return this.root.x; }
  public get y(): number { return this.root.y; }
  public get activeClass(): PlayerClassId { return this.classId; }
  public get activeSkin(): string { return this.skinId; }
  public get physicsRoot(): Phaser.GameObjects.Zone { return this.root; }
  public get direction(): Direction { return this.facing; }
  public get currentState(): PlayerState { return this.state; }
  public get config(): PlayerClassConfig { return PLAYER_CLASS_CONFIGS[this.classId]; }
  public get currentHealth(): number { return this.health; }
  public get maxHealth(): number { return this.config.maxHealth + this.bonuses.maxHealth; }
  public get currentMana(): number { return this.mana; }
  public get maxMana(): number { return PLAYER_RESOURCES.maxMana + this.bonuses.maxMana; }
  public get finalDamage(): number { return this.config.attackDamage + this.bonuses.damage; }
  public get finalMoveSpeed(): number { return this.config.moveSpeed * (1 + this.bonuses.movementSpeed); }
  public get finalManaRegen(): number { return PLAYER_RESOURCES.manaRegenPerSecond + this.bonuses.manaRegen; }
  public get cooldownMultiplier(): number { return 1 - this.bonuses.cooldownReduction; }
  public applyEquipment(bonuses: ItemStats): void {
    this.bonuses = { ...bonuses };
    this.health = Math.min(this.health, this.maxHealth); this.mana = Math.min(this.mana, this.maxMana);
    this.onHealthChanged(this.health, this.maxHealth); this.onManaChanged(this.mana, this.maxMana);
  }

  public destroy(): void {
    combatTargets(this.scene).remove(this); this.dodgeState.cancel();
    this.visual.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.handleAnimationUpdate, this);
    this.visual.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleAnimationComplete, this);
    this.visual.destroy();
    this.root.destroy();
  }

  private resetVisualState(cancelDodge = true): void {
    if (cancelDodge) this.dodgeState.cancel();
    const skin = getCharacterSkin(this.skinId);
    this.state = 'idle'; this.activeAttackKey = ''; this.impactTriggered = false; this.pendingSkillId = undefined;
    this.body.setVelocity(0, 0); this.visual.stop();
    this.visual.setScale(skin.displayScale * WORLD_CHARACTER_RENDER_SCALE).clearTint();
    this.applyVisualState('idle');
  }

  private playIdle(): void {
    this.visual.stop();
    const visualDirection = this.visualDirection;
    this.applyVisualState('idle');
    this.applyHorizontalFlip(visualDirection);
    this.visual.setTexture(characterTextureKey(this.skinId, 'idle'), idleFrameForSkin(this.skinId, visualDirection));
  }

  private handleAnimationUpdate(animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (this.state !== 'attack' || this.impactTriggered || animation.key !== this.activeAttackKey) return;
    const attack = getCharacterSkin(this.skinId).animations.attack;
    const row = attack.directionRows?.[this.visualDirection] ?? 0;
    const configuredFrame = this.config.attackKind === 'arrow' ? attack.releaseFrame : undefined;
    const impactFrame = Math.min(configuredFrame ?? getCharacterSkin(this.skinId).attackImpactFrame, attack.frames - 1);
    if (Number(frame.textureFrame) !== row * attack.frames + impactFrame) return;
    const release = this.projectileReleasePoint();
    this.impactTriggered = true; this.emitAttackImpact(release);
  }

  private handleAnimationComplete(animation: Phaser.Animations.Animation): void {
    if (this.state !== 'attack' || animation.key !== this.activeAttackKey) return;
    this.state = 'idle'; this.activeAttackKey = ''; this.pendingSkillId = undefined; this.playIdle();
  }

  private emitAttackImpact(release?: { x: number; y: number }, meleePhase?: number): void {
    this.onAttackImpact({ classId: this.classId, kind: this.config.attackKind, facing: this.facing, aimX: this.aimX, aimY: this.aimY, targetX: this.targetX, targetY: this.targetY, rootX: this.x, rootY: this.y, releaseX: release?.x, releaseY: release?.y, meleePhase, skillId: this.pendingSkillId });
  }

  private projectileReleasePoint(): { x: number; y: number } | undefined {
    if (this.config.attackKind === 'melee') return undefined;
    const scale = getCharacterSkin(this.skinId).displayScale * WORLD_CHARACTER_RENDER_SCALE;
    if (this.config.attackKind === 'arrow') {
      const horizontal = this.horizontalFacing === 'left' ? -1 : 1;
      return { x: Math.round(this.x + horizontal * 14 * scale), y: Math.round(this.y - 25 * scale) };
    }
    return { x: Math.round(this.x + this.aimX * 8 * scale), y: Math.round(this.y - 18 * scale) };
  }

  private requireGameplaySkin(classId: PlayerClassId, skinId: string): string {
    const skin = getCharacterSkin(skinId);
    if (skin.classId !== classId || skin.runtimeStatus !== 'GAMEPLAY') {
      throw new Error(`Skin ${skinId} is not a gameplay-compatible ${classId} skin.`);
    }
    return skin.id;
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

  private get visualDirection(): Direction {
    return getCharacterSkin(this.skinId).compatibility === 'SIDE_VIEW_ONLY' ? this.horizontalFacing : this.facing;
  }

  private applyHorizontalFlip(direction: Direction): void {
    const skin = getCharacterSkin(this.skinId);
    const sideView = skin.compatibility === 'SIDE_VIEW_ONLY';
    const visualState = this.state === 'move' ? 'walk' : this.state === 'attack' ? 'attack' : 'idle';
    const animation = skin.animations[visualState];
    const sourceRootX = animation.rootX ?? skin.visualCenterX;
    const flipped = sideView && direction === 'left';
    this.visual
      .setFlipX(flipped)
      .setOrigin(flipped ? 1 - sourceRootX / animation.frameWidth : sourceRootX / animation.frameWidth, this.visual.originY);
  }

  private applyVisualState(state: 'idle' | 'walk' | 'attack'): void {
    const skin = getCharacterSkin(this.skinId);
    const animation = skin.animations[state];
    const rootX = animation.rootX ?? skin.visualCenterX;
    const baseline = animation.baseline ?? skin.baseline;
    this.visual.setOrigin(rootX / animation.frameWidth, baseline / animation.frameHeight);
    this.configureCollision(skin, rootX, baseline);
  }

  private configureCollision(_skin: ReturnType<typeof getCharacterSkin>, _rootX: number, _baseline: number): void {
    this.body.setSize(18, 13).setOffset(0, 0);
  }

}

export function gameplaySkinIds(classId: PlayerClassId): readonly string[] {
  return GAMEPLAY_SKINS_BY_CLASS[classId].map((skin) => skin.id);
}
