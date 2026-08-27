import { OBJECTIVE_TARGETS, XP_REWARDS, requiredXpForLevel, type EnemyKind } from '../../data/progression';
import { PLAYER_RESOURCES } from '../../data/playerResources';
import { CLASS_WEAPONS, EQUIPMENT_CONFIG, ITEM_DEFINITIONS, ITEM_RARITIES, rollItem, type EquipmentSlot, type ItemInstance } from '../../data/equipment';
import { buyPrice, sellPrice, ECONOMY_CONFIG, type PotionKind } from '../../data/gameplayEconomy';
import { finiteInt, object, validateItem } from '../equipment/itemValidation';
import type { PlayerClassId } from '../../entities/player/playerTypes';

export type GameProgress = {
  version: 4;
  coins: number;
  buildings: { forge: boolean; infirmary: boolean };
  player: { level: number; xp: number; healthPotions: number; manaPotions: number; slimeKills: number; spiderKills: number };
  shop: { generation: number; stocks: Partial<Record<PlayerClassId, ItemInstance[]>>; receipts: string[] };
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipmentSlot, ItemInstance>>;
  milestones: { eliteKilled: boolean; dungeonEntered: boolean; bossFirstKill: boolean };
  selection: { classId?: PlayerClassId; skinId?: string };
};
export type DefeatResult = { xpGained: number; levelsGained: number; completedObjective?: EnemyKind; progress: GameProgress };
const STORAGE_KEY = 'ashvale-progress-v4';
const DEFAULT_PROGRESS: GameProgress = {
  version: 4, coins: 0, buildings: { forge: false, infirmary: false },
  player: { level: 1, xp: 0, healthPotions: PLAYER_RESOURCES.initialPotionCount, manaPotions: PLAYER_RESOURCES.initialPotionCount, slimeKills: 0, spiderKills: 0 },
  shop: { generation: 0, stocks: {}, receipts: [] }, inventory: [], equipment: {}, milestones: { eliteKilled: false, dungeonEntered: false, bossFirstKill: false }, selection: {},
};

export class GameProgressService {
  private progress: GameProgress = structuredClone(DEFAULT_PROGRESS);
  private revision = 0;
  public get version(): number { return this.revision; }

  public load(): GameProgress {
    this.progress = structuredClone(DEFAULT_PROGRESS);
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('ashvale-progress-v3') ?? localStorage.getItem('ashvale-progress-v2') ?? localStorage.getItem('ashvale-progress-v1');
      if (!raw) return this.snapshot;
      const candidate = object(JSON.parse(raw));
      if (![1, 2, 3, 4].includes(Number(candidate.version))) return this.snapshot;
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
      const shopInput = object(candidate.shop);
      const stocks: GameProgress['shop']['stocks'] = {};
      for (const owner of ['warrior', 'archer', 'mage'] as const) {
        const saved = object(shopInput.stocks)[owner];
        if (Array.isArray(saved)) stocks[owner] = saved.slice(0, 3).map(unique).filter((item): item is ItemInstance => !!item);
      }
      this.progress = {
        version: 4, inventory, equipment,
        shop: { generation: finiteInt(shopInput.generation, 0), stocks, receipts: Array.isArray(shopInput.receipts) ? shopInput.receipts.filter((v): v is string => typeof v === 'string' && v.length <= 80).slice(-64) : [] },
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
      if (candidate.version !== 4) this.persist();
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
    if (this.progress.player.level > oldLevel) this.invalidateShop();
    const completedObjective = before < OBJECTIVE_TARGETS[kind] && this.progress.player[killKey] >= OBJECTIVE_TARGETS[kind] ? kind : undefined;
    return { xpGained, levelsGained: this.progress.player.level - oldLevel, completedObjective, progress: this.persist() };
  }
  public ensureShop(classId: PlayerClassId): ItemInstance[] {
    if (!this.progress.buildings.forge) return [];
    if (!this.progress.shop.stocks[classId]) {
      const options = { classId, equipment: this.progress.equipment, forceRelevant: true };
      this.progress.shop.stocks[classId] = [CLASS_WEAPONS[classId], 'armor', undefined].map(kind => {
        const roll = Math.random();
        return rollItem(this.progress.player.level, 'normal', Math.random, { ...options,
          kind: kind as ItemInstance['kind'] | undefined, rarity: roll < ECONOMY_CONFIG.shopCommonChance ? 'common' : roll < ECONOMY_CONFIG.shopCommonChance + ECONOMY_CONFIG.shopUncommonChance ? 'uncommon' : 'rare',
          itemLevel: this.progress.player.level + (Math.random() < ECONOMY_CONFIG.shopHigherLevelChance ? 1 : 0) });
      });
      this.persist();
    }
    return structuredClone(this.progress.shop.stocks[classId]!);
  }
  public refreshShop(): void { this.invalidateShop(); this.persist(); }
  private invalidateShop(): void { this.progress.shop.generation += 1; this.progress.shop.stocks = {}; }
  public buyEquipment(id: string, classId: PlayerClassId): 'ok' | 'missing' | 'coins' | 'full' | 'locked' {
    if (!this.progress.buildings.forge) return 'locked';
    const stock = this.progress.shop.stocks[classId];
    const index = stock?.findIndex(item => item.id === id) ?? -1;
    if (!stock || index < 0) return 'missing';
    if (this.progress.inventory.length >= EQUIPMENT_CONFIG.capacity) return 'full';
    const item = stock[index], cost = buyPrice(item);
    if (this.progress.coins < cost) return 'coins';
    if ([...this.progress.inventory, ...Object.values(this.progress.equipment)].some(existing => existing.id === id)) return 'missing';
    stock.splice(index, 1); this.progress.inventory.push(item); this.progress.coins -= cost;
    this.persist(); return 'ok';
  }
  public buyPotion(kind: PotionKind, transactionId: string): 'ok' | 'coins' | 'duplicate' | 'locked' {
    if (!this.progress.buildings.forge) return 'locked';
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(transactionId) || this.progress.shop.receipts.includes(transactionId)) return 'duplicate';
    const cost = ECONOMY_CONFIG.potionPrices[kind];
    if (this.progress.coins < cost) return 'coins';
    const key = kind === 'health' ? 'healthPotions' : 'manaPotions';
    if (this.progress.player[key] >= 1000000) return 'duplicate';
    this.progress.player[key] += 1; this.progress.coins -= cost;
    this.progress.shop.receipts.push(transactionId); this.progress.shop.receipts = this.progress.shop.receipts.slice(-64);
    this.persist(); return 'ok';
  }
  public sellItem(id: string, confirmed = false): 'ok' | 'missing' | 'confirm' | 'locked' {
    if (!this.progress.buildings.forge) return 'locked';
    const index = this.progress.inventory.findIndex(item => item.id === id);
    if (index < 0) return 'missing';
    const item = this.progress.inventory[index];
    if (ITEM_RARITIES.indexOf(item.rarity) >= 2 && !confirmed) return 'confirm';
    this.progress.inventory.splice(index, 1); this.progress.coins = finiteInt(this.progress.coins + sellPrice(item), this.progress.coins);
    this.persist(); return 'ok';
  }
  public addPotion(kind: PotionKind): boolean {
    const key = kind === 'health' ? 'healthPotions' : 'manaPotions';
    if (this.progress.player[key] >= 1000000) return false;
    this.progress.player[key] += 1; this.persist(); return true;
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
