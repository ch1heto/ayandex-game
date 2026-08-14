import type { PlayerClassId } from '../entities/player/playerTypes';

import originalWarriorIdleUrl from '../../assets/characters/classes/warrior/idle.png';
import originalWarriorWalkUrl from '../../assets/characters/classes/warrior/walk.png';
import originalWarriorAttackUrl from '../../assets/characters/classes/warrior/attack.png';
import originalArcherIdleUrl from '../../assets/characters/classes/archer/idle.png';
import originalArcherWalkUrl from '../../assets/characters/classes/archer/walk.png';
import originalArcherAttackUrl from '../../assets/characters/classes/archer/attack.png';
import originalMageIdleUrl from '../../assets/characters/classes/mage/idle.png';
import originalMageWalkUrl from '../../assets/characters/classes/mage/walk.png';
import originalMageAttackUrl from '../../assets/characters/classes/mage/attack.png';

import sushiIdleUrl from '../../assets/characters/skins/warrior/sushi-warrior/preview-idle.png';
import sushiWalkUrl from '../../assets/characters/skins/warrior/sushi-warrior/preview-walk.png';
import sushiAttackUrl from '../../assets/characters/skins/warrior/sushi-warrior/preview-attack.png';
import skeletonIdleUrl from '../../assets/characters/skins/warrior/skeleton-warrior/preview-idle.png';
import skeletonWalkUrl from '../../assets/characters/skins/warrior/skeleton-warrior/preview-walk.png';
import skeletonAttackUrl from '../../assets/characters/skins/warrior/skeleton-warrior/preview-attack.png';
import redIdleUrl from '../../assets/characters/skins/warrior/red-reaper/preview-idle.png';
import redWalkUrl from '../../assets/characters/skins/warrior/red-reaper/preview-walk.png';
import redAttackUrl from '../../assets/characters/skins/warrior/red-reaper/preview-attack.png';
import archerHeroIdleUrl from '../../assets/characters/skins/archer/archer-hero/preview-idle.png';
import archerHeroWalkUrl from '../../assets/characters/skins/archer/archer-hero/preview-walk.png';
import archerHeroAttackUrl from '../../assets/characters/skins/archer/archer-hero/preview-attack.png';
import littleMageIdleUrl from '../../assets/characters/skins/mage/little-mage/preview-idle.png';
import littleMageWalkUrl from '../../assets/characters/skins/mage/little-mage/preview-walk.png';
import littleMageAttackUrl from '../../assets/characters/skins/mage/little-mage/preview-attack.png';

export type SkinCompatibility = 'FULL_4DIR' | 'PARTIAL' | 'SIDE_VIEW_ONLY';
export type SkinRuntimeStatus = 'PORTRAIT_ONLY' | 'GAMEPLAY' | 'PREVIEW_ONLY' | 'EXCLUDED';
export type SkinAnimationState = 'idle' | 'walk' | 'attack';

export type SkinAnimationConfig = {
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
  rootX?: number;
  baseline?: number;
  releaseFrame?: number;
  directionRows?: Partial<Record<'down' | 'left' | 'up' | 'right', number>>;
};

export type CharacterSkinConfig = {
  id: string;
  classId: PlayerClassId;
  displayName: string;
  sourcePack: string;
  displayScale: number;
  origin: { x: number; y: number };
  baseline: number;
  visualCenterX: number;
  attackImpactFrame: number;
  supportedDirections: readonly ('down' | 'left' | 'up' | 'right')[];
  compatibility: SkinCompatibility;
  runtimeStatus: SkinRuntimeStatus;
  animations: Record<SkinAnimationState, SkinAnimationConfig>;
};

