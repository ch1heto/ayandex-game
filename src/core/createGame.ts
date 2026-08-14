import Phaser from 'phaser';

import { baseScenes, gameConfig } from './gameConfig';

export async function createGame(parentId: string): Promise<Phaser.Game> {
  const container = document.getElementById(parentId);

  if (!container) {
    throw new Error(`Game container #${parentId} was not found.`);
  }

  container.addEventListener('contextmenu', (event) => event.preventDefault());

  const developmentScenes = import.meta.env.DEV
    ? [
        (await import('../scenes/SkinPreviewScene')).SkinPreviewScene,
      ]
    : [];

  return new Phaser.Game({
    ...gameConfig,
    parent: parentId,
    scene: [...baseScenes, ...developmentScenes],
  });
}
