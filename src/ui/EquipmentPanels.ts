import type Phaser from 'phaser';
import { appendItemStats, appendComparison, statValue } from './ItemDetails';
import { EMPTY_STATS, EQUIPMENT_CONFIG, EQUIPMENT_SLOTS, CLASS_WEAPONS, resolveEquipSlot, ITEM_DEFINITIONS, RARITY_COLORS, equipmentBonuses, type EquipmentSlot, type ItemInstance, type ItemStats } from '../data/equipment';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { ADVANCED_SKILLS } from '../data/advancedSkills';
import { SKILL_1_CONFIGS } from '../data/skills';
import { getCharacterSkin } from '../data/characterSkins';
import type { PlayerClassId } from '../entities/player/playerTypes';
import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { t, type TranslationKey } from '../i18n/LocalizationService';
import { gameProgressService } from '../systems/save/GameProgressService';
import { notify } from '../systems/notifications/notifications';
import { ITEM_ICONS } from './itemIcons';
import { LivePlayerPreview } from './LivePlayerPreview';

const keys = Object.keys(EMPTY_STATS) as (keyof ItemStats)[];
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
}
export class EquipmentPanels {
  public readonly inventory = node('section', 'hud-info-panel equipment-panel');
  public readonly character = node('section', 'hud-info-panel character-panel');
  private readonly grid = node('div', 'inventory-grid');
  private readonly cells: HTMLButtonElement[] = [];
  private readonly summary = node('div', 'inventory-summary');
  private readonly tooltip = node('div', 'item-tooltip');
  private readonly sheet = node('div', 'character-sheet');
  private readonly worn = node('div', 'paper-doll');
  private readonly wornSlots = new Map<EquipmentSlot, HTMLButtonElement>();
  private targetSlot?: EquipmentSlot;
  private readonly previewHost = node('div', 'player-preview-host');
  private readonly previewCaption = node('div', 'preview-caption');
  private readonly potions = node('div', 'inventory-potions');
  private preview?: LivePlayerPreview;
  private selected?: string;
  private signature = '';
  private characterSignature = '';

  public constructor(private readonly scene: Phaser.Scene, private readonly player: PlayerCharacter) {
    for (const [panel, title] of [[this.inventory, t('hud.inventoryTitle')], [this.character, t('hud.characterTitle')]] as const) {
      const heading = node('header', 'equipment-heading'); heading.append(node('h2', '', title));
      const close = node('button', 'equipment-close', '×');
      close.type = 'button'; close.setAttribute('aria-label', t('settings.close')); close.onclick = () => this.close();
      heading.append(close); panel.append(heading);
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
      panel.inert = true;
      panel.addEventListener('pointerdown', event => event.stopPropagation());
    }
    for (let index = 0; index < EQUIPMENT_CONFIG.capacity; index++) {
      const cell = node('button', 'inventory-cell');
      cell.type = 'button'; cell.onclick = () => this.select(cell.dataset.itemId);
      this.cells.push(cell); this.grid.append(cell);
    }
    const bag = node('div', 'inventory-bag');
    bag.append(this.summary, this.grid, this.potions);
    const equipment = node('div', 'inventory-loadout');
    this.worn.append(this.previewHost);
    for (const slot of EQUIPMENT_SLOTS) {
      const button = node('button', 'equipment-slot slot-' + slot); button.type = 'button';
      button.onclick = () => this.select(gameProgressService.snapshot.equipment[slot]?.id);
      this.wornSlots.set(slot, button); this.worn.append(button);
    }
    equipment.append(node('h3', 'equipment-section-title', t('equipment.loadout')), this.worn, this.previewCaption,
      node('small', 'preview-note', t('equipment.skinOnly')));
    const layout = node('div', 'inventory-layout'); layout.append(bag, equipment, this.tooltip);
    this.inventory.append(layout, node('small', 'equipment-hint', t('hud.closeHint')));
    this.character.append(this.sheet, node('small', 'equipment-hint', t('character.equipHint')));
  }

  public toggle(which: 'inventory' | 'character'): void {
    const selected = this[which]; const open = !selected.classList.contains('visible');
    this.close();
    if (open) {
      selected.classList.add('visible'); selected.inert = false;
      if (which === 'inventory') { this.preview = new LivePlayerPreview(this.player); this.previewHost.append(this.preview.canvas); }
    }
    this.scene.registry.set('equipmentPanelOpen', open); this.refresh();
  }
  public close(): void {
    this.inventory.classList.remove('visible'); this.character.classList.remove('visible');
    this.inventory.inert = true; this.character.inert = true;
    this.preview?.destroy(); this.preview = undefined;
    this.scene.registry.set('equipmentPanelOpen', false);
  }
  public destroy(): void { this.close(); this.inventory.remove(); this.character.remove(); }