const original = (
  classId: PlayerClassId,
  urls: Record<SkinAnimationState, string>,
): CharacterSkinConfig => ({
  id: `original-${classId}`,
  classId,
  displayName: `Original ${classId[0].toUpperCase()}${classId.slice(1)}`,
  sourcePack: 'Ashvale original class assets',
  displayScale: 1,
  origin: { x: 0.5, y: 60 / 64 },
  baseline: 60,
  visualCenterX: 32,
  attackImpactFrame: 2,
  supportedDirections: ['down', 'left', 'up', 'right'],
  compatibility: 'FULL_4DIR',
  runtimeStatus: 'PORTRAIT_ONLY',
  animations: {
    idle: { url: urls.idle, frameWidth: 64, frameHeight: 64, frames: 1, frameRate: 1, directionRows: { down: 0, left: 1, up: 2, right: 3 } },
    walk: { url: urls.walk, frameWidth: 64, frameHeight: 64, frames: 4, frameRate: 9, directionRows: { down: 0, left: 1, up: 2, right: 3 } },
    attack: { url: urls.attack, frameWidth: 64, frameHeight: 64, frames: 4, frameRate: 12, directionRows: { down: 0, left: 1, up: 2, right: 3 } },
  },
});

const sideView = (
  id: string,
  classId: PlayerClassId,
  displayName: string,
  sourcePack: string,
  scale: number,
  originY: number,
  configs: Record<SkinAnimationState, Omit<SkinAnimationConfig, 'directionRows'>>,
  geometry: Partial<Pick<CharacterSkinConfig, 'baseline' | 'visualCenterX' | 'attackImpactFrame'>> = {},
): CharacterSkinConfig => ({
  id,
  classId,
  displayName,
  sourcePack,
  displayScale: scale,
  origin: {
    x: (geometry.visualCenterX ?? configs.idle.frameWidth / 2) / configs.idle.frameWidth,
    y: (geometry.baseline ?? Math.round(configs.idle.frameHeight * originY)) / configs.idle.frameHeight,
  },
  baseline: geometry.baseline ?? Math.round(configs.idle.frameHeight * originY),
  visualCenterX: geometry.visualCenterX ?? configs.idle.frameWidth / 2,
  attackImpactFrame: geometry.attackImpactFrame ?? Math.min(2, configs.attack.frames - 1),
  supportedDirections: ['left', 'right'],
  compatibility: 'SIDE_VIEW_ONLY',
  runtimeStatus: 'GAMEPLAY',
  animations: configs,
});

