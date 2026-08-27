"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameProgressService = exports.GameProgressService = void 0;
const progression_1 = require("../../data/progression");
const playerResources_1 = require("../../data/playerResources");
const equipment_1 = require("../../data/equipment");
const itemValidation_1 = require("../equipment/itemValidation");
const STORAGE_KEY = 'ashvale-progress-v3';
const DEFAULT_PROGRESS = {
    version: 3, coins: 0, buildings: { forge: false, infirmary: false },
    player: { level: 1, xp: 0, healthPotions: playerResources_1.PLAYER_RESOURCES.initialPotionCount, manaPotions: playerResources_1.PLAYER_RESOURCES.initialPotionCount, slimeKills: 0, spiderKills: 0 },
    inventory: [], equipment: {}, milestones: { eliteKilled: false, dungeonEntered: false, bossFirstKill: false }, selection: {},
};
class GameProgressService {
    progress = structuredClone(DEFAULT_PROGRESS);
    revision = 0;
    get version() { return this.revision; }
    load() {
        this.progress = structuredClone(DEFAULT_PROGRESS);
        try {
            const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('ashvale-progress-v2') ?? localStorage.getItem('ashvale-progress-v1');
            if (!raw)
                return this.snapshot;
            const candidate = (0, itemValidation_1.object)(JSON.parse(raw));
            if (![1, 2, 3].includes(Number(candidate.version)))
                return this.snapshot;
            const player = (0, itemValidation_1.object)(candidate.player);
            const buildings = (0, itemValidation_1.object)(candidate.buildings);
            const milestones = (0, itemValidation_1.object)(candidate.milestones);
            const selection = (0, itemValidation_1.object)(candidate.selection);
            const ids = new Set();
            const unique = (value) => {
                const item = (0, itemValidation_1.validateItem)(value);
                if (!item || ids.has(item.id))
                    return;
                ids.add(item.id);
                return item;
            };
            const equipment = {};
            for (const slot of ['weapon', 'armor']) {
                const item = (0, itemValidation_1.validateItem)((0, itemValidation_1.object)(candidate.equipment)[slot]);
                if (item && equipment_1.ITEM_DEFINITIONS[item.kind].slot === slot)
                    equipment[slot] = unique(item);
            }
            const inventory = Array.isArray(candidate.inventory) ? candidate.inventory.map(unique).filter((item) => !!item).slice(0, equipment_1.EQUIPMENT_CONFIG.capacity) : [];
            const classId = selection.classId ?? candidate.selectedClass;
            const skinId = selection.skinId ?? candidate.currentSkin;
            this.progress = {
                version: 3, inventory, equipment,
                milestones: { eliteKilled: milestones.eliteKilled === true, dungeonEntered: milestones.dungeonEntered === true, bossFirstKill: milestones.bossFirstKill === true },
                selection: { classId: ['warrior', 'archer', 'mage'].includes(String(classId)) ? classId : undefined, skinId: typeof skinId === 'string' ? skinId.slice(0, 80) : undefined },
                coins: (0, itemValidation_1.finiteInt)(candidate.coins, 0),
                buildings: { forge: buildings.forge === true, infirmary: buildings.infirmary === true },
                player: {
                    level: (0, itemValidation_1.finiteInt)(player.level, 1, 1, 10000), xp: (0, itemValidation_1.finiteInt)(player.xp, 0),
                    healthPotions: (0, itemValidation_1.finiteInt)(player.healthPotions, playerResources_1.PLAYER_RESOURCES.initialPotionCount),
                    manaPotions: (0, itemValidation_1.finiteInt)(player.manaPotions, playerResources_1.PLAYER_RESOURCES.initialPotionCount),
                    slimeKills: (0, itemValidation_1.finiteInt)(player.slimeKills, 0), spiderKills: (0, itemValidation_1.finiteInt)(player.spiderKills, 0),
                },
            };
            this.normalizeXp();
            if (candidate.version !== 3)
                this.persist();
        }
        catch (error) {
            console.warn('Local progress could not be loaded.', error);
        }
        this.revision += 1;
        return this.snapshot;
    }
    addCoins(value) {
        this.progress.coins = (0, itemValidation_1.finiteInt)(this.progress.coins + value, this.progress.coins);
        return this.persist();
    }
    spendCoins(value) {
        const cost = (0, itemValidation_1.finiteInt)(value, 0);
        if (cost === 0 || this.progress.coins < cost)
            return false;
        this.progress.coins -= cost;
        this.persist();
        return true;
    }
    restoreBuilding(building, cost) {
        if (this.progress.buildings[building] || this.progress.coins < cost)
            return false;
        this.progress.coins -= cost;
        this.progress.buildings[building] = true;
        this.persist();
        return true;
    }
    recordEnemyDefeat(kind, multiplier = 1) {
        const killKey = kind === 'slime' ? 'slimeKills' : 'spiderKills';
        const before = this.progress.player[killKey];
        this.progress.player[killKey] += 1;
        const xpGained = progression_1.XP_REWARDS[kind] * multiplier;
        this.progress.player.xp += xpGained;
        const oldLevel = this.progress.player.level;
        this.normalizeXp();
        const completedObjective = before < progression_1.OBJECTIVE_TARGETS[kind] && this.progress.player[killKey] >= progression_1.OBJECTIVE_TARGETS[kind] ? kind : undefined;
        return { xpGained, levelsGained: this.progress.player.level - oldLevel, completedObjective, progress: this.persist() };
    }
    consumePotion(kind) {
        const key = kind === 'health' ? 'healthPotions' : 'manaPotions';
        if (this.progress.player[key] <= 0)
            return false;
        this.progress.player[key] -= 1;
        this.persist();
        return true;
    }
    pickup(item) {
        if (this.progress.inventory.length >= equipment_1.EQUIPMENT_CONFIG.capacity)
            return false;
        if ([...this.progress.inventory, ...Object.values(this.progress.equipment)].some(existing => existing.id === item.id))
            return false;
        this.progress.inventory.push(structuredClone(item));
        this.persist();
        return true;
    }
    equip(id, classId) {
        const index = this.progress.inventory.findIndex(item => item.id === id);
        if (index < 0)
            return 'missing';
        const item = this.progress.inventory[index];
        const definition = equipment_1.ITEM_DEFINITIONS[item.kind];
        if (definition.classId && definition.classId !== classId)
            return 'wrong-class';
        const old = this.progress.equipment[definition.slot];
        this.progress.inventory.splice(index, 1);
        if (old)
            this.progress.inventory.splice(index, 0, old);
        this.progress.equipment[definition.slot] = item;
        this.persist();
        return 'ok';
    }
    unequip(slot) {
        const item = this.progress.equipment[slot];
        if (!item || this.progress.inventory.length >= equipment_1.EQUIPMENT_CONFIG.capacity)
            return false;
        this.progress.inventory.push(item);
        delete this.progress.equipment[slot];
        this.persist();
        return true;
    }
    select(classId, skinId) {
        this.progress.selection = { classId, skinId };
        this.persist();
    }
    milestone(key) {
        if (this.progress.milestones[key])
            return false;
        this.progress.milestones[key] = true;
        this.persist();
        return true;
    }
    get snapshot() { return structuredClone(this.progress); }
    persist() {
        this.revision += 1;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
        }
        catch (error) {
            console.warn('Local progress could not be saved.', error);
        }
        return this.snapshot;
    }
    normalizeXp() {
        while (this.progress.player.xp >= (0, progression_1.requiredXpForLevel)(this.progress.player.level)) {
            this.progress.player.xp -= (0, progression_1.requiredXpForLevel)(this.progress.player.level);
            this.progress.player.level += 1;
        }
    }
}
exports.GameProgressService = GameProgressService;
exports.gameProgressService = new GameProgressService();
