"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EQUIPMENT_CONFIG = exports.RARITY_COLORS = exports.EMPTY_STATS = exports.ITEM_DEFINITIONS = exports.ITEM_RARITIES = void 0;
exports.rollItem = rollItem;
exports.equipmentBonuses = equipmentBonuses;
exports.ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
exports.ITEM_DEFINITIONS = {
    sword: { slot: 'weapon', classId: 'warrior' }, bow: { slot: 'weapon', classId: 'archer' },
    staff: { slot: 'weapon', classId: 'mage' }, armor: { slot: 'armor' },
};
exports.EMPTY_STATS = { damage: 0, maxHealth: 0, maxMana: 0, cooldownReduction: 0, movementSpeed: 0 };
exports.RARITY_COLORS = { common: '#c6c9c2', uncommon: '#89c778', rare: '#6faee9', epic: '#b78aec', legendary: '#edba55' };
exports.EQUIPMENT_CONFIG = {
    capacity: 24, normalDropChance: .12, itemLevelOffsets: [-1, 0, 0, 0, 1],
    rarityWeights: { normal: [60, 25, 10, 4, 1], elite: [15, 40, 30, 13, 2], boss: [0, 0, 72, 25, 3] },
    rarityMultipliers: [1, 1.3, 1.7, 2.2, 3], maxCooldownReduction: .2, maxMovementSpeed: .1,
    damageBase: 2, damagePerLevel: 1, healthBase: 8, healthPerLevel: 3, manaBase: 3, manaPerLevel: 2,
    pickupRadius: 23,
};
function rollItem(playerLevel, source, random = Math.random) {
    const weights = exports.EQUIPMENT_CONFIG.rarityWeights[source];
    let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
    let index = weights.findIndex((weight) => { roll -= weight; return roll < 0; });
    if (index < 0)
        index = 0;
    const kinds = Object.keys(exports.ITEM_DEFINITIONS);
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))];
    const offsets = exports.EQUIPMENT_CONFIG.itemLevelOffsets;
    const itemLevel = Math.max(1, Math.min(100, playerLevel + offsets[Math.min(offsets.length - 1, Math.floor(random() * offsets.length))]));
    const power = exports.EQUIPMENT_CONFIG.rarityMultipliers[index];
    const stats = { ...exports.EMPTY_STATS };
    if (kind === 'armor')
        stats.maxHealth = Math.round((exports.EQUIPMENT_CONFIG.healthBase + itemLevel * exports.EQUIPMENT_CONFIG.healthPerLevel) * power);
    else
        stats.damage = Math.round((exports.EQUIPMENT_CONFIG.damageBase + itemLevel * exports.EQUIPMENT_CONFIG.damagePerLevel) * power);
    if (index > 0)
        stats.maxMana = Math.round((exports.EQUIPMENT_CONFIG.manaBase + itemLevel * exports.EQUIPMENT_CONFIG.manaPerLevel) * power);
    if (index > 1) {
        if (kind === 'armor')
            stats.movementSpeed = Math.min(.1, .02 * (index - 1));
        else
            stats.cooldownReduction = Math.min(.2, .03 * (index - 1));
    }
    return { id: crypto.randomUUID(), kind, rarity: exports.ITEM_RARITIES[index], itemLevel, stats };
}
function equipmentBonuses(equipment, classId) {
    const total = { ...exports.EMPTY_STATS };
    for (const item of Object.values(equipment)) {
        if (exports.ITEM_DEFINITIONS[item.kind].classId && exports.ITEM_DEFINITIONS[item.kind].classId !== classId)
            continue;
        for (const key of Object.keys(total))
            total[key] += item.stats[key];
    }
    total.cooldownReduction = Math.min(exports.EQUIPMENT_CONFIG.maxCooldownReduction, total.cooldownReduction);
    total.movementSpeed = Math.min(exports.EQUIPMENT_CONFIG.maxMovementSpeed, total.movementSpeed);
    return total;
}