export const CHARACTER_SKINS: readonly CharacterSkinConfig[] = [
  original('warrior', { idle: originalWarriorIdleUrl, walk: originalWarriorWalkUrl, attack: originalWarriorAttackUrl }),
  sideView('sushi-warrior', 'warrior', 'Sushi Warrior', 'SushiWarrior.zip', 0.72, 0.92, {
    idle: { url: sushiIdleUrl, frameWidth: 128, frameHeight: 64, frames: 4, frameRate: 7 },
    walk: { url: sushiWalkUrl, frameWidth: 128, frameHeight: 64, frames: 4, frameRate: 9 },
    attack: { url: sushiAttackUrl, frameWidth: 128, frameHeight: 64, frames: 6, frameRate: 10 },
  }, { visualCenterX: 32, baseline: 59, attackImpactFrame: 3 }),
  sideView('skeleton-warrior', 'warrior', 'Skeleton Warrior', 'SkeletonWarrior.zip', 1.5, 0.9, {
    idle: { url: skeletonIdleUrl, frameWidth: 96, frameHeight: 96, frames: 4, frameRate: 7 },
    walk: { url: skeletonWalkUrl, frameWidth: 96, frameHeight: 96, frames: 8, frameRate: 9 },
    attack: { url: skeletonAttackUrl, frameWidth: 96, frameHeight: 96, frames: 8, frameRate: 10 },
  }, { visualCenterX: 43, baseline: 61, attackImpactFrame: 3 }),
  sideView('red-reaper', 'warrior', 'Red Reaper Sample', 'Free Sample.zip', 1, 0.9, {
    idle: { url: redIdleUrl, frameWidth: 64, frameHeight: 64, frames: 4, frameRate: 7 },
    walk: { url: redWalkUrl, frameWidth: 64, frameHeight: 64, frames: 9, frameRate: 10 },
    attack: { url: redAttackUrl, frameWidth: 64, frameHeight: 64, frames: 8, frameRate: 10 },
  }, { visualCenterX: 32, baseline: 64, attackImpactFrame: 4 }),
  original('archer', { idle: originalArcherIdleUrl, walk: originalArcherWalkUrl, attack: originalArcherAttackUrl }),
  sideView('archer-hero', 'archer', 'Archer Hero', 'ArcherHero.zip', 1, 0.92, {
    idle: { url: archerHeroIdleUrl, frameWidth: 64, frameHeight: 64, frames: 2, frameRate: 6 },
    walk: { url: archerHeroWalkUrl, frameWidth: 64, frameHeight: 64, frames: 8, frameRate: 10 },
    // Frames 4–5 are the fully-drawn hold. Frame 6 is the first visual release.
    attack: { url: archerHeroAttackUrl, frameWidth: 64, frameHeight: 64, frames: 8, frameRate: 10, releaseFrame: 6 },
  }, { visualCenterX: 32, baseline: 53, attackImpactFrame: 5 }),
  original('mage', { idle: originalMageIdleUrl, walk: originalMageWalkUrl, attack: originalMageAttackUrl }),
  sideView('little-mage', 'mage', 'Little Mage', 'Little Mage1-1.zip', 2, 0.94, {
    idle: { url: littleMageIdleUrl, frameWidth: 16, frameHeight: 16, frames: 6, frameRate: 7, rootX: 7, baseline: 16 },
    walk: { url: littleMageWalkUrl, frameWidth: 16, frameHeight: 16, frames: 6, frameRate: 9, rootX: 7, baseline: 16 },
    attack: { url: littleMageAttackUrl, frameWidth: 32, frameHeight: 32, frames: 6, frameRate: 10, rootX: 11, baseline: 32 },
  }, { visualCenterX: 7, baseline: 16, attackImpactFrame: 2 }),
] as const;

export const SKINS_BY_CLASS: Record<PlayerClassId, readonly CharacterSkinConfig[]> = {
  warrior: CHARACTER_SKINS.filter((skin) => skin.classId === 'warrior' && skin.runtimeStatus === 'GAMEPLAY'),
  archer: CHARACTER_SKINS.filter((skin) => skin.classId === 'archer' && skin.runtimeStatus === 'GAMEPLAY'),
  mage: CHARACTER_SKINS.filter((skin) => skin.classId === 'mage' && skin.runtimeStatus === 'GAMEPLAY'),
};

export const PORTRAIT_SKIN_BY_CLASS: Record<PlayerClassId, string> = {
  warrior: 'original-warrior', archer: 'original-archer', mage: 'original-mage',
};

export const GAMEPLAY_SKINS_BY_CLASS: Record<PlayerClassId, readonly CharacterSkinConfig[]> = {
  warrior: CHARACTER_SKINS.filter((skin) => skin.classId === 'warrior' && skin.runtimeStatus === 'GAMEPLAY'),
  archer: CHARACTER_SKINS.filter((skin) => skin.classId === 'archer' && skin.runtimeStatus === 'GAMEPLAY'),
  mage: CHARACTER_SKINS.filter((skin) => skin.classId === 'mage' && skin.runtimeStatus === 'GAMEPLAY'),
};

export function getCharacterSkin(skinId: string): CharacterSkinConfig {
  const skin = CHARACTER_SKINS.find((candidate) => candidate.id === skinId);
  if (!skin) throw new Error(`Unknown character skin: ${skinId}`);
  return skin;
}

export function isGameplaySkinForClass(skinId: string, classId: PlayerClassId): boolean {
  const skin = CHARACTER_SKINS.find((candidate) => candidate.id === skinId);
  return skin?.classId === classId && skin.runtimeStatus === 'GAMEPLAY';
}
