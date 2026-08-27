import type { PlayerClassId } from '../entities/player/playerTypes';

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type ItemRarity = typeof ITEM_RARITIES[number];
export type EquipmentSlot = 'weapon' | 'armor';
export type ItemKind = 'sword' | 'bow' | 'staff' | 'armor';
export type ItemStats = { damage: number; maxHealth: number; maxMana: number; cooldownReduction: number; movementSpeed: number };
export type ItemInstance = { id: string; kind: ItemKind; rarity: ItemRarity; itemLevel: number; stats: ItemStats };
export type ItemDefinition = { slot: EquipmentSlot; classId?: PlayerClassId };
export const ITEM_DEFINITIONS: Record<ItemKind, ItemDefinition> = {
  sword: { slot: 'weapon', classId: 'warrior' }, bow: { slot: 'weapon', classId: 'archer' },
  staff: { slot: 'weapon', classId: 'mage' }, armor: { slot: 'armor' },
};
export const EMPTY_STATS: Readonly<ItemStats> = { damage: 0, maxHealth: 0, maxMana: 0, cooldownReduction: 0, movementSpeed: 0 };
export const RARITY_COLORS: Record<ItemRarity, string> = { common: '#c6c9c2', uncommon: '#89c778', rare: '#6faee9', epic: '#b78aec', legendary: '#edba55' };
export const EQUIPMENT_CONFIG = {
  capacity: 24, normalDropChance: .12, itemLevelOffsets: [-1, 0, 0, 0, 1],
  rarityWeights: { normal: [60, 25, 10, 4, 1], elite: [15, 40, 30, 13, 2], boss: [0, 0, 72, 25, 3] },
  rarityMultipliers: [1, 1.3, 1.7, 2.2, 3], maxCooldownReduction: .2, maxMovementSpeed: .1,
  damageBase: 2, damagePerLevel: 1, healthBase: 8, healthPerLevel: 3, manaBase: 3, manaPerLevel: 2,
  pickupRadius: 23,
} as const;

export function rollItem(playerLevel: number, source: 'normal' | 'elite' | 'boss', random = Math.random): ItemInstance {
  const weights = EQUIPMENT_CONFIG.rarityWeights[source];
  let roll = random() * weights.reduce((sum: number, weight) => sum + weight, 0);
  let index = weights.findIndex((weight) => { roll -= weight; return roll < 0; });
  if (index < 0) index = 0;
  const kinds = Object.keys(ITEM_DEFINITIONS) as ItemKind[];
  const kind = kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))];
  const offsets = EQUIPMENT_CONFIG.itemLevelOffsets;
  const itemLevel = Math.max(1, Math.min(100, playerLevel + offsets[Math.min(offsets.length - 1, Math.floor(random() * offsets.length))]));
  const power = EQUIPMENT_CONFIG.rarityMultipliers[index];
  const stats = { ...EMPTY_STATS };
  if (kind === 'armor') stats.maxHealth = Math.round((EQUIPMENT_CONFIG.healthBase + itemLevel * EQUIPMENT_CONFIG.healthPerLevel) * power);
  else stats.damage = Math.round((EQUIPMENT_CONFIG.damageBase + itemLevel * EQUIPMENT_CONFIG.damagePerLevel) * power);
  if (index > 0) stats.maxMana = Math.round((EQUIPMENT_CONFIG.manaBase + itemLevel * EQUIPMENT_CONFIG.manaPerLevel) * power);
  if (index > 1) {
    if (kind === 'armor') stats.movementSpeed = Math.min(.1, .02 * (index - 1));
    else stats.cooldownReduction = Math.min(.2, .03 * (index - 1));
  }
  return { id: crypto.randomUUID(), kind, rarity: ITEM_RARITIES[index], itemLevel, stats };
}

export function equipmentBonuses(equipment: Partial<Record<EquipmentSlot, ItemInstance>>, classId: PlayerClassId): ItemStats {
  const total = { ...EMPTY_STATS };
  for (const item of Object.values(equipment)) {
    if (ITEM_DEFINITIONS[item.kind].classId && ITEM_DEFINITIONS[item.kind].classId !== classId) continue;
    for (const key of Object.keys(total) as (keyof ItemStats)[]) total[key] += item.stats[key];
  }
  total.cooldownReduction = Math.min(EQUIPMENT_CONFIG.maxCooldownReduction, total.cooldownReduction);
  total.movementSpeed = Math.min(EQUIPMENT_CONFIG.maxMovementSpeed, total.movementSpeed);
  return total;
}
