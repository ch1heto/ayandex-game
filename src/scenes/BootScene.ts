import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { yandexGamesService } from '../yandex/YandexGamesService';
import { gameProgressService } from '../systems/save/GameProgressService';
import { localizationService } from '../i18n/LocalizationService';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.Boot);
  }

  public create(): void {
    localizationService.load();
    const progress = gameProgressService.load();
    this.registry.set('coins', progress.coins);
    this.registry.set('forgeRestored', progress.buildings.forge);
    this.registry.set('infirmaryRestored', progress.buildings.infirmary);
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Ashvale', {
      color: '#e8edf5',
      fontFamily: 'monospace',
      fontSize: '22px',
    }).setOrigin(0.5);

    void yandexGamesService.initialize().finally(() => {
      this.scene.start(SceneKey.Preload);
    });
  }
}
