import Phaser from 'phaser';

import type { PlayerClassConfig } from '../data/playerClasses';
import type { Direction } from '../entities/player/playerTypes';

type ProjectileRecord = {
  sprite: Phaser.Physics.Arcade.Sprite;
  startX: number;
  startY: number;
  maxRange: number;
  colliders: Phaser.Physics.Arcade.Collider[];
  obstacleCollider?: Phaser.Physics.Arcade.Collider;
  hitTargets: Set<Phaser.GameObjects.GameObject>;
  hitsRemaining: number;
  onExpire?: (x: number, y: number) => void;
  trail?: Phaser.Time.TimerEvent;
};

export type ProjectileOptions = {
  texture?: string;
  maxHits?: number;
  speedMultiplier?: number;
  rangeMultiplier?: number;
  tint?: number;
  onExpire?: (x: number, y: number) => void;
  trailColor?: number;
  trailSize?: number;
  trailLifetimeMs?: number;
  scale?: number;
};

const MUZZLE_OFFSET: Record<Direction, { x: number; y: number }> = {
  down: { x: 0, y: -19 },
  left: { x: -17, y: -25 },
  up: { x: 0, y: -31 },
  right: { x: 17, y: -25 },
};

export class ProjectileSystem {
  private readonly active: ProjectileRecord[] = [];

  public constructor(private readonly scene: Phaser.Scene) {}

  public spawn(
    config: PlayerClassConfig,
    facing: Direction,
    rootX: number,
    rootY: number,
    targetX: number,
    targetY: number,
    targets: ReadonlyArray<Phaser.Types.Physics.Arcade.ArcadeColliderType>,
    onHit: (target: Phaser.GameObjects.GameObject) => void,
    obstacles?: Phaser.Types.Physics.Arcade.ArcadeColliderType,
    releasePoint?: { x: number; y: number },
    options: ProjectileOptions = {},
  ): void {
    if (!config.projectileSpeed || !config.projectileRange) return;
    const texture = options.texture ?? (config.attackKind === 'arrow' ? 'projectile-arrow' : 'projectile-magic');
    const muzzle = MUZZLE_OFFSET[facing];
    const startX = releasePoint?.x ?? rootX + muzzle.x;
    const startY = releasePoint?.y ?? rootY + muzzle.y;
    const trajectory = new Phaser.Math.Vector2(targetX - startX, targetY - startY);
    if (trajectory.lengthSq() === 0) return;
    trajectory.normalize();
    const sprite = this.scene.physics.add.sprite(startX, startY, texture)
      .setDepth(Math.floor(startY) + 1)
      .setRotation(Math.atan2(trajectory.y, trajectory.x));
    sprite.body?.setAllowGravity(false);
    if (options.tint !== undefined) sprite.setTint(options.tint);
    sprite.setScale(options.scale ?? 1);
    sprite.setVelocity(trajectory.x * config.projectileSpeed * (options.speedMultiplier ?? 1), trajectory.y * config.projectileSpeed * (options.speedMultiplier ?? 1));

    const record: ProjectileRecord = {
      sprite,
      startX,
      startY,
      maxRange: config.projectileRange * (options.rangeMultiplier ?? 1),
      colliders: [],
      hitTargets: new Set(),
      hitsRemaining: options.maxHits ?? 1,
      onExpire: options.onExpire,
    };
    targets.forEach((target) => record.colliders.push(this.scene.physics.add.overlap(
      sprite,
      target,
      (_projectileObject, targetObject) => {
        const hitTarget = targetObject as Phaser.GameObjects.GameObject;
        if (record.hitTargets.has(hitTarget)) return;
        record.hitTargets.add(hitTarget);
        onHit(hitTarget);
        record.hitsRemaining -= 1;
        if (record.hitsRemaining <= 0) this.remove(record);
      },
    )));
    if (obstacles) {
      record.obstacleCollider = this.scene.physics.add.collider(sprite, obstacles, () => this.remove(record, true));
    }
    if (options.trailColor !== undefined) {
      record.trail = this.scene.time.addEvent({
        delay: 42,
        loop: true,
        callback: () => this.createTrailPixel(record, options.trailColor!, options.trailSize ?? 3, options.trailLifetimeMs ?? 110),
      });
    }
    this.active.push(record);
  }

  public update(): void {
    for (const projectile of [...this.active]) {
      const distance = Phaser.Math.Distance.Between(projectile.startX, projectile.startY, projectile.sprite.x, projectile.sprite.y);
      projectile.sprite.setDepth(Math.floor(projectile.sprite.y) + 1);
      if (distance >= projectile.maxRange) this.remove(projectile, true);
    }
  }

  public destroy(): void {
    for (const projectile of [...this.active]) this.remove(projectile);
  }

  private createTrailPixel(projectile: ProjectileRecord, color: number, size: number, lifetimeMs: number): void {
    if (!projectile.sprite.active) return;
    const pixel = this.scene.add.rectangle(Math.round(projectile.sprite.x), Math.round(projectile.sprite.y), size, size, color, .78).setDepth(projectile.sprite.depth - 1);
    this.scene.time.delayedCall(lifetimeMs, () => pixel.destroy());
  }

  private remove(projectile: ProjectileRecord, expired = false): void {
    const index = this.active.indexOf(projectile);
    if (index === -1) return;
    this.active.splice(index, 1);
    projectile.colliders.forEach((collider) => collider.destroy());
    projectile.obstacleCollider?.destroy();
    projectile.trail?.remove(false);
    if (expired) projectile.onExpire?.(Math.round(projectile.sprite.x), Math.round(projectile.sprite.y));
    projectile.sprite.destroy();
  }
}
