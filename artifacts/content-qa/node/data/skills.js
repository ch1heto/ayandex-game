"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_1_CONFIGS = void 0;
exports.SKILL_1_CONFIGS = {
    warrior: { id: 'heavy-slash', classId: 'warrior', cooldownMs: 5000, damageMultiplier: 1.9, rangeMultiplier: 1.18, localizedNameKey: 'skill.warrior', behavior: 'heavy-slash', color: 0xffa63d },
    archer: { id: 'piercing-shot', classId: 'archer', cooldownMs: 5000, damageMultiplier: 2, rangeMultiplier: 1.2, localizedNameKey: 'skill.archer', behavior: 'piercing-shot', projectile: { maxHits: 1 }, color: 0xffdf69 },
    mage: { id: 'magic-burst', classId: 'mage', cooldownMs: 5000, damageMultiplier: 2, rangeMultiplier: 1, localizedNameKey: 'skill.mage', behavior: 'magic-burst', projectile: { maxHits: 1, splashMultiplier: 0.5, splashRadius: 62 }, color: 0xd7a0ff },
};
