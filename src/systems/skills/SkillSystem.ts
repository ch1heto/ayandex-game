import Phaser from 'phaser';
import { BLINK_CONFIG } from '../../data/arcane';
import { blinkDestination, type Rect } from './blinkDestination';
import { PixelSkillVfx } from './PixelSkillVfx';
import { t } from '../../i18n/LocalizationService';
import { notify } from '../notifications/notifications';

import { ProjectileSystem } from '../../combat/ProjectileSystem';
import { PLAYER_CLASS_CONFIGS } from '../../data/playerClasses';
import { SKILL_1_CONFIGS, type SkillConfig } from '../../data/skills';
import type { EmberSpiderSpawner } from '../../entities/enemies/EmberSpiderSpawner';
import type { MossSlimeSpawner } from '../../entities/enemies/MossSlimeSpawner';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import type { AttackImpact, PlayerClassId } from '../../entities/player/playerTypes';
import {
  createHeavySlashSector,
  heavySlashSectorPolygon,
  pointInHeavySlashSector,
  pointOnSector,
  type HeavySlashSector,
} from './heavySlashSector';

type SkillContext = {
  player: PlayerCharacter;
  projectiles: ProjectileSystem;
  slimes: MossSlimeSpawner;
  spiders: EmberSpiderSpawner;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
};

const HEAVY_SLASH_INNER_RADIUS = 18;
const HEAVY_SLASH_HALF_ANGLE = Math.PI * 52 / 180;

type PendingSkillActivation = {
  classId: PlayerClassId;
  skillId: string;
  heavySlashSector?: HeavySlashSector;
};

export class SkillSystem {
  private readonly readyAt: Record<PlayerClassId, number> = { warrior: 0, archer: 0, mage: 0 };
  private pending?: PendingSkillActivation;
  private heavySlashTelegraph?: Phaser.GameObjects.Graphics;
  private readonly vfx: PixelSkillVfx;

  public constructor(private readonly scene: Phaser.Scene, private readonly context: SkillContext) {
    this.ensurePiercingShotTexture();
    this.vfx = new PixelSkillVfx(scene);
  }

  public activate(targetX: number, targetY: number): boolean {
    const classId = this.context.player.activeClass;
    const config = SKILL_1_CONFIGS[classId];
    if (this.scene.time.now < this.readyAt[classId]) return false;
    if (config.behavior === 'arcane-blink') {
      if (Math.hypot(targetX - this.context.player.x, targetY - this.context.player.y) < 1) {
        const direction = this.context.player.direction;
        targetX = this.context.player.x + (direction === 'left' ? -BLINK_CONFIG.range : direction === 'right' ? BLINK_CONFIG.range : 0);
        targetY = this.context.player.y + (direction === 'up' ? -BLINK_CONFIG.range : direction === 'down' ? BLINK_CONFIG.range : 0);
      }
      const destination = this.resolveBlink(targetX, targetY);
      if (Math.hypot(destination.x - this.context.player.x, destination.y - this.context.player.y) < BLINK_CONFIG.minimumTravel) {
        notify(this.scene, t('skill.blinkBlocked'), 'blink-blocked'); return false;
      }
    }
    if (!this.context.player.useSkillAttack(targetX, targetY, config.id)) return false;
    if (config.behavior === 'arcane-blink') this.vfx.blinkAnticipation(this.context.player.x, this.context.player.y);
    this.readyAt[classId] = this.scene.time.now + config.cooldownMs * this.context.player.cooldownMultiplier;
    if (config.behavior === 'heavy-slash') {
      const sector = createHeavySlashSector(
        Math.round(this.context.player.x),
        Math.round(this.context.player.y),
        targetX,
        targetY,
        HEAVY_SLASH_INNER_RADIUS,
        Math.round(PLAYER_CLASS_CONFIGS.warrior.attackRange * config.rangeMultiplier + 22),
        HEAVY_SLASH_HALF_ANGLE,
      );
      this.pending = { classId, skillId: config.id, heavySlashSector: sector };
      this.showHeavySlashTelegraph(sector);
    } else {
      this.pending = { classId, skillId: config.id };
    }
    return true;
  }

