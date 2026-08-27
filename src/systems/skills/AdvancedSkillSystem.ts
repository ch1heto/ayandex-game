import Phaser from 'phaser';
import type { ArcaneEchoSystem } from './ArcaneEchoSystem';
import { ARCANE_BIND_CONTROL } from '../../data/arcane';
import { getCharacterSkin } from '../../data/characterSkins';
import { ADVANCED_SKILLS, type AdvancedSkillConfig } from '../../data/advancedSkills';
import type { AttackImpact, PlayerClassId } from '../../entities/player/playerTypes';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import type { MossSlime } from '../../entities/enemies/MossSlime';
import type { EmberSpider } from '../../entities/enemies/EmberSpider';
import type { MossSlimeSpawner } from '../../entities/enemies/MossSlimeSpawner';
import type { EmberSpiderSpawner } from '../../entities/enemies/EmberSpiderSpawner';
import type { ProjectileSystem } from '../../combat/ProjectileSystem';
import { PLAYER_CLASS_CONFIGS } from '../../data/playerClasses';
import { t } from '../../i18n/LocalizationService';
import { notify } from '../notifications/notifications';
import { PixelSkillVfx } from './PixelSkillVfx';
type Context = { echoes: ArcaneEchoSystem; player: PlayerCharacter; slimes: MossSlimeSpawner; spiders: EmberSpiderSpawner; projectiles: ProjectileSystem; obstacles: Phaser.Types.Physics.Arcade.ArcadeColliderType };
type Cast = { skill: AdvancedSkillConfig; x: number; y: number; rootX: number; rootY: number; angle: number; damage: number; born: number; classId: PlayerClassId };
type Enemy = MossSlime | EmberSpider;
export class AdvancedSkillSystem {
  private readonly ready = new Map<string, number>();
  private pending?: Cast;
  private timers = new Set<Phaser.Time.TimerEvent>();
  public readonly vfx: PixelSkillVfx;
  public constructor(private readonly scene: Phaser.Scene, private readonly context: Context) {
    this.vfx = new PixelSkillVfx(scene);
    this.ensureBindTexture();
  }
  public cooldown(classId: PlayerClassId, slot: 2 | 3): number { return Math.max(0, (this.ready.get(ADVANCED_SKILLS[classId][slot].id) ?? 0) - this.scene.time.now); }
  public activate(slot: 2 | 3, targetX: number, targetY: number): boolean {
    const player = this.context.player; const skill = ADVANCED_SKILLS[player.activeClass][slot];
    if (this.cooldown(player.activeClass, slot) > 0 || player.currentHealth <= 0) return false;
    if (player.currentMana < skill.mana) {
      this.scene.registry.set('skillDeniedSlot', slot); this.scene.registry.set('skillDeniedUntil', this.scene.time.now + 250);
      notify(this.scene, t('skill.noMana'), 'no-mana'); return false;
    }
    const direction = new Phaser.Math.Vector2(targetX - player.x, targetY - player.y);
    if (!direction.lengthSq()) direction.set(0, 1);
    const angle = Math.atan2(direction.y, direction.x); const distance = Math.min(direction.length(), skill.range);
    direction.normalize();
    const x = skill.range ? Math.round(player.x + direction.x * distance) : player.x;
    const y = skill.range ? Math.round(player.y + direction.y * distance) : player.y;
    if (skill.id === 'arcane-echoes' && this.context.echoes.positions().length !== 3) { notify(this.scene, t('skill.echoBlocked'), 'echo-blocked'); return false; }
    if (!player.useSkillAttack(player.x + direction.x * 100, player.y + direction.y * 100, skill.id)) return false;
    player.spendMana(skill.mana);
    this.ready.set(skill.id, this.scene.time.now + skill.cooldownMs * player.cooldownMultiplier);
    this.pending = { skill, x, y, rootX: player.x, rootY: player.y, angle, damage: Math.round(player.finalDamage * skill.multiplier), born: this.scene.time.now, classId: player.activeClass };
    this.vfx.anticipation(player.x, player.y, skill.color, skill.anticipationMs + 160);
    if (skill.id === 'arrow-rain') {
      const attack = getCharacterSkin(player.activeSkin).animations.attack;
      const release = attack.releaseFrame ?? getCharacterSkin(player.activeSkin).attackImpactFrame;
      const castMs = Math.max(skill.anticipationMs, release / attack.frameRate * 1000);
      const duration = castMs + (skill.id === 'arrow-rain' ? 230 + ((skill.pulses ?? 4) - 1) * (skill.intervalMs ?? 420) : 290);
      this.vfx.telegraph(x, y, skill.radius, skill.color, duration);
    }
    if (skill.id === 'seismic-slam') this.vfx.telegraph(player.x, player.y, skill.radius, skill.color, 400, angle);
    return true;
  }
  public handleImpact(impact: AttackImpact): boolean {
    if (!impact.skillId || !Object.values(ADVANCED_SKILLS[impact.classId]).some(skill => skill.id === impact.skillId)) return false;
    const cast = this.pending; this.pending = undefined;
    if (!cast || cast.skill.id !== impact.skillId) return true;
    this.delay(Math.max(0, cast.born + cast.skill.anticipationMs - this.scene.time.now), () => this.execute(cast, impact));
    return true;
  }
  public update(time: number): void { this.vfx.update(time); }
  public cancelPending(): void { this.pending = undefined; }
  public cancel(): void { this.pending = undefined; this.timers.forEach(timer => timer.remove(false)); this.timers.clear(); this.vfx.destroy(); }
  public destroy(): void { this.cancel(); }
  private delay(ms: number, action: () => void): void {
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers.delete(timer); if (this.context.player.currentHealth > 0) action();
    }); this.timers.add(timer);
  }
  private execute(cast: Cast, impact: AttackImpact): void {
    const { skill, rootX, rootY, x, y, angle } = cast;
    if (this.context.player.activeClass !== cast.classId) return;
    if (skill.id === 'multishot') {
      this.vfx.bowRelease(impact.releaseX ?? rootX, impact.releaseY ?? rootY - 20, angle);
      const release = { x: impact.releaseX ?? rootX, y: impact.releaseY ?? rootY - 20 };
      for (const spread of [-12, 0, 12]) {
        const a = angle + Phaser.Math.DegToRad(spread);
        this.context.projectiles.spawn(PLAYER_CLASS_CONFIGS.archer, impact.facing, rootX, rootY,
          release.x + Math.cos(a) * skill.range, release.y + Math.sin(a) * skill.range,
          [this.context.slimes.group, this.context.spiders.hurtboxGroup], target => {
            const enemy = this.context.slimes.getSlime(target) ?? this.context.spiders.get(target);
            if (enemy) this.hit(enemy, cast);
          }, this.context.obstacles, release, { tint: skill.color, trailColor: skill.color, trailSize: 2, trailLifetimeMs: 100, trailLength: 8, speedMultiplier: 1.12 });
      }
    } else if (skill.id === 'arcane-bind') {
      const release = { x: impact.releaseX ?? rootX, y: impact.releaseY ?? rootY - 18 };
      this.context.projectiles.spawn(PLAYER_CLASS_CONFIGS.mage, impact.facing, rootX, rootY, x, y,
        [this.context.slimes.group, this.context.spiders.hurtboxGroup], target => {
          const enemy = this.context.slimes.getSlime(target) ?? this.context.spiders.get(target);
          if (enemy) this.hit(enemy, cast);
        }, this.context.obstacles, release, {
          texture: 'skill-arcane-bind', speedMultiplier: 1.35,
          rangeMultiplier: skill.range / (PLAYER_CLASS_CONFIGS.mage.projectileRange ?? skill.range),
          trailColor: 0xa68dda, trailSize: 2, trailLifetimeMs: 140,
        });
    } else if (skill.id === 'arrow-rain') {
      for (let pulse = 0; pulse < (skill.pulses ?? 4); pulse++) this.delay(pulse * (skill.intervalMs ?? 420), () => {
        this.vfx.cast(skill.id, x, y, skill.radius, skill.color, angle);
        this.delay(230, () => this.area(cast, x, y));
      });
    } else if (skill.id === 'arcane-echoes') {
      if (!this.context.echoes.cast()) {
        this.context.player.restoreMana(skill.mana); this.ready.delete(skill.id);
        notify(this.scene, t('skill.echoBlocked'), 'echo-blocked');
      }
    } else {
      this.vfx.cast(skill.id, rootX, rootY, skill.radius, skill.color, angle);
      this.area(cast, rootX, rootY);
      if (skill.id === 'seismic-slam') this.scene.cameras.main.shake(80, .0018, true);
    }
  }
  private ensureBindTexture(): void {
    const key = 'skill-arcane-bind';
    if (this.scene.textures.exists(key)) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let x = 0; x < 18; x++) {
      const height = Math.max(1, 6 - Math.abs(x - 9));
      g.fillStyle(0x4f397e).fillRect(x, 7 - height, 1, height * 2 + 1);
    }
    g.fillStyle(0x8f82d9).fillRect(5, 4, 10, 7);
    g.fillStyle(0x8eecf5).fillRect(8, 3, 3, 9).fillRect(6, 6, 10, 3);
    g.fillStyle(0xf0ffff).fillRect(10, 6, 4, 2);
    g.generateTexture(key, 20, 15); g.destroy();
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private area(cast: Cast, x: number, y: number): void {
    // Arcade overlap gives real hurtbox contact; final radial/cone test avoids rectangular AoE corners.
    const radius = cast.skill.radius;
    const zone = this.scene.add.zone(x, y, radius * 2, radius * 2);
    this.scene.physics.add.existing(zone); const body = zone.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true); body.updateFromGameObject();
    const hit = new Set<Enemy>();
    for (const group of [this.context.slimes.group, this.context.spiders.hurtboxGroup]) this.scene.physics.overlap(zone, group, (_area, target) => {
      const enemy = this.context.slimes.getSlime(target as Phaser.GameObjects.GameObject) ?? this.context.spiders.get(target as Phaser.GameObjects.GameObject);
      if (!enemy || hit.has(enemy) || enemy.currentHealth <= 0) return;
      const dx = enemy.visual.x - x, dy = enemy.visual.y - y;
      if (Math.hypot(dx, dy) > radius + 12) return;
      if (cast.skill.id === 'seismic-slam' && Math.cos(Math.atan2(dy, dx) - cast.angle) < Math.cos(.6)) return;
      hit.add(enemy); this.hit(enemy, cast);
    });
    zone.destroy();
  }
  private hit(enemy: Enemy, cast: Cast): void {
    if (enemy.currentHealth <= 0 || !enemy.visual.active) return;
    if (!enemy.takeDamage(cast.damage, cast.rootX, cast.rootY)) return;
    const boss = 'isBoss' in enemy && enemy.isBoss;
    if (cast.skill.id === 'arcane-bind') {
      if (!boss && enemy.currentHealth > 0) enemy.applyStun(enemy.elite ? ARCANE_BIND_CONTROL.eliteMs : ARCANE_BIND_CONTROL.normalMs);
      this.vfx.bindImpact(enemy.visual.x, enemy.visual.y);
    }
    if (cast.skill.id === 'seismic-slam' && !boss) enemy.modifiers.stagger(350);
    this.vfx.impact(enemy.visual.x, enemy.visual.y - 10, cast.skill.color);
  }
}
