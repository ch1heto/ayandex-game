import Phaser from 'phaser';

import archerAttackUrl from '../../../assets/characters/classes/archer/attack.png';
import archerIdleUrl from '../../../assets/characters/classes/archer/idle.png';
import archerWalkUrl from '../../../assets/characters/classes/archer/walk.png';
import mageAttackUrl from '../../../assets/characters/classes/mage/attack.png';
import mageIdleUrl from '../../../assets/characters/classes/mage/idle.png';
import mageWalkUrl from '../../../assets/characters/classes/mage/walk.png';
import warriorAttackUrl from '../../../assets/characters/classes/warrior/attack.png';
import warriorIdleUrl from '../../../assets/characters/classes/warrior/idle.png';
import warriorWalkUrl from '../../../assets/characters/classes/warrior/walk.png';
import arrowUrl from '../../../assets/projectiles/arrow.png';
import magicBoltUrl from '../../../assets/projectiles/magic-bolt.png';
import { DIRECTIONS, PLAYER_CLASS_IDS, type Direction, type PlayerClassId } from './playerTypes';

export const CHARACTER_FRAME_SIZE = 64;
export const CHARACTER_ROOT_Y = 60 / CHARACTER_FRAME_SIZE;
export const DIRECTION_ROW: Record<Direction, number> = { down: 0, left: 1, up: 2, right: 3 };

const CHARACTER_URLS: Record<PlayerClassId, { idle: string; walk: string; attack: string }> = {
  warrior: { idle: warriorIdleUrl, walk: warriorWalkUrl, attack: warriorAttackUrl },
  archer: { idle: archerIdleUrl, walk: archerWalkUrl, attack: archerAttackUrl },
  mage: { idle: mageIdleUrl, walk: mageWalkUrl, attack: mageAttackUrl },
};

export function idleTextureKey(classId: PlayerClassId): string {
  return `${classId}-idle`;
}

export function walkAnimationKey(classId: PlayerClassId, direction: Direction): string {
  return `${classId}-walk-${direction}`;
}

export function attackAnimationKey(classId: PlayerClassId, direction: Direction): string {
  return `${classId}-attack-${direction}`;
}

export function idleFrame(direction: Direction): number {
  return DIRECTION_ROW[direction];
}

export function preloadCharacterAssets(scene: Phaser.Scene): void {
  PLAYER_CLASS_IDS.forEach((classId) => {
    const urls = CHARACTER_URLS[classId];
    scene.load.spritesheet(idleTextureKey(classId), urls.idle, { frameWidth: CHARACTER_FRAME_SIZE, frameHeight: CHARACTER_FRAME_SIZE });
    scene.load.spritesheet(`${classId}-walk`, urls.walk, { frameWidth: CHARACTER_FRAME_SIZE, frameHeight: CHARACTER_FRAME_SIZE });
    scene.load.spritesheet(`${classId}-attack`, urls.attack, { frameWidth: CHARACTER_FRAME_SIZE, frameHeight: CHARACTER_FRAME_SIZE });
  });
  scene.load.image('projectile-arrow', arrowUrl);
  scene.load.image('projectile-magic', magicBoltUrl);
}

export function registerCharacterAnimations(scene: Phaser.Scene): void {
  PLAYER_CLASS_IDS.forEach((classId) => {
    DIRECTIONS.forEach((direction) => {
      const row = DIRECTION_ROW[direction];
      createAnimation(scene, walkAnimationKey(classId, direction), `${classId}-walk`, row * 4, 4, 9, -1);
      createAnimation(scene, attackAnimationKey(classId, direction), `${classId}-attack`, row * 4, 4, 12, 0);
    });
  });
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  texture: string,
  start: number,
  count: number,
  frameRate: number,
  repeat: number,
): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(texture, { start, end: start + count - 1 }),
    frameRate,
    repeat,
  });
}
