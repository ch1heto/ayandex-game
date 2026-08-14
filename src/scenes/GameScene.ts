import Phaser from 'phaser';

import { ProjectileSystem } from '../combat/ProjectileSystem';
import { setCanvasPixelArt } from '../core/canvasRendering';
import { CAMERA_ZOOM_PRESETS, loadCameraZoomIndex, saveCameraZoomIndex } from '../core/cameraZoom';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { GAMEPLAY_SKINS_BY_CLASS, isGameplaySkinForClass } from '../data/characterSkins';
import { CombatDebugOverlay } from '../debug/CombatDebugOverlay';
import { MossSlimeSpawner } from '../entities/enemies/MossSlimeSpawner';
import { preloadMossSlimeAssets, registerMossSlimeAnimations } from '../entities/enemies/mossSlimeAssets';
import { EmberSpiderSpawner } from '../entities/enemies/EmberSpiderSpawner';
import { preloadEmberSpiderAssets, registerEmberSpiderAnimations } from '../entities/enemies/emberSpiderAssets';
import { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { preloadCharacterAssets, registerCharacterAnimations } from '../entities/player/characterAssets';
import { PLAYER_CLASS_IDS, type AttackImpact, type PlayerClassId } from '../entities/player/playerTypes';
import { warriorSwordSweep } from '../entities/player/warriorSwordAttack';
import { CoinDropSystem, preloadCoinAssets, registerCoinAnimations } from '../systems/loot/CoinDropSystem';
import { createAshvaleWorld, preloadAshvaleWorld, type AshvaleWorldRuntime } from '../world/AshvaleWorld';
import { yandexGamesService } from '../yandex/YandexGamesService';
import { gameProgressService } from '../systems/save/GameProgressService';
import { preloadRestorationAssets, RestorationSystem } from '../systems/settlement/RestorationSystem';
import { t } from '../i18n/LocalizationService';
import { SkillSystem } from '../systems/skills/SkillSystem';

// Cover the complete authored sword arc instead of only its three trailing
// phases. Reach remains data-driven and identical for every Warrior skin.
const SWORD_CONTACT_PHASES = [-2, -1, 0, 1] as const;
const SWORD_SAMPLE_DISTANCES = [0.35, 0.58, 0.8, 1] as const;

export class GameScene extends Phaser.Scene {
  private worldRuntime!: AshvaleWorldRuntime;
  private player!: PlayerCharacter;
  private projectiles!: ProjectileSystem;
  private coinDrops!: CoinDropSystem;
  private slimes!: MossSlimeSpawner;
  private spiders!: EmberSpiderSpawner;
  private restoration!: RestorationSystem;
  private skills!: SkillSystem;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private debugOverlay: CombatDebugOverlay | undefined;
  private coins = 0;
  private respawnPending = false;
  private removePauseListener: (() => void) | undefined;
  private removeResumeListener: (() => void) | undefined;
  private activeRegion: 'slime' | 'hub' | 'spider' | undefined;
  private cameraZoomIndex = 1;

  public constructor() { super(SceneKey.Game); }

  public preload(): void {
    preloadCharacterAssets(this);
    preloadMossSlimeAssets(this);
    preloadEmberSpiderAssets(this);
    preloadCoinAssets(this);
    preloadAshvaleWorld(this);
    preloadRestorationAssets(this);
  }

  public create(): void {
    setCanvasPixelArt(this.game, true);
    this.worldRuntime = createAshvaleWorld(this);
    this.physics.world.setBounds(0, 0, this.worldRuntime.width, this.worldRuntime.height);
    registerCharacterAnimations(this);
    registerMossSlimeAnimations(this);
    registerEmberSpiderAnimations(this);
    registerCoinAnimations(this);

    this.projectiles = new ProjectileSystem(this);
    this.coins = gameProgressService.snapshot.coins;
    const selectedClassValue = this.registry.get('selectedClass');
    const selectedSkin = this.registry.get('selectedSkin');
    const selectedClass = typeof selectedClassValue === 'string' && PLAYER_CLASS_IDS.includes(selectedClassValue as PlayerClassId)
      ? selectedClassValue as PlayerClassId
      : undefined;
    if (!selectedClass || typeof selectedSkin !== 'string' || !isGameplaySkinForClass(selectedSkin, selectedClass)) {
      this.scene.start(SceneKey.CharacterSelect);
      return;
    }
    this.player = new PlayerCharacter(
      this,
      this.worldRuntime.playerSpawn.x,
      this.worldRuntime.playerSpawn.y,
      selectedClass,
      selectedSkin,
      this.handleAttackImpact,
      this.handleHealthChanged,
    );
    this.coinDrops = new CoinDropSystem(this, this.player.physicsRoot, this.handleCoinPickup);
    this.restoration = new RestorationSystem(this, this.player, this.worldRuntime.collisionGroup, this.setCoins);
    this.slimes = new MossSlimeSpawner(this, this.worldRuntime.slimeSpawns, this.player, this.coinDrops);
    this.spiders = new EmberSpiderSpawner(this, this.worldRuntime.spiderSpawns, this.player, this.coinDrops);
    this.skills = new SkillSystem(this, {
      player: this.player,
      projectiles: this.projectiles,
      slimes: this.slimes,
      spiders: this.spiders,
      obstacles: this.worldRuntime.collisionGroup,
    });
    this.physics.add.collider(this.player.physicsRoot, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.player.physicsRoot, this.slimes.group);
    this.physics.add.collider(this.player.physicsRoot, this.spiders.group);
    this.physics.add.collider(this.slimes.group, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.spiders.group, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.slimes.group, this.spiders.group);

    this.cameras.main.setBounds(0, 0, this.worldRuntime.width, this.worldRuntime.height);
    this.cameras.main.startFollow(this.player.visual, true, 1, 1);
    this.cameras.main.setFollowOffset(0, 0);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#14201c');
    this.cameraZoomIndex = loadCameraZoomIndex();
    this.applyCameraZoom();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    keyboard.on('keydown', this.handleKeyDown, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.game.canvas.addEventListener('wheel', this.handleCameraWheel, { passive: false });

    if (import.meta.env.DEV) {
      this.debugOverlay = new CombatDebugOverlay(this, this.player, this.slimes, this.worldRuntime.collisionRects);
    }

    this.registry.set('activeClass', this.player.activeClass);
    this.registry.set('activeSkin', this.player.activeSkin);
    this.registry.set('playerHealth', this.player.currentHealth);
    this.registry.set('playerMaxHealth', this.player.maxHealth);
    this.registry.set('coins', this.coins);
    this.refreshSkillRegistry();
    this.scene.launch(SceneKey.UI);
    this.updateRegionTitle(true);

    this.removePauseListener = yandexGamesService.onPause(() => this.scene.pause());
    this.removeResumeListener = yandexGamesService.onResume(() => this.scene.resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  public update(time: number): void {
    this.player.move(
      !this.restoration.isModalOpen && this.upKey.isDown,
      !this.restoration.isModalOpen && this.downKey.isDown,
      !this.restoration.isModalOpen && this.leftKey.isDown,
      !this.restoration.isModalOpen && this.rightKey.isDown,
    );
    this.projectiles.update();
    this.slimes.update(time);
    this.spiders.update(time);
    this.coinDrops.update(time);
    this.restoration.update();
    this.refreshSkillRegistry();
    this.updateRegionTitle(false);
    this.debugOverlay?.update();
  }

  private switchClass(classId: PlayerClassId): void {
    const selected = this.registry.get(`selectedSkin:${classId}`);
    const fallback = GAMEPLAY_SKINS_BY_CLASS[classId][0]?.id;
    const skinId = typeof selected === 'string' && isGameplaySkinForClass(selected, classId) ? selected : fallback;
    if (!skinId || !this.player.switchClass(classId, skinId)) return;
    this.skills.cancelPending();
    this.projectiles.destroy();
    this.player.restoreFullHealth();
    this.registry.set('selectedClass', classId);
    this.registry.set('selectedSkin', this.player.activeSkin);
    this.registry.set(`selectedSkin:${classId}`, this.player.activeSkin);
    this.registry.set('activeClass', classId);
    this.registry.set('activeSkin', this.player.activeSkin);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'KeyF' && this.restoration.interact()) return;
    if (event.code === 'Digit1' && !this.restoration.isModalOpen) {
      const pointer = this.input.activePointer;
      this.skills.activate(pointer.worldX, pointer.worldY);
      return;
    }
    if (import.meta.env.DEV && event.code === 'F1') this.switchClass('warrior');
    if (import.meta.env.DEV && event.code === 'F2') this.switchClass('archer');
    if (import.meta.env.DEV && event.code === 'F3') this.switchClass('mage');
    if (import.meta.env.DEV && event.code === 'KeyQ') this.cycleGameplaySkin(-1);
    if (import.meta.env.DEV && event.code === 'KeyE') this.cycleGameplaySkin(1);
    if (event.code === 'F4' && import.meta.env.DEV) this.debugOverlay?.toggle();
  }

  private cycleGameplaySkin(delta: number): void {
    const skins = GAMEPLAY_SKINS_BY_CLASS[this.player.activeClass];
    if (skins.length < 2) return;
    const current = skins.findIndex((skin) => skin.id === this.player.activeSkin);
    const next = skins[Phaser.Math.Wrap(current + delta, 0, skins.length)];
    if (!this.player.switchSkin(next.id)) return;
    this.skills.cancelPending();
    this.projectiles.destroy();
    this.registry.set(`selectedSkin:${this.player.activeClass}`, next.id);
    this.registry.set('selectedSkin', next.id);
    this.registry.set('activeSkin', next.id);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 || this.restoration.isModalOpen) return;
    this.player.attack(pointer.worldX, pointer.worldY);
  }

  private handleCameraWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.deltaY === 0) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextIndex = Phaser.Math.Clamp(this.cameraZoomIndex + direction, 0, CAMERA_ZOOM_PRESETS.length - 1);
    if (nextIndex === this.cameraZoomIndex) return;
    this.cameraZoomIndex = nextIndex;
    this.applyCameraZoom();
    saveCameraZoomIndex(nextIndex);
  };

  private applyCameraZoom(): void {
    this.cameras.main.setZoom(CAMERA_ZOOM_PRESETS[this.cameraZoomIndex]);
    this.cameras.main.setRoundPixels(true);
  }

  private handleAttackImpact = (impact: AttackImpact): void => {
    if (this.skills.handleImpact(impact)) return;
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
      [this.slimes.group, this.spiders.group],
      (target) => {
        const slime = this.slimes.getSlime(target);
        if (slime) slime.takeDamage(config.attackDamage, impact.rootX, impact.rootY);
        else this.spiders.get(target)?.takeDamage(config.attackDamage, impact.rootX, impact.rootY);
      },
      this.worldRuntime.collisionGroup,
      impact.releaseX !== undefined && impact.releaseY !== undefined
        ? { x: impact.releaseX, y: impact.releaseY }
        : undefined,
    );
  };

  private createMeleeHitbox(impact: AttackImpact, damage: number): void {
    const hitEnemies = new Set<Phaser.GameObjects.GameObject>();
    const hitboxes: Phaser.GameObjects.Zone[] = [];
    const contactPhase = impact.meleePhase ?? 2;
    for (const phaseOffset of SWORD_CONTACT_PHASES) {
      const sweep = warriorSwordSweep(impact.facing, impact.rootX, impact.rootY, contactPhase + phaseOffset);
      for (const distance of SWORD_SAMPLE_DISTANCES) {
        const x = Phaser.Math.Linear(sweep.startX, sweep.endX, distance);
        const y = Phaser.Math.Linear(sweep.startY, sweep.endY, distance);
        const hitbox = this.add.zone(x, y, sweep.thickness, sweep.thickness);
        this.physics.add.existing(hitbox);
        const body = hitbox.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false).setImmovable(true).setCircle(sweep.thickness / 2);
        this.physics.overlap(hitbox, this.slimes.group, (_hitbox, slimeObject) => {
          const target = slimeObject as Phaser.GameObjects.GameObject;
          if (hitEnemies.has(target)) return;
          hitEnemies.add(target);
          this.slimes.getSlime(target)?.takeDamage(damage, impact.rootX, impact.rootY);
        });
        this.physics.overlap(hitbox, this.spiders.group, (_hitbox, spiderObject) => {
          const target = spiderObject as Phaser.GameObjects.GameObject;
          if (hitEnemies.has(target)) return;
          hitEnemies.add(target);
          this.spiders.get(target)?.takeDamage(damage, impact.rootX, impact.rootY);
        });
        hitboxes.push(hitbox);
      }
      if (import.meta.env.DEV && this.debugOverlay?.isVisible) this.showDebugSwordSweep(sweep);
    }
    this.time.delayedCall(58, () => hitboxes.forEach((hitbox) => hitbox.destroy()));
  }

  private handleHealthChanged = (health: number, maxHealth: number): void => {
    this.registry.set('playerHealth', health);
    this.registry.set('playerMaxHealth', maxHealth);
    if (health > 0 || this.respawnPending) return;
    this.skills?.cancelPending();
    this.respawnPending = true;
    this.time.delayedCall(720, () => {
      this.player.setPosition(this.worldRuntime.playerSpawn.x, this.worldRuntime.playerSpawn.y);
      this.player.restoreFullHealth();
      this.cameras.main.flash(120, 221, 236, 220, false);
      this.respawnPending = false;
    });
  };

  private handleCoinPickup = (value: number): void => {
    this.setCoins(gameProgressService.addCoins(value).coins);
  };

  private setCoins = (coins: number): void => {
    this.coins = coins;
    this.registry.set('coins', coins);
  };

  private refreshSkillRegistry(): void {
    const classId = this.player.activeClass;
    const config = this.skills.getConfig(classId);
    this.registry.set('skill1NameKey', config.localizedNameKey);
    this.registry.set('skill1CooldownMs', this.skills.getCooldownRemaining(classId));
    this.registry.set('skill1CooldownTotalMs', config.cooldownMs);
    this.registry.set('skill1Color', config.color);
  }

  private showDebugSwordSweep(sweep: ReturnType<typeof warriorSwordSweep>): void {
    const marker = this.add.graphics().setDepth(20_000);
    marker.lineStyle(sweep.thickness, 0xf5c96a, 0.2);
    marker.beginPath();
    marker.moveTo(sweep.startX, sweep.startY);
    marker.lineTo(sweep.endX, sweep.endY);
    marker.strokePath();
    this.time.delayedCall(110, () => marker.destroy());
  }

  private updateRegionTitle(force: boolean): void {
    const nextRegion = this.player.x < 1420 ? 'slime' : this.player.x > 2460 ? 'spider' : 'hub';
    if (!force && nextRegion === this.activeRegion) return;
    this.activeRegion = nextRegion;
    const copy = t(nextRegion === 'slime' ? 'region.slime' : nextRegion === 'spider' ? 'region.spider' : 'region.hub');
    const color = nextRegion === 'slime' ? '#dbe8ad' : nextRegion === 'spider' ? '#efab64' : '#eadba9';
    const title = this.add.text(this.scale.width / 2, 54, copy, {
      color,
      fontFamily: 'Pixellari, monospace',
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
    this.game.canvas.removeEventListener('wheel', this.handleCameraWheel);
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
    this.debugOverlay?.destroy();
    this.debugOverlay = undefined;
    this.projectiles?.destroy();
    this.slimes?.destroy();
    this.spiders?.destroy();
    this.skills?.destroy();
    this.restoration?.destroy();
    this.coinDrops?.destroy();
    this.player?.destroy();
    this.scene.stop(SceneKey.UI);
  }
}
