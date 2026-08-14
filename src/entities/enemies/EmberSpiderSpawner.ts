import Phaser from 'phaser';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import type { CoinDropSystem } from '../../systems/loot/CoinDropSystem';
import { EmberSpider } from './EmberSpider';

type SpawnSlot = { x: number; y: number; spider?: EmberSpider; respawnAt: number };

export class EmberSpiderSpawner {
  public readonly group: Phaser.Physics.Arcade.Group;
  private readonly slots: SpawnSlot[];

  public constructor(
    private readonly scene: Phaser.Scene,
    points: readonly { x: number; y: number }[],
    private readonly player: PlayerCharacter,
    private readonly drops: CoinDropSystem,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
    this.slots = points.map((point) => ({ ...point, respawnAt: 0 }));
    this.slots.forEach((slot) => this.spawn(slot));
  }

  public update(time: number): void {
    this.slots.forEach((slot) => {
      slot.spider?.update(time);
      if (slot.spider || time < slot.respawnAt) return;
      if (Phaser.Math.Distance.Between(slot.x, slot.y, this.player.x, this.player.y) < 140) return;
      this.spawn(slot);
    });
  }

  public get(gameObject: Phaser.GameObjects.GameObject): EmberSpider | undefined { const spider = gameObject.getData('emberSpider'); return spider instanceof EmberSpider ? spider : undefined; }
  public forEach(callback: (spider: EmberSpider) => void): void { this.slots.forEach((slot) => { if (slot.spider) callback(slot.spider); }); }
  public destroy(): void { this.slots.forEach((slot) => slot.spider?.destroy()); this.slots.length = 0; this.group.destroy(true); }

  private spawn(slot: SpawnSlot): void {
    const spider = new EmberSpider(this.scene, slot.x, slot.y, this.player, (dead, x, y) => {
      if (slot.spider !== dead) return;
      slot.spider = undefined;
      this.drops.spawn(x, y, Phaser.Math.Between(2, 4));
      slot.respawnAt = this.scene.time.now + Phaser.Math.Between(20_000, 29_000);
    });
    slot.spider = spider;
    this.group.add(spider.visual);
  }
}
