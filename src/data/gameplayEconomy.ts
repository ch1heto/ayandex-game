import { ITEM_RARITIES, type ItemInstance } from './equipment';
export const HEAL_PER_COIN = 10;
export type PotionKind = 'health' | 'mana';
export const ECONOMY_CONFIG = {
  potionPrices: { health: 12, mana: 14 },
  potionDropChance: { normal: .05, elite: .2, boss: 1 },
  sellMultipliers: [1, 2, 4, 7, 11],
  buyMultiplier: 4, buyFlat: 10,
  shopCommonChance: .35, shopUncommonChance: .5, shopHigherLevelChance: .5,
  levelRestoreFraction: .3,
} as const;
export function rollPotion(source: 'normal' | 'elite' | 'boss', random = Math.random): PotionKind | undefined {
  return random() < ECONOMY_CONFIG.potionDropChance[source] ? (random() < .5 ? 'health' : 'mana') : undefined;
}
export const sellPrice = (item: ItemInstance): number => Math.floor((2 + 2 * item.itemLevel) * ECONOMY_CONFIG.sellMultipliers[ITEM_RARITIES.indexOf(item.rarity)]);
export const buyPrice = (item: ItemInstance): number => sellPrice(item) * ECONOMY_CONFIG.buyMultiplier + ECONOMY_CONFIG.buyFlat;
