import type { PlayerClassId } from '../entities/player/playerTypes';

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type ItemRarity = typeof ITEM_RARITIES[number];
export type EquipmentSlot = 'weapon' | 'armor';
export type ItemKind = 'sword' | 'bow' | 'staff' | 'armor';
export type ItemStats = { damage: number; maxHealth: number; maxMana: number; cooldownReduction: number; movementSpeed: number; manaRegen: number };
export const AFFIXES = {
  vital: { stat: 'maxHealth', base: 5, perLevel: 2, cap: 10000 },
  arcane: { stat: 'maxMana', base: 3, perLevel: 1, cap: 10000 },
  swift: { stat: 'movementSpeed', base: .01, perLevel: .001, cap: .04 },
  focused: { stat: 'cooldownReduction', base: .015, perLevel: .001, cap: .06 },
  sharp: { stat: 'damage', base: 1, perLevel: .5, cap: 10000 },
  restoring: { stat: 'manaRegen', base: .4, perLevel: .04, cap: 1.5 },
} as const;
export type AffixId = keyof typeof AFFIXES;
export type ItemAffix = { id: AffixId; value: number };
export type ItemInstance = { id: string; kind: ItemKind; rarity: ItemRarity; itemLevel: number; stats: ItemStats; affixes?: ItemAffix[] };
export type ItemDefinition = { slot: EquipmentSlot; classId?: PlayerClassId };
export const ITEM_DEFINITIONS: Record<ItemKind, ItemDefinition> = {
  sword: { slot: 'weapon', classId: 'warrior' }, bow: { slot: 'weapon', classId: 'archer' },
  staff: { slot: 'weapon', classId: 'mage' }, armor: { slot: 'armor' },
};
export const CLASS_WEAPONS: Record<PlayerClassId, ItemKind> = { warrior: 'sword', archer: 'bow', mage: 'staff' };
export const EMPTY_STATS: Readonly<ItemStats> = { damage: 0, maxHealth: 0, maxMana: 0, cooldownReduction: 0, movementSpeed: 0, manaRegen: 0 };
export const RARITY_COLORS: Record<ItemRarity, string> = { common: '#c6c9c2', uncommon: '#89c778', rare: '#6faee9', epic: '#b78aec', legendary: '#edba55' };
export const EQUIPMENT_CONFIG = {
  capacity: 24, normalDropChance: .12, relevantChance: .75, uncommonAffixChance: .25, epicSecondAffixChance: .5, itemLevelOffsets: [-1, 0, 0, 1, 1],
  eliteLevelOffsets: [0, 0, 1, 1, 1], bossLevelOffsets: [0, 1, 1, 1, 1],
  rarityWeights: { normal: [60, 25, 10, 4, 1], elite: [15, 40, 30, 13, 2], boss: [0, 0, 72, 25, 3] },
  rarityMultipliers: [1, 1.3, 1.7, 2.2, 3], maxCooldownReduction: .2, maxMovementSpeed: .1, maxManaRegen: 3,
  damageBase: 2, damagePerLevel: 1, healthBase: 8, healthPerLevel: 3, manaBase: 3, manaPerLevel: 2,
  pickupRadius: 23,
} as const;
type RollOptions = { classId?: PlayerClassId; equipment?: Partial<Record<EquipmentSlot, ItemInstance>>; forceRelevant?: boolean; kind?: ItemKind; rarity?: ItemRarity; itemLevel?: number };
const choose = <T>(values: readonly T[], random: () => number): T => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
export function isRelevant(item: Pick<ItemInstance, 'kind'>, classId: PlayerClassId): boolean {
  return item.kind === 'armor' || item.kind === CLASS_WEAPONS[classId];
}
export function rollItem(playerLevel: number, source: 'normal' | 'elite' | 'boss', random = Math.random, options: RollOptions = {}): ItemInstance {
  const weights = EQUIPMENT_CONFIG.rarityWeights[source];
  let roll = random() * weights.reduce((sum: number, weight) => sum + weight, 0);
  let index = weights.findIndex(weight => { roll -= weight; return roll < 0; });
  if (index < 0) index = 0;
  if (options.rarity) index = ITEM_RARITIES.indexOf(options.rarity);
  const classId = options.classId ?? 'warrior';
  let kind: ItemKind;
  if (options.kind) kind = options.kind;
  else if (options.forceRelevant || random() < EQUIPMENT_CONFIG.relevantChance) {
    const quality = (item?: ItemInstance): number => item && isRelevant(item, classId) ? item.itemLevel * EQUIPMENT_CONFIG.rarityMultipliers[ITEM_RARITIES.indexOf(item.rarity)] : 0;
    const weapon = quality(options.equipment?.weapon), armor = quality(options.equipment?.armor);
    const weaponChance = .5 + Math.max(-.15, Math.min(.15, (armor - weapon) / Math.max(1, playerLevel) * .1));
    kind = random() < weaponChance ? CLASS_WEAPONS[classId] : 'armor';
  } else kind = choose((['sword', 'bow', 'staff'] as const).filter(value => value !== CLASS_WEAPONS[classId]), random);
  const offsets = source === 'boss' ? EQUIPMENT_CONFIG.bossLevelOffsets : source === 'elite' ? EQUIPMENT_CONFIG.eliteLevelOffsets : EQUIPMENT_CONFIG.itemLevelOffsets;
  const itemLevel = Math.max(1, Math.min(10000, options.itemLevel ?? playerLevel + choose(offsets, random)));
  const power = EQUIPMENT_CONFIG.rarityMultipliers[index];
  const variance = () => .9 + random() * .2;
  const integer = (value: number) => Math.min(10000, Math.round(value * variance()));
  const stats = { ...EMPTY_STATS };
  if (kind === 'armor') stats.maxHealth = integer((EQUIPMENT_CONFIG.healthBase + itemLevel * EQUIPMENT_CONFIG.healthPerLevel) * power);
  else stats.damage = integer((EQUIPMENT_CONFIG.damageBase + itemLevel * EQUIPMENT_CONFIG.damagePerLevel) * power);
  if (index > 0) stats.maxMana = integer((EQUIPMENT_CONFIG.manaBase + itemLevel * EQUIPMENT_CONFIG.manaPerLevel) * power);
  if (index > 1) {
    if (kind === 'armor') stats.movementSpeed = Math.min(.1, Number((.02 * (index - 1) * variance()).toFixed(4)));
    else stats.cooldownReduction = Math.min(.2, Number((.03 * (index - 1) * variance()).toFixed(4)));
  }
  const count = index === 0 ? 0 : index === 1 ? (random() < EQUIPMENT_CONFIG.uncommonAffixChance ? 1 : 0) : index === 2 ? 1 : index === 3 ? (random() < EQUIPMENT_CONFIG.epicSecondAffixChance ? 2 : 1) : 2;
  const available = Object.keys(AFFIXES) as AffixId[];
  const affixes: ItemAffix[] = [];
  for (let i = 0; i < count; i++) {
    const id = choose(available, random); available.splice(available.indexOf(id), 1);
    const def = AFFIXES[id], value = Math.min(def.cap, (def.base + def.perLevel * itemLevel) * variance());
    affixes.push({ id, value: ['damage', 'maxHealth', 'maxMana'].includes(def.stat) ? Math.round(value) : Number(value.toFixed(4)) });
  }
  return { id: crypto.randomUUID(), kind, rarity: ITEM_RARITIES[index], itemLevel, stats, affixes };
}
export function rollEquipmentDrops(level: number, source: 'normal' | 'elite' | 'boss', random = Math.random, options: RollOptions = {}): ItemInstance[] {
  if (source === 'normal' && random() >= EQUIPMENT_CONFIG.normalDropChance) return [];
  return Array.from({ length: source === 'boss' ? 2 : 1 }, (_, index) =>
    rollItem(level, source, random, { ...options, forceRelevant: source === 'boss' && index === 0 }));
}
export function cappedStats(stats: ItemStats): ItemStats {
  return { ...stats, cooldownReduction: Math.min(EQUIPMENT_CONFIG.maxCooldownReduction, stats.cooldownReduction),
    movementSpeed: Math.min(EQUIPMENT_CONFIG.maxMovementSpeed, stats.movementSpeed), manaRegen: Math.min(EQUIPMENT_CONFIG.maxManaRegen, stats.manaRegen) };
}
export function itemStats(item: ItemInstance): ItemStats {
  const stats = { ...EMPTY_STATS, ...item.stats };
  for (const affix of item.affixes ?? []) stats[AFFIXES[affix.id].stat] += affix.value;
  return cappedStats(stats);
}
export function equipmentBonuses(equipment: Partial<Record<EquipmentSlot, ItemInstance>>, classId: PlayerClassId): ItemStats {
  const total = { ...EMPTY_STATS };
  for (const item of Object.values(equipment)) {
    if (!isRelevant(item, classId)) continue;
    const stats = itemStats(item);
    for (const key of Object.keys(total) as (keyof ItemStats)[]) total[key] += stats[key];
  }
  return cappedStats(total);
}
export function equipmentComparison(item: ItemInstance, equipment: Partial<Record<EquipmentSlot, ItemInstance>>, classId: PlayerClassId): ItemStats {
  const before = equipmentBonuses(equipment, classId);
  const after = equipmentBonuses({ ...equipment, [ITEM_DEFINITIONS[item.kind].slot]: item }, classId);
  const delta = { ...EMPTY_STATS };
  for (const key of Object.keys(delta) as (keyof ItemStats)[]) delta[key] = Number((after[key] - before[key]).toFixed(4));
  return delta;
}
