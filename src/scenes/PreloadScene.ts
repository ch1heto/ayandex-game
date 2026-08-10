import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.Preload);
  }

  public create(): void {
    // Static production assets will be loaded here. The foundation deliberately
    // uses no final art assets yet.
    this.scene.start(SceneKey.MainMenu);
  }
}
