import Phaser from 'phaser';

import tilesUrl from '../../assets/tilesets/spider-hollow.png';
import rockAUrl from '../../assets/environments/spider-hollow/props/ember-rock-a.png';
import rockBUrl from '../../assets/environments/spider-hollow/props/ember-rock-b.png';
import treeUrl from '../../assets/environments/spider-hollow/props/dead-tree.png';
import bushUrl from '../../assets/environments/spider-hollow/props/thorn-bush.png';
import webLargeUrl from '../../assets/environments/spider-hollow/props/web-large.png';
import webSmallUrl from '../../assets/environments/spider-hollow/props/web-small.png';
import stumpUrl from '../../assets/environments/spider-hollow/props/burnt-stump.png';
import plantUrl from '../../assets/environments/spider-hollow/props/ember-plant.png';
import { SceneKey } from '../core/sceneKeys';
import { setCanvasPixelArt } from '../core/canvasRendering';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { isGameplaySkinForClass } from '../data/characterSkins';
import { PLAYER_CLASS_IDS, type AttackImpact, type PlayerClassId } from '../entities/player/playerTypes';
import { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { preloadCharacterAssets, registerCharacterAnimations } from '../entities/player/characterAssets';
import { preloadEmberSpiderAssets, registerEmberSpiderAnimations } from '../entities/enemies/emberSpiderAssets';
import { EmberSpiderSpawner } from '../entities/enemies/EmberSpiderSpawner';
import { preloadCoinAssets, registerCoinAnimations, CoinDropSystem } from '../systems/loot/CoinDropSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { warriorSwordSweep } from '../entities/player/warriorSwordAttack';
import { gameProgressService } from '../systems/save/GameProgressService';

const WORLD_WIDTH = 1280; const WORLD_HEIGHT = 704;
const TEXTURES = { tiles: 'spider-zone-tiles', rockA: 'spider-rock-a', rockB: 'spider-rock-b', tree: 'spider-tree', bush: 'spider-bush', webLarge: 'spider-web-large', webSmall: 'spider-web-small', stump: 'spider-stump', plant: 'spider-plant' } as const;

export class SpiderZoneScene extends Phaser.Scene {
  private player!: PlayerCharacter; private spiders!: EmberSpiderSpawner; private drops!: CoinDropSystem; private projectiles!: ProjectileSystem; private collisions!: Phaser.Physics.Arcade.StaticGroup;
  private upKey!: Phaser.Input.Keyboard.Key; private downKey!: Phaser.Input.Keyboard.Key; private leftKey!: Phaser.Input.Keyboard.Key; private rightKey!: Phaser.Input.Keyboard.Key;
  public constructor() { super(SceneKey.SpiderZone); }
  public preload(): void { preloadCharacterAssets(this); preloadEmberSpiderAssets(this); preloadCoinAssets(this); this.load.spritesheet(TEXTURES.tiles, tilesUrl, { frameWidth: 32, frameHeight: 32 }); Object.entries({ rockA: rockAUrl, rockB: rockBUrl, tree: treeUrl, bush: bushUrl, webLarge: webLargeUrl, webSmall: webSmallUrl, stump: stumpUrl, plant: plantUrl }).forEach(([key, url]) => this.load.image(TEXTURES[key as keyof typeof TEXTURES], url)); }
  public create(): void {
    setCanvasPixelArt(this.game, true); registerCharacterAnimations(this); registerEmberSpiderAnimations(this); registerCoinAnimations(this); this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT); this.drawWorld();
    const classId = this.registry.get('selectedClass') as PlayerClassId; const skinId = this.registry.get('selectedSkin'); if (!PLAYER_CLASS_IDS.includes(classId) || typeof skinId !== 'string' || !isGameplaySkinForClass(skinId, classId)) { this.scene.start(SceneKey.CharacterSelect); return; }
    this.player = new PlayerCharacter(this, 120, 352, classId, skinId, this.attackImpact, this.healthChanged); this.projectiles = new ProjectileSystem(this); this.drops = new CoinDropSystem(this, this.player.physicsRoot, this.pickupCoin);
    this.spiders = new EmberSpiderSpawner(this, [{ x: 390, y: 210 }, { x: 590, y: 410 }, { x: 790, y: 235 }, { x: 930, y: 515 }, { x: 1090, y: 320 }], this.player, this.drops);
    this.physics.add.collider(this.player.physicsRoot, this.collisions); this.physics.add.collider(this.player.physicsRoot, this.spiders.group); this.physics.add.collider(this.spiders.group, this.collisions);
    const keyboard = this.input.keyboard!; this.upKey = keyboard.addKey('W'); this.downKey = keyboard.addKey('S'); this.leftKey = keyboard.addKey('A'); this.rightKey = keyboard.addKey('D'); keyboard.on('keydown-F', this.returnToHub, this); this.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerDown, this);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).startFollow(this.player.visual, true, 1, 1).setRoundPixels(true).setBackgroundColor('#161310'); this.registry.set('activeClass', classId); this.registry.set('activeSkin', skinId); this.registry.set('coins', gameProgressService.snapshot.coins); this.scene.launch(SceneKey.UI);
    const title = this.add.text(320, 54, 'EMBERWEB HOLLOW', { color: '#efab64', fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', stroke: '#1d100b', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(30_000); this.tweens.add({ targets: title, alpha: 0, delay: 1300, duration: 400, onComplete: () => title.destroy() }); this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
  public update(time: number): void { this.player.move(this.upKey.isDown, this.downKey.isDown, this.leftKey.isDown, this.rightKey.isDown); this.projectiles.update(); this.spiders.update(time); this.drops.update(time); if (this.player.x < 38) this.scene.start(SceneKey.Hub); }
  private drawWorld(): void { for (let y = 0; y < WORLD_HEIGHT; y += 32) for (let x = 0; x < WORLD_WIDTH; x += 32) this.add.image(x, y, TEXTURES.tiles, (x * 3 + y * 5) % 17 === 0 ? 3 : (x / 32 + y / 32) % 3).setOrigin(0); this.collisions = this.physics.add.staticGroup(); const props: [number, number, keyof typeof TEXTURES, number, number][] = [[285,180,'tree',52,36],[535,150,'rockA',60,28],[755,595,'rockB',58,25],[1040,155,'tree',52,36],[1150,570,'rockA',60,28],[430,540,'bush',48,22],[850,350,'stump',44,20],[675,270,'webLarge',0,0],[1000,405,'webSmall',0,0],[330,390,'plant',0,0]]; props.forEach(([x,y,key,w,h]) => { const image=this.add.image(x,y,TEXTURES[key]).setOrigin(0.5,1).setDepth(Math.floor(y)); if(w&&h){const zone=this.add.zone(x,y-h/2,w,h);this.physics.add.existing(zone,true);this.collisions.add(zone);} image.texture.setFilter(Phaser.Textures.FilterMode.NEAREST); }); this.add.text(52, 330, '← HUB', { color:'#d6b07c',fontFamily:'monospace',fontSize:'10px',stroke:'#160f0b',strokeThickness:3 }); }
  private pointerDown(pointer: Phaser.Input.Pointer): void { if (pointer.button === 0) this.player.attack(pointer.worldX, pointer.worldY); }
  private attackImpact = (impact: AttackImpact): void => { const config=PLAYER_CLASS_CONFIGS[impact.classId]; if(impact.kind==='melee'){ const hit=new Set<Phaser.GameObjects.GameObject>(); [-1,0,1].forEach(offset=>{const sweep=warriorSwordSweep(impact.facing,impact.rootX,impact.rootY,2+offset);[.35,.58,.8,1].forEach(distance=>{const x=Phaser.Math.Linear(sweep.startX,sweep.endX,distance),y=Phaser.Math.Linear(sweep.startY,sweep.endY,distance);const zone=this.add.zone(x,y,sweep.thickness,sweep.thickness);this.physics.add.existing(zone);this.physics.overlap(zone,this.spiders.group,(_z,target)=>{const object=target as Phaser.GameObjects.GameObject;if(!hit.has(object)){hit.add(object);this.spiders.get(object)?.takeDamage(config.attackDamage,impact.rootX,impact.rootY);}});this.time.delayedCall(58,()=>zone.destroy());});});return;} this.projectiles.spawn(config,impact.facing,impact.rootX,impact.rootY,impact.targetX,impact.targetY,[this.spiders.hurtboxGroup],target=>this.spiders.get(target)?.takeDamage(config.attackDamage,impact.rootX,impact.rootY),this.collisions,impact.releaseX!==undefined?{x:impact.releaseX,y:impact.releaseY!}:undefined); };
  private healthChanged = (health:number,maxHealth:number):void=>{this.registry.set('playerHealth',health);this.registry.set('playerMaxHealth',maxHealth);if(health<=0)this.time.delayedCall(700,()=>this.scene.start(SceneKey.Hub));};
  private pickupCoin = (value:number):void=>{this.registry.set('coins',gameProgressService.addCoins(value).coins);};
  private returnToHub():void{if(this.player.x<145)this.scene.start(SceneKey.Hub);}
  private shutdown():void{this.input.off(Phaser.Input.Events.POINTER_DOWN,this.pointerDown,this);this.input.keyboard?.off('keydown-F',this.returnToHub,this);this.projectiles?.destroy();this.spiders?.destroy();this.drops?.destroy();this.player?.destroy();this.scene.stop(SceneKey.UI);}
}