  public handleImpact(impact: AttackImpact): boolean {
    const config = SKILL_1_CONFIGS[impact.classId];
    if (!impact.skillId) return false;
    if (impact.skillId !== config.id || this.pending?.skillId !== config.id) return true;
    const activation = this.pending;
    this.pending = undefined;
    if (config.behavior === 'heavy-slash') {
      this.clearHeavySlashTelegraph();
      if (activation.heavySlashSector) this.executeHeavySlash(activation.heavySlashSector, config);
    }
    else if (config.behavior === 'piercing-shot') this.executePiercingShot(impact, config);
    else this.executeBlink(impact);
    return true;
  }

  public update(time: number): void { this.vfx.update(time); }

  public getCooldownRemaining(classId: PlayerClassId): number {
    return Math.max(0, this.readyAt[classId] - this.scene.time.now);
  }

  public getConfig(classId: PlayerClassId): SkillConfig { return SKILL_1_CONFIGS[classId]; }

  public destroy(): void {
    this.cancelPending();
  }

  public cancelPending(): void {
    this.pending = undefined;
    this.clearHeavySlashTelegraph();
    this.vfx.destroy();
  }

  private showHeavySlashTelegraph(sector: HeavySlashSector): void {
    this.clearHeavySlashTelegraph();
    const graphics = this.scene.add.graphics().setName('heavy-slash-telegraph').setDepth(Math.floor(sector.originY) - 2);
    graphics.fillStyle(0xb72e2e, .19);
    graphics.fillPoints(
      heavySlashSectorPolygon(sector).map((point) => new Phaser.Math.Vector2(point.x, point.y)),
      true,
    );
    const startAngle = sector.aimAngle - sector.halfAngle;
    const endAngle = sector.aimAngle + sector.halfAngle;
    const leftInner = pointOnSector(sector, startAngle, sector.innerRadius);
    const leftOuter = pointOnSector(sector, startAngle, sector.outerRadius);
    const rightInner = pointOnSector(sector, endAngle, sector.innerRadius);
    graphics.lineStyle(2, 0xe36a58, .92);
    graphics.beginPath();
    graphics.moveTo(leftInner.x, leftInner.y);
    graphics.lineTo(leftOuter.x, leftOuter.y);
    graphics.arc(sector.originX, sector.originY, sector.outerRadius, startAngle, endAngle, false);
    graphics.lineTo(rightInner.x, rightInner.y);
    graphics.strokePath();
    graphics.lineStyle(1, 0x6f1519, .9);
    graphics.beginPath();
    graphics.arc(sector.originX, sector.originY, sector.outerRadius - 3, startAngle, endAngle, false);
    graphics.strokePath();
    this.heavySlashTelegraph = graphics;
  }

  private clearHeavySlashTelegraph(): void {
    this.heavySlashTelegraph?.destroy();
    this.heavySlashTelegraph = undefined;
  }

  private executeHeavySlash(sector: HeavySlashSector, skill: SkillConfig): void {
    this.drawHeavySlashVfx(sector, skill.color);
    this.context.slimes.forEach((slime) => {
      const center = this.enemyCenter(slime.visual);
      if (pointInHeavySlashSector(sector, center.x, center.y)) this.hitEnemy(slime.visual, skill, sector);
    });
    this.context.spiders.forEach((spider) => {
      const center = this.enemyCenter(spider.visual);
      if (pointInHeavySlashSector(sector, center.x, center.y)) this.hitEnemy(spider.visual, skill, sector);
    });
  }

  private hitEnemy(target: Phaser.GameObjects.GameObject, skill: SkillConfig, sector: HeavySlashSector): void {
    const damage = this.skillDamage(skill);
    const slime = this.context.slimes.getSlime(target);
    if (slime) {
      slime.takeDamage(damage, sector.originX, sector.originY);
      slime.applyKnockback(sector.originX, sector.originY, 172);
    } else {
      const spider = this.context.spiders.get(target);
      spider?.takeDamage(damage, sector.originX, sector.originY);
      spider?.applyKnockback(sector.originX, sector.originY, 132);
    }
    const position = target as unknown as Phaser.GameObjects.Components.Transform;
    this.heavyImpact(position.x, position.y, sector.originX, sector.originY, skill.color);
    this.scene.cameras.main.shake(46, .0022, true);
  }

