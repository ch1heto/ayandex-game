import Phaser from 'phaser';

import { setCanvasPixelArt } from '../core/canvasRendering';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { SKINS_BY_CLASS, type CharacterSkinConfig, type SkinAnimationState } from '../data/characterSkins';
import { preloadSkinPreviewAssets, registerSkinPreviewAnimations, skinAnimationKey, skinTextureKey } from '../entities/player/skinAssets';
import type { PlayerClassId } from '../entities/player/playerTypes';

const STATES: readonly SkinAnimationState[] = ['idle', 'walk', 'attack'];

export class SkinPreviewScene extends Phaser.Scene {
  private selectedClass: PlayerClassId = 'warrior';
  private selectedIndex: Record<PlayerClassId, number> = { warrior: 0, archer: 0, mage: 0 };
  private content!: Phaser.GameObjects.Container;

  public constructor() { super(SceneKey.SkinPreview); }

  public preload(): void {
    preloadSkinPreviewAssets(this);
  }

  public create(): void {
    setCanvasPixelArt(this.game, true);
    this.drawBackground();
    registerSkinPreviewAnimations(this);
    this.content = this.add.container(0, 0);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.draw();
  }

  private get currentSkin(): CharacterSkinConfig {
    return SKINS_BY_CLASS[this.selectedClass][this.selectedIndex[this.selectedClass]];
  }

  private draw(): void {
    this.content.removeAll(true);
    const skin = this.currentSkin;
    const accent = PLAYER_CLASS_CONFIGS[this.selectedClass].accentColor;
    this.content.add(this.add.text(18, 14, 'SKIN PREVIEW / TEST SELECTOR', {
      color: '#eef3f8', fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
    }));
    this.content.add(this.add.text(18, 38, '[1] Warrior   [2] Archer   [3] Mage', {
      color: '#aeb9c5', fontFamily: 'monospace', fontSize: '10px',
    }));
    this.content.add(this.add.text(18, 55, '[Z/X] previous/next asset   [Esc] menu', {
      color: '#9aa8b7', fontFamily: 'monospace', fontSize: '9px',
    }));

    const classLabel = this.add.text(320, 92, `CLASS: ${this.selectedClass.toUpperCase()}`, {
      color: accent, fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const skinLabel = this.add.text(320, 112, `<  ${skin.displayName}  >`, {
      color: '#f2df9c', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const statusLabel = this.add.text(320, 132, 'DEV GAMEPLAY ENABLED — SIDE-VIEW ADAPTER', {
      color: '#9bd09e', fontFamily: 'monospace', fontSize: '8px',
    }).setOrigin(0.5);
    this.content.add([classLabel, skinLabel, statusLabel]);

    STATES.forEach((state, index) => this.drawState(skin, state, 125 + index * 195));
    this.content.add(this.add.text(18, 327,
      `Compatibility: ${skin.compatibility}   Runtime: ${skin.runtimeStatus}\nSource: ${skin.sourcePack}   Directions: ${skin.supportedDirections.join(', ')}`,
      { color: skin.runtimeStatus === 'GAMEPLAY' ? '#91d49b' : '#d9ad6c', fontFamily: 'monospace', fontSize: '8px', lineSpacing: 3 },
    ));
  }

  private drawState(skin: CharacterSkinConfig, state: SkinAnimationState, x: number): void {
    const baseline = 272;
    const animation = skin.animations[state];
    const panel = this.add.rectangle(x, 222, 178, 164, 0x18212c, 0.96).setStrokeStyle(1, 0x64768a, 0.65);
    const label = this.add.text(x, 154, state.toUpperCase(), { color: '#d7e0e9', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold' }).setOrigin(0.5);
    const line = this.add.line(x - 75, baseline, 0, 0, 150, 0, 0x628c72, 0.65).setOrigin(0, 0.5);
    const sprite = this.add.sprite(x, baseline, skinTextureKey(skin.id, state), 0)
      .setOrigin(
        (animation.rootX ?? skin.visualCenterX) / animation.frameWidth,
        (animation.baseline ?? skin.baseline) / animation.frameHeight,
      )
      .setScale(skin.displayScale)
      .play(skinAnimationKey(skin.id, state));
    if (skin.compatibility === 'SIDE_VIEW_ONLY') sprite.setFlipX(false);
    const frameText = this.add.text(x, 292, `${animation.frameWidth}x${animation.frameHeight} • ${animation.frames} frames`, {
      color: '#7f90a1', fontFamily: 'monospace', fontSize: '7px',
    }).setOrigin(0.5);
    this.content.add([panel, label, line, sprite, frameText]);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Digit1') this.selectClass('warrior');
    if (event.code === 'Digit2') this.selectClass('archer');
    if (event.code === 'Digit3') this.selectClass('mage');
    if (event.code === 'KeyZ') this.cycleSkin(-1);
    if (event.code === 'KeyX') this.cycleSkin(1);
    if (event.code === 'Escape') this.scene.start(SceneKey.MainMenu);
  }

  private selectClass(classId: PlayerClassId): void {
    this.selectedClass = classId;
    this.draw();
  }

  private cycleSkin(delta: number): void {
    const skins = SKINS_BY_CLASS[this.selectedClass];
    this.selectedIndex[this.selectedClass] = Phaser.Math.Wrap(this.selectedIndex[this.selectedClass] + delta, 0, skins.length);
    this.draw();
  }

  private shutdown(): void {
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x10151e, 1).fillRect(0, 0, 640, 360);
    graphics.lineStyle(1, 0x1e2b38, 0.55);
    for (let x = 0; x <= 640; x += 32) graphics.lineBetween(x, 0, x, 360);
    for (let y = 0; y <= 360; y += 32) graphics.lineBetween(0, y, 640, y);
  }
}
