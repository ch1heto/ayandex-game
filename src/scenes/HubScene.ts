import Phaser from 'phaser';

import hubTilesUrl from '../../assets/tilesets/ashvale-hub.png';
import forgeRuinedUrl from '../../assets/environments/ashvale-hub/props/forge-ruined.png';
import forgeRestoredUrl from '../../assets/environments/ashvale-hub/props/forge-restored.png';
import infirmaryRuinedUrl from '../../assets/environments/ashvale-hub/props/infirmary-ruined.png';
import infirmaryRestoredUrl from '../../assets/environments/ashvale-hub/props/infirmary-restored.png';
import boardUrl from '../../assets/environments/ashvale-hub/props/restoration-board.png';
import { SceneKey } from '../core/sceneKeys';
import { setCanvasPixelArt } from '../core/canvasRendering';
import { PLAYER_CLASS_IDS, type PlayerClassId } from '../entities/player/playerTypes';
import { isGameplaySkinForClass } from '../data/characterSkins';
import { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { preloadCharacterAssets, registerCharacterAnimations } from '../entities/player/characterAssets';
import { gameProgressService } from '../systems/save/GameProgressService';
import { createDomOverlay } from '../ui/domOverlay';

const KEYS = { tiles: 'hub-tiles', forgeRuined: 'hub-forge-ruined', forgeRestored: 'hub-forge-restored', infirmaryRuined: 'hub-infirmary-ruined', infirmaryRestored: 'hub-infirmary-restored', board: 'hub-board' } as const;
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 640;
const FORGE_COST = 12;
const INFIRMARY_COST = 16;

export class HubScene extends Phaser.Scene {
  private player!: PlayerCharacter;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private forge!: Phaser.GameObjects.Image;
  private infirmary!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private modal?: HTMLDivElement;

  public constructor() { super(SceneKey.Hub); }

  public preload(): void {
    preloadCharacterAssets(this);
    this.load.spritesheet(KEYS.tiles, hubTilesUrl, { frameWidth: 32, frameHeight: 32 });
    this.load.image(KEYS.forgeRuined, forgeRuinedUrl); this.load.image(KEYS.forgeRestored, forgeRestoredUrl);
    this.load.image(KEYS.infirmaryRuined, infirmaryRuinedUrl); this.load.image(KEYS.infirmaryRestored, infirmaryRestoredUrl);
    this.load.image(KEYS.board, boardUrl);
  }

  public create(): void {
    setCanvasPixelArt(this.game, true);
    registerCharacterAnimations(this);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawGround();
    const progress = gameProgressService.snapshot;
    this.forge = this.add.image(245, 430, progress.buildings.forge ? KEYS.forgeRestored : KEYS.forgeRuined).setOrigin(0.5, 1).setDepth(430);
    this.infirmary = this.add.image(720, 430, progress.buildings.infirmary ? KEYS.infirmaryRestored : KEYS.infirmaryRuined).setOrigin(0.5, 1).setDepth(430);
    this.add.image(480, 395, KEYS.board).setOrigin(0.5, 1).setDepth(395);
    this.add.text(480, 426, 'RESTORATION BOARD', { color: '#eadba9', fontFamily: 'monospace', fontSize: '9px', stroke: '#1b211d', strokeThickness: 3 }).setOrigin(0.5).setDepth(1000);
    this.add.text(180, 575, 'SLIME GLADE', { color: '#b7d89a', fontFamily: 'monospace', fontSize: '10px', stroke: '#142018', strokeThickness: 3 }).setOrigin(0.5);
    this.add.text(780, 575, 'SPIDER HOLLOW', { color: '#e29a5a', fontFamily: 'monospace', fontSize: '10px', stroke: '#24150f', strokeThickness: 3 }).setOrigin(0.5);
    const selectedClass = this.registry.get('selectedClass') as PlayerClassId;
    const selectedSkin = this.registry.get('selectedSkin');
    if (!PLAYER_CLASS_IDS.includes(selectedClass) || typeof selectedSkin !== 'string' || !isGameplaySkinForClass(selectedSkin, selectedClass)) { this.scene.start(SceneKey.CharacterSelect); return; }
    this.player = new PlayerCharacter(this, 480, 460, selectedClass, selectedSkin, () => undefined, this.handleHealth);
    const colliders = this.physics.add.staticGroup();
    this.addCollision(colliders, 245, 430, 126, 48); this.addCollision(colliders, 720, 430, 126, 48); this.addCollision(colliders, 480, 395, 76, 24);
    this.physics.add.collider(this.player.physicsRoot, colliders);
    const keyboard = this.input.keyboard!;
    this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W); this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S); this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A); this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    keyboard.on('keydown', this.handleKeyDown, this);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).startFollow(this.player.visual, true, 1, 1).setRoundPixels(true);
    this.prompt = this.add.text(320, 320, '', { color: '#fff2c0', fontFamily: 'monospace', fontSize: '9px', backgroundColor: '#111913cc', padding: { x: 6, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(30_000);
    this.registry.set('activeClass', selectedClass); this.registry.set('activeSkin', selectedSkin); this.registry.set('coins', progress.coins);
    this.scene.launch(SceneKey.UI);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  public update(): void {
    if (this.modal) { this.player.move(false, false, false, false); return; }
    this.player.move(this.upKey.isDown, this.downKey.isDown, this.leftKey.isDown, this.rightKey.isDown);
    if (this.player.y > 558 && this.player.x < 315) this.scene.start(SceneKey.Game);
    else if (this.player.y > 558 && this.player.x > 645) this.scene.start(SceneKey.SpiderZone);
    this.prompt.setText(Phaser.Math.Distance.Between(this.player.x, this.player.y, 480, 395) < 76 ? '[F] OPEN RESTORATION BOARD' : '');
  }

  private drawGround(): void {
    for (let y = 0; y < WORLD_HEIGHT; y += 32) for (let x = 0; x < WORLD_WIDTH; x += 32) {
      const plaza = x >= 128 && x < 832 && y >= 96 && y < 544;
      this.add.image(x, y, KEYS.tiles, plaza ? (x / 32 + y / 32) % 4 : 2).setOrigin(0).setDepth(0);
    }
    this.add.rectangle(480, 320, 720, 456, 0x838172, 0.08).setStrokeStyle(3, 0xb1aa8b, 0.5).setDepth(1);
  }

  private addCollision(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, width: number, height: number): void {
    const zone = this.add.zone(x, y - height / 2, width, height); this.physics.add.existing(zone, true); group.add(zone);
  }

  private interact(): void {
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, 480, 395) > 76 || this.modal) return;
    this.openRestorationModal();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'KeyF') this.interact();
    if (!import.meta.env.DEV) return;
    if (event.code === 'F6') this.scene.start(SceneKey.Game);
    if (event.code === 'F7') this.scene.start(SceneKey.SpiderZone);
    if (event.code === 'F8') {
      const progress = gameProgressService.addCoins(20);
      this.registry.set('coins', progress.coins);
    }
  }

  private openRestorationModal(): void {
    const progress = gameProgressService.snapshot;
    const overlay = createDomOverlay(this, 'restoration-ui'); this.modal = overlay;
    const panel = document.createElement('section'); panel.className = 'restoration-panel';
    panel.innerHTML = `<h2>RESTORATION BOARD</h2><p>COINS: ${progress.coins}</p>`;
    panel.append(this.buildButton('forge', FORGE_COST, progress.buildings.forge), this.buildButton('infirmary', INFIRMARY_COST, progress.buildings.infirmary));
    const close = document.createElement('button'); close.className = 'ui-button ghost'; close.textContent = 'CLOSE'; close.onclick = () => { overlay.remove(); this.modal = undefined; };
    panel.append(close); overlay.append(panel);
  }

  private buildButton(building: 'forge' | 'infirmary', cost: number, restored: boolean): HTMLButtonElement {
    const button = document.createElement('button'); button.className = 'building-option';
    button.textContent = restored ? `${building.toUpperCase()} · RESTORED` : `${building.toUpperCase()} · ${cost} COINS`;
    button.disabled = restored; button.onclick = () => {
      if (!gameProgressService.restoreBuilding(building, cost)) return;
      const progress = gameProgressService.snapshot; this.registry.set('coins', progress.coins); this.registry.set(`${building}Restored`, true);
      (building === 'forge' ? this.forge : this.infirmary).setTexture(building === 'forge' ? KEYS.forgeRestored : KEYS.infirmaryRestored);
      this.modal?.remove(); this.modal = undefined;
    };
    return button;
  }

  private handleHealth = (health: number, maxHealth: number): void => { this.registry.set('playerHealth', health); this.registry.set('playerMaxHealth', maxHealth); };
  private shutdown(): void { this.input.keyboard?.off('keydown', this.handleKeyDown, this); this.modal?.remove(); this.modal = undefined; this.player?.destroy(); this.scene.stop(SceneKey.UI); }
}
