"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finiteInt = finiteInt;
exports.object = object;
exports.validateItem = validateItem;
const equipment_1 = require("../../data/equipment");
function finiteInt(value, fallback, min = 0, max = 1_000_000) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function validateItem(value) {
    const item = object(value);
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id))
        return;
    if (typeof item.kind !== 'string' || !Object.hasOwn(equipment_1.ITEM_DEFINITIONS, item.kind))
        return;
    if (!equipment_1.ITEM_RARITIES.includes(item.rarity))
        return;
    const input = object(item.stats);
    const stats = { ...equipment_1.EMPTY_STATS };
    for (const key of ['damage', 'maxHealth', 'maxMana'])
        stats[key] = finiteInt(input[key], 0, 0, 10_000);
    for (const key of ['cooldownReduction', 'movementSpeed']) {
        const v = input[key];
        stats[key] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(key === 'movementSpeed' ? .1 : .2, v)) : 0;
    }
    if (item.kind === 'armor') {
        stats.damage = 0;
        stats.cooldownReduction = 0;
    }
    else {
        stats.maxHealth = 0;
        stats.movementSpeed = 0;
    }
    return { id: item.id, kind: item.kind, rarity: item.rarity, itemLevel: finiteInt(item.itemLevel, 1, 1, 100), stats };
}