  private executePiercingShot(impact: AttackImpact, skill: SkillConfig): void {
    const base = PLAYER_CLASS_CONFIGS.archer;
    const damage = this.skillDamage(skill);
    this.vfx.bowRelease(impact.releaseX ?? impact.rootX, impact.releaseY ?? impact.rootY - 20, Math.atan2(impact.aimY, impact.aimX));
    this.context.projectiles.spawn(
      base, impact.facing, impact.rootX, impact.rootY, impact.targetX, impact.targetY,
      [this.context.slimes.group, this.context.spiders.hurtboxGroup],
      (target) => {
        const slime = this.context.slimes.getSlime(target);
        if (slime) slime.takeDamage(damage, impact.rootX, impact.rootY);
        else this.context.spiders.get(target)?.takeDamage(damage, impact.rootX, impact.rootY);
        const position = target as unknown as Phaser.GameObjects.Components.Transform;
        this.piercingImpact(position.x, position.y, impact.rootX, impact.rootY, skill.color);
      },
      this.context.obstacles,
      impact.releaseX !== undefined && impact.releaseY !== undefined ? { x: impact.releaseX, y: impact.releaseY } : undefined,
      {
        texture: 'skill-archer-piercing-arrow', maxHits: skill.projectile?.maxHits,
        rangeMultiplier: skill.rangeMultiplier, speedMultiplier: skill.projectile?.speedMultiplier,
        trailColor: 0x8aefd1, trailSize: 2, trailLifetimeMs: 120, trailLength: 18,
      },
    );
  }

  private resolveBlink(targetX: number, targetY: number): { x: number; y: number } {
    const player = this.context.player;
    const body = player.physicsRoot.body as Phaser.Physics.Arcade.Body;
    const rects: Rect[] = [];
    const bodies = [...this.context.obstacles.getChildren(), ...this.context.slimes.group.getChildren(), ...this.context.spiders.group.getChildren()];
    for (const object of bodies) {
      const candidate = (object as Phaser.GameObjects.Zone).body;
      if ((candidate instanceof Phaser.Physics.Arcade.Body || candidate instanceof Phaser.Physics.Arcade.StaticBody) && candidate.enable && object.active) rects.push({ x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height });
    }
    return blinkDestination({ x: player.x, y: player.y }, { x: targetX, y: targetY }, BLINK_CONFIG.range,
      { left: body.offset.x - player.physicsRoot.displayOriginX, top: body.offset.y - player.physicsRoot.displayOriginY, width: body.width, height: body.height },
      this.scene.physics.world.bounds, rects, BLINK_CONFIG.clearance);
  }

  private executeBlink(impact: AttackImpact): void {
    const player = this.context.player;
    if (player.currentHealth <= 0) return;
    // Recheck live bodies at release: a gate or enemy may have moved during anticipation.
    const destination = this.resolveBlink(impact.targetX, impact.targetY);
    if (Math.hypot(destination.x - player.x, destination.y - player.y) < BLINK_CONFIG.minimumTravel) {
      this.readyAt.mage = this.scene.time.now;
      notify(this.scene, t('skill.blinkBlocked'), 'blink-blocked');
      return;
    }
    this.vfx.blink(player.visual, player.x, player.y, destination.x, destination.y);
    player.setPosition(destination.x, destination.y);
  }

  private drawHeavySlashVfx(sector: HeavySlashSector, color: number): void {
    const graphics = this.scene.add.graphics().setName('heavy-slash-impact-vfx').setDepth(Math.floor(sector.originY) + 5);
    const startAngle = sector.aimAngle - sector.halfAngle;
    const endAngle = sector.aimAngle + sector.halfAngle;
    graphics.lineStyle(7, 0x7a2d18, .72);
    graphics.beginPath();
    graphics.arc(sector.originX, sector.originY, sector.outerRadius - 7, startAngle, endAngle, false);
    graphics.strokePath();
    graphics.lineStyle(3, color, .95);
    graphics.beginPath();
    graphics.arc(sector.originX, sector.originY, sector.outerRadius - 8, startAngle, endAngle, false);
    graphics.strokePath();
    graphics.lineStyle(2, 0xffe0a1, .88);
    graphics.beginPath();
    graphics.arc(sector.originX, sector.originY, (sector.innerRadius + sector.outerRadius) * .58, startAngle, endAngle, false);
    graphics.strokePath();
    this.scene.time.delayedCall(145, () => graphics.destroy());
  }

