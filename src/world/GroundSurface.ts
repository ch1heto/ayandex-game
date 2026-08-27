import Phaser from 'phaser';
import atlasUrl from '../../assets/tilesets/ashvale-ground.png';
import worldUrl from '../../maps/ashvale-ground.json?url';
import dungeonUrl from '../../maps/catacombs-ground.json?url';

/** Prebuilt, tile-based presentation only. Authored map objects/collision stay authoritative. */
export function preloadGroundSurfaces(scene: Phaser.Scene): void {
  scene.load.image('ashvale-ground', atlasUrl);
  scene.load.tilemapTiledJSON('ashvale-ground-map', worldUrl);
  scene.load.tilemapTiledJSON('catacombs-ground-map', dungeonUrl);
}

export function createGroundSurface(scene: Phaser.Scene, dungeon = false): Phaser.Tilemaps.Tilemap {
  const map = scene.make.tilemap({ key: dungeon ? 'catacombs-ground-map' : 'ashvale-ground-map' });
  scene.textures.get('ashvale-ground').setFilter(Phaser.Textures.FilterMode.NEAREST);
  const tiles = map.addTilesetImage('ashvale-ground', 'ashvale-ground');
  if (!tiles || !map.createLayer('Ground', tiles)?.setDepth(0)) throw new Error('Ground surface is missing.');
  return map;
}
