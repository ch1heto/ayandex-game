import { AFFIXES, EMPTY_STATS, equipmentComparison, itemStats, isRelevant, resolveEquipSlot, type ItemInstance, type ItemStats, type EquipmentSlot } from '../data/equipment';
import type { PlayerClassId } from '../entities/player/playerTypes';
import { t } from '../i18n/LocalizationService';
const keys = Object.keys(EMPTY_STATS) as (keyof ItemStats)[];
export function statValue(key: keyof ItemStats, value: number): string {
  return key === 'cooldownReduction' || key === 'movementSpeed' ? Number((value * 100).toFixed(1)) + '%' : String(Number(value.toFixed(2)));
}
function row(host: HTMLElement, tag: 'h4' | 'div' | 'small', text: string, className = ''): void {
  const element = document.createElement(tag); element.textContent = text; element.className = className; host.append(element);
}
export function appendItemStats(host: HTMLElement, item: ItemInstance): void {
  row(host, 'h4', t('equipment.stats'));
  const stats = itemStats(item);
  for (const key of keys) if (stats[key]) row(host, 'div', t(`stat.${key}`) + ' ' + statValue(key, stats[key]), 'item-stat');
  if (item.affixes?.length) row(host, 'h4', t('equipment.affixes'));
  for (const affix of item.affixes ?? []) row(host, 'small', t(`affix.${affix.id}`) + ': ' + t(`stat.${AFFIXES[affix.id].stat}`) + ' +' + statValue(AFFIXES[affix.id].stat, affix.value), 'item-affix');
}
export function appendComparison(host: HTMLElement, item: ItemInstance, equipment: Partial<Record<EquipmentSlot, ItemInstance>>, classId: PlayerClassId, targetSlot?: EquipmentSlot): void {
  row(host, 'h4', t('equipment.onEquip'));
  if (!isRelevant(item, classId)) { row(host, 'small', t('equipment.wrongClass')); return; }
  if (!resolveEquipSlot(item.kind, equipment, targetSlot)) { row(host, 'small', t('equipment.chooseRing')); return; }
  const delta = equipmentComparison(item, equipment, classId, targetSlot);
  let changed = false;
  for (const key of keys) if (delta[key]) {
    changed = true;
    row(host, 'div', t(`stat.${key}`) + ' ' + (delta[key] > 0 ? '+' : '') + statValue(key, delta[key]), delta[key] > 0 ? 'stat-better' : 'stat-worse');
  }
  if (!changed) row(host, 'small', t('equipment.sameStats'));
}
