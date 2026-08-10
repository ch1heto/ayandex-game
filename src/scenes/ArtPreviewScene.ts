import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { MossSlimeAnimation, MOSS_SLIME_ROOT_Y, preloadMossSlimeAssets, registerMossSlimeAnimations } from '../entities/enemies/mossSlimeAssets';
import {
  CHARACTER_ROOT_Y,
  DIRECTION_ROW,
  attackAnimationKey,
  idleFrame,
  idleTextureKey,
  preloadCharacterAssets,
  registerCharacterAnimations,
  walkAnimationKey,
} from '../entities/player/characterAssets';
import { DIRECTIONS, type Direction, type PlayerClassId } from '../entities/player/playerTypes';
import {
  COIN_ANIMATION_KEY,
  COIN_TEXTURE_KEY,
  preloadCoinAssets,
  registerCoinAnimations,
} from '../systems/loot/CoinDropSystem';
import { preloadTwilightGlade } from '../world/TwilightGladeWorld';

type PreviewState = 'idle' | 'walk' | 'attack';
type PreviewPage = 'vertical-slice' | 'characters';
const STATE_BASELINES: Record<PreviewState, number> = { idle: 111, walk: 215, attack: 319 };

export class ArtPreviewScene extends Phaser.Scene {
  private selectedClass: PlayerClassId = 'warrior';
  private page: PreviewPage = 'vertical-slice';
  private previewLayer!: Phaser.GameObjects.Container;

  public constructor() { super(SceneKey.ArtPreview); }

  public preload(): void {
    preloadCharacterAssets(this);
    preloadMossSlimeAssets(this);
    preloadCoinAssets(this);
    preloadTwilightGlade(this);
  }

  public create(): void {
    this.drawBackground();
    registerCharacterAnimations(this);
    registerMossSlimeAnimations(this);
    registerCoinAnimations(this);
    this.registerLoopingPreviews();
    this.previewLayer = this.add.container(0, 0);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.drawPage();
  }

  private drawPage(): void {
    this.previewLayer.removeAll(true);
    if (this.page === 'vertical-slice') this.drawVerticalSlice();
    else this.drawSelectedClass();
  }

