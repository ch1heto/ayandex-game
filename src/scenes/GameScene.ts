import Phaser from 'phaser';

import { ProjectileSystem } from '../combat/ProjectileSystem';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { CombatDebugOverlay } from '../debug/CombatDebugOverlay';
import { MossSlimeSpawner } from '../entities/enemies/MossSlimeSpawner';
import { preloadMossSlimeAssets, registerMossSlimeAnimations } from '../entities/enemies/mossSlimeAssets';
import { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { preloadCharacterAssets, registerCharacterAnimations } from '../entities/player/characterAssets';
import type { AttackImpact, Direction, PlayerClassId } from '../entities/player/playerTypes';
import { CoinDropSystem, preloadCoinAssets, registerCoinAnimations } from '../systems/loot/CoinDropSystem';
import { createTwilightGlade, preloadTwilightGlade, type TwilightGladeRuntime } from '../world/TwilightGladeWorld';
import { yandexGamesService } from '../yandex/YandexGamesService';

const MELEE_RANGE = 40;
const MELEE_HITBOX_SIZE = 26;
const MELEE_OFFSET: Record<Direction, { x: number; y: number }> = {
  down: { x: 0, y: MELEE_RANGE },
  left: { x: -MELEE_RANGE, y: 0 },
  up: { x: 0, y: -MELEE_RANGE },
  right: { x: MELEE_RANGE, y: 0 },
};

export class GameScene extends Phaser.Scene {
  private worldRuntime!: TwilightGladeRuntime;
  private player!: PlayerCharacter;
  private projectiles!: ProjectileSystem;
  private coinDrops!: CoinDropSystem;
  private slimes!: MossSlimeSpawner;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private debugOverlay: CombatDebugOverlay | undefined;
  private coins = 0;
  private respawnPending = false;
  private removePauseListener: (() => void) | undefined;
  private removeResumeListener: (() => void) | undefined;

  public constructor() { super(SceneKey.Game); }

  public preload(): void {
    preloadCharacterAssets(this);
    preloadMossSlimeAssets(this);
    preloadCoinAssets(this);
    preloadTwilightGlade(this);
  }

  public create(): void {
    this.worldRuntime = createTwilightGlade(this);
    this.physics.world.setBounds(0, 0, this.worldRuntime.width, this.worldRuntime.height);
    registerCharacterAnimations(this);
    registerMossSlimeAnimations(this);
    registerCoinAnimations(this);

    this.projectiles = new ProjectileSystem(this);
    this.player = new PlayerCharacter(
      this,
      this.worldRuntime.playerSpawn.x,
      this.worldRuntime.playerSpawn.y,
      this.handleAttackImpact,
      this.handleHealthChanged,
    );
    this.coinDrops = new CoinDropSystem(this, this.player.visual, this.handleCoinPickup);
    this.slimes = new MossSlimeSpawner(this, this.worldRuntime.slimeSpawns, this.player, this.coinDrops);
    this.physics.add.collider(this.player.visual, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.player.visual, this.slimes.group);
    this.physics.add.collider(this.slimes.group, this.worldRuntime.collisionGroup);

    this.cameras.main.setBounds(0, 0, this.worldRuntime.width, this.worldRuntime.height);
    this.cameras.main.startFollow(this.player.visual, true, 0.14, 0.14);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#132725');

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    keyboard.on('keydown', this.handleKeyDown, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);

    if (import.meta.env.DEV) {
      this.debugOverlay = new CombatDebugOverlay(this, this.player, this.slimes, this.worldRuntime.collisionRects);
    }

    this.registry.set('activeClass', this.player.activeClass);
    this.registry.set('playerHealth', this.player.currentHealth);
    this.registry.set('playerMaxHealth', this.player.maxHealth);
    this.registry.set('coins', this.coins);
    this.scene.launch(SceneKey.UI);
    this.showLocationTitle();

    this.removePauseListener = yandexGamesService.onPause(() => this.scene.pause());
    this.removeResumeListener = yandexGamesService.onResume(() => this.scene.resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  public update(time: number): void {
    this.player.move(this.upKey.isDown, this.downKey.isDown, this.leftKey.isDown, this.rightKey.isDown);
    this.projectiles.update();
    this.slimes.update(time);
    this.coinDrops.update(time);
    this.debugOverlay?.update();
  }

  private switchClass(classId: PlayerClassId): void {
    this.player.switchClass(classId);
    this.registry.set('activeClass', classId);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Digit1') this.switchClass('warrior');
    if (event.code === 'Digit2') this.switchClass('archer');
    if (event.code === 'Digit3') this.switchClass('mage');
    if (event.code === 'F3' && import.meta.env.DEV) this.debugOverlay?.toggle();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    this.player.attack(pointer.worldX, pointer.worldY);
  }

  private handleAttackImpact = (impact: AttackImpact): void => {
    const config = PLAYER_CLASS_CONFIGS[impact.classId];
    if (impact.kind === 'melee') {
      this.createMeleeHitbox(impact, config.attackDamage);
      return;
    }

    this.projectiles.spawn(
      config,
      impact.facing,
      impact.rootX,
      impact.rootY,
      impact.targetX,
      impact.targetY,
      this.slimes.group,
      (target) => this.slimes.getSlime(target)?.takeDamage(config.attackDamage, impact.rootX, impact.rootY),
      this.worldRuntime.collisionGroup,
    );
  };

  private createMeleeHitbox(impact: AttackImpact, damage: number): void {
    const offset = MELEE_OFFSET[impact.facing];
    const x = impact.rootX + offset.x;
    const y = impact.rootY + offset.y;
    const hitbox = this.add.zone(x, y, MELEE_HITBOX_SIZE, MELEE_HITBOX_SIZE);
    this.physics.add.existing(hitbox);
    const body = hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    const hitSlimes = new Set<Phaser.GameObjects.GameObject>();

    this.physics.overlap(hitbox, this.slimes.group, (_hitbox, slimeObject) => {
      const target = slimeObject as Phaser.GameObjects.GameObject;
      if (hitSlimes.has(target)) return;
      hitSlimes.add(target);
      this.slimes.getSlime(target)?.takeDamage(damage, impact.rootX, impact.rootY);
    });

    if (import.meta.env.DEV && this.debugOverlay?.isVisible) this.showDebugHitbox(x, y);
    this.time.delayedCall(48, () => hitbox.destroy());
  }

  private handleHealthChanged = (health: number, maxHealth: number): void => {
    this.registry.set('playerHealth', health);
    this.registry.set('playerMaxHealth', maxHealth);
    if (health > 0 || this.respawnPending) return;
    this.respawnPending = true;
    this.time.delayedCall(720, () => {
      this.player.setPosition(this.worldRuntime.playerSpawn.x, this.worldRuntime.playerSpawn.y);
      this.player.restoreFullHealth();
      this.cameras.main.flash(120, 221, 236, 220, false);
      this.respawnPending = false;
    });
  };

  private handleCoinPickup = (value: number): void => {
    this.coins += value;
    this.registry.set('coins', this.coins);
  };

  private showDebugHitbox(x: number, y: number): void {
    const marker = this.add.rectangle(x, y, MELEE_HITBOX_SIZE, MELEE_HITBOX_SIZE)
      .setStrokeStyle(1, 0xf5c96a, 0.9)
      .setFillStyle(0xf5c96a, 0.12)
      .setDepth(20_000);
    this.time.delayedCall(110, () => marker.destroy());
  }

  private showLocationTitle(): void {
    const title = this.add.text(320, 54, 'СУМЕРЕЧНАЯ ОПУШКА', {
      color: '#e5d8a9',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      stroke: '#17231f',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30_000).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 260, hold: 1200, yoyo: true, onComplete: () => title.destroy() });
  }

  private shutdown(): void {
    this.removePauseListener?.();
    this.removeResumeListener?.();
    this.removePauseListener = undefined;
    this.removeResumeListener = undefined;
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
    this.debugOverlay?.destroy();
    this.debugOverlay = undefined;
    this.projectiles?.destroy();
    this.slimes?.destroy();
    this.coinDrops?.destroy();
    this.player?.destroy();
    this.scene.stop(SceneKey.UI);
  }
}
