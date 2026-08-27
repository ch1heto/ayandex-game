"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADVANCED_SKILLS = void 0;
exports.ADVANCED_SKILLS = {
    warrior: {
        2: { id: 'whirlwind', name: 'skill.whirlwind', mana: 25, cooldownMs: 7000, multiplier: 1.6, radius: 76, range: 0, color: 0xffbf55, anticipationMs: 160 },
        3: { id: 'seismic-slam', name: 'skill.seismic-slam', mana: 40, cooldownMs: 12000, multiplier: 2.2, radius: 112, range: 112, color: 0xffae47, anticipationMs: 260 },
    },
    archer: {
        2: { id: 'multishot', name: 'skill.multishot', mana: 20, cooldownMs: 6000, multiplier: .75, radius: 0, range: 430, color: 0x83f0b9, anticipationMs: 110 },
        3: { id: 'arrow-rain', name: 'skill.arrow-rain', mana: 40, cooldownMs: 12000, multiplier: .6, radius: 82, range: 270, color: 0x72e5ad, anticipationMs: 440, pulses: 4, intervalMs: 420 },
    },
    mage: {
        2: { id: 'frost-nova', name: 'skill.frost-nova', mana: 25, cooldownMs: 7000, multiplier: 1.2, radius: 92, range: 0, color: 0x8ae6ff, anticipationMs: 180, slow: .35, slowMs: 2400 },
        3: { id: 'arcane-meteor', name: 'skill.arcane-meteor', mana: 45, cooldownMs: 13000, multiplier: 2.6, radius: 90, range: 270, color: 0xb397ff, anticipationMs: 650 },
    },
};