  private drawVerticalSlice(): void {
    this.previewLayer.add(this.add.text(14, 8, 'TWILIGHT GLADE • VERTICAL SLICE QA', {
      color: '#e8edf5', fontFamily: 'monospace', fontSize: '12px',
    }));
    this.previewLayer.add(this.add.text(14, 24, '[TAB] character QA  |  1x + nearest enlarged  |  [Esc] menu', {
      color: '#9ca8b7', fontFamily: 'monospace', fontSize: '8px',
    }));

    const environmentPanel = this.add.rectangle(114, 199, 214, 310, 0x17231f, 0.94).setStrokeStyle(1, 0x6f8759, 0.6);
    const animationPanel = this.add.rectangle(430, 199, 404, 310, 0x171d24, 0.94).setStrokeStyle(1, 0x967a54, 0.55);
    this.previewLayer.add([environmentPanel, animationPanel]);
    this.previewLayer.add(this.add.text(16, 49, 'FOREST TILES + PROPS', {
      color: '#b9ce91', fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold',
    }));
    this.previewLayer.add(this.add.image(17, 65, 'twilight-glade-tiles').setOrigin(0));
    this.previewLayer.add(this.add.image(68, 222, 'glade-tree-a').setOrigin(0.5, 1));
    this.previewLayer.add(this.add.image(167, 143, 'glade-bush-a').setOrigin(0.5, 1));
    this.previewLayer.add(this.add.image(167, 219, 'glade-rock-a').setOrigin(0.5, 1));
    this.previewLayer.add(this.add.image(77, 288, 'glade-pond').setOrigin(0.5));
    this.previewLayer.add(this.add.image(164, 293, 'glade-stump').setOrigin(0.5, 1));
    this.previewLayer.add(this.add.image(194, 304, 'glade-flowers-gold').setOrigin(0.5, 1));
    this.previewLayer.add(this.add.text(14, 334, '32px GRID • TRUNK-ONLY COLLISION', {
      color: '#718474', fontFamily: 'monospace', fontSize: '6px',
    }));

    this.previewLayer.add(this.add.text(240, 49, 'MOSS SLIME ANIMATIONS', {
      color: '#d9bd78', fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold',
    }));
    const states = [
      ['IDLE', MossSlimeAnimation.Idle],
      ['MOVE', MossSlimeAnimation.Move],
      ['ATTACK', 'preview-moss-slime-attack'],
      ['HURT', 'preview-moss-slime-hurt'],
      ['DEATH', 'preview-moss-slime-death'],
    ] as const;
    states.forEach(([label, animation], index) => {
      const baseline = 92 + index * 53;
      const line = this.add.line(286, baseline, 0, 0, 320, 0, 0x806e4a, 0.35).setOrigin(0, 0.5);
      const text = this.add.text(242, baseline - 21, label, {
        color: '#bfc9c1', fontFamily: 'monospace', fontSize: '7px',
      });
      const large = this.add.sprite(354, baseline, MossSlimeAnimation.Idle, 0)
        .setOrigin(0.5, MOSS_SLIME_ROOT_Y).setScale(1.5).play(animation);
      const gameScale = this.add.sprite(438, baseline, MossSlimeAnimation.Idle, 0)
        .setOrigin(0.5, MOSS_SLIME_ROOT_Y).play(animation);
      this.previewLayer.add([line, text, large, gameScale]);
    });
    this.previewLayer.add(this.add.text(507, 68, 'COIN DROP', {
      color: '#d9bd78', fontFamily: 'monospace', fontSize: '7px',
    }));
    this.previewLayer.add(this.add.sprite(550, 98, COIN_TEXTURE_KEY, 0).setScale(2).play(COIN_ANIMATION_KEY));
    this.previewLayer.add(this.add.sprite(590, 98, COIN_TEXTURE_KEY, 0).play(COIN_ANIMATION_KEY));
    this.previewLayer.add(this.add.text(520, 116, '2x       1x', {
      color: '#718474', fontFamily: 'monospace', fontSize: '6px',
    }));
  }

