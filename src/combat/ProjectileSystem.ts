import Phaser from 'phaser';

import type { PlayerClassConfig } from '../data/playerClasses';
import type { Direction } from '../entities/player/playerTypes';

type ProjectileRecord = {
  sprite: Phaser.Physics.Arcade.Sprite;
  startX: number;
  startY: number;
  maxRange: number;
  collider?: Phaser.Physics.Arcade.Collider;
  obstacleCollider?: Phaser.Physics.Arcade.Collider;
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
    target: Phaser.Types.Physics.Arcade.ArcadeColliderType | undefined,
    onHit: (target: Phaser.GameObjects.GameObject) => void,
    obstacles?: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  ): void {
    if (!config.projectileSpeed || !config.projectileRange) return;
    const texture = config.attackKind === 'arrow' ? 'projectile-arrow' : 'projectile-magic';
    const muzzle = MUZZLE_OFFSET[facing];
    const startX = rootX + muzzle.x;
    const startY = rootY + muzzle.y;
    const trajectory = new Phaser.Math.Vector2(targetX - startX, targetY - startY);
    if (trajectory.lengthSq() === 0) return;
    trajectory.normalize();
    const sprite = this.scene.physics.add.sprite(startX, startY, texture)
      .setDepth(Math.floor(startY) + 1)
      .setRotation(Math.atan2(trajectory.y, trajectory.x));
    sprite.body?.setAllowGravity(false);
    sprite.setVelocity(trajectory.x * config.projectileSpeed, trajectory.y * config.projectileSpeed);

    const record: ProjectileRecord = { sprite, startX, startY, maxRange: config.projectileRange };
    if (target) {
      record.collider = this.scene.physics.add.overlap(sprite, target, (_projectileObject, targetObject) => {
        onHit(targetObject as Phaser.GameObjects.GameObject);
        this.remove(record);
      });
    }
    if (obstacles) {
      record.obstacleCollider = this.scene.physics.add.collider(sprite, obstacles, () => this.remove(record));
    }
    this.active.push(record);
  }

  public update(): void {
    for (const projectile of [...this.active]) {
      const distance = Phaser.Math.Distance.Between(projectile.startX, projectile.startY, projectile.sprite.x, projectile.sprite.y);
      projectile.sprite.setDepth(Math.floor(projectile.sprite.y) + 1);
      if (distance >= projectile.maxRange) this.remove(projectile);
    }
  }

  public destroy(): void {
    for (const projectile of [...this.active]) this.remove(projectile);
  }

  private remove(projectile: ProjectileRecord): void {
    const index = this.active.indexOf(projectile);
    if (index === -1) return;
    this.active.splice(index, 1);
    projectile.collider?.destroy();
    projectile.obstacleCollider?.destroy();
    projectile.sprite.destroy();
  }
}
