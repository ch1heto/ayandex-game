import { AFFIXES, EMPTY_STATS, ITEM_DEFINITIONS, ITEM_RARITIES, type AffixId, type ItemAffix, type ItemInstance, type ItemKind, type ItemStats } from '../../data/equipment';

export function finiteInt(value: unknown, fallback: number, min = 0, max = 1_000_000): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function validateItem(value: unknown): ItemInstance | undefined {
  const item = object(value);
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id)) return;
  if (typeof item.kind !== 'string' || !Object.hasOwn(ITEM_DEFINITIONS, item.kind)) return;
  if (!ITEM_RARITIES.includes(item.rarity as ItemInstance['rarity'])) return;
  const input = object(item.stats);
  const stats: ItemStats = { ...EMPTY_STATS };
  for (const key of ['damage', 'maxHealth', 'maxMana'] as const) stats[key] = finiteInt(input[key], 0, 0, 10_000);
  for (const key of ['cooldownReduction', 'movementSpeed'] as const) {
    const v = input[key]; stats[key] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(key === 'movementSpeed' ? .1 : .2, v)) : 0;
  }
  if (item.kind === 'armor') { stats.damage = 0; stats.cooldownReduction = 0; }
  else { stats.maxHealth = 0; stats.movementSpeed = 0; }
  const affixes: ItemAffix[] = [];
  const rarityIndex = ITEM_RARITIES.indexOf(item.rarity as ItemInstance['rarity']);
  const maxAffixes = rarityIndex === 0 ? 0 : rarityIndex < 3 ? 1 : 2;
  for (const raw of Array.isArray(item.affixes) ? item.affixes : []) {
    const affix = object(raw), id = affix.id as AffixId;
    if (!Object.hasOwn(AFFIXES, id) || affixes.some(existing => existing.id === id) || affixes.length >= maxAffixes) continue;
    if (typeof affix.value !== 'number' || !Number.isFinite(affix.value) || affix.value <= 0) continue;
    affixes.push({ id, value: Math.min(AFFIXES[id].cap, affix.value) });
  }
  return { id: item.id, kind: item.kind as ItemKind, rarity: item.rarity as ItemInstance['rarity'], itemLevel: finiteInt(item.itemLevel, 1, 1, 10000), stats, affixes };
}
