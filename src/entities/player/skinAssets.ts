import Phaser from 'phaser';

import { CHARACTER_SKINS, type SkinAnimationState } from '../../data/characterSkins';

export function skinTextureKey(skinId: string, state: SkinAnimationState): string {
  return `skin-${skinId}-${state}`;
}

export function skinAnimationKey(skinId: string, state: SkinAnimationState): string {
  return `skin-preview-${skinId}-${state}`;
}

export function preloadSkinPreviewAssets(scene: Phaser.Scene): void {
  CHARACTER_SKINS.filter((skin) => skin.runtimeStatus !== 'EXCLUDED').forEach((skin) => {
    (Object.keys(skin.animations) as SkinAnimationState[]).forEach((state) => {
      const animation = skin.animations[state];
      scene.load.spritesheet(skinTextureKey(skin.id, state), animation.url, {
        frameWidth: animation.frameWidth,
        frameHeight: animation.frameHeight,
      });
    });
  });
}

export function registerSkinPreviewAnimations(scene: Phaser.Scene): void {
  CHARACTER_SKINS.filter((skin) => skin.runtimeStatus !== 'EXCLUDED').forEach((skin) => {
    (Object.keys(skin.animations) as SkinAnimationState[]).forEach((state) => {
      const animation = skin.animations[state];
      const key = skinAnimationKey(skin.id, state);
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(skinTextureKey(skin.id, state), {
          start: 0,
          end: Math.max(0, animation.frames - 1),
        }),
        frameRate: animation.frameRate,
        repeat: -1,
        repeatDelay: state === 'attack' ? 260 : 0,
      });
    });
  });
}
