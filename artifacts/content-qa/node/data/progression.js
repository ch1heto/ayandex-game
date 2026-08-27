"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBJECTIVE_TARGETS = exports.XP_REWARDS = void 0;
exports.requiredXpForLevel = requiredXpForLevel;
exports.XP_REWARDS = { slime: 10, spider: 15 };
exports.OBJECTIVE_TARGETS = { slime: 5, spider: 3 };
function requiredXpForLevel(level) {
    return 100 + (Math.max(1, Math.floor(level)) - 1) * 50;
}
