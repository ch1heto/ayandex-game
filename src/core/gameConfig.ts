import Phaser from 'phaser';

import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';

export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;
export const baseScenes = [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene];

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  parent: 'app',
  backgroundColor: '#10151e',
  pixelArt: true,
  antialias: false,
  antialiasGL: false,
  roundPixels: true,
  render: {
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: baseScenes,
};
