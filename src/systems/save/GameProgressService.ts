import { OBJECTIVE_TARGETS, XP_REWARDS, requiredXpForLevel, type EnemyKind } from '../../data/progression';
import { PLAYER_RESOURCES } from '../../data/playerResources';
import { EQUIPMENT_CONFIG, ITEM_DEFINITIONS, type EquipmentSlot, type ItemInstance } from '../../data/equipment';
import { finiteInt, object, validateItem } from '../equipment/itemValidation';
import type { PlayerClassId } from '../../entities/player/playerTypes';

export type GameProgress = {
  version: 3;
  coins: number;
  buildings: { forge: boolean; infirmary: boolean };
  player: { level: number; xp: number; healthPotions: number; manaPotions: number; slimeKills: number; spiderKills: number };
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipmentSlot, ItemInstance>>;
  milestones: { eliteKilled: boolean; dungeonEntered: boolean; bossFirstKill: boolean };
  selection: { classId?: PlayerClassId; skinId?: string };
};
export type DefeatResult = { xpGained: number; levelsGained: number; completedObjective?: EnemyKind; progress: GameProgress };
const STORAGE_KEY = 'ashvale-progress-v3';
const DEFAULT_PROGRESS: GameProgress = {
  version: 3, coins: 0, buildings: { forge: false, infirmary: false },
  player: { level: 1, xp: 0, healthPotions: PLAYER_RESOURCES.initialPotionCount, manaPotions: PLAYER_RESOURCES.initialPotionCount, slimeKills: 0, spiderKills: 0 },
  inventory: [], equipment: {}, milestones: { eliteKilled: false, dungeonEntered: false, bossFirstKill: false }, selection: {},
};

export class GameProgressService {
  private progress: GameProgress = structuredClone(DEFAULT_PROGRESS);
  private revision = 0;
  public get version(): number { return this.revision; }

