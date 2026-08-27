import Phaser from 'phaser';
import { ELITE_CONFIG, rollElite, type EliteAffix, type EnemySpawnOptions, type EnemySpawnPoint } from '../../data/elites';

import { MOSS_SLIME_CONFIG } from '../../data/enemies';
import type { CoinDropSystem } from '../../systems/loot/CoinDropSystem';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import { MossSlime } from './MossSlime';
import type { EnemyKind } from '../../data/progression';

type SpawnSlot = {
  x: number;
  y: number;
  slime?: MossSlime;
  respawnAt: number;
  elite?: EliteAffix;
};

export class MossSlimeSpawner {
  public readonly group: Phaser.Physics.Arcade.Group;
  private readonly slots: SpawnSlot[];

  public constructor(
    private readonly scene: Phaser.Scene,
    spawnPoints: ReadonlyArray<EnemySpawnPoint>,
    private readonly player: PlayerCharacter,
    private readonly coinDrops: CoinDropSystem,
    private readonly onDefeated: (kind: EnemyKind, x: number, y: number, elite?: EliteAffix) => void = () => undefined,
    private readonly onEngage: (slime: MossSlime) => void = () => undefined,
    private readonly options: EnemySpawnOptions = {},
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
    this.slots = spawnPoints.map((point) => ({ ...point, respawnAt: 0 }));
    this.slots.forEach((slot) => this.spawn(slot));
  }

  public update(time: number): void {
    this.slots.forEach((slot) => {
      slot.slime?.update(time);
      if (this.options.respawn === false || slot.slime || time < slot.respawnAt) return;
      const distance = Phaser.Math.Distance.Between(slot.x, slot.y, this.player.x, this.player.y);
      if (distance < MOSS_SLIME_CONFIG.respawnPlayerClearRadius) return;
      this.spawn(slot);
    });
  }

  public getSlime(gameObject: Phaser.GameObjects.GameObject): MossSlime | undefined {
    const slime = gameObject.getData('mossSlime');
    return slime instanceof MossSlime ? slime : undefined;
  }

  public forEach(callback: (slime: MossSlime) => void): void {
    this.slots.forEach((slot) => {
      if (slot.slime) callback(slot.slime);
    });
  }

  public destroy(): void {
    this.slots.forEach((slot) => slot.slime?.destroy());
    this.slots.length = 0;
    this.group.destroy(true);
  }

  public spawnAt(point: EnemySpawnPoint): void { const slot: SpawnSlot = { ...point, respawnAt: 0 }; this.slots.push(slot); this.spawn(slot); }
  public get livingCount(): number { return this.slots.filter(slot => slot.slime && slot.slime.currentHealth > 0).length; }

  private spawn(slot: SpawnSlot): void {
    const elite = slot.elite ?? (this.options.elites === false ? undefined : rollElite());
    const slime = new MossSlime(this.scene, slot.x, slot.y, this.player, (deadSlime, x, y) => {
      if (slot.slime !== deadSlime) return;
      slot.slime = undefined;
      const amount = Phaser.Math.Between(MOSS_SLIME_CONFIG.coinDropMin, MOSS_SLIME_CONFIG.coinDropMax);
      this.coinDrops.spawn(x, y, amount * (elite ? ELITE_CONFIG.coins : 1));
      this.onDefeated('slime', x, y, elite);
      slot.respawnAt = this.scene.time.now + Phaser.Math.Between(
        MOSS_SLIME_CONFIG.respawnDelayMinMs,
        MOSS_SLIME_CONFIG.respawnDelayMaxMs,
      );
    }, this.onEngage, elite);
    slot.slime = slime;
    this.group.add(slime.visual);
  }
}
