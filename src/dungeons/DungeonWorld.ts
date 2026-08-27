import Phaser from 'phaser';
import mapUrl from '../../maps/ashen-catacombs.json?url';
import tilesUrl from '../../assets/tilesets/ashvale-world.png';
import type { AshvaleWorldRuntime, WorldCollisionRect } from '../world/AshvaleWorld';
import { DUNGEON_CONFIG } from '../data/dungeon';
export type DungeonWorld = AshvaleWorldRuntime & { gates: { body: Phaser.GameObjects.Zone; art: Phaser.GameObjects.Graphics }[] };
export function preloadDungeonWorld(scene: Phaser.Scene): void {
  scene.load.tilemapTiledJSON('ashen-catacombs', mapUrl); scene.load.image('ashvale-world-tiles', tilesUrl);
}
export function createDungeonWorld(scene: Phaser.Scene): DungeonWorld {
  const map = scene.make.tilemap({ key: 'ashen-catacombs' });
  const tiles = map.addTilesetImage('ashvale-world', 'ashvale-world-tiles');
  if (!tiles) throw new Error('Dungeon tileset missing');
  scene.textures.get('ashvale-world-tiles').setFilter(Phaser.Textures.FilterMode.NEAREST);
  const ground = map.createLayer('Ground', tiles, 0, 0, false);
  if (ground instanceof Phaser.Tilemaps.TilemapLayer) ground.setDepth(0).setTint(0x898799);
  map.createLayer('GroundDetails', tiles)?.setDepth(1).setAlpha(.48);
  const walls = map.createLayer('Walls', tiles, 0, 0, false);
  if (walls instanceof Phaser.Tilemaps.TilemapLayer) walls.setDepth(2).setTint(0x424558);
  const collisionGroup = scene.physics.add.staticGroup();
  const collisionRects: WorldCollisionRect[] = [];
  const addBody = (x: number, y: number, width: number, height: number) => {
    const body = scene.add.zone(x + width / 2, y + height / 2, width, height); scene.physics.add.existing(body, true); collisionGroup.add(body);
    collisionRects.push({ x, y, width, height }); return body;
  };
  map.getObjectLayer('Collision')?.objects.forEach(o => addBody(o.x ?? 0, o.y ?? 0, o.width ?? 32, o.height ?? 32));
  map.getObjectLayer('Props')?.objects.forEach(o => {
    const texture = (o.properties as { name: string; value: string }[])?.find(p => p.name === 'texture')?.value;
    if (texture) scene.add.image(o.x ?? 0, o.y ?? 0, texture).setOrigin(.5, 1).setDepth(Math.floor(o.y ?? 0)).setTint(0xb7a6cc);
  });
  const gates = (map.getObjectLayer('Doors')?.objects ?? []).map(o => {
    const x = o.x ?? 0, y = o.y ?? 0, width = o.width ?? 32, height = o.height ?? 128;
    const body = addBody(x, y, width, height);
    const art = scene.add.graphics().setDepth(Math.floor(y + height));
    art.fillStyle(0x1a1728).fillRect(x, y, width, height);
    for (let i = 0; i < height; i += 12) {
      art.fillStyle(0x74668d).fillRect(x + 4, y + i, 24, 5);
      art.fillStyle(0xc2a4dc).fillRect(x + 5, y + i, 3, 3);
    }
    return { body, art };
  });
  return { map, gates, collisionGroup, collisionRects, playerSpawn: { ...DUNGEON_CONFIG.playerSpawn }, slimeSpawns: [], spiderSpawns: [], width: map.widthInPixels, height: map.heightInPixels };
}