  private registerLoopingPreviews(): void {
    (['warrior', 'archer', 'mage'] as PlayerClassId[]).forEach((classId) => {
      DIRECTIONS.forEach((direction) => {
        const key = `preview-${attackAnimationKey(classId, direction)}`;
        if (this.anims.exists(key)) return;
        const start = DIRECTION_ROW[direction] * 4;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`${classId}-attack`, { start, end: start + 3 }),
          frameRate: 10,
          repeat: -1,
          repeatDelay: 220,
        });
      });
    });
    this.createSlimePreview('preview-moss-slime-attack', MossSlimeAnimation.Attack, 4, 10, 260);
    this.createSlimePreview('preview-moss-slime-hurt', MossSlimeAnimation.Hurt, 2, 8, 420);
    this.createSlimePreview('preview-moss-slime-death', MossSlimeAnimation.Death, 4, 9, 520);
  }

  private createSlimePreview(key: string, texture: string, frames: number, frameRate: number, repeatDelay: number): void {
    if (this.anims.exists(key)) return;
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(texture, { start: 0, end: frames - 1 }),
      frameRate,
      repeat: -1,
      repeatDelay,
    });
  }

  private drawSelectedClass(): void {
    const config = PLAYER_CLASS_CONFIGS[this.selectedClass];
    const accent = Phaser.Display.Color.HexStringToColor(config.accentColor).color;
    this.previewLayer.add(this.add.text(14, 8, 'ASHVALE CHARACTER QA', {
      color: '#e8edf5', fontFamily: 'monospace', fontSize: '12px',
    }));
    this.previewLayer.add(this.add.text(14, 24, '[1] Warrior  [2] Archer  [3] Mage  |  [TAB] vertical slice  |  [Esc] menu', {
      color: '#9ca8b7', fontFamily: 'monospace', fontSize: '8px',
    }));
    this.previewLayer.add(this.add.text(505, 8, config.label, {
      color: config.accentColor, fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
    }));
    (['idle', 'walk', 'attack'] as PreviewState[]).forEach((state) => {
      const baseline = STATE_BASELINES[state];
      this.previewLayer.add(this.add.text(14, baseline - 56, state.toUpperCase(), {
        color: config.accentColor, fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold',
      }));
      DIRECTIONS.forEach((direction, index) => this.drawDirectionCell(state, direction, index, baseline, accent));
    });
  }

  private drawDirectionCell(state: PreviewState, direction: Direction, index: number, baseline: number, accent: number): void {
    const x = 86 + index * 145;
    const panel = this.add.rectangle(x, baseline - 25, 134, 82, 0x17222d, 0.96).setStrokeStyle(1, accent, 0.55);
    const label = this.add.text(x - 59, baseline - 58, direction.toUpperCase(), {
      color: '#c9d3dc', fontFamily: 'monospace', fontSize: '7px',
    });
    const baselineLine = this.add.line(x - 57, baseline, 0, 0, 114, 0, accent, 0.55).setOrigin(0, 0.5);
    const root = this.add.circle(x - 16, baseline, 1.5, 0xf6d17b);
    const large = this.createPreviewSprite(x - 16, baseline, state, direction, 1.5);
    const gameScale = this.createPreviewSprite(x + 43, baseline, state, direction, 1);
    const scaleLabel = this.add.text(x + 29, baseline - 53, '1x', {
      color: '#8293a4', fontFamily: 'monospace', fontSize: '6px',
    });
    this.previewLayer.add([panel, label, baselineLine, root, large, gameScale, scaleLabel]);
  }

  private createPreviewSprite(x: number, y: number, state: PreviewState, direction: Direction, scale: number): Phaser.GameObjects.Sprite {
    if (state === 'idle') {
      return this.add.sprite(x, y, idleTextureKey(this.selectedClass), idleFrame(direction))
        .setOrigin(0.5, CHARACTER_ROOT_Y)
        .setScale(scale);
    }
    const texture = state === 'walk' ? `${this.selectedClass}-walk` : `${this.selectedClass}-attack`;
    const animation = state === 'walk'
      ? walkAnimationKey(this.selectedClass, direction)
      : `preview-${attackAnimationKey(this.selectedClass, direction)}`;
    return this.add.sprite(x, y, texture, DIRECTION_ROW[direction] * 4)
      .setOrigin(0.5, CHARACTER_ROOT_Y)
      .setScale(scale)
      .play(animation);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Digit1') this.selectClass('warrior');
    if (event.code === 'Digit2') this.selectClass('archer');
    if (event.code === 'Digit3') this.selectClass('mage');
    if (event.code === 'Tab') {
      event.preventDefault();
      this.page = this.page === 'vertical-slice' ? 'characters' : 'vertical-slice';
      this.drawPage();
    }
    if (event.code === 'Escape') this.scene.start(SceneKey.MainMenu);
  }

  private selectClass(classId: PlayerClassId): void {
    this.selectedClass = classId;
    this.page = 'characters';
    this.drawPage();
  }

  private shutdown(): void {
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
  }

  private drawBackground(): void {
    const grid = this.add.graphics();
    grid.fillStyle(0x10151e, 1).fillRect(0, 0, 640, 360);
    grid.lineStyle(1, 0x1f3038, 0.55);
    for (let x = 0; x <= 640; x += 32) grid.lineBetween(x, 0, x, 360);
    for (let y = 0; y <= 360; y += 32) grid.lineBetween(0, y, 640, y);
  }
}
