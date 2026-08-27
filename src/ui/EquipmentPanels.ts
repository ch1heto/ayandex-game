import type Phaser from 'phaser';
import { EMPTY_STATS, EQUIPMENT_CONFIG, ITEM_DEFINITIONS, RARITY_COLORS, equipmentBonuses, type ItemInstance, type ItemStats } from '../data/equipment';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { ADVANCED_SKILLS } from '../data/advancedSkills';
import { SKILL_1_CONFIGS } from '../data/skills';
import { getCharacterSkin } from '../data/characterSkins';
import type { PlayerClassId } from '../entities/player/playerTypes';
import { t } from '../i18n/LocalizationService';
import { gameProgressService } from '../systems/save/GameProgressService';
import { notify } from '../systems/notifications/notifications';
import { ITEM_ICONS } from './itemIcons';

const keys = Object.keys(EMPTY_STATS) as (keyof ItemStats)[];
function node(tag: string, className: string, text = ''): HTMLElement {
  const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
}
function statValue(key: keyof ItemStats, value: number): string {
  return key === 'cooldownReduction' || key === 'movementSpeed' ? Math.round(value * 100) + '%' : String(value);
}
export class EquipmentPanels {
  public readonly inventory = node('section', 'hud-info-panel equipment-panel');
  public readonly character = node('section', 'hud-info-panel character-panel');
  private readonly grid = node('div', 'inventory-grid');
  private readonly cells: HTMLButtonElement[] = [];
  private readonly summary = node('div', 'inventory-summary');
  private readonly tooltip = node('div', 'item-tooltip');
  private readonly sheet = node('div', 'character-sheet');
  private selected?: string;
  private signature = '';
  private characterSignature = '';

  public constructor(private readonly scene: Phaser.Scene) {
    for (const [panel, title] of [[this.inventory, t('hud.inventoryTitle')], [this.character, t('hud.characterTitle')]] as const) {
      const heading = node('header', 'equipment-heading'); heading.append(node('h2', '', title));
      const close = node('button', 'equipment-close', '×') as HTMLButtonElement;
      close.type = 'button'; close.setAttribute('aria-label', t('settings.close')); close.onclick = () => this.close();
      heading.append(close); panel.append(heading);
      panel.addEventListener('pointerdown', event => event.stopPropagation());
    }
    for (let index = 0; index < EQUIPMENT_CONFIG.capacity; index++) {
      const cell = node('button', 'inventory-cell') as HTMLButtonElement;
      cell.type = 'button'; cell.onclick = () => { this.selected = cell.dataset.itemId; this.signature = ''; this.refresh(); };
      this.cells.push(cell); this.grid.append(cell);
    }
    const layout = node('div', 'inventory-layout'); layout.append(this.grid, this.tooltip);
    this.inventory.append(this.summary, layout, node('small', 'equipment-hint', t('hud.closeHint')));
    this.character.append(this.sheet);
  }

  public toggle(which: 'inventory' | 'character'): void {
    const selected = this[which]; const open = !selected.classList.contains('visible');
    this.close(); if (open) selected.classList.add('visible');
    this.scene.registry.set('equipmentPanelOpen', open); this.refresh();
  }
  public close(): void {
    this.inventory.classList.remove('visible'); this.character.classList.remove('visible');
    this.scene.registry.set('equipmentPanelOpen', false);
  }
  public destroy(): void { this.close(); this.inventory.remove(); this.character.remove(); }

