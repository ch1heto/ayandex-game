export const DUNGEON_CONFIG = {
  entrance: { x: 3664, y: 520 }, roomStride: 896, roomLeft: 32, roomTop: 32, roomWidth: 768, roomHeight: 640,
  playerSpawn: { x: 170, y: 352 }, boss: { maxHealth: 580, scale: 2, xpMultiplier: 10, coins: 24, lungeDamage: 23, venomDamage: 11, zoneDamage: 7, lungeSpeed: 270, lungeWindupMs: 700, lungeDurationMs: 450, venomSpeed: 112, venomCount: 8, zoneRadius: 44, zoneTelegraphMs: 850, zoneLifetimeMs: 3000, zoneTickMs: 900 },
} as const;
export const DUNGEON_ENCOUNTERS = [
  { slimes: [[340, 270], [490, 430], [570, 280]], spiders: [] },
  { slimes: [[440, 240]], spiders: [[360, 380], [580, 440]] },
  { slimes: [[350, 270]], spiders: [[490, 420], [590, 290]], elite: 1 },
  { slimes: [], spiders: [], boss: true },
] as const;
