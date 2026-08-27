import Phaser from 'phaser';
import { equipmentBonuses } from '../data/equipment';
import { ELITE_CONFIG, type EliteAffix } from '../data/elites';
import { DUNGEON_CONFIG } from '../data/dungeon';
import { AdvancedSkillSystem } from '../systems/skills/AdvancedSkillSystem';
import { EquipmentLootSystem, preloadEquipmentIcons } from '../systems/loot/EquipmentLootSystem';
import { notify } from '../systems/notifications/notifications';
import { createDungeonWorld, preloadDungeonWorld, type DungeonWorld } from '../dungeons/DungeonWorld';
import { DungeonRun } from '../dungeons/DungeonRun';
import { PixelPortal } from '../dungeons/PixelPortal';

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
import { OBJECTIVE_TARGETS, requiredXpForLevel, type EnemyKind } from '../data/progression';
import { PLAYER_RESOURCES } from '../data/playerResources';
import type { MossSlime } from '../entities/enemies/MossSlime';
import { EmberSpider } from '../entities/enemies/EmberSpider';

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
  private restoration?: RestorationSystem;
  private advanced!: AdvancedSkillSystem;
  private equipmentLoot!: EquipmentLootSystem;
  private dungeon?: DungeonRun;
  private entrance?: PixelPortal;
  private equipmentRevision = -1;
  private coinNotification = 0;
  private nextCoinNotification = 0;
  private xpNotification = 0;
  private nextXpNotification = 0;
  private lastCoinNotification = -Infinity;
  private lastXpNotification = -Infinity;
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
  private healthPotionReadyAt = 0;
  private manaPotionReadyAt = 0;
  private target?: { kind: EnemyKind; enemy: MossSlime | EmberSpider };
  private targetExpiresAt = 0;


  public constructor(private readonly isDungeon = false) { super(isDungeon ? SceneKey.Dungeon : SceneKey.Game); }

  public preload(): void {
    preloadCharacterAssets(this);
    preloadMossSlimeAssets(this);
    preloadEmberSpiderAssets(this);
    preloadCoinAssets(this);
    preloadAshvaleWorld(this);
    preloadRestorationAssets(this);
    preloadEquipmentIcons(this);
    if (this.isDungeon) preloadDungeonWorld(this);
  }

  public create(): void {
    setCanvasPixelArt(this.game, true);
    this.respawnPending = false; this.target = undefined; this.activeRegion = undefined; this.equipmentRevision = -1;
    this.healthPotionReadyAt = 0; this.manaPotionReadyAt = 0; this.coinNotification = 0; this.nextCoinNotification = 0; this.xpNotification = 0; this.nextXpNotification = 0; this.lastCoinNotification = -Infinity; this.lastXpNotification = -Infinity;
    this.registry.set('hudNotifications', []); this.registry.set('equipmentPanelOpen', false); this.registry.set('inDungeon', this.isDungeon);
    this.worldRuntime = this.isDungeon ? createDungeonWorld(this) : createAshvaleWorld(this);
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
      this.handleManaChanged,
    );
    this.coinDrops = new CoinDropSystem(this, this.player.physicsRoot, this.handleCoinPickup);
    this.restoration = this.isDungeon ? undefined : new RestorationSystem(this, this.player, this.worldRuntime.collisionGroup, this.setCoins);
    this.equipmentLoot = new EquipmentLootSystem(this, this.player);
    this.entrance = this.isDungeon ? undefined : new PixelPortal(this, DUNGEON_CONFIG.entrance.x, DUNGEON_CONFIG.entrance.y);
    this.slimes = new MossSlimeSpawner(this, this.worldRuntime.slimeSpawns, this.player, this.coinDrops, this.handleEnemyDefeated, (enemy) => this.focusTarget('slime', enemy), { respawn: !this.isDungeon, elites: !this.isDungeon });
    this.spiders = new EmberSpiderSpawner(this, this.worldRuntime.spiderSpawns, this.player, this.coinDrops, this.handleEnemyDefeated, (enemy) => this.focusTarget('spider', enemy), { respawn: !this.isDungeon, elites: !this.isDungeon });
    this.skills = new SkillSystem(this, {
      player: this.player,
      projectiles: this.projectiles,
      slimes: this.slimes,
      spiders: this.spiders,
      obstacles: this.worldRuntime.collisionGroup,
    });
    this.advanced = new AdvancedSkillSystem(this, { player: this.player, projectiles: this.projectiles, slimes: this.slimes, spiders: this.spiders, obstacles: this.worldRuntime.collisionGroup });
    this.syncEquipment();
    this.dungeon = this.isDungeon ? new DungeonRun(this, this.worldRuntime as DungeonWorld, this.player, this.slimes, this.spiders,
      enemy => this.focusTarget('spider', enemy), this.handleBossReward, (x, y) => { this.coinDrops.spawn(x, y, Phaser.Math.Between(2, 4)); this.handleEnemyDefeated('spider', x, y); }) : undefined;
    this.physics.add.collider(this.player.physicsRoot, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.player.physicsRoot, this.slimes.group);
    this.physics.add.collider(this.player.physicsRoot, this.spiders.group);
    this.physics.add.collider(this.slimes.group, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.spiders.group, this.worldRuntime.collisionGroup);
    this.physics.add.collider(this.slimes.group, this.spiders.group);

    this.cameras.main.setBounds(0, 0, this.worldRuntime.width, this.worldRuntime.height);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#14201c');
    this.cameraZoomIndex = loadCameraZoomIndex();
    this.applyCameraZoom();
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, this.updateCameraFollow, this);

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
    this.registry.set('playerMana', this.player.currentMana);
    this.registry.set('playerMaxMana', this.player.maxMana);
    this.registry.set('coins', this.coins);
    this.registry.set('worldWidth', this.worldRuntime.width);
    this.registry.set('worldHeight', this.worldRuntime.height);
    this.refreshProgressRegistry();
    this.refreshSkillRegistry();
    this.scene.launch(SceneKey.UI);
    this.updateRegionTitle(true);

    this.removePauseListener = yandexGamesService.onPause(() => this.scene.pause());
    this.removeResumeListener = yandexGamesService.onResume(() => this.scene.resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  public update(time: number, delta: number): void {
    this.player.move(
      !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true && this.upKey.isDown,
      !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true && this.downKey.isDown,
      !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true && this.leftKey.isDown,
      !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true && this.rightKey.isDown,
    );
    this.projectiles.update();
    this.player.updateResources(time, delta);
    this.slimes.update(time);
    this.spiders.update(time);
    this.coinDrops.update(time);
    this.restoration?.update();
    this.equipmentLoot.update(time); this.advanced.update(time);
    this.entrance?.update(time); this.dungeon?.update(time);
    if (this.entrance?.near(this.player.x, this.player.y)) this.registry.set('interactionPromptKey', 'dungeon.enter');
    this.syncEquipment();
    if (this.coinNotification > 0 && time >= this.nextCoinNotification) {
      notify(this, t('notify.coins', { coins: this.coinNotification }), 'coins'); this.coinNotification = 0; this.lastCoinNotification = time;
    }
    if (this.xpNotification > 0 && time >= this.nextXpNotification) {
      notify(this, t('notify.xp', { xp: this.xpNotification }), 'xp'); this.xpNotification = 0; this.lastXpNotification = time;
    }
    this.refreshSkillRegistry();
    this.refreshRuntimeRegistry(time);
    this.updateRegionTitle(false);
    this.debugOverlay?.update();
  }

  private updateCameraFollow(): void {
    const camera = this.cameras.main;
    const zoom = camera.zoom;
    // Arcade Physics resolves after Scene.update(), so synchronize the
    // presentation from the final root position immediately before rendering.
    this.player.syncVisual();
    // Native follow resolves inside Camera.preRender(), after Scene.update().
    // Resolve it here instead so the render matrix receives grid-locked scroll.
    const desiredScrollX = this.player.x - camera.width * camera.originX;
    const desiredScrollY = this.player.y - camera.height * camera.originY;
    camera.scrollX = this.snapCameraScroll(
      desiredScrollX,
      camera.clampX(Number.NEGATIVE_INFINITY),
      camera.clampX(Number.POSITIVE_INFINITY),
      zoom,
    );
    camera.scrollY = this.snapCameraScroll(
      desiredScrollY,
      camera.clampY(Number.NEGATIVE_INFINITY),
      camera.clampY(Number.POSITIVE_INFINITY),
      zoom,
    );
  }

  private snapCameraScroll(value: number, min: number, max: number, zoom: number): number {
    const snappedMin = Math.ceil(min * zoom) / zoom;
    const snappedMax = Math.floor(max * zoom) / zoom;
    const snappedValue = Math.round(value * zoom) / zoom;
    return Phaser.Math.Clamp(snappedValue, snappedMin, snappedMax);
  }

  private switchClass(classId: PlayerClassId): void {
    const selected = this.registry.get(`selectedSkin:${classId}`);
    const fallback = GAMEPLAY_SKINS_BY_CLASS[classId][0]?.id;
    const skinId = typeof selected === 'string' && isGameplaySkinForClass(selected, classId) ? selected : fallback;
    if (!skinId || !this.player.switchClass(classId, skinId)) return;
    this.skills.cancelPending(); this.advanced.cancel();
    this.projectiles.destroy();
    this.player.restoreFullHealth();
    this.registry.set('selectedClass', classId);
    this.registry.set('selectedSkin', this.player.activeSkin);
    this.registry.set(`selectedSkin:${classId}`, this.player.activeSkin);
    this.registry.set('activeClass', classId);
    this.registry.set('activeSkin', this.player.activeSkin);
    gameProgressService.select(classId, this.player.activeSkin); this.equipmentRevision = -1; this.syncEquipment();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat || this.player.currentHealth <= 0) return;
    if (event.code === 'KeyF' && this.registry.get('equipmentPanelOpen') !== true) {
      if (this.dungeon?.canExit) { this.scene.start(SceneKey.Game); return; }
      if (this.entrance?.near(this.player.x, this.player.y)) { this.scene.start(SceneKey.Dungeon); return; }
      if (this.restoration?.interact()) return;
    }
    if (['Digit1', 'Digit2', 'Digit3'].includes(event.code) && !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true) {
      const pointer = this.input.activePointer;
      const target = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (event.code === 'Digit1') this.skills.activate(target.x, target.y);
      else this.advanced.activate(event.code === 'Digit2' ? 2 : 3, target.x, target.y);
      return;
    }
    if (import.meta.env.DEV && event.code === 'F1') this.switchClass('warrior');
    if (import.meta.env.DEV && event.code === 'F2') this.switchClass('archer');
    if (import.meta.env.DEV && event.code === 'F3') this.switchClass('mage');
    if (event.code === 'KeyQ' && !event.shiftKey && !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true) this.usePotion('health');
    if (event.code === 'KeyE' && !event.shiftKey && !this.restoration?.isModalOpen && this.registry.get('equipmentPanelOpen') !== true) this.usePotion('mana');
    if (import.meta.env.DEV && event.shiftKey && event.code === 'KeyQ') this.cycleGameplaySkin(-1);
    if (import.meta.env.DEV && event.shiftKey && event.code === 'KeyE') this.cycleGameplaySkin(1);
    if (event.code === 'F4' && import.meta.env.DEV) this.debugOverlay?.toggle();
  }

  private cycleGameplaySkin(delta: number): void {
    const skins = GAMEPLAY_SKINS_BY_CLASS[this.player.activeClass];
    if (skins.length < 2) return;
    const current = skins.findIndex((skin) => skin.id === this.player.activeSkin);
    const next = skins[Phaser.Math.Wrap(current + delta, 0, skins.length)];
    if (!this.player.switchSkin(next.id)) return;
    this.skills.cancelPending(); this.advanced.cancel();
    this.projectiles.destroy();
    this.registry.set(`selectedSkin:${this.player.activeClass}`, next.id);
    this.registry.set('selectedSkin', next.id);
    this.registry.set('activeSkin', next.id);
    gameProgressService.select(this.player.activeClass, next.id);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 || this.restoration?.isModalOpen || this.registry.get('equipmentPanelOpen') === true) return;
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
    if (this.player) this.updateCameraFollow();
  }

  private handleAttackImpact = (impact: AttackImpact): void => {
    if (this.advanced.handleImpact(impact) || this.skills.handleImpact(impact)) return;
    const config = { ...PLAYER_CLASS_CONFIGS[impact.classId], attackDamage: this.player.finalDamage };
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
      [this.slimes.group, this.spiders.hurtboxGroup],
      (target) => {
        const slime = this.slimes.getSlime(target);
        if (slime) { slime.takeDamage(config.attackDamage, impact.rootX, impact.rootY); this.focusTarget('slime', slime); }
        else { const spider = this.spiders.get(target); if (spider) { spider.takeDamage(config.attackDamage, impact.rootX, impact.rootY); this.focusTarget('spider', spider); } }
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
          const slime = this.slimes.getSlime(target); slime?.takeDamage(damage, impact.rootX, impact.rootY); if (slime) this.focusTarget('slime', slime);
        });
        this.physics.overlap(hitbox, this.spiders.group, (_hitbox, spiderObject) => {
          const target = spiderObject as Phaser.GameObjects.GameObject;
          if (hitEnemies.has(target)) return;
          hitEnemies.add(target);
          const spider = this.spiders.get(target); spider?.takeDamage(damage, impact.rootX, impact.rootY); if (spider) this.focusTarget('spider', spider);
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
    this.skills?.cancelPending(); this.advanced?.cancel(); this.projectiles?.destroy();
    this.respawnPending = true;
    this.time.delayedCall(720, () => {
      if (this.isDungeon) { this.scene.start(SceneKey.Game); return; }
      this.player.setPosition(this.worldRuntime.playerSpawn.x, this.worldRuntime.playerSpawn.y);
      this.player.restoreFullHealth();
      this.cameras.main.flash(120, 221, 236, 220, false);
      this.respawnPending = false;
    });
  };

  private handleManaChanged = (mana: number, maxMana: number): void => {
    this.registry.set('playerMana', mana);
    this.registry.set('playerMaxMana', maxMana);
  };

  private handleEnemyDefeated = (kind: EnemyKind, x: number, y: number, elite?: EliteAffix): void => {
    this.equipmentLoot.roll(x, y, elite ? 'elite' : 'normal');
    if (elite) { gameProgressService.milestone('eliteKilled'); notify(this, t('notify.elite'), 'elite'); }
    const result = gameProgressService.recordEnemyDefeat(kind, elite ? ELITE_CONFIG.xp : 1);
    if (!this.xpNotification) this.nextXpNotification = Math.max(this.time.now + 400, this.lastXpNotification + 1000);
    this.xpNotification += result.xpGained;
    if (result.levelsGained > 0) this.pushNotification(t('notify.level', { level: result.progress.player.level }));
    if (result.completedObjective) this.pushNotification(t(result.completedObjective === 'slime' ? 'objective.slimeComplete' : 'objective.spiderComplete'));
    this.refreshProgressRegistry();
    if (this.target?.kind === kind && this.target.enemy.currentHealth <= 0) this.clearTarget();
  };

  private usePotion(kind: 'health' | 'mana'): void {
    const now = this.time.now;
    const readyAt = kind === 'health' ? this.healthPotionReadyAt : this.manaPotionReadyAt;
    if (now < readyAt) return;
    const saved = gameProgressService.snapshot.player;
    if ((kind === 'health' ? saved.healthPotions : saved.manaPotions) <= 0) { this.pushNotification(t('potion.empty')); return; }
    const restored = kind === 'health'
      ? this.player.restoreHealth(PLAYER_RESOURCES.healthPotionRestore)
      : this.player.restoreMana(PLAYER_RESOURCES.manaPotionRestore);
    if (!restored) { this.pushNotification(t(kind === 'health' ? 'potion.healthFull' : 'potion.manaFull')); return; }
    gameProgressService.consumePotion(kind);
    if (kind === 'health') this.healthPotionReadyAt = now + PLAYER_RESOURCES.potionCooldownMs;
    else this.manaPotionReadyAt = now + PLAYER_RESOURCES.potionCooldownMs;
    this.pushNotification(t(kind === 'health' ? 'potion.healthUsed' : 'potion.manaUsed'));
    this.refreshProgressRegistry();
  }

  private handleCoinPickup = (value: number): void => {
    this.setCoins(gameProgressService.addCoins(value).coins);
    if (!this.coinNotification) this.nextCoinNotification = Math.max(this.time.now + 400, this.lastCoinNotification + 1000);
    this.coinNotification += value;
  };

  private setCoins = (coins: number): void => {
    this.coins = coins;
    this.registry.set('coins', coins);
  };

  private refreshSkillRegistry(): void {
    this.registry.set('skill2CooldownMs', this.advanced.cooldown(this.player.activeClass, 2));
    this.registry.set('skill3CooldownMs', this.advanced.cooldown(this.player.activeClass, 3));
    this.registry.set('equipmentCooldownMultiplier', this.player.cooldownMultiplier);
    const classId = this.player.activeClass;
    const config = this.skills.getConfig(classId);
    this.registry.set('skill1NameKey', config.localizedNameKey);
    this.registry.set('skill1CooldownMs', this.skills.getCooldownRemaining(classId));
    this.registry.set('skill1CooldownTotalMs', config.cooldownMs * this.player.cooldownMultiplier);
    this.registry.set('skill1Color', config.color);
  }

  private refreshProgressRegistry(): void {
    const player = gameProgressService.snapshot.player;
    this.registry.set('playerLevel', player.level);
    this.registry.set('playerXp', player.xp);
    this.registry.set('playerXpRequired', requiredXpForLevel(player.level));
    this.registry.set('healthPotions', player.healthPotions);
    this.registry.set('manaPotions', player.manaPotions);
    this.registry.set('slimeKills', player.slimeKills);
    this.registry.set('spiderKills', player.spiderKills);
    this.registry.set('slimeTarget', OBJECTIVE_TARGETS.slime);
    this.registry.set('spiderTarget', OBJECTIVE_TARGETS.spider);
  }

  private refreshRuntimeRegistry(time: number): void {
    this.registry.set('gameTime', time);
    this.registry.set('playerX', this.player.x);
    this.registry.set('playerY', this.player.y);
    this.registry.set('healthPotionCooldownMs', Math.max(0, this.healthPotionReadyAt - time));
    this.registry.set('manaPotionCooldownMs', Math.max(0, this.manaPotionReadyAt - time));
    this.registry.set('potionCooldownTotalMs', PLAYER_RESOURCES.potionCooldownMs);
    if (!this.target || time >= this.targetExpiresAt || this.target.enemy.currentHealth <= 0) { this.clearTarget(); return; }
    this.registry.set('targetVisible', true);
    const enemy = this.target.enemy;
    const boss = enemy instanceof EmberSpider && enemy.isBoss;
    this.registry.set('targetIsBoss', boss);
    const name = t(this.target.kind === 'slime' ? 'target.slime' : 'target.spider');
    this.registry.set('targetDisplayName', boss ? t('boss.label') + ' · ' + t('boss.name') + ' · ' + t('boss.phase', { phase: enemy.bossPhase }) : enemy.elite ? '◆ ' + t(`elite.${enemy.elite}`) + ' ' + name : name);
    this.registry.set('targetNameKey', this.target.kind === 'slime' ? 'target.slime' : 'target.spider');
    this.registry.set('targetHealth', this.target.enemy.currentHealth);
    this.registry.set('targetMaxHealth', this.target.enemy.maxHealth);
  }

  private focusTarget(kind: EnemyKind, enemy: MossSlime | EmberSpider): void {
    this.target = { kind, enemy };
    this.targetExpiresAt = this.time.now + 3_500;
  }

  private clearTarget(): void {
    this.target = undefined;
    this.registry.set('targetVisible', false); this.registry.set('targetIsBoss', false);
  }

  private pushNotification(message: string): void {
    notify(this, message);
  }

  private syncEquipment(): void {
    if (this.equipmentRevision === gameProgressService.version) return;
    this.equipmentRevision = gameProgressService.version;
    const saved = gameProgressService.snapshot;
    this.player.applyEquipment(equipmentBonuses(saved.equipment, this.player.activeClass));
    this.registry.set('playerFinalDamage', this.player.finalDamage); this.refreshProgressRegistry();
  }

  private handleBossReward = (x: number, y: number): void => {
    const result = gameProgressService.recordEnemyDefeat('spider', DUNGEON_CONFIG.boss.xpMultiplier);
    gameProgressService.milestone('bossFirstKill');
    this.setCoins(gameProgressService.addCoins(DUNGEON_CONFIG.boss.coins).coins);
    this.equipmentLoot.roll(x, y, 'boss');
    notify(this, t('boss.defeated'), 'boss', '#d4b476');
    notify(this, t('notify.xp', { xp: result.xpGained }), 'boss-xp');
    notify(this, t('notify.coins', { coins: DUNGEON_CONFIG.boss.coins }), 'boss-coins');
    if (result.levelsGained) notify(this, t('notify.level', { level: result.progress.player.level }), 'level');
    this.refreshProgressRegistry();
  };

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
    if (this.isDungeon) return;
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
    this.events.off(Phaser.Scenes.Events.PRE_RENDER, this.updateCameraFollow, this);
    this.debugOverlay?.destroy();
    this.debugOverlay = undefined;
    this.projectiles?.destroy();
    this.slimes?.destroy();
    this.spiders?.destroy();
    this.skills?.destroy(); this.advanced?.destroy(); this.equipmentLoot?.destroy(); this.dungeon?.destroy(); this.entrance?.destroy();
    this.restoration?.destroy();
    this.coinDrops?.destroy();
    this.player?.destroy();
    this.worldRuntime?.map.destroy(); this.worldRuntime?.collisionGroup.destroy(true);
    this.scene.stop(SceneKey.UI);
  }
}
