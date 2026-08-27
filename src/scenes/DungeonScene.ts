import { GameScene } from './GameScene';
/** Shares the existing player/input/combat lifecycle, with its own Tiled world and encounter controller. */
export class DungeonScene extends GameScene {
  public constructor() { super(true); }
}
