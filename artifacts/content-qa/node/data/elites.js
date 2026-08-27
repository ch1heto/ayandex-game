"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AFFIX_MULTIPLIERS = exports.ELITE_CONFIG = void 0;
exports.rollElite = rollElite;
exports.ELITE_CONFIG = { spawnChance: .07, health: 2.2, damage: 1.3, xp: 3, coins: 2, scale: 1.14, affixes: ['swift', 'brutal', 'warden'] };
exports.AFFIX_MULTIPLIERS = {
    swift: { health: 1, damage: 1, speed: 1.18 }, brutal: { health: 1, damage: 1.07, speed: 1 }, warden: { health: 1.12, damage: 1, speed: 1 },
};
function rollElite(random = Math.random) {
    return random() < exports.ELITE_CONFIG.spawnChance ? exports.ELITE_CONFIG.affixes[Math.min(2, Math.floor(random() * 3))] : undefined;
}
