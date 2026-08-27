export type EliteAffix = 'swift' | 'brutal' | 'warden';
export const ELITE_CONFIG = { spawnChance: .07, health: 2.2, damage: 1.3, xp: 3, coins: 2, scale: 1.14, affixes: ['swift', 'brutal', 'warden'] as const };
export const AFFIX_MULTIPLIERS: Record<EliteAffix, { health: number; damage: number; speed: number }> = {
  swift: { health: 1, damage: 1, speed: 1.18 }, brutal: { health: 1, damage: 1.07, speed: 1 }, warden: { health: 1.12, damage: 1, speed: 1 },
};
export function rollElite(random = Math.random): EliteAffix | undefined {
  return random() < ELITE_CONFIG.spawnChance ? ELITE_CONFIG.affixes[Math.min(2, Math.floor(random() * 3))] : undefined;
}
export type EnemySpawnOptions = { respawn?: boolean; elites?: boolean };
export type EnemySpawnPoint = { x: number; y: number; elite?: EliteAffix };
