import type { Direction } from './playerTypes';
import { PLAYER_CLASS_CONFIGS } from '../../data/playerClasses';

export const WARRIOR_SWORD_PHASE_COUNT = 4;
export const WARRIOR_SWORD_PHASE_MS = 82;
export const WARRIOR_SWORD_ATTACK_DURATION_MS = WARRIOR_SWORD_PHASE_COUNT * WARRIOR_SWORD_PHASE_MS;

// The same discrete angles are rasterized by build-warrior-sword-attack.py.
// Reach comes from the canonical Warrior gameplay config, never from a skin's
// visible weapon length.
export const WARRIOR_SWORD_ANGLES: Record<Direction, readonly number[]> = {
  down: [-110, -35, 20, 65],
  left: [-75, -135, 180, 140],
  up: [15, -30, -85, -125],
  right: [-105, -45, 0, 40],
};

const HAND_FROM_ROOT: Record<Direction, { x: number; y: number }> = {
  down: { x: -10, y: -23 },
  left: { x: 2, y: -24 },
  up: { x: 7, y: -25 },
  right: { x: 3, y: -24 },
};

export type WarriorSwordSweep = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
};

export function warriorSwordPhase(elapsedMs: number): number {
  return Math.min(WARRIOR_SWORD_PHASE_COUNT - 1, Math.floor(Math.max(0, elapsedMs) / WARRIOR_SWORD_PHASE_MS));
}

export function warriorSwordSweep(
  direction: Direction,
  rootX: number,
  rootY: number,
  phase: number,
): WarriorSwordSweep {
  const safePhase = Math.max(0, Math.min(WARRIOR_SWORD_PHASE_COUNT - 1, Math.floor(phase)));
  const hand = HAND_FROM_ROOT[direction];
  const angle = WARRIOR_SWORD_ANGLES[direction][safePhase] * Math.PI / 180;
  const startX = rootX + hand.x;
  const startY = rootY + hand.y;
  return {
    startX,
    startY,
    endX: startX + Math.cos(angle) * PLAYER_CLASS_CONFIGS.warrior.attackRange,
    endY: startY + Math.sin(angle) * PLAYER_CLASS_CONFIGS.warrior.attackRange,
    thickness: 10,
  };
}
