export type GameProgress = {
  version: 1;
  coins: number;
  buildings: { forge: boolean; infirmary: boolean };
};

const STORAGE_KEY = 'ashvale-progress-v1';
const DEFAULT_PROGRESS: GameProgress = { version: 1, coins: 0, buildings: { forge: false, infirmary: false } };

export class GameProgressService {
  private progress: GameProgress = structuredClone(DEFAULT_PROGRESS);

  public load(): GameProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.snapshot;
      const candidate = JSON.parse(raw) as Partial<GameProgress>;
      if (candidate.version !== 1) return this.snapshot;
      this.progress = {
        version: 1,
        coins: Math.max(0, Math.floor(candidate.coins ?? 0)),
        buildings: {
          forge: candidate.buildings?.forge === true,
          infirmary: candidate.buildings?.infirmary === true,
        },
      };
    } catch (error) {
      console.warn('Local progress could not be loaded.', error);
    }
    return this.snapshot;
  }

  public addCoins(value: number): GameProgress {
    this.progress.coins = Math.max(0, this.progress.coins + Math.floor(value));
    return this.persist();
  }

  public spendCoins(value: number): boolean {
    const cost = Math.max(0, Math.floor(value));
    if (cost === 0 || this.progress.coins < cost) return false;
    this.progress.coins -= cost;
    this.persist();
    return true;
  }

  public restoreBuilding(building: 'forge' | 'infirmary', cost: number): boolean {
    if (this.progress.buildings[building] || this.progress.coins < cost) return false;
    this.progress.coins -= cost;
    this.progress.buildings[building] = true;
    this.persist();
    return true;
  }

  public get snapshot(): GameProgress { return structuredClone(this.progress); }

  private persist(): GameProgress {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress)); }
    catch (error) { console.warn('Local progress could not be saved.', error); }
    return this.snapshot;
  }
}

export const gameProgressService = new GameProgressService();
