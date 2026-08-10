import Phaser from 'phaser';

import attackUrl from '../../../assets/enemies/moss-slime/attack.png';
import deathUrl from '../../../assets/enemies/moss-slime/death.png';
import hurtUrl from '../../../assets/enemies/moss-slime/hurt.png';
import idleUrl from '../../../assets/enemies/moss-slime/idle.png';
import moveUrl from '../../../assets/enemies/moss-slime/move.png';

export const MOSS_SLIME_FRAME_SIZE = 64;
export const MOSS_SLIME_ROOT_Y = 58 / MOSS_SLIME_FRAME_SIZE;

export const MossSlimeAnimation = {
  Idle: 'moss-slime-idle',
  Move: 'moss-slime-move',
  Attack: 'moss-slime-attack',
  Hurt: 'moss-slime-hurt',
  Death: 'moss-slime-death',
} as const;

const SHEETS = {
  [MossSlimeAnimation.Idle]: { url: idleUrl, frames: 4, frameRate: 3, repeat: -1 },
  [MossSlimeAnimation.Move]: { url: moveUrl, frames: 4, frameRate: 8, repeat: -1 },
  [MossSlimeAnimation.Attack]: { url: attackUrl, frames: 4, frameRate: 10, repeat: 0 },
  [MossSlimeAnimation.Hurt]: { url: hurtUrl, frames: 2, frameRate: 10, repeat: 0 },
  [MossSlimeAnimation.Death]: { url: deathUrl, frames: 4, frameRate: 9, repeat: 0 },
};

export function preloadMossSlimeAssets(scene: Phaser.Scene): void {
  Object.entries(SHEETS).forEach(([key, sheet]) => {
    scene.load.spritesheet(key, sheet.url, { frameWidth: MOSS_SLIME_FRAME_SIZE, frameHeight: MOSS_SLIME_FRAME_SIZE });
  });
}

export function registerMossSlimeAnimations(scene: Phaser.Scene): void {
  Object.entries(SHEETS).forEach(([key, sheet]) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: sheet.frames - 1 }),
      frameRate: sheet.frameRate,
      repeat: sheet.repeat,
    });
  });
}
