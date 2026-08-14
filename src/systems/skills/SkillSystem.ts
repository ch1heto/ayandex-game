import Phaser from 'phaser';

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
  obstacles: Phaser.Types.Physics.Arcade.ArcadeColliderType;
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

  public constructor(private readonly scene: Phaser.Scene, private readonly context: SkillContext) {
    this.ensurePiercingShotTexture();
    this.ensureMagicBurstTexture();
  }

  public activate(targetX: number, targetY: number): boolean {
    const classId = this.context.player.activeClass;
    const config = SKILL_1_CONFIGS[classId];
    if (this.scene.time.now < this.readyAt[classId]) return false;
    if (!this.context.player.useSkillAttack(targetX, targetY, config.id)) return false;
    this.readyAt[classId] = this.scene.time.now + config.cooldownMs;
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
    else this.executeMagicBurst(impact, config);
    return true;
  }

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
    this.context.projectiles.spawn(
      base, impact.facing, impact.rootX, impact.rootY, impact.targetX, impact.targetY,
      [this.context.slimes.group, this.context.spiders.group],
      (target) => {
        const damage = this.skillDamage(skill);
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
        rangeMultiplier: skill.rangeMultiplier, speedMultiplier: 1.08,
        trailColor: 0xffe98f, trailSize: 5, trailLifetimeMs: 150,
      },
    );
  }

  private executeMagicBurst(impact: AttackImpact, skill: SkillConfig): void {
    const base = PLAYER_CLASS_CONFIGS.mage;
    let directTarget: Phaser.GameObjects.GameObject | undefined;
    const explode = (x: number, y: number) => this.magicBurst(x, y, skill, directTarget);
    this.context.projectiles.spawn(
      base, impact.facing, impact.rootX, impact.rootY, impact.targetX, impact.targetY,
      [this.context.slimes.group, this.context.spiders.group],
      (target) => {
        directTarget = target;
        const damage = this.skillDamage(skill);
        const slime = this.context.slimes.getSlime(target);
        if (slime) slime.takeDamage(damage, impact.rootX, impact.rootY);
        else this.context.spiders.get(target)?.takeDamage(damage, impact.rootX, impact.rootY);
        const position = target as unknown as Phaser.GameObjects.Components.Transform;
        explode(position.x, position.y);
      },
      this.context.obstacles,
      impact.releaseX !== undefined && impact.releaseY !== undefined ? { x: impact.releaseX, y: impact.releaseY } : undefined,
      {
        texture: 'skill-mage-burst-projectile', maxHits: 1, tint: skill.color,
        trailColor: 0xe8c6ff, trailSize: 5, trailLifetimeMs: 150, onExpire: explode, scale: 1.5,
      },
    );
  }

  private magicBurst(x: number, y: number, skill: SkillConfig, directTarget?: Phaser.GameObjects.GameObject): void {
    const radius = skill.projectile?.splashRadius ?? 58;
    const damage = Math.round(this.skillDamage(skill) * (skill.projectile?.splashMultiplier ?? 0.55));
    this.context.slimes.forEach((slime) => {
      if (slime.visual !== directTarget && Phaser.Math.Distance.Between(x, y, slime.visual.x, slime.visual.y) <= radius) slime.takeDamage(damage, x, y);
    });
    this.context.spiders.forEach((spider) => {
      if (spider.visual !== directTarget && Phaser.Math.Distance.Between(x, y, spider.visual.x, spider.visual.y) <= radius) spider.takeDamage(damage, x, y);
    });
    [8, 24, 40, radius].forEach((ringRadius, step) => {
      this.scene.time.delayedCall(step * 38, () => this.pixelRing(x, y, ringRadius, skill.color));
    });
    this.impactBurst(x, y, skill.color);
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
    return Math.round(PLAYER_CLASS_CONFIGS[skill.classId].attackDamage * skill.damageMultiplier);
  }

  private ensurePiercingShotTexture(): void {
    const key = 'skill-archer-piercing-arrow';
    if (this.scene.textures.exists(key)) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x3b2617, 1);
    graphics.fillRect(0, 3, 25, 5);
    graphics.fillRect(21, 1, 6, 9);
    graphics.fillStyle(0xd59232, 1);
    graphics.fillRect(1, 4, 22, 3);
    graphics.fillStyle(0xffefad, 1);
    graphics.fillRect(5, 4, 20, 1);
    graphics.fillStyle(0xffc84f, 1);
    graphics.fillTriangle(22, 1, 31, 5, 22, 10);
    graphics.fillStyle(0xfff0a6, 1);
    graphics.fillTriangle(24, 3, 31, 5, 24, 7);
    graphics.generateTexture(key, 32, 11);
    graphics.destroy();
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private pixelRing(x: number, y: number, radius: number, color: number): void {
    const pixels: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < 16; index += 1) {
      const angle = index / 16 * Math.PI * 2;
      pixels.push(this.scene.add.rectangle(
        Math.round(x + Math.cos(angle) * radius),
        Math.round(y + Math.sin(angle) * radius),
        4, 4, color,
      ).setDepth(Math.floor(y) + 4));
    }
    this.scene.time.delayedCall(48, () => pixels.forEach((pixel) => pixel.destroy()));
  }

  private ensureMagicBurstTexture(): void {
    const key = 'skill-mage-burst-projectile';
    if (this.scene.textures.exists(key)) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x4d246e, 1);
    graphics.fillRect(1, 3, 15, 6);
    graphics.fillRect(4, 1, 8, 10);
    graphics.fillStyle(0xd7a0ff, 1);
    graphics.fillRect(4, 3, 10, 6);
    graphics.fillRect(7, 2, 5, 8);
    graphics.fillStyle(0xfff0ff, 1);
    graphics.fillRect(8, 4, 7, 2);
    graphics.generateTexture(key, 18, 12);
    graphics.destroy();
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
