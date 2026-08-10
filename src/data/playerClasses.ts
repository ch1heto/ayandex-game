import type { AttackKind, PlayerClassId } from '../entities/player/playerTypes';

export type PlayerClassConfig = {
  id: PlayerClassId;
  label: string;
  accentColor: string;
  moveSpeed: number;
  maxHealth: number;
  attackKind: AttackKind;
  attackDamage: number;
  projectileSpeed?: number;
  projectileRange?: number;
};

export const PLAYER_CLASS_CONFIGS: Record<PlayerClassId, PlayerClassConfig> = {
  warrior: {
    id: 'warrior',
    label: 'WARRIOR',
    accentColor: '#7ca3d2',
    moveSpeed: 142,
    maxHealth: 120,
    attackKind: 'melee',
    attackDamage: 18,
  },
  archer: {
    id: 'archer',
    label: 'ARCHER',
    accentColor: '#8fc17f',
    moveSpeed: 152,
    maxHealth: 95,
    attackKind: 'arrow',
    attackDamage: 12,
    projectileSpeed: 350,
    projectileRange: 430,
  },
  mage: {
    id: 'mage',
    label: 'MAGE',
    accentColor: '#bb8ce4',
    moveSpeed: 145,
    maxHealth: 105,
    attackKind: 'magic',
    attackDamage: 14,
    projectileSpeed: 300,
    projectileRange: 390,
  },
};
