import type Phaser from 'phaser';
import { DUNGEON_CONFIG, DUNGEON_ENCOUNTERS } from '../data/dungeon';
import type { DungeonWorld } from './DungeonWorld';
import { PixelPortal } from './PixelPortal';
import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import type { MossSlimeSpawner } from '../entities/enemies/MossSlimeSpawner';
import type { EmberSpiderSpawner } from '../entities/enemies/EmberSpiderSpawner';
import { EmberSpider } from '../entities/enemies/EmberSpider';
import { AshenBroodmother } from '../entities/enemies/AshenBroodmother';
import { gameProgressService } from '../systems/save/GameProgressService';
import { notify } from '../systems/notifications/notifications';
import { t } from '../i18n/LocalizationService';
export class DungeonRun {
  private room = 0;
  private cleared = new Set<number>();
  private readonly exit: PixelPortal;
  private rewardExit?: PixelPortal;
  private boss?: AshenBroodmother;
  public constructor(private readonly scene: Phaser.Scene, private readonly world: DungeonWorld, private readonly player: PlayerCharacter,
    private readonly slimes: MossSlimeSpawner, private readonly spiders: EmberSpiderSpawner,
    private readonly focus: (enemy: EmberSpider) => void,
    private readonly reward: (x: number, y: number) => void,
    private readonly onAddDeath: (x: number, y: number) => void) {
    this.exit = new PixelPortal(scene, 116, 352); this.enterRoom(0);
    gameProgressService.milestone('dungeonEntered'); notify(scene, t('dungeon.entered'));
  }
  public update(time: number): void {
    this.exit.update(time); this.rewardExit?.update(time);
    const next = Math.min(3, Math.max(0, Math.floor((this.player.x - DUNGEON_CONFIG.roomLeft - 40) / DUNGEON_CONFIG.roomStride)));
    if (next > this.room && this.cleared.has(this.room)) this.enterRoom(next);
    if (this.room < 3 && !this.cleared.has(this.room) && this.slimes.livingCount + this.spiders.livingCount === 0) {
      this.cleared.add(this.room);
      const gate = this.world.gates[this.room]; gate.body.destroy(); gate.art.destroy();
      notify(this.scene, t('dungeon.cleared'), 'room-' + this.room);
    }
    if (this.boss?.visual.active && this.boss.currentHealth > 0) this.focus(this.boss);
    this.scene.registry.set('interactionPromptKey', this.canExit ? 'dungeon.exit' : '');
  }
  public get canExit(): boolean { return this.exit.near(this.player.x, this.player.y) || !!this.rewardExit?.near(this.player.x, this.player.y); }
  public destroy(): void { this.exit.destroy(); this.rewardExit?.destroy(); }
  private enterRoom(index: number): void {
    this.room = index; this.scene.registry.set('dungeonRoom', index + 1);
    const encounter = DUNGEON_ENCOUNTERS[index]; const offset = DUNGEON_CONFIG.roomLeft + index * DUNGEON_CONFIG.roomStride;
    encounter.slimes.forEach(([x, y]) => this.slimes.spawnAt({ x: x + offset, y }));
    encounter.spiders.forEach(([x, y], i) => this.spiders.spawnAt({ x: x + offset, y, elite: index === 2 && i === 1 ? 'warden' : undefined }));
    if (index !== 3) return;
    this.boss = new AshenBroodmother(this.scene, offset + 470, 340, this.player,
      (_boss, x, y) => {
        if (this.cleared.has(3)) return;
        this.cleared.add(3); this.reward(x, y);
        this.rewardExit = new PixelPortal(this.scene, offset + 625, 352);
      }, this.focus,
      (x, y) => {
        const add = new EmberSpider(this.scene, x, y, this.player, (_spider, px, py) => this.onAddDeath(px, py), this.focus);
        this.spiders.addExternal(add); return add;
      }, this.world.collisionGroup);
    this.spiders.addExternal(this.boss);
  }
}
