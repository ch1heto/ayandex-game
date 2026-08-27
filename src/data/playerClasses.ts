import type { AttackKind, PlayerClassId } from '../entities/player/playerTypes';

export type PlayerClassConfig = {
  id: PlayerClassId;
  label: string;
  accentColor: string;
  moveSpeed: number;
  maxHealth: number;
  attackKind: AttackKind;
  attackDamage: number;
  attackRange: number;
  projectileSpeed?: number;
  projectileRange?: number;
};

export const PLAYER_CLASS_CONFIGS: Record<PlayerClassId, PlayerClassConfig> = {
  warrior: {
    id: 'warrior',
    label: 'WARRIOR',
    accentColor: '#7ca3d2',
    moveSpeed: 142,
    maxHealth: 140,
    attackKind: 'melee',
    attackDamage: 20,
    attackRange: 42,
  },
  archer: {
    id: 'archer',
    label: 'ARCHER',
    accentColor: '#8fc17f',
    moveSpeed: 152,
    maxHealth: 95,
    attackKind: 'arrow',
    attackDamage: 12,
    attackRange: 430,
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
    attackRange: 390,
    projectileSpeed: 300,
    projectileRange: 390,
  },
};
