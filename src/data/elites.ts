export const VOLATILE_CONFIG = { delayMs: 1000, radius: 62, damage: 18 } as const;
export type EliteAffix = 'swift' | 'brutal' | 'warden' | 'volatile';
export const ELITE_CONFIG = { spawnChance: .07, health: 2.2, damage: 1.3, xp: 3, coins: 2, scale: 1.14, affixes: ['swift', 'brutal', 'warden', 'volatile'] as const };
export const AFFIX_MULTIPLIERS: Record<EliteAffix, { health: number; damage: number; speed: number }> = {
  volatile: { health: 1, damage: 1, speed: 1 },
  swift: { health: 1, damage: 1, speed: 1.18 }, brutal: { health: 1, damage: 1.07, speed: 1 }, warden: { health: 1.12, damage: 1, speed: 1 },
};
export function rollElite(random = Math.random): EliteAffix | undefined {
  return random() < ELITE_CONFIG.spawnChance ? ELITE_CONFIG.affixes[Math.min(3, Math.floor(random() * 4))] : undefined;
}
export type EnemySpawnOptions = { respawn?: boolean; elites?: boolean };
export type EnemySpawnPoint = { x: number; y: number; elite?: EliteAffix };