  public refresh(): void {
    const classId = (this.scene.registry.get('activeClass') ?? 'warrior') as PlayerClassId;
    const signature = gameProgressService.version + ':' + classId + ':' + this.selected;
    if (signature !== this.signature) {
      this.signature = signature;
      const progress = gameProgressService.snapshot;
      this.summary.textContent = t('restore.coins', { coins: progress.coins }) + ' · ' + t('potion.health') + ': ' + progress.player.healthPotions + ' · ' + t('potion.mana') + ': ' + progress.player.manaPotions + ' · ' + progress.inventory.length + '/24';
      this.cells.forEach((cell, index) => {
        const item = progress.inventory[index]; cell.replaceChildren(); cell.classList.toggle('selected', !!item && item.id === this.selected);
        cell.dataset.itemId = item?.id ?? ''; cell.style.setProperty('--rarity', item ? RARITY_COLORS[item.rarity] : '#524d39');
        cell.setAttribute('aria-label', item ? t(`item.${item.kind}`) + ' · ' + t(`rarity.${item.rarity}`) : t('equipment.empty') + ' ' + (index + 1));
        if (item) { cell.append(this.icon(item), node('small', 'item-level', String(item.itemLevel))); }
      });
      this.tooltip.replaceChildren();
      const item = progress.inventory.find(item => item.id === this.selected);
      if (item) this.renderTooltip(item, classId);
      else this.tooltip.append(node('p', 'tooltip-hint', t('equipment.select')));
    }
    const values = ['playerHealth', 'playerMaxHealth', 'playerMana', 'playerMaxMana', 'activeSkin'].map(key => this.scene.registry.get(key));
    const characterSignature = signature + ':' + values.map(value => typeof value === 'number' ? Math.floor(value) : value).join(':');
    if (!this.character.classList.contains('visible') || characterSignature === this.characterSignature) return;
    this.characterSignature = characterSignature;
    const p = gameProgressService.snapshot; const base = PLAYER_CLASS_CONFIGS[classId]; const bonus = equipmentBonuses(p.equipment, classId);
    this.sheet.replaceChildren();
    const row = (label: string, value: string) => { const r = node('div', 'character-row'); r.append(node('span', '', label), node('b', '', value)); this.sheet.append(r); };
    row(t('equipment.class'), t(`class.${classId}`)); row(t('hud.level', { level: p.player.level }), t('hud.xp') + ' ' + p.player.xp + '/' + this.scene.registry.get('playerXpRequired'));
    row('HP', Math.ceil(Number(values[0])) + ' / ' + values[1]); row(t('hud.mana'), Math.floor(Number(values[2])) + ' / ' + values[3]);
    row(t('character.baseDamage'), String(base.attackDamage)); row(t('character.finalDamage'), String(base.attackDamage + bonus.damage));
    const skin = String(values[4] ?? ''); row(t('character.skin'), skin ? getCharacterSkin(skin).displayName : '');
    row('1', t(SKILL_1_CONFIGS[classId].localizedNameKey));
    for (const slot of [2, 3] as const) { const skill = ADVANCED_SKILLS[classId][slot]; row(String(slot), t(skill.name) + ' · ' + skill.mana + ' MP'); }
    for (const slot of ['weapon', 'armor'] as const) {
      const item = p.equipment[slot]; const r = node('div', 'equipped-row');
      r.append(node('span', '', t(`equipment.${slot}`)));
      if (item) {
        r.append(this.icon(item), node('b', '', t(`item.${item.kind}`)));
        const button = node('button', 'equipment-action', t('equipment.unequip')) as HTMLButtonElement;
        button.onclick = () => {
          if (!gameProgressService.unequip(slot)) notify(this.scene, t('equipment.full'));
          else notify(this.scene, t('equipment.unequipped', { item: t(`item.${item.kind}`) }));
          this.refresh();
        }; r.append(button);
        if (ITEM_DEFINITIONS[item.kind].classId && ITEM_DEFINITIONS[item.kind].classId !== classId) r.append(node('small', 'stat-worse', t('equipment.inactive')));
      } else r.append(node('b', '', t('equipment.empty')));
      this.sheet.append(r);
    }
    for (const key of keys) if (bonus[key]) row(t(`stat.${key}`), '+' + statValue(key, bonus[key]));
  }

  private icon(item: ItemInstance): HTMLImageElement {
    const image = document.createElement('img'); image.src = ITEM_ICONS[item.kind]; image.alt = ''; image.className = 'equipment-icon'; return image;
  }
  private renderTooltip(item: ItemInstance, classId: PlayerClassId): void {
    const title = node('h3', '', t(`item.${item.kind}`)); title.style.color = RARITY_COLORS[item.rarity];
    const definition = ITEM_DEFINITIONS[item.kind];
    this.tooltip.append(title, node('p', '', t(`rarity.${item.rarity}`)), node('p', '', t('equipment.level', { level: item.itemLevel })), node('p', '', t(`equipment.${definition.slot}`)));
    if (definition.classId) this.tooltip.append(node('p', '', t('equipment.class') + ': ' + t(`class.${definition.classId}`)));
    for (const key of keys) if (item.stats[key]) this.tooltip.append(node('div', 'item-stat', t(`stat.${key}`) + ' +' + statValue(key, item.stats[key])));
    this.tooltip.append(node('h4', '', t('equipment.compare')));
    const equipped = gameProgressService.snapshot.equipment[definition.slot];
    for (const key of keys) {
      const difference = item.stats[key] - (equipped?.stats[key] ?? 0);
      if (difference) this.tooltip.append(node('div', difference > 0 ? 'stat-better' : 'stat-worse', t(`stat.${key}`) + ' ' + (difference > 0 ? '+' : '') + statValue(key, difference)));
    }
    const equip = node('button', 'equipment-action', t('equipment.equip')) as HTMLButtonElement;
    equip.onclick = () => {
      const result = gameProgressService.equip(item.id, classId);
      if (result === 'missing') return;
      notify(this.scene, result === 'wrong-class' ? t('equipment.wrongClass') : t('equipment.equipped', { item: t(`item.${item.kind}`) }), 'equip', result === 'ok' ? RARITY_COLORS[item.rarity] : undefined);
      this.refresh();
    }; this.tooltip.append(equip);
  }
}
