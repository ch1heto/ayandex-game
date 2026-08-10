import Phaser from 'phaser';

import { MOSS_SLIME_CONFIG } from '../data/enemies';
import type { MossSlimeSpawner } from '../entities/enemies/MossSlimeSpawner';
import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import type { WorldCollisionRect } from '../world/TwilightGladeWorld';

export class CombatDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private visible = false;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerCharacter,
    private readonly slimes: MossSlimeSpawner,
    private readonly collisionRects: ReadonlyArray<WorldCollisionRect>,
  ) {
    this.graphics = scene.add.graphics().setDepth(20_000).setVisible(false);
    this.label = scene.add.text(632, 8, 'F3 DEBUG', {
      color: '#f6d17b',
      backgroundColor: '#10151ecc',
      fontFamily: 'monospace',
      fontSize: '8px',
      padding: { x: 4, y: 3 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20_001).setVisible(false);
  }

  public toggle(): void {
    this.visible = !this.visible;
    this.graphics.setVisible(this.visible);
    this.label.setVisible(this.visible);
    if (!this.visible) this.graphics.clear();
  }

  public update(): void {
    if (!this.visible) return;
    this.graphics.clear();

    this.graphics.lineStyle(1, 0x62d4a7, 0.7);
    this.collisionRects.forEach((rect) => this.graphics.strokeRect(rect.x, rect.y, rect.width, rect.height));

    const playerBody = this.player.visual.body as Phaser.Physics.Arcade.Body;
    this.graphics.lineStyle(1, 0x6ed6ff, 0.95).strokeRect(playerBody.x, playerBody.y, playerBody.width, playerBody.height);

    this.slimes.forEach((slime) => {
      const body = slime.visual.body as Phaser.Physics.Arcade.Body;
      this.graphics.lineStyle(1, 0xff7a78, 0.95).strokeRect(body.x, body.y, body.width, body.height);
      this.graphics.lineStyle(1, 0xe6d66b, 0.32).strokeCircle(slime.x, slime.y, MOSS_SLIME_CONFIG.detectionRange);
      this.graphics.lineStyle(1, 0xff9f55, 0.7).strokeCircle(slime.x, slime.y, MOSS_SLIME_CONFIG.attackRange);
    });
  }

  public get isVisible(): boolean { return this.visible; }

  public destroy(): void {
    this.graphics.destroy();
    this.label.destroy();
  }
}
