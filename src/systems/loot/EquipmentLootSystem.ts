import Phaser from 'phaser';
import { EQUIPMENT_CONFIG, RARITY_COLORS, rollItem, type ItemInstance } from '../../data/equipment';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import { gameProgressService } from '../save/GameProgressService';
import { notify } from '../notifications/notifications';
import { t } from '../../i18n/LocalizationService';
import { ITEM_ICONS } from '../../ui/itemIcons';
type Drop = { item: ItemInstance; root: Phaser.GameObjects.Zone; icon: Phaser.GameObjects.Image; particles: Phaser.GameObjects.Graphics; x: number; y: number; nextAttempt: number; born: number };
export function preloadEquipmentIcons(scene: Phaser.Scene): void {
  for (const [kind, url] of Object.entries(ITEM_ICONS)) scene.load.image('equipment-' + kind, url);
}
export class EquipmentLootSystem {
  private readonly drops: Drop[] = [];
  private readonly pickupGroup: Phaser.Physics.Arcade.Group;
  private readonly overlap: Phaser.Physics.Arcade.Collider;
  public constructor(private readonly scene: Phaser.Scene, player: PlayerCharacter) {
    this.pickupGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.overlap = scene.physics.add.overlap(player.physicsRoot, this.pickupGroup, (_player, object) => {
      const drop = (object as Phaser.GameObjects.Zone).getData('drop') as Drop;
      if (!drop || scene.time.now < drop.nextAttempt || player.currentHealth <= 0) return;
      if (!gameProgressService.pickup(drop.item)) {
        drop.nextAttempt = scene.time.now + 1600; notify(scene, t('equipment.full'), 'inventory-full'); return;
      }
      notify(scene, t('equipment.pickup', { item: t(`item.${drop.item.kind}`) }) + ' · ' + t(`rarity.${drop.item.rarity}`), drop.item.id, RARITY_COLORS[drop.item.rarity]);
      this.remove(drop);
    });
    for (const kind of Object.keys(ITEM_ICONS)) scene.textures.get('equipment-' + kind).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  public roll(x: number, y: number, source: 'normal' | 'elite' | 'boss'): void {
    if (source === 'normal' && Math.random() >= EQUIPMENT_CONFIG.normalDropChance) return;
    const count = source === 'boss' ? 2 : 1;
    for (let index = 0; index < count; index++) this.spawn(rollItem(gameProgressService.snapshot.player.level, source), x + (index ? 24 : -12), y + 10);
  }
  public spawn(item: ItemInstance, x: number, y: number): void {
    const root = this.scene.add.zone(Math.round(x), Math.round(y), EQUIPMENT_CONFIG.pickupRadius * 2, EQUIPMENT_CONFIG.pickupRadius * 2);
    this.pickupGroup.add(root, true);
    const body = root.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false).setImmovable(true); body.moves = false;
    const icon = this.scene.add.image(Math.round(x), Math.round(y - 10), 'equipment-' + item.kind).setScale(.75).setDepth(Math.floor(y) + 4);
    const particles = this.scene.add.graphics().setDepth(Math.floor(y) + 3);
    const drop: Drop = { item, root, icon, particles, x, y, nextAttempt: this.scene.time.now + 350, born: this.scene.time.now };
    root.setData('drop', drop); this.drops.push(drop);
  }
  public update(time: number): void {
    for (const drop of this.drops) {
      const bob = Math.round(Math.sin((time - drop.born) / 250) * 2);
      drop.icon.setY(Math.round(drop.y - 10 + bob));
      const color = Phaser.Display.Color.HexStringToColor(RARITY_COLORS[drop.item.rarity]).color;
      const g = drop.particles.clear(); g.fillStyle(0x111619, .9).fillRect(Math.round(drop.x - 9), Math.round(drop.y + 2), 18, 3);
      g.fillStyle(color, .9).fillRect(Math.round(drop.x - 8), Math.round(drop.y), 16, 2);
      if (['rare', 'epic', 'legendary'].includes(drop.item.rarity)) {
        for (let i = 0; i < 3; i++) { const phase = (Math.floor(time / 100) + i * 7) % 24; g.fillStyle(color, .7).fillRect(Math.round(drop.x - 12 + i * 12), Math.round(drop.y - phase), 2, 2); }
      }
      if (drop.item.rarity === 'legendary') {
        for (let step = 0; step < 9; step++) g.fillStyle(color, .45 - step * .035).fillRect(Math.round(drop.x - 2), Math.round(drop.y - 16 - step * 5), 4, 4);
      }
    }
  }
  public destroy(): void { this.overlap.destroy(); for (const drop of [...this.drops]) this.remove(drop); this.pickupGroup.destroy(true); }
  private remove(drop: Drop): void {
    const index = this.drops.indexOf(drop); if (index < 0) return;
    this.drops.splice(index, 1); drop.root.destroy(); drop.icon.destroy(); drop.particles.destroy();
  }
}
