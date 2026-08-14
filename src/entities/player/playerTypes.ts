export const PLAYER_CLASS_IDS = ['warrior', 'archer', 'mage'] as const;
export type PlayerClassId = (typeof PLAYER_CLASS_IDS)[number];

export const DIRECTIONS = ['down', 'left', 'up', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type PlayerState = 'idle' | 'move' | 'attack';
export type AttackKind = 'melee' | 'arrow' | 'magic';

export type AttackImpact = {
  classId: PlayerClassId;
  kind: AttackKind;
  facing: Direction;
  aimX: number;
  aimY: number;
  targetX: number;
  targetY: number;
  rootX: number;
  rootY: number;
  releaseX?: number;
  releaseY?: number;
  meleePhase?: number;
  skillId?: string;
};
