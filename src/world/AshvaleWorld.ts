import Phaser from 'phaser';
import { preloadGroundSurfaces, createGroundSurface } from './GroundSurface';

import worldMapUrl from '../../maps/ashvale-world.json?url';
import worldTilesUrl from '../../assets/tilesets/ashvale-world.png';
import leafParticleUrl from '../../assets/environments/twilight-glade/leaf-particle.png';
import bushAUrl from '../../assets/environments/twilight-glade/props/bush-a.png';
import bushBUrl from '../../assets/environments/twilight-glade/props/bush-b.png';
import fernUrl from '../../assets/environments/twilight-glade/props/fern.png';
import flowersGoldUrl from '../../assets/environments/twilight-glade/props/flowers-gold.png';
import flowersWhiteUrl from '../../assets/environments/twilight-glade/props/flowers-white.png';
import rockAUrl from '../../assets/environments/twilight-glade/props/rock-a.png';
import rockBUrl from '../../assets/environments/twilight-glade/props/rock-b.png';
import sproutUrl from '../../assets/environments/twilight-glade/props/sprout.png';
import stumpUrl from '../../assets/environments/twilight-glade/props/stump.png';
import treeAUrl from '../../assets/environments/twilight-glade/props/tree-a.png';
import treeBUrl from '../../assets/environments/twilight-glade/props/tree-b.png';
import burntStumpUrl from '../../assets/environments/spider-hollow/props/burnt-stump.png';
import deadTreeUrl from '../../assets/environments/spider-hollow/props/dead-tree.png';
import emberPlantUrl from '../../assets/environments/spider-hollow/props/ember-plant.png';
import emberRockAUrl from '../../assets/environments/spider-hollow/props/ember-rock-a.png';
import emberRockBUrl from '../../assets/environments/spider-hollow/props/ember-rock-b.png';
import thornBushUrl from '../../assets/environments/spider-hollow/props/thorn-bush.png';
import webLargeUrl from '../../assets/environments/spider-hollow/props/web-large.png';
import webSmallUrl from '../../assets/environments/spider-hollow/props/web-small.png';

const MAP_KEY = 'ashvale-world-map';
const TILESET_KEY = 'ashvale-world-tiles';
const TILESET_NAME = 'ashvale-world';

const PROP_URLS = {
  'world-bush-a': bushAUrl,
  'world-bush-b': bushBUrl,
  'world-fern': fernUrl,
  'world-flowers-gold': flowersGoldUrl,
  'world-flowers-white': flowersWhiteUrl,
  'world-rock-a': rockAUrl,
  'world-rock-b': rockBUrl,
  'world-sprout': sproutUrl,
  'world-stump': stumpUrl,
  'world-tree-a': treeAUrl,
  'world-tree-b': treeBUrl,
  'world-burnt-stump': burntStumpUrl,
  'world-dead-tree': deadTreeUrl,
  'world-ember-plant': emberPlantUrl,
  'world-ember-rock-a': emberRockAUrl,
  'world-ember-rock-b': emberRockBUrl,
  'world-thorn-bush': thornBushUrl,
  'world-web-large': webLargeUrl,
  'world-web-small': webSmallUrl,
  'world-leaf-particle': leafParticleUrl,
} as const;

const PROP_TEXTURE_KEYS: Record<string, keyof typeof PROP_URLS> = {
  'bush-a': 'world-bush-a',
  'bush-b': 'world-bush-b',
  fern: 'world-fern',
  'flowers-gold': 'world-flowers-gold',
  'flowers-white': 'world-flowers-white',
  'rock-a': 'world-rock-a',
  'rock-b': 'world-rock-b',
  sprout: 'world-sprout',
  stump: 'world-stump',
  'tree-a': 'world-tree-a',
  'tree-b': 'world-tree-b',
  'burnt-stump': 'world-burnt-stump',
  'dead-tree': 'world-dead-tree',
  'ember-plant': 'world-ember-plant',
  'ember-rock-a': 'world-ember-rock-a',
  'ember-rock-b': 'world-ember-rock-b',
  'thorn-bush': 'world-thorn-bush',
  'web-large': 'world-web-large',
  'web-small': 'world-web-small',
};

type PropCollisionPart = { offsetX: number; offsetY: number; width: number; height: number };
type PropCollisionProfile = { parts: readonly PropCollisionPart[] };

export const PROP_COLLISION_PROFILES: Readonly<Record<string, PropCollisionProfile>> = {
  'rock-a': {
    parts: [
      { offsetX: 0, offsetY: -21, width: 64, height: 36 },
      { offsetX: 0, offsetY: -43, width: 46, height: 18 },
      { offsetX: 0, offsetY: -6, width: 56, height: 12 },
    ],
  },
  'rock-b': {
    parts: [
      { offsetX: 0, offsetY: -18, width: 66, height: 30 },
      { offsetX: 0, offsetY: -36, width: 50, height: 14 },
      { offsetX: 0, offsetY: -5, width: 60, height: 10 },
    ],
  },
  'ember-rock-a': {
    parts: [
      { offsetX: 0, offsetY: -23, width: 56, height: 42 },
      { offsetX: 0, offsetY: -54, width: 36, height: 26 },
      { offsetX: 0, offsetY: -6, width: 58, height: 12 },
    ],
  },
  'ember-rock-b': {
    parts: [
      { offsetX: 0, offsetY: -23, width: 64, height: 42 },
      { offsetX: 0, offsetY: -52, width: 46, height: 24 },
      { offsetX: 0, offsetY: -5, width: 58, height: 10 },
    ],
  },
};

