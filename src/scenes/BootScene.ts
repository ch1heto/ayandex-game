import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { yandexGamesService } from '../yandex/YandexGamesService';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.Boot);
  }

  public create(): void {
    this.add.text(320, 180, 'Ashvale', {
      color: '#e8edf5',
      fontFamily: 'monospace',
      fontSize: '22px',
    }).setOrigin(0.5);

    void yandexGamesService.initialize().finally(() => {
      this.scene.start(SceneKey.Preload);
    });
  }
}