  public load(): GameProgress {
    this.progress = structuredClone(DEFAULT_PROGRESS);
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('ashvale-progress-v2') ?? localStorage.getItem('ashvale-progress-v1');
      if (!raw) return this.snapshot;
      const candidate = object(JSON.parse(raw));
      if (![1, 2, 3].includes(Number(candidate.version))) return this.snapshot;
      const player = object(candidate.player);
      const buildings = object(candidate.buildings);
      const milestones = object(candidate.milestones);
      const selection = object(candidate.selection);
      const ids = new Set<string>();
      const unique = (value: unknown): ItemInstance | undefined => {
        const item = validateItem(value);
        if (!item || ids.has(item.id)) return;
        ids.add(item.id); return item;
      };
      const equipment: GameProgress['equipment'] = {};
      for (const slot of ['weapon', 'armor'] as const) {
        const item = validateItem(object(candidate.equipment)[slot]);
        if (item && ITEM_DEFINITIONS[item.kind].slot === slot) equipment[slot] = unique(item);
      }
      const inventory = Array.isArray(candidate.inventory) ? candidate.inventory.map(unique).filter((item): item is ItemInstance => !!item).slice(0, EQUIPMENT_CONFIG.capacity) : [];
      const classId = selection.classId ?? candidate.selectedClass;
      const skinId = selection.skinId ?? candidate.currentSkin;
      this.progress = {
        version: 3, inventory, equipment,
        milestones: { eliteKilled: milestones.eliteKilled === true, dungeonEntered: milestones.dungeonEntered === true, bossFirstKill: milestones.bossFirstKill === true },
        selection: { classId: ['warrior', 'archer', 'mage'].includes(String(classId)) ? classId as PlayerClassId : undefined, skinId: typeof skinId === 'string' ? skinId.slice(0, 80) : undefined },
        coins: finiteInt(candidate.coins, 0),
        buildings: { forge: buildings.forge === true, infirmary: buildings.infirmary === true },
        player: {
          level: finiteInt(player.level, 1, 1, 10000), xp: finiteInt(player.xp, 0),
          healthPotions: finiteInt(player.healthPotions, PLAYER_RESOURCES.initialPotionCount),
          manaPotions: finiteInt(player.manaPotions, PLAYER_RESOURCES.initialPotionCount),
          slimeKills: finiteInt(player.slimeKills, 0), spiderKills: finiteInt(player.spiderKills, 0),
        },
      };
      this.normalizeXp();
      if (candidate.version !== 3) this.persist();
    } catch (error) { console.warn('Local progress could not be loaded.', error); }
    this.revision += 1;
    return this.snapshot;
  }

  public addCoins(value: number): GameProgress {
    this.progress.coins = finiteInt(this.progress.coins + value, this.progress.coins);
    return this.persist();
  }
  public spendCoins(value: number): boolean {
    const cost = finiteInt(value, 0);
    if (cost === 0 || this.progress.coins < cost) return false;
    this.progress.coins -= cost; this.persist(); return true;
  }
  public restoreBuilding(building: 'forge' | 'infirmary', cost: number): boolean {
    if (this.progress.buildings[building] || this.progress.coins < cost) return false;
    this.progress.coins -= cost; this.progress.buildings[building] = true; this.persist(); return true;
  }
  public recordEnemyDefeat(kind: EnemyKind, multiplier = 1): DefeatResult {
    const killKey = kind === 'slime' ? 'slimeKills' : 'spiderKills';
    const before = this.progress.player[killKey];
    this.progress.player[killKey] += 1;
    const xpGained = XP_REWARDS[kind] * multiplier;
    this.progress.player.xp += xpGained;
    const oldLevel = this.progress.player.level;
    this.normalizeXp();
    const completedObjective = before < OBJECTIVE_TARGETS[kind] && this.progress.player[killKey] >= OBJECTIVE_TARGETS[kind] ? kind : undefined;
    return { xpGained, levelsGained: this.progress.player.level - oldLevel, completedObjective, progress: this.persist() };
  }
  public consumePotion(kind: 'health' | 'mana'): boolean {
    const key = kind === 'health' ? 'healthPotions' : 'manaPotions';
    if (this.progress.player[key] <= 0) return false;
    this.progress.player[key] -= 1; this.persist(); return true;
  }
  public pickup(item: ItemInstance): boolean {
    if (this.progress.inventory.length >= EQUIPMENT_CONFIG.capacity) return false;
    if ([...this.progress.inventory, ...Object.values(this.progress.equipment)].some(existing => existing.id === item.id)) return false;
    this.progress.inventory.push(structuredClone(item)); this.persist(); return true;
  }
  public equip(id: string, classId: PlayerClassId): 'ok' | 'wrong-class' | 'missing' {
    const index = this.progress.inventory.findIndex(item => item.id === id);
    if (index < 0) return 'missing';
    const item = this.progress.inventory[index];
    const definition = ITEM_DEFINITIONS[item.kind];
    if (definition.classId && definition.classId !== classId) return 'wrong-class';
    const old = this.progress.equipment[definition.slot];
    this.progress.inventory.splice(index, 1);
    if (old) this.progress.inventory.splice(index, 0, old);
    this.progress.equipment[definition.slot] = item;
    this.persist(); return 'ok';
  }
  public unequip(slot: EquipmentSlot): boolean {
    const item = this.progress.equipment[slot];
    if (!item || this.progress.inventory.length >= EQUIPMENT_CONFIG.capacity) return false;
    this.progress.inventory.push(item); delete this.progress.equipment[slot]; this.persist(); return true;
  }
  public select(classId: PlayerClassId, skinId: string): void {
    this.progress.selection = { classId, skinId }; this.persist();
  }
  public milestone(key: keyof GameProgress['milestones']): boolean {
    if (this.progress.milestones[key]) return false;
    this.progress.milestones[key] = true; this.persist(); return true;
  }
  public get snapshot(): GameProgress { return structuredClone(this.progress); }
  private persist(): GameProgress {
    this.revision += 1;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress)); }
    catch (error) { console.warn('Local progress could not be saved.', error); }
    return this.snapshot;
  }
  private normalizeXp(): void {
    while (this.progress.player.xp >= requiredXpForLevel(this.progress.player.level)) {
      this.progress.player.xp -= requiredXpForLevel(this.progress.player.level);
      this.progress.player.level += 1;
    }
  }
}
export const gameProgressService = new GameProgressService();
