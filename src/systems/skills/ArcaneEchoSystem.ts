import Phaser from 'phaser';
import { combatTargets, type CombatTarget } from '../../combat/CombatTargets';
import { ProjectileSystem } from '../../combat/ProjectileSystem';
import { ECHO_CONFIG } from '../../data/echoes';
import { PLAYER_CLASS_CONFIGS } from '../../data/playerClasses';
import { getCharacterSkin } from '../../data/characterSkins';
import { characterAnimationKey, characterTextureKey, idleFrameForSkin } from '../../entities/player/characterAssets';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import type { MossSlimeSpawner } from '../../entities/enemies/MossSlimeSpawner';
import type { EmberSpiderSpawner } from '../../entities/enemies/EmberSpiderSpawner';
import type { MossSlime } from '../../entities/enemies/MossSlime';
import type { EmberSpider } from '../../entities/enemies/EmberSpider';
import { PixelSkillVfx, line } from './PixelSkillVfx';
import { summonPositions } from './summonPositions';
import type { Rect } from './blinkDestination';
type Enemy = MossSlime | EmberSpider;
type Context = { player: PlayerCharacter; slimes: MossSlimeSpawner; spiders: EmberSpiderSpawner; obstacles: Phaser.Physics.Arcade.StaticGroup };
export class ArcaneEchoSystem {
  private echoes: ArcaneEcho[] = [];
  private readonly vfx: PixelSkillVfx;
  public constructor(private readonly scene: Phaser.Scene, private readonly context: Context) { this.vfx = new PixelSkillVfx(scene); }
  public positions(): { x: number; y: number }[] {
    const blockers: Rect[] = [];
    for (const group of [this.context.obstacles, this.context.slimes.group, this.context.spiders.group]) {
      for (const object of group.getChildren()) {
        const body = (object as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody }).body;
        if (body?.enable) blockers.push({ x: body.x, y: body.y, width: body.width, height: body.height });
      }
    }
    return summonPositions(this.context.player, this.scene.physics.world.bounds, blockers);
  }
  public cast(): boolean {
    const positions = this.positions();
    if (positions.length !== ECHO_CONFIG.count || !this.context.player.alive) return false;
    this.clear();
    const player = this.context.player;
    this.vfx.effect(player.x, player.y, 500, (g, p) => {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 - Math.PI / 2, x = Math.cos(a) * (22 + p * 10), y = Math.sin(a) * (15 + p * 6);
        line(g, x - 7, y, x, y - 7, 0x96eff5, 2, 1 - p);
        line(g, x, y - 7, x + 7, y, 0xb59aec, 2, 1 - p);
        line(g, x + 7, y, x, y + 7, 0x96eff5, 2, 1 - p);
        line(g, x, y + 7, x - 7, y, 0xb59aec, 2, 1 - p);
      }
    }, true);
    const damage = Math.round(player.finalDamage * ECHO_CONFIG.damageFraction);
    this.echoes = positions.map((position, index) => new ArcaneEcho(this.scene, this.context, position.x, position.y, damage, index, this.vfx));
    return true;
  }
  public update(time: number): void {
    this.echoes.forEach(echo => echo.update(time));
    this.echoes = this.echoes.filter(echo => !echo.disposed);
    this.vfx.update(time);
  }
  public clear(): void { this.echoes.forEach(echo => echo.destroy()); this.echoes = []; }
  public destroy(): void { this.clear(); this.vfx.destroy(); }
}
class ArcaneEcho implements CombatTarget {
  public readonly targetId = crypto.randomUUID();
  public readonly targetType = 'summon' as const;
  public readonly priority = 1;
  public readonly physicsRoot: Phaser.GameObjects.Zone;
  public disposed = false;
  private readonly visual: Phaser.GameObjects.Sprite;
  private readonly outline: Phaser.GameObjects.Image[];
  private readonly projectiles: ProjectileSystem;
  private readonly collider: Phaser.Physics.Arcade.Collider;
  private readonly born: number;
  private readonly skinId: string;
  private readonly start: { x: number; y: number };
  private nextAttack: number;
  private releaseAt = 0;
  private attackUntil = 0;
  private aim = { x: 0, y: 0 };
  private facing: 'left' | 'right' = 'right';
  public constructor(private readonly scene: Phaser.Scene, private readonly context: Context, public readonly x: number, public readonly y: number,
    private readonly damage: number, index: number, private readonly vfx: PixelSkillVfx) {
    this.born = scene.time.now; this.nextAttack = this.born + ECHO_CONFIG.materializeMs + index * 100;
    this.skinId = context.player.activeSkin; this.start = { x: context.player.x, y: context.player.y };
    this.physicsRoot = scene.add.zone(x, y, 18, 13).setOrigin(.5, 1);
    scene.physics.add.existing(this.physicsRoot);
    const body = this.physicsRoot.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(18, 13); body.moves = false; body.updateFromGameObject();
    this.visual = scene.add.sprite(x, y, characterTextureKey(this.skinId, 'idle'), idleFrameForSkin(this.skinId, 'right'));
    this.outline = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => scene.add.image(x + dx, y + dy, this.visual.texture.key).setData('offset', { dx, dy }).setTint(0x8eeef4));
    this.projectiles = new ProjectileSystem(scene);
    this.collider = scene.physics.add.collider(this.physicsRoot, context.obstacles);
    this.setPose(false); combatTargets(scene).add(this); this.syncVisual(this.born);
  }
  public get alive(): boolean { return !this.disposed && this.scene.time.now >= this.born + ECHO_CONFIG.materializeMs; }
  public takeDamage(_damage: number, _sourceX: number, _sourceY: number): boolean {
    if (!this.alive) return false;
    this.destroy(); return true;
  }
  public update(time: number): void {
    if (this.disposed) return;
    if (time >= this.born + ECHO_CONFIG.lifetimeMs || !this.context.player.alive) { this.destroy(); return; }
    this.projectiles.update(); this.syncVisual(time);
    if (!this.alive) return;
    if (this.releaseAt && time >= this.releaseAt) {
      this.releaseAt = 0;
      const release = { x: this.x + (this.facing === 'left' ? -16 : 16), y: this.y - 24 };
      this.projectiles.spawn(PLAYER_CLASS_CONFIGS.mage, this.facing, this.x, this.y, this.aim.x, this.aim.y,
        [this.context.slimes.group, this.context.spiders.hurtboxGroup], object => {
          if (this.disposed) return;
          const enemy = this.context.slimes.getSlime(object) ?? this.context.spiders.get(object);
          if (enemy?.visual.active && enemy.currentHealth > 0) enemy.takeDamage(this.damage, this.x, this.y);
        }, this.context.obstacles, release, { tint: 0x9eddf6, trailColor: 0x9983ca, trailSize: 2, scale: .85 });
    }
    if (this.attackUntil && time >= this.attackUntil) { this.attackUntil = 0; this.setPose(false); }
    if (time < this.nextAttack || this.attackUntil || Math.hypot(this.x - this.context.player.x, this.y - this.context.player.y) > ECHO_CONFIG.leash) return;
    const enemies: Enemy[] = [];
    const add = (enemy: Enemy) => { if (enemy.visual.active && enemy.currentHealth > 0 && Math.hypot(enemy.visual.x - this.x, enemy.visual.y - this.y) <= ECHO_CONFIG.leash) enemies.push(enemy); };
    this.context.slimes.forEach(add); this.context.spiders.forEach(add);
    enemies.sort((a, b) => Math.hypot(a.visual.x - this.x, a.visual.y - this.y) - Math.hypot(b.visual.x - this.x, b.visual.y - this.y));
    const enemy = enemies[0]; if (!enemy) { this.nextAttack = time + 200; return; }
    this.aim = { x: enemy.visual.x, y: enemy.visual.y - 18 }; this.facing = enemy.visual.x < this.x ? 'left' : 'right';
    const skin = getCharacterSkin(this.skinId), attack = skin.animations.attack;
    this.nextAttack = time + ECHO_CONFIG.attackIntervalMs;
    this.releaseAt = time + (attack.releaseFrame ?? skin.attackImpactFrame) / attack.frameRate * 1000;
    this.attackUntil = time + attack.frames / attack.frameRate * 1000;
    this.setPose(true);
  }
  private setPose(attack: boolean): void {
    const skin = getCharacterSkin(this.skinId), state = attack ? 'attack' : 'idle', animation = skin.animations[state];
    const flipped = this.facing === 'left', root = (animation.rootX ?? skin.visualCenterX) / animation.frameWidth;
    this.visual.setTexture(characterTextureKey(this.skinId, state), idleFrameForSkin(this.skinId, this.facing))
      .setOrigin(flipped ? 1 - root : root, (animation.baseline ?? skin.baseline) / animation.frameHeight).setFlipX(flipped)
      .setScale(skin.displayScale * 1.15).setTint(0xc5e9ff);
    if (attack) this.visual.play(characterAnimationKey(this.skinId, 'attack', this.facing), true); else this.visual.stop();
  }
  private syncVisual(time: number): void {
    const p = Math.min(1, (time - this.born) / ECHO_CONFIG.materializeMs), alpha = p < 1 ? .3 + p * .48 : .78;
    const x = Math.round(this.start.x + (this.x - this.start.x) * p), y = Math.round(this.start.y + (this.y - this.start.y) * p);
    this.visual.setPosition(x, y).setDepth(y).setAlpha(alpha);
    this.outline.forEach(image => {
      const { dx, dy } = image.getData('offset') as { dx: number; dy: number };
      image.setTexture(this.visual.texture.key, this.visual.frame.name).setPosition(x + dx, y + dy)
        .setOrigin(this.visual.originX, this.visual.originY).setScale(this.visual.scaleX, this.visual.scaleY)
        .setFlipX(this.visual.flipX).setDepth(y - .1).setAlpha(alpha * .6);
    });
  }
  public destroy(): void {
    if (this.disposed) return; this.disposed = true;
    combatTargets(this.scene).remove(this);
    this.releaseAt = 0; this.collider.destroy(); this.projectiles.destroy();
    this.vfx.impact(this.x, this.y - 10, 0xa8dcf6); this.visual.destroy(); this.outline.forEach(image => image.destroy()); this.physicsRoot.destroy();
  }
}
