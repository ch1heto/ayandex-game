import Phaser from 'phaser';
import { ELITE_CONFIG, rollElite, type EliteAffix, type EnemySpawnOptions, type EnemySpawnPoint } from '../../data/elites';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import type { CoinDropSystem } from '../../systems/loot/CoinDropSystem';
import { EmberSpider } from './EmberSpider';
import type { EnemyKind } from '../../data/progression';

type SpawnSlot = { x: number; y: number; spider?: EmberSpider; respawnAt: number; elite?: EliteAffix };

export class EmberSpiderSpawner {
  public readonly group: Phaser.Physics.Arcade.Group;
  public readonly hurtboxGroup: Phaser.Physics.Arcade.Group;
  private readonly slots: SpawnSlot[];
  private external: EmberSpider[] = [];

  public constructor(
    private readonly scene: Phaser.Scene,
    points: readonly EnemySpawnPoint[],
    private readonly player: PlayerCharacter,
    private readonly drops: CoinDropSystem,
    private readonly onDefeated: (kind: EnemyKind, x: number, y: number, elite?: EliteAffix) => void = () => undefined,
    private readonly onEngage: (spider: EmberSpider) => void = () => undefined,
    private readonly options: EnemySpawnOptions = {},
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
    this.hurtboxGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.slots = points.map((point) => ({ ...point, respawnAt: 0 }));
    this.slots.forEach((slot) => this.spawn(slot));
  }

  public update(time: number): void {
    this.external = this.external.filter(spider => spider.visual.active);
    this.external.forEach(spider => spider.update(time));
    this.slots.forEach((slot) => {
      slot.spider?.update(time);
      if (this.options.respawn === false || slot.spider || time < slot.respawnAt) return;
      if (Phaser.Math.Distance.Between(slot.x, slot.y, this.player.x, this.player.y) < 140) return;
      this.spawn(slot);
    });
  }

  public get(gameObject: Phaser.GameObjects.GameObject): EmberSpider | undefined { const spider = gameObject.getData('emberSpider'); return spider instanceof EmberSpider ? spider : undefined; }
  public forEach(callback: (spider: EmberSpider) => void): void { this.slots.forEach((slot) => { if (slot.spider) callback(slot.spider); }); this.external.forEach(spider => { if (spider.visual.active) callback(spider); }); }
  public destroy(): void { this.external.forEach(spider => spider.destroy()); this.external = []; this.slots.forEach((slot) => slot.spider?.destroy()); this.slots.length = 0; this.group.destroy(true); this.hurtboxGroup.destroy(true); }

  public addExternal(spider: EmberSpider): void { this.external.push(spider); this.group.add(spider.visual); this.hurtboxGroup.add(spider.hurtbox); }
  public spawnAt(point: EnemySpawnPoint): void { const slot: SpawnSlot = { ...point, respawnAt: 0 }; this.slots.push(slot); this.spawn(slot); }
  public get livingCount(): number { return this.slots.filter(slot => slot.spider && slot.spider.currentHealth > 0).length + this.external.filter(spider => spider.visual.active && spider.currentHealth > 0).length; }

  private spawn(slot: SpawnSlot): void {
    const elite = slot.elite ?? (this.options.elites === false ? undefined : rollElite());
    const spider = new EmberSpider(this.scene, slot.x, slot.y, this.player, (dead, x, y) => {
      if (slot.spider !== dead) return;
      slot.spider = undefined;
      this.drops.spawn(x, y, Phaser.Math.Between(2, 4) * (elite ? ELITE_CONFIG.coins : 1));
      this.onDefeated('spider', x, y, elite);
      slot.respawnAt = this.scene.time.now + Phaser.Math.Between(20_000, 29_000);
    }, this.onEngage, elite);
    slot.spider = spider;
    this.group.add(spider.visual);
    this.hurtboxGroup.add(spider.hurtbox);
  }
}