  public refresh(): void {
    const inventoryOpen = this.inventory.classList.contains('visible');
    const characterOpen = this.character.classList.contains('visible');
    if (!inventoryOpen && !characterOpen) return;
    const classId = this.player.activeClass;
    const signature = gameProgressService.version + ':' + classId + ':' + this.player.activeSkin + ':' + this.selected;
    if (inventoryOpen) {
      this.preview?.refresh();
      if (signature !== this.signature) {
        this.signature = signature;
        const progress = gameProgressService.snapshot;
        this.summary.textContent = t('restore.coins', { coins: progress.coins }) + ' · ' +
          t('equipment.capacity', { used: progress.inventory.length, total: EQUIPMENT_CONFIG.capacity });
        this.cells.forEach((cell, index) => {
          const item = progress.inventory[index]; cell.replaceChildren(); cell.classList.toggle('selected', !!item && item.id === this.selected);
          cell.dataset.itemId = item?.id ?? ''; cell.style.setProperty('--rarity', item ? RARITY_COLORS[item.rarity] : '#524d39');
          cell.setAttribute('aria-pressed', String(!!item && item.id === this.selected));
          cell.setAttribute('aria-label', item ? t(`item.${item.kind}`) + ' · ' + t(`rarity.${item.rarity}`) : t('equipment.empty') + ' ' + (index + 1));
          if (item) cell.append(this.icon(item), node('small', 'item-level', String(item.itemLevel)));
        });
        this.potions.replaceChildren();
        for (const [kind, hotkey, count] of [['health', 'Q', progress.player.healthPotions], ['mana', 'E', progress.player.manaPotions]] as const) {
          const stack = node('div', 'inventory-potion slot-' + kind + '-potion');
          const glyph = node('span', 'potion-glyph'); glyph.setAttribute('aria-hidden', 'true');
          stack.append(glyph, node('span', '', t(`potion.${kind}`)), node('b', '', '×' + count), node('kbd', '', hotkey)); this.potions.append(stack);
        }
        this.previewCaption.textContent = t(`class.${classId}`) + ' · ' + getCharacterSkin(this.player.activeSkin).displayName;
        for (const slot of EQUIPMENT_SLOTS) {
          const item = progress.equipment[slot];
          const button = this.wornSlots.get(slot)!; button.replaceChildren();
          button.classList.toggle('selected', !!item && item.id === this.selected);
          button.style.setProperty('--rarity', item ? RARITY_COLORS[item.rarity] : '#65593e');
          button.append(node('span', 'equipment-slot-label', t(`equipment.${slot}`)));
          if (item) button.append(this.icon(item));
          else {
            const silhouette = document.createElement('img'); silhouette.className = 'equipment-icon empty-silhouette'; silhouette.alt = '';
            silhouette.src = ITEM_ICONS[slot === 'weapon' ? CLASS_WEAPONS[classId] : slot === 'ring1' || slot === 'ring2' ? 'ring' : slot];
            button.append(silhouette);
          }
          if (item && this.inactive(item, classId)) button.append(node('small', 'stat-worse', t('equipment.inactive')));
          button.disabled = !item;
          button.setAttribute('aria-pressed', String(!!item && item.id === this.selected));
          button.setAttribute('aria-label', t(`equipment.${slot}`) + ': ' + (item ? t(`item.${item.kind}`) : t('equipment.empty')));
        }
        this.tooltip.replaceChildren();
        const item = [...progress.inventory, ...Object.values(progress.equipment)].find(item => item.id === this.selected);
        if (item) this.renderTooltip(item, classId);
        else this.tooltip.append(node('p', 'tooltip-hint', t('equipment.select')));
      }
    }
    if (!characterOpen) return;
    const characterSignature = signature + ':' + [Math.ceil(this.player.currentHealth), this.player.maxHealth, Math.floor(this.player.currentMana), this.player.maxMana, this.player.finalDamage].join(':');
    if (characterSignature === this.characterSignature) return;
    this.characterSignature = characterSignature;
    const p = gameProgressService.snapshot; const base = PLAYER_CLASS_CONFIGS[classId]; const bonus = equipmentBonuses(p.equipment, classId);
    this.sheet.replaceChildren();
    const stats = node('div', 'character-stats'), skills = node('div', 'character-skills');
    const row = (label: string, value: string) => { const r = node('div', 'character-row'); r.append(node('span', '', label), node('b', '', value)); stats.append(r); };
    row(t('equipment.class'), t(`class.${classId}`));
    row(t('hud.level', { level: p.player.level }), t('hud.xp') + ' ' + p.player.xp + '/' + this.scene.registry.get('playerXpRequired'));
    row('HP', Math.ceil(this.player.currentHealth) + ' / ' + this.player.maxHealth);
    row(t('hud.mana'), Math.floor(this.player.currentMana) + ' / ' + this.player.maxMana);
    row(t('character.baseDamage'), String(base.attackDamage)); row(t('character.finalDamage'), String(this.player.finalDamage));
    row(t('stat.movementSpeed'), this.player.finalMoveSpeed.toFixed(1) + ' px/s');
    row(t('stat.cooldownReduction'), statValue('cooldownReduction', 1 - this.player.cooldownMultiplier));
    row(t('stat.manaRegen'), this.player.finalManaRegen.toFixed(2) + '/s');
    row(t('character.skin'), getCharacterSkin(this.player.activeSkin).displayName);
    stats.append(node('h3', 'equipment-section-title', t('equipment.loadout')));
    for (const slot of EQUIPMENT_SLOTS) {
      const item = p.equipment[slot];
      row(t(`equipment.${slot}`), item ? t(`item.${item.kind}`) + ' · ' + t(`rarity.${item.rarity}`) : t('equipment.empty'));
      if (item && this.inactive(item, classId)) stats.append(node('small', 'stat-worse', t('equipment.inactive')));
    }
    for (const key of keys) if (bonus[key]) row(t(`stat.${key}`), '+' + statValue(key, bonus[key]));
    skills.append(node('h3', 'equipment-section-title', t('character.skills')));
    const first = SKILL_1_CONFIGS[classId];
    for (const [slot, name, mana, cooldown, id] of [
      [1, first.localizedNameKey, 0, first.cooldownMs, first.id],
      ...([2, 3] as const).map(slot => { const skill = ADVANCED_SKILLS[classId][slot]; return [slot, skill.name, skill.mana, skill.cooldownMs, skill.id] as const; }),
    ] as const) {
      const card = node('div', 'character-skill');
      card.append(node('kbd', '', String(slot)), node('h4', '', t(name)),
        node('p', 'skill-summary', t('character.skillCost', { mana, cooldown: (cooldown * this.player.cooldownMultiplier / 1000).toFixed(1) })),
        node('p', '', t(`skill.role.${id}` as TranslationKey)));
      skills.append(card);
    }
    this.sheet.append(stats, skills);
  }

