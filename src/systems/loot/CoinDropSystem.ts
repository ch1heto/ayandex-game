import Phaser from 'phaser';

import coinUrl from '../../../assets/items/coin.png';

export const COIN_TEXTURE_KEY = 'coin-pickup';
export const COIN_ANIMATION_KEY = 'coin-spin';

type CoinRecord = {
  sprite: Phaser.Physics.Arcade.Sprite;
  collectableAt: number;
  collected: boolean;
};

export function preloadCoinAssets(scene: Phaser.Scene): void {
  scene.load.spritesheet(COIN_TEXTURE_KEY, coinUrl, { frameWidth: 16, frameHeight: 16 });
}

export function registerCoinAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists(COIN_ANIMATION_KEY)) return;
  scene.anims.create({
    key: COIN_ANIMATION_KEY,
    frames: scene.anims.generateFrameNumbers(COIN_TEXTURE_KEY, { start: 0, end: 3 }),
    frameRate: 9,
    repeat: -1,
  });
}

export class CoinDropSystem {
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly records = new Map<Phaser.Physics.Arcade.Sprite, CoinRecord>();
  private readonly overlap: Phaser.Physics.Arcade.Collider;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.GameObjects.GameObject & { x: number; y: number },
    private readonly onPickup: (value: number) => void,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
    this.overlap = scene.physics.add.overlap(player as Phaser.Types.Physics.Arcade.ArcadeColliderType, this.group, (_player, coinObject) => {
      if (coinObject instanceof Phaser.Physics.Arcade.Sprite) this.collect(coinObject);
    });
  }

  public spawn(x: number, y: number, amount: number): void {
    for (let index = 0; index < amount; index += 1) {
      const targetX = x + Phaser.Math.Between(-14, 14);
      const targetY = y + Phaser.Math.Between(-8, 10);
      const sprite = this.group.create(x, y, COIN_TEXTURE_KEY, 0) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(Math.floor(targetY) + 1).play(COIN_ANIMATION_KEY);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setSize(10, 10).setOffset(3, 4);
      this.records.set(sprite, { sprite, collectableAt: this.scene.time.now + 260, collected: false });
      this.scene.tweens.add({ targets: sprite, x: targetX, duration: 180, ease: 'Quad.Out' });
      this.scene.tweens.add({
        targets: sprite,
        y: targetY - 9,
        duration: 90,
        ease: 'Quad.Out',
        yoyo: true,
        onComplete: () => {
          if (sprite.active) sprite.setY(targetY).setDepth(Math.floor(targetY) + 1);
        },
      });
    }
  }

  public update(time: number): void {
    this.records.forEach((record) => {
      if (record.collected || !record.sprite.active || time < record.collectableAt) return;
      const direction = new Phaser.Math.Vector2(this.player.x - record.sprite.x, this.player.y - record.sprite.y);
      if (direction.lengthSq() > 58 * 58 || direction.lengthSq() === 0) return;
      direction.normalize().scale(105);
      record.sprite.setVelocity(direction.x, direction.y);
      record.sprite.setDepth(Math.floor(record.sprite.y) + 1);
    });
  }

  public destroy(): void {
    this.overlap.destroy();
    this.records.forEach((record) => record.sprite.destroy());
    this.records.clear();
    this.group.destroy(true);
  }

  private collect(sprite: Phaser.Physics.Arcade.Sprite): void {
    const record = this.records.get(sprite);
    if (!record || record.collected || this.scene.time.now < record.collectableAt) return;
    record.collected = true;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    sprite.stop();
    this.onPickup(1);
    this.scene.tweens.add({
      targets: sprite,
      y: sprite.y - 9,
      alpha: 0,
      duration: 115,
      ease: 'Quad.Out',
      onComplete: () => {
        this.records.delete(sprite);
        sprite.destroy();
      },
    });
  }
}