  private enemyCenter(target: Phaser.GameObjects.GameObject): { x: number; y: number } {
    const body = (target as Phaser.GameObjects.Sprite).body;
    if (body instanceof Phaser.Physics.Arcade.Body) return { x: body.center.x, y: body.center.y };
    const transform = target as unknown as Phaser.GameObjects.Components.Transform;
    return { x: transform.x, y: transform.y };
  }

  private heavyImpact(x: number, y: number, sourceX: number, sourceY: number, color: number): void {
    this.impactBurst(x, y, color, 13, 25);
    const direction = new Phaser.Math.Vector2(x - sourceX, y - sourceY);
    if (direction.lengthSq() > 0) direction.normalize();
    const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);
    const groundPixels: Phaser.GameObjects.Rectangle[] = [];
    for (let index = -4; index <= 4; index += 1) {
      const distance = index * 6;
      groundPixels.push(this.scene.add.rectangle(
        Math.round(x + perpendicular.x * distance),
        Math.round(y + perpendicular.y * distance + 6),
        Math.abs(index) % 2 === 0 ? 7 : 4,
        3,
        index % 2 === 0 ? 0xf4c05c : 0x8e3a1d,
      ).setDepth(Math.floor(y) + 3));
    }
    this.scene.time.delayedCall(165, () => groundPixels.forEach((pixel) => pixel.destroy()));
  }

  private piercingImpact(x: number, y: number, sourceX: number, sourceY: number, color: number): void {
    const direction = new Phaser.Math.Vector2(x - sourceX, y - sourceY);
    if (direction.lengthSq() > 0) direction.normalize();
    const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);
    const pixels: Phaser.GameObjects.Rectangle[] = [];
    for (let index = -3; index <= 5; index += 1) {
      const forward = index * 6;
      const spread = index % 2 === 0 ? 5 : -5;
      pixels.push(this.scene.add.rectangle(
        Math.round(x + direction.x * forward + perpendicular.x * spread),
        Math.round(y + direction.y * forward + perpendicular.y * spread),
        index >= 0 ? 7 : 4,
        3,
        index % 2 === 0 ? color : 0xfff3bd,
      ).setDepth(Math.floor(y) + 6));
    }
    this.scene.time.delayedCall(165, () => pixels.forEach((pixel) => pixel.destroy()));
  }

  private impactBurst(x: number, y: number, color: number, count = 9, distance = 20): void {
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const pixel = this.scene.add.rectangle(Math.round(x), Math.round(y), 5, 5, color).setDepth(Math.floor(y) + 5);
      this.scene.time.delayedCall(48, () => pixel.setPosition(Math.round(x + Math.cos(angle) * 10), Math.round(y + Math.sin(angle) * 10)));
      this.scene.time.delayedCall(105, () => pixel.setPosition(Math.round(x + Math.cos(angle) * distance), Math.round(y + Math.sin(angle) * distance)));
      this.scene.time.delayedCall(155, () => pixel.destroy());
    }
  }

  private skillDamage(skill: SkillConfig): number {
    return Math.round(this.context.player.finalDamage * skill.damageMultiplier);
  }

  private ensurePiercingShotTexture(): void {
    const key = 'skill-archer-piercing-arrow';
    if (this.scene.textures.exists(key)) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x173c34, 1);
    graphics.fillRect(0, 3, 25, 5);
    graphics.fillRect(21, 1, 6, 9);
    graphics.fillStyle(0x4fbb9e, 1);
    graphics.fillRect(1, 4, 22, 3);
    graphics.fillStyle(0xffefad, 1);
    graphics.fillRect(5, 4, 20, 1);
    graphics.fillStyle(0x90f1c4, 1);
    graphics.fillTriangle(22, 1, 31, 5, 22, 10);
    graphics.fillStyle(0xfff0a6, 1);
    graphics.fillTriangle(24, 3, 31, 5, 24, 7);
    graphics.generateTexture(key, 32, 11);
    graphics.destroy();
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }


}
