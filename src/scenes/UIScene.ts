import Phaser from 'phaser';

import coinIconUrl from '../../assets/ui/hud/coin-icon.png';
import healthFrameUrl from '../../assets/ui/hud/health-frame.png';
import heartFullUrl from '../../assets/ui/hud/heart-full.png';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import type { PlayerClassId } from '../entities/player/playerTypes';

const HEALTH_FRAME_KEY = 'hud-health-frame';
const HEART_KEY = 'hud-heart-full';
const COIN_ICON_KEY = 'hud-coin-icon';
const BAR_WIDTH = 82;

export class UIScene extends Phaser.Scene {
  private classText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private healthFill!: Phaser.GameObjects.Rectangle;
  private coinIcon!: Phaser.GameObjects.Image;
  private lastCoins = 0;

  public constructor() { super(SceneKey.UI); }

  public preload(): void {
    this.load.image(HEALTH_FRAME_KEY, healthFrameUrl);
    this.load.image(HEART_KEY, heartFullUrl);
    this.load.image(COIN_ICON_KEY, coinIconUrl);
  }

  public create(): void {
    this.add.rectangle(7, 7, 216, 50, 0x101812, 0.82)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6c7654, 0.55)
      .setScrollFactor(0);

    this.healthFill = this.add.rectangle(43, 20, BAR_WIDTH, 6, 0xb84442, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.add.image(10, 8, HEALTH_FRAME_KEY).setOrigin(0).setScrollFactor(0);
    this.add.image(16, 11, HEART_KEY).setOrigin(0).setScrollFactor(0);
    this.healthText = this.add.text(47, 12, '', {
      color: '#f5ead0',
      fontFamily: 'monospace',
      fontSize: '8px',
      stroke: '#241b18',
      strokeThickness: 2,
    }).setScrollFactor(0);

    this.coinIcon = this.add.image(151, 11, COIN_ICON_KEY).setOrigin(0).setScrollFactor(0);
    this.coinText = this.add.text(174, 13, '0', {
      color: '#f6d47b',
      fontFamily: 'monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      stroke: '#241b18',
      strokeThickness: 2,
    }).setScrollFactor(0);
    this.classText = this.add.text(15, 39, '', {
      color: '#e8edf5',
      fontFamily: 'monospace',
      fontSize: '8px',
    }).setScrollFactor(0);
    this.refresh();
  }

  public update(): void {
    this.refresh();
  }

  private refresh(): void {
    const classId = (this.registry.get('activeClass') ?? 'warrior') as PlayerClassId;
    const config = PLAYER_CLASS_CONFIGS[classId];
    const health = numberFromRegistry(this.registry.get('playerHealth'), config.maxHealth);
    const maxHealth = Math.max(1, numberFromRegistry(this.registry.get('playerMaxHealth'), config.maxHealth));
    const coins = Math.max(0, Math.floor(numberFromRegistry(this.registry.get('coins'), 0)));
    this.healthFill.width = Math.max(0, Math.round(BAR_WIDTH * Phaser.Math.Clamp(health / maxHealth, 0, 1)));
    this.healthText.setText(`${Math.ceil(health)} / ${maxHealth}`);
    this.coinText.setText(String(coins));
    this.classText.setText(`${config.label}  •  WASD / LMB  •  1·2·3`);
    this.classText.setColor(config.accentColor);
    if (coins > this.lastCoins) {
      this.coinIcon.setTint(0xfff2a6).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(90, () => {
        if (this.coinIcon.active) this.coinIcon.clearTint();
      });
    }
    this.lastCoins = coins;
  }
}

function numberFromRegistry(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
