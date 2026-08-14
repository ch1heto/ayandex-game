import Phaser from 'phaser';

import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';

const initialViewportWidth = Math.max(640, window.innerWidth);
const initialViewportHeight = Math.max(360, window.innerHeight);
export const baseScenes = [BootScene, PreloadScene, MainMenuScene, CharacterSelectScene, GameScene, UIScene];

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: initialViewportWidth,
  height: initialViewportHeight,
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
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: '100%',
    height: '100%',
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
