import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { yandexGamesService } from '../yandex/YandexGamesService';

export class MainMenuScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.MainMenu);
  }

  public create(): void {
    const title = this.add.text(320, 134, 'ASHVALE', {
      color: '#e8edf5',
      fontFamily: 'monospace',
      fontSize: '36px',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const start = this.add.text(320, 208, 'ENTER TWILIGHT GLADE', {
      color: '#9cc7a1',
      fontFamily: 'monospace',
      fontSize: '17px',
      backgroundColor: '#1e3240',
      padding: { x: 14, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.add.text(320, 290, 'WASD — MOVE/FACE   |   LMB — BASIC ATTACK   |   1/2/3 — CLASS', {
      color: '#8f9baa',
      fontFamily: 'monospace',
      fontSize: '12px',
    }).setOrigin(0.5);

    start.on(Phaser.Input.Events.POINTER_OVER, () => start.setColor('#ffffff'));
    start.on(Phaser.Input.Events.POINTER_OUT, () => start.setColor('#9cc7a1'));
    start.on(Phaser.Input.Events.POINTER_UP, () => this.startGame());
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());

    if (import.meta.env.DEV) {
      const artPreview = this.add.text(320, 250, 'ART PREVIEW (DEV)', {
        color: '#d7b86e',
        fontFamily: 'monospace',
        fontSize: '13px',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      artPreview.on(Phaser.Input.Events.POINTER_OVER, () => artPreview.setColor('#ffffff'));
      artPreview.on(Phaser.Input.Events.POINTER_OUT, () => artPreview.setColor('#d7b86e'));
      artPreview.on(Phaser.Input.Events.POINTER_UP, () => this.scene.start(SceneKey.ArtPreview));
      this.input.keyboard?.once('keydown-P', () => this.scene.start(SceneKey.ArtPreview));
    }

    yandexGamesService.markGameReady();
    title.setResolution(1);
  }

  private startGame(): void {
    this.scene.start(SceneKey.Game);
  }
}
