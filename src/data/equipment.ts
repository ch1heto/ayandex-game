import type { PlayerClassId } from '../entities/player/playerTypes';

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type ItemRarity = typeof ITEM_RARITIES[number];
export const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'chest', 'legs', 'boots', 'amulet', 'ring1', 'ring2'] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
export type ItemKind = 'sword' | 'bow' | 'staff' | 'helmet' | 'chest' | 'legs' | 'boots' | 'amulet' | 'ring';
export type Equipment = Partial<Record<EquipmentSlot, ItemInstance>>;
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
export type ItemDefinition = { slot: EquipmentSlot; classId?: PlayerClassId; alternateSlot?: EquipmentSlot };
export const ITEM_DEFINITIONS: Record<ItemKind, ItemDefinition> = {
  sword: { slot: 'weapon', classId: 'warrior' }, bow: { slot: 'weapon', classId: 'archer' },
  staff: { slot: 'weapon', classId: 'mage' }, helmet: { slot: 'helmet' }, chest: { slot: 'chest' },
  legs: { slot: 'legs' }, boots: { slot: 'boots' }, amulet: { slot: 'amulet' }, ring: { slot: 'ring1', alternateSlot: 'ring2' },
};
export const CLASS_WEAPONS: Record<PlayerClassId, ItemKind> = { warrior: 'sword', archer: 'bow', mage: 'staff' };
export const EMPTY_STATS: Readonly<ItemStats> = { damage: 0, maxHealth: 0, maxMana: 0, cooldownReduction: 0, movementSpeed: 0, manaRegen: 0 };
export const RARITY_COLORS: Record<ItemRarity, string> = { common: '#c6c9c2', uncommon: '#89c778', rare: '#6faee9', epic: '#b78aec', legendary: '#edba55' };
export const EQUIPMENT_CONFIG = {
  capacity: 24, normalDropChance: .12, relevantChance: .75, uncommonAffixChance: .25, epicSecondAffixChance: .5, itemLevelOffsets: [-1, 0, 0, 1, 1],
  eliteLevelOffsets: [0, 0, 1, 1, 1], bossLevelOffsets: [0, 1, 1, 1, 1],
  rarityWeights: { normal: [60, 25, 10, 4, 1], elite: [15, 40, 30, 13, 2], boss: [0, 0, 72, 25, 3] },
  rarityMultipliers: [1, 1.3, 1.7, 2.2, 3], maxCooldownReduction: .2, maxMovementSpeed: .1, maxManaRegen: 3,
  pickupRadius: 23,
} as const;

type ItemBudget = {
  base: Partial<Record<'damage' | 'maxHealth' | 'maxMana', readonly [number, number]>>;
  utility?: 'cooldownReduction' | 'movementSpeed' | 'manaRegen';
  utilityBase: number; affixPower: number; affixes: AffixId[];
};
const weaponBudget: ItemBudget = { base: { damage: [2, 1], maxMana: [1, .35] }, utility: 'cooldownReduction', utilityBase: .018, affixPower: .8, affixes: ['sharp', 'arcane', 'focused'] };
// Full-set resources share the old armor budget; accessories trade raw defense for utility.
export const ITEM_BUDGETS: Record<ItemKind, ItemBudget> = {
  sword: weaponBudget, bow: weaponBudget, staff: weaponBudget,
  chest: { base: { maxHealth: [5, 1.45] }, utilityBase: 0, affixPower: .5, affixes: ['vital', 'arcane'] },
  helmet: { base: { maxHealth: [2, .5], maxMana: [1, .2] }, utility: 'cooldownReduction', utilityBase: .007, affixPower: .3, affixes: ['vital', 'arcane', 'focused', 'restoring'] },
  legs: { base: { maxHealth: [3, .65] }, utility: 'movementSpeed', utilityBase: .006, affixPower: .35, affixes: ['vital', 'swift'] },
  boots: { base: { maxHealth: [1, .25] }, utility: 'movementSpeed', utilityBase: .012, affixPower: .25, affixes: ['swift', 'arcane'] },
  amulet: { base: { maxMana: [2, .8] }, utility: 'manaRegen', utilityBase: .12, affixPower: .35, affixes: ['arcane', 'focused', 'restoring', 'sharp'] },
  ring: { base: { maxMana: [1, .2] }, utilityBase: 0, affixPower: .2, affixes: ['vital', 'arcane', 'sharp', 'focused', 'restoring'] },
};
export function itemSlots(kind: ItemKind): EquipmentSlot[] {
  const def = ITEM_DEFINITIONS[kind];
  return def.alternateSlot ? [def.slot, def.alternateSlot] : [def.slot];
}
export function resolveEquipSlot(kind: ItemKind, equipment: Equipment, chosen?: EquipmentSlot): EquipmentSlot | undefined {
  const slots = itemSlots(kind);
  if (chosen) return slots.includes(chosen) ? chosen : undefined;
  return slots.find(slot => !equipment[slot]) ?? (slots.length === 1 ? slots[0] : undefined);
}

