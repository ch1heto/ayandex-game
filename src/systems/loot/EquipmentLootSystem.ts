import Phaser from 'phaser';
import { EQUIPMENT_CONFIG, RARITY_COLORS, rollEquipmentDrops, type ItemInstance } from '../../data/equipment';
import { rollPotion, type PotionKind } from '../../data/gameplayEconomy';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import { gameProgressService } from '../save/GameProgressService';
import { notify } from '../notifications/notifications';
import { t } from '../../i18n/LocalizationService';
import { ITEM_ICONS } from '../../ui/itemIcons';
type Payload = { item: ItemInstance; potion?: never } | { item?: never; potion: PotionKind };
type Drop = Payload & { root: Phaser.GameObjects.Zone; icon: Phaser.GameObjects.Image; particles: Phaser.GameObjects.Graphics; x: number; y: number; nextAttempt: number; born: number; claimed: boolean };
export function preloadEquipmentIcons(scene: Phaser.Scene): void {
  for (const [kind, url] of Object.entries(ITEM_ICONS)) scene.load.image('equipment-' + kind, url);
}
export class EquipmentLootSystem {
  private readonly drops: Drop[] = [];
  private readonly pickupGroup: Phaser.Physics.Arcade.Group;
  private readonly overlap: Phaser.Physics.Arcade.Collider;
  public constructor(private readonly scene: Phaser.Scene, private readonly player: PlayerCharacter) {
    this.pickupGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.ensurePotionTextures();
    this.overlap = scene.physics.add.overlap(player.physicsRoot, this.pickupGroup, (_player, object) => {
      const drop = (object as Phaser.GameObjects.Zone).getData('drop') as Drop;
      if (!drop || drop.claimed || !this.drops.includes(drop) || scene.time.now < drop.nextAttempt || player.currentHealth <= 0) return;
      drop.claimed = true;
      const accepted = drop.item ? gameProgressService.pickup(drop.item) : gameProgressService.addPotion(drop.potion);
      if (!accepted) { drop.claimed = false; drop.nextAttempt = scene.time.now + 1600; notify(scene, t('equipment.full'), 'inventory-full'); return; }
      if (drop.item) notify(scene, t('equipment.pickup', { item: t(`item.${drop.item.kind}`) }) + ' · ' + t(`rarity.${drop.item.rarity}`), drop.item.id, RARITY_COLORS[drop.item.rarity]);
      else notify(scene, t('equipment.pickup', { item: t(drop.potion === 'health' ? 'shop.health' : 'shop.mana') }), 'potion-pickup');
      this.remove(drop);
    });
    for (const kind of Object.keys(ITEM_ICONS)) scene.textures.get('equipment-' + kind).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  public roll(x: number, y: number, source: 'normal' | 'elite' | 'boss'): void {
    const potion = rollPotion(source);
    if (potion) this.spawnDrop({ potion }, x, y - 18);
    const saved = gameProgressService.snapshot;
    rollEquipmentDrops(saved.player.level, source, Math.random, { classId: this.player.activeClass, equipment: saved.equipment })
      .forEach((item, index) => this.spawn(item, x + (index ? 24 : -12), y + 10));
  }
  public spawn(item: ItemInstance, x: number, y: number): void { this.spawnDrop({ item }, x, y); }
  private spawnDrop(payload: Payload, x: number, y: number): void {
    const root = this.scene.add.zone(Math.round(x), Math.round(y), EQUIPMENT_CONFIG.pickupRadius * 2, EQUIPMENT_CONFIG.pickupRadius * 2);
    this.pickupGroup.add(root, true);
    const body = root.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false).setImmovable(true); body.moves = false;
    const texture = payload.item ? 'equipment-' + payload.item.kind : 'loot-potion-' + payload.potion;
    const icon = this.scene.add.image(Math.round(x), Math.round(y - 10), texture).setScale(payload.item ? .75 : 1).setDepth(Math.floor(y) + 4);
    const particles = this.scene.add.graphics().setDepth(Math.floor(y) + 3);
    const drop: Drop = { ...payload, root, icon, particles, x, y, nextAttempt: this.scene.time.now + 350, born: this.scene.time.now, claimed: false };
    root.setData('drop', drop); this.drops.push(drop);
  }
  public update(time: number): void {
    for (const drop of this.drops) {
      const bob = Math.round(Math.sin((time - drop.born) / 250) * 2), rarity = drop.item?.rarity ?? 'common';
      drop.icon.setY(Math.round(drop.y - 10 + bob));
      const color = drop.potion ? (drop.potion === 'health' ? 0xe48588 : 0x83bada) : Phaser.Display.Color.HexStringToColor(RARITY_COLORS[rarity]).color;
      const g = drop.particles.clear(); g.fillStyle(0x111619, .9).fillRect(Math.round(drop.x - 9), Math.round(drop.y + 2), 18, 3);
      g.fillStyle(color, .9).fillRect(Math.round(drop.x - 8), Math.round(drop.y), 16, 2);
      if (['rare', 'epic', 'legendary'].includes(rarity)) for (let i = 0; i < 3; i++) {
        const phase = (Math.floor(time / 100) + i * 7) % 24; g.fillStyle(color, .7).fillRect(Math.round(drop.x - 12 + i * 12), Math.round(drop.y - phase), 2, 2);
      }
      if (rarity === 'legendary') for (let step = 0; step < 9; step++) g.fillStyle(color, .45 - step * .035).fillRect(Math.round(drop.x - 2), Math.round(drop.y - 16 - step * 5), 4, 4);
    }
  }
  public destroy(): void { this.overlap.destroy(); for (const drop of [...this.drops]) this.remove(drop); this.pickupGroup.destroy(true); }
  private remove(drop: Drop): void {
    const index = this.drops.indexOf(drop); if (index < 0) return;
    this.drops.splice(index, 1); drop.root.destroy(); drop.icon.destroy(); drop.particles.destroy();
  }
  private ensurePotionTextures(): void {
    for (const kind of ['health', 'mana'] as const) {
      const key = 'loot-potion-' + kind; if (this.scene.textures.exists(key)) continue;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x172331).fillRect(4, 0, 8, 5).fillRect(2, 6, 12, 12);
      g.fillStyle(0xbba16b).fillRect(5, 1, 6, 3);
      g.fillStyle(0x9bbbc3).fillRect(5, 4, 6, 3).fillRect(3, 7, 10, 10);
      g.fillStyle(kind === 'health' ? 0xb44766 : 0x458dbb).fillRect(4, 9, 8, 7);
      g.fillStyle(kind === 'health' ? 0xf29f9c : 0xa6e4ee).fillRect(5, 9, 2, 4);
      g.generateTexture(key, 16, 18); g.destroy(); this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
