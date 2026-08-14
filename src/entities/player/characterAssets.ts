import Phaser from 'phaser';

import arrowUrl from '../../../assets/projectiles/arrow.png';
import magicBoltUrl from '../../../assets/projectiles/magic-bolt.png';
import { GAMEPLAY_SKINS_BY_CLASS, getCharacterSkin, type SkinAnimationState } from '../../data/characterSkins';
import { DIRECTIONS, type Direction, type PlayerClassId } from './playerTypes';

export const DIRECTION_ROW: Record<Direction, number> = { down: 0, left: 1, up: 2, right: 3 };

export function characterTextureKey(skinId: string, state: SkinAnimationState): string {
  return `character-${skinId}-${state}`;
}

export function characterAnimationKey(skinId: string, state: 'walk' | 'attack', direction: Direction): string {
  return `character-${skinId}-${state}-${direction}`;
}

export function preloadCharacterAssets(scene: Phaser.Scene): void {
  Object.values(GAMEPLAY_SKINS_BY_CLASS).flat().forEach((skin) => {
    (Object.keys(skin.animations) as SkinAnimationState[]).forEach((state) => {
      const animation = skin.animations[state];
      scene.load.spritesheet(characterTextureKey(skin.id, state), animation.url, {
        frameWidth: animation.frameWidth,
        frameHeight: animation.frameHeight,
      });
    });
  });
  scene.load.image('projectile-arrow', arrowUrl);
  scene.load.image('projectile-magic', magicBoltUrl);
}

export function registerCharacterAnimations(scene: Phaser.Scene): void {
  Object.values(GAMEPLAY_SKINS_BY_CLASS).flat().forEach((skin) => {
    const directions: readonly Direction[] = skin.compatibility === 'SIDE_VIEW_ONLY' ? ['left', 'right'] : DIRECTIONS;
    directions.forEach((direction) => {
      const walk = skin.animations.walk;
      const attack = skin.animations.attack;
      const walkRow = walk.directionRows?.[direction];
      const attackRow = attack.directionRows?.[direction];
      const resolvedWalkRow = walkRow ?? 0;
      const resolvedAttackRow = attackRow ?? 0;
      createAnimation(scene, characterAnimationKey(skin.id, 'walk', direction), characterTextureKey(skin.id, 'walk'), resolvedWalkRow * walk.frames, walk.frames, walk.frameRate, -1);
      createAnimation(scene, characterAnimationKey(skin.id, 'attack', direction), characterTextureKey(skin.id, 'attack'), resolvedAttackRow * attack.frames, attack.frames, attack.frameRate, 0);
    });
  });
}

export function idleFrameForSkin(skinId: string, direction: Direction): number {
  const skin = getCharacterSkin(skinId);
  return (skin.animations.idle.directionRows?.[direction] ?? 0) * skin.animations.idle.frames;
}

export function firstGameplaySkin(classId: PlayerClassId): string | undefined {
  return GAMEPLAY_SKINS_BY_CLASS[classId][0]?.id;
}

function createAnimation(scene: Phaser.Scene, key: string, texture: string, start: number, count: number, frameRate: number, repeat: number): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(texture, { start, end: start + count - 1 }), frameRate, repeat });
}
