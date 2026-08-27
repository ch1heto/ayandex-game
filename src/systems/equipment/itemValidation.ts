import { EMPTY_STATS, ITEM_DEFINITIONS, ITEM_RARITIES, type ItemInstance, type ItemKind, type ItemStats } from '../../data/equipment';

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
  return { id: item.id, kind: item.kind as ItemKind, rarity: item.rarity as ItemInstance['rarity'], itemLevel: finiteInt(item.itemLevel, 1, 1, 100), stats };
}
