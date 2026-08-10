export type MossSlimeConfig = {
  maxHealth: number;
  moveSpeed: number;
  detectionRange: number;
  disengageRange: number;
  territoryRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  hurtDurationMs: number;
  knockbackSpeed: number;
  coinDropMin: number;
  coinDropMax: number;
  respawnDelayMinMs: number;
  respawnDelayMaxMs: number;
  respawnPlayerClearRadius: number;
};

export const MOSS_SLIME_CONFIG: MossSlimeConfig = {
  maxHealth: 48,
  moveSpeed: 48,
  detectionRange: 185,
  disengageRange: 285,
  territoryRange: 112,
  attackRange: 40,
  attackDamage: 12,
  attackCooldownMs: 1120,
  hurtDurationMs: 165,
  knockbackSpeed: 72,
  coinDropMin: 1,
  coinDropMax: 3,
  respawnDelayMinMs: 18_000,
  respawnDelayMaxMs: 26_000,
  respawnPlayerClearRadius: 120,
};
