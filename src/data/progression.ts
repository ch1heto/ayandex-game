export type EnemyKind = 'slime' | 'spider';

export const XP_REWARDS: Readonly<Record<EnemyKind, number>> = { slime: 10, spider: 15 };
export const OBJECTIVE_TARGETS: Readonly<Record<EnemyKind, number>> = { slime: 5, spider: 3 };

export function requiredXpForLevel(level: number): number {
  return 100 + (Math.max(1, Math.floor(level)) - 1) * 50;
}