type TiledProperty = { name: string; value: unknown };
export type WorldCollisionRect = { x: number; y: number; width: number; height: number };
export type WorldSpawnPoint = { x: number; y: number };

export type AshvaleWorldRuntime = {
  map: Phaser.Tilemaps.Tilemap;
  groundMap?: Phaser.Tilemaps.Tilemap;
  collisionGroup: Phaser.Physics.Arcade.StaticGroup;
  collisionRects: WorldCollisionRect[];
  playerSpawn: WorldSpawnPoint;
  slimeSpawns: WorldSpawnPoint[];
  spiderSpawns: WorldSpawnPoint[];
  width: number;
  height: number;
};

export function preloadAshvaleWorld(scene: Phaser.Scene): void {
  preloadGroundSurfaces(scene);
  scene.load.tilemapTiledJSON(MAP_KEY, worldMapUrl);
  scene.load.image(TILESET_KEY, worldTilesUrl);
  Object.entries(PROP_URLS).forEach(([key, url]) => scene.load.image(key, url));
}

export function createAshvaleWorld(scene: Phaser.Scene): AshvaleWorldRuntime {
  const map = scene.make.tilemap({ key: MAP_KEY });
  const tileset = map.addTilesetImage(TILESET_NAME, TILESET_KEY);
  if (!tileset) throw new Error('Ashvale world tileset could not be created.');
  const groundMap = createGroundSurface(scene);

  [TILESET_KEY, ...Object.keys(PROP_URLS)].forEach((key) => {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
  const collisionGroup = scene.physics.add.staticGroup();
  const collisionRects: WorldCollisionRect[] = [];
  map.getObjectLayer('WorldObjects')?.objects.forEach((object) => {
    createProp(scene, object, collisionGroup, collisionRects);
  });
  map.getObjectLayer('Collision')?.objects.forEach((object) => {
    if (isLegacyRockCollision(object)) return;
    const width = object.width ?? 0;
    const height = object.height ?? 0;
    const x = object.x ?? 0;
    const y = object.y ?? 0;
    if (width <= 0 || height <= 0) return;
    const zone = scene.add.zone(x + width / 2, y + height / 2, width, height);
    scene.physics.add.existing(zone, true);
    collisionGroup.add(zone);
    collisionRects.push({ x, y, width, height });
  });

  let playerSpawn: WorldSpawnPoint = { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
  const slimeSpawns: WorldSpawnPoint[] = [];
  const spiderSpawns: WorldSpawnPoint[] = [];
  map.getObjectLayer('Spawns')?.objects.forEach((object) => {
    const point = { x: Math.round(object.x ?? 0), y: Math.round(object.y ?? 0) };
    if (object.type === 'player-spawn') playerSpawn = point;
    if (object.type === 'moss-slime-spawn') slimeSpawns.push(point);
    if (object.type === 'ember-spider-spawn') spiderSpawns.push(point);
  });

  const leaves = scene.add.particles(0, 0, 'world-leaf-particle', {
    x: { min: 40, max: 1300 }, y: { min: 40, max: map.heightInPixels - 40 },
    speedX: { min: -5, max: 8 }, speedY: { min: 3, max: 8 },
    lifespan: { min: 4200, max: 6200 }, frequency: 1050, quantity: 1,
    alpha: { start: .28, end: 0 }, rotate: { min: -25, max: 25 },
  });
  leaves.setDepth(2);

  return {
    map, groundMap, collisionGroup, collisionRects, playerSpawn, slimeSpawns, spiderSpawns,
    width: map.widthInPixels, height: map.heightInPixels,
  };
}

function createProp(
  scene: Phaser.Scene,
  object: Phaser.Types.Tilemaps.TiledObject,
  collisionGroup: Phaser.Physics.Arcade.StaticGroup,
  collisionRects: WorldCollisionRect[],
): void {
  const textureName = readStringProperty(object, 'texture');
  const textureKey = textureName ? PROP_TEXTURE_KEYS[textureName] : undefined;
  if (!textureKey) return;
  const x = Math.round(object.x ?? 0);
  const y = Math.round(object.y ?? 0);
  scene.add.image(x, y, textureKey).setOrigin(.5, 1).setDepth(Math.floor(y));
  const profile = textureName ? PROP_COLLISION_PROFILES[textureName] : undefined;
  profile?.parts.forEach((part) => {
    const centerX = x + part.offsetX;
    const centerY = y + part.offsetY;
    const zone = scene.add.zone(centerX, centerY, part.width, part.height);
    scene.physics.add.existing(zone, true);
    collisionGroup.add(zone);
    collisionRects.push({
      x: centerX - part.width / 2,
      y: centerY - part.height / 2,
      width: part.width,
      height: part.height,
    });
  });
}

function isLegacyRockCollision(object: Phaser.Types.Tilemaps.TiledObject): boolean {
  const name = object.name ?? '';
  return Object.keys(PROP_COLLISION_PROFILES).some((textureName) => (
    name.includes(`${textureName}-`) && name.endsWith('-footprint')
  ));
}

function readStringProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
  const properties = (object.properties ?? []) as TiledProperty[];
  const value = properties.find((property) => property.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}
