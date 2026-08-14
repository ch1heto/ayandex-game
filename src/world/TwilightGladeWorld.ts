import Phaser from 'phaser';

import twilightGladeMapUrl from '../../maps/twilight-glade.json?url';
import bushAUrl from '../../assets/environments/twilight-glade/props/bush-a.png';
import bushBUrl from '../../assets/environments/twilight-glade/props/bush-b.png';
import fernUrl from '../../assets/environments/twilight-glade/props/fern.png';
import flowersGoldUrl from '../../assets/environments/twilight-glade/props/flowers-gold.png';
import flowersWhiteUrl from '../../assets/environments/twilight-glade/props/flowers-white.png';
import leafParticleUrl from '../../assets/environments/twilight-glade/leaf-particle.png';
import pondUrl from '../../assets/environments/twilight-glade/props/pond.png';
import rockAUrl from '../../assets/environments/twilight-glade/props/rock-a.png';
import rockBUrl from '../../assets/environments/twilight-glade/props/rock-b.png';
import sproutUrl from '../../assets/environments/twilight-glade/props/sprout.png';
import stumpUrl from '../../assets/environments/twilight-glade/props/stump.png';
import treeAUrl from '../../assets/environments/twilight-glade/props/tree-a.png';
import treeBUrl from '../../assets/environments/twilight-glade/props/tree-b.png';
import tilesetUrl from '../../assets/tilesets/twilight-glade.png';

const MAP_KEY = 'twilight-glade-map';
const TILESET_KEY = 'twilight-glade-tiles';
const TILESET_NAME = 'twilight-glade';

const PROP_URLS = {
  'glade-bush-a': bushAUrl,
  'glade-bush-b': bushBUrl,
  'glade-fern': fernUrl,
  'glade-flowers-gold': flowersGoldUrl,
  'glade-flowers-white': flowersWhiteUrl,
  'glade-pond': pondUrl,
  'glade-rock-a': rockAUrl,
  'glade-rock-b': rockBUrl,
  'glade-sprout': sproutUrl,
  'glade-stump': stumpUrl,
  'glade-tree-a': treeAUrl,
  'glade-tree-b': treeBUrl,
  'glade-leaf-particle': leafParticleUrl,
} as const;

const PROP_TEXTURE_KEYS: Record<string, keyof typeof PROP_URLS> = {
  'bush-a': 'glade-bush-a',
  'bush-b': 'glade-bush-b',
  fern: 'glade-fern',
  'flowers-gold': 'glade-flowers-gold',
  'flowers-white': 'glade-flowers-white',
  pond: 'glade-pond',
  'rock-a': 'glade-rock-a',
  'rock-b': 'glade-rock-b',
  sprout: 'glade-sprout',
  stump: 'glade-stump',
  'tree-a': 'glade-tree-a',
  'tree-b': 'glade-tree-b',
};

type TiledProperty = { name: string; value: unknown };

export type WorldCollisionRect = { x: number; y: number; width: number; height: number };
export type WorldSpawnPoint = { x: number; y: number };

export type TwilightGladeRuntime = {
  map: Phaser.Tilemaps.Tilemap;
  collisionGroup: Phaser.Physics.Arcade.StaticGroup;
  collisionRects: WorldCollisionRect[];
  playerSpawn: WorldSpawnPoint;
  slimeSpawns: WorldSpawnPoint[];
  width: number;
  height: number;
};

export function preloadTwilightGlade(scene: Phaser.Scene): void {
  scene.load.tilemapTiledJSON(MAP_KEY, twilightGladeMapUrl);
  scene.load.image(TILESET_KEY, tilesetUrl);
  Object.entries(PROP_URLS).forEach(([key, url]) => scene.load.image(key, url));
}

export function createTwilightGlade(scene: Phaser.Scene): TwilightGladeRuntime {
  const map = scene.make.tilemap({ key: MAP_KEY });
  const tileset = map.addTilesetImage(TILESET_NAME, TILESET_KEY);
  if (!tileset) throw new Error('Twilight Glade tileset could not be created.');

  const ground = map.createLayer('Ground', tileset, 0, 0);
  const paths = map.createLayer('Paths', tileset, 0, 0);
  if (!ground || !paths) throw new Error('Twilight Glade ground layers are missing.');
  [TILESET_KEY, ...Object.keys(PROP_URLS)].forEach((key) => {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
  ground.setDepth(0);
  paths.setDepth(1);

  const objectLayer = map.getObjectLayer('WorldObjects');
  objectLayer?.objects.forEach((object) => createProp(scene, object));

  const collisionGroup = scene.physics.add.staticGroup();
  const collisionRects: WorldCollisionRect[] = [];
  map.getObjectLayer('Collision')?.objects.forEach((object) => {
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
  map.getObjectLayer('Spawns')?.objects.forEach((object) => {
    const point = { x: object.x ?? 0, y: object.y ?? 0 };
    if (object.type === 'player-spawn') playerSpawn = point;
    if (object.type === 'moss-slime-spawn') slimeSpawns.push(point);
  });

  createLeafAtmosphere(scene, map.widthInPixels, map.heightInPixels);

  return {
    map,
    collisionGroup,
    collisionRects,
    playerSpawn,
    slimeSpawns,
    width: map.widthInPixels,
    height: map.heightInPixels,
  };
}

function createProp(scene: Phaser.Scene, object: Phaser.Types.Tilemaps.TiledObject): void {
  const textureName = readStringProperty(object, 'texture');
  const textureKey = textureName ? PROP_TEXTURE_KEYS[textureName] : undefined;
  if (!textureKey) return;
  const x = Math.round(object.x ?? 0);
  const y = Math.round(object.y ?? 0);
  const ground = readBooleanProperty(object, 'ground');
  const image = scene.add.image(x, y, textureKey);
  if (ground) {
    image.setOrigin(0.5).setDepth(1.5);
    return;
  }
  image.setOrigin(0.5, 1).setDepth(Math.floor(y));
}

function createLeafAtmosphere(scene: Phaser.Scene, width: number, height: number): void {
  const particles = scene.add.particles(0, 0, 'glade-leaf-particle', {
    x: { min: 24, max: width - 24 },
    y: { min: 24, max: height - 24 },
    speedX: { min: -7, max: 9 },
    speedY: { min: 3, max: 9 },
    lifespan: { min: 4200, max: 6500 },
    frequency: 920,
    quantity: 1,
    alpha: { start: 0.35, end: 0 },
    rotate: { min: -25, max: 25 },
  });
  particles.setDepth(2);
}

function readStringProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
  const properties = (object.properties ?? []) as TiledProperty[];
  const value = properties.find((property) => property.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

function readBooleanProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): boolean {
  const properties = (object.properties ?? []) as TiledProperty[];
  return properties.find((property) => property.name === name)?.value === true;
}