  private select(id?: string): void { this.selected = id; this.targetSlot = undefined; this.signature = ''; this.refresh(); }
  private inactive(item: ItemInstance, classId: PlayerClassId): boolean { return !!ITEM_DEFINITIONS[item.kind].classId && ITEM_DEFINITIONS[item.kind].classId !== classId; }
  private icon(item: ItemInstance): HTMLImageElement {
    const image = document.createElement('img'); image.src = ITEM_ICONS[item.kind]; image.alt = ''; image.className = 'equipment-icon'; return image;
  }
  private unequip(slot: EquipmentSlot, item: ItemInstance): void {
    if (!gameProgressService.unequip(slot)) notify(this.scene, t('equipment.full'));
    else notify(this.scene, t('equipment.unequipped', { item: t(`item.${item.kind}`) }));
    this.refresh();
  }
  private renderTooltip(item: ItemInstance, classId: PlayerClassId): void {
    const title = node('h3', '', t(`item.${item.kind}`)); title.style.color = RARITY_COLORS[item.rarity];
    const definition = ITEM_DEFINITIONS[item.kind];
    const equipment = gameProgressService.snapshot.equipment;
    const equippedSlot = EQUIPMENT_SLOTS.find(slot => equipment[slot]?.id === item.id);
    const isEquipped = !!equippedSlot;
    const targetSlot = resolveEquipSlot(item.kind, equipment, this.targetSlot);
    this.tooltip.append(title, node('p', '', t(`rarity.${item.rarity}`)), node('p', '', t('equipment.level', { level: item.itemLevel })), node('p', '', t(`equipment.${equippedSlot ?? targetSlot ?? definition.slot}`)));
    if (definition.classId) this.tooltip.append(node('p', '', t('equipment.class') + ': ' + t(`class.${definition.classId}`)));
    appendItemStats(this.tooltip, item);
    if (!isEquipped) {
      if (item.kind === 'ring' && equipment.ring1 && equipment.ring2) {
        const choices = node('div', 'ring-choices');
        for (const slot of ['ring1', 'ring2'] as const) {
          const button = node('button', 'equipment-action', t(`equipment.${slot}`)); button.type = 'button';
          button.classList.toggle('selected', slot === this.targetSlot); button.setAttribute('aria-pressed', String(slot === this.targetSlot));
          button.onclick = () => { this.targetSlot = slot; this.signature = ''; this.refresh(); }; choices.append(button);
        }
        this.tooltip.append(choices);
      }
      appendComparison(this.tooltip, item, equipment, classId, targetSlot);
    }
    else this.tooltip.append(node('h4', '', t('equipment.worn')));
    const action = node('button', 'equipment-action', t(isEquipped ? 'equipment.unequip' : 'equipment.equip')); action.type = 'button';
    if (!isEquipped && this.inactive(item, classId)) { action.disabled = true; this.tooltip.append(node('small', 'stat-worse', t('equipment.wrongClass'))); }
    if (!isEquipped && !targetSlot) action.disabled = true;
    action.onclick = () => {
      if (!action.isConnected) return;
      if (isEquipped) { this.unequip(equippedSlot!, item); return; }
      const result = gameProgressService.equip(item.id, classId, targetSlot);
      if (result === 'missing' || result === 'choose-slot') return;
      notify(this.scene, t(result === 'wrong-class' ? 'equipment.wrongClass' : 'equipment.equipped', { item: t(`item.${item.kind}`) }), 'equip', result === 'ok' ? RARITY_COLORS[item.rarity] : undefined);
      this.refresh();
    };
    this.tooltip.append(action);
  }
}