type RollOptions = { classId?: PlayerClassId; equipment?: Partial<Record<EquipmentSlot, ItemInstance>>; forceRelevant?: boolean; kind?: ItemKind; rarity?: ItemRarity; itemLevel?: number };
const choose = <T>(values: readonly T[], random: () => number): T => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
export function isRelevant(item: Pick<ItemInstance, 'kind'>, classId: PlayerClassId): boolean {
  return !ITEM_DEFINITIONS[item.kind].classId || item.kind === CLASS_WEAPONS[classId];
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
    const candidates: ItemKind[] = [CLASS_WEAPONS[classId], 'helmet', 'chest', 'legs', 'boots', 'amulet', 'ring'];
    const weights = candidates.map(candidate => {
      const slots = itemSlots(candidate);
      const weakness = Math.max(...slots.map(slot => {
        const item = options.equipment?.[slot];
        if (!item || !isRelevant(item, classId)) return 2.2;
        const quality = item.itemLevel * EQUIPMENT_CONFIG.rarityMultipliers[ITEM_RARITIES.indexOf(item.rarity)];
        return 1 + Math.max(0, Math.min(1, (playerLevel - quality) / Math.max(1, playerLevel)));
      }));
      return weakness * (candidate === 'ring' ? 1.25 : 1);
    });
    let selection = random() * weights.reduce((sum, weight) => sum + weight, 0);
    kind = candidates[weights.findIndex(weight => (selection -= weight) < 0)] ?? candidates[0];
  } else kind = choose((['sword', 'bow', 'staff'] as const).filter(value => value !== CLASS_WEAPONS[classId]), random);
  const offsets = source === 'boss' ? EQUIPMENT_CONFIG.bossLevelOffsets : source === 'elite' ? EQUIPMENT_CONFIG.eliteLevelOffsets : EQUIPMENT_CONFIG.itemLevelOffsets;
  const itemLevel = Math.max(1, Math.min(10000, options.itemLevel ?? playerLevel + choose(offsets, random)));
  const power = EQUIPMENT_CONFIG.rarityMultipliers[index];
  const variance = () => .9 + random() * .2;
  const integer = (value: number) => Math.min(10000, Math.round(value * variance()));
  const stats = { ...EMPTY_STATS };
  const budget = ITEM_BUDGETS[kind];
  for (const key of ['damage', 'maxHealth', 'maxMana'] as const) {
    const base = budget.base[key];
    if (base) stats[key] = integer((base[0] + base[1] * itemLevel) * power);
  }
  if (index > 1) {
    const utility = budget.utility;
    if (utility) stats[utility] = Number((budget.utilityBase * (index - 1) * variance()).toFixed(4));
  }
  const count = index === 0 ? 0 : index === 1 ? (random() < EQUIPMENT_CONFIG.uncommonAffixChance ? 1 : 0) : index === 2 ? 1 : index === 3 ? (random() < EQUIPMENT_CONFIG.epicSecondAffixChance ? 2 : 1) : 2;
  const available = [...budget.affixes];
  const affixes: ItemAffix[] = [];
  for (let i = 0; i < count; i++) {
    const id = choose(available, random); available.splice(available.indexOf(id), 1);
    const def = AFFIXES[id], value = Math.min(def.cap, (def.base + def.perLevel * itemLevel) * budget.affixPower * variance());
    affixes.push({ id, value: ['damage', 'maxHealth', 'maxMana'].includes(def.stat) ? Math.max(1, Math.round(value)) : Number(value.toFixed(4)) });
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
export function equipmentComparison(item: ItemInstance, equipment: Equipment, classId: PlayerClassId, targetSlot?: EquipmentSlot): ItemStats {
  const slot = resolveEquipSlot(item.kind, equipment, targetSlot);
  if (!slot || !isRelevant(item, classId)) return { ...EMPTY_STATS };
  const before = equipmentBonuses(equipment, classId);
  const after = equipmentBonuses({ ...equipment, [slot]: item }, classId);
  const delta = { ...EMPTY_STATS };
  for (const key of Object.keys(delta) as (keyof ItemStats)[]) delta[key] = Number((after[key] - before[key]).toFixed(4));
  return delta;
}
