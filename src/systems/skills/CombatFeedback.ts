import Phaser from 'phaser';
import { VOLATILE_CONFIG } from '../../data/elites';
import { combatTargets } from '../../combat/CombatTargets';
import { ECONOMY_CONFIG } from '../../data/gameplayEconomy';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import { PixelSkillVfx, pixel, line } from './PixelSkillVfx';
export class CombatFeedback {
  private readonly vfx: PixelSkillVfx;
  private dodgeFrames: number[] = [];
  private explosions: { x: number; y: number; at: number; root: Phaser.GameObjects.Zone }[] = [];
  public constructor(private readonly scene: Phaser.Scene, private readonly player: PlayerCharacter) { this.vfx = new PixelSkillVfx(scene); }
  public dodge(): void { this.dodgeFrames = [this.scene.time.now, this.scene.time.now + 70, this.scene.time.now + 140]; }
  public levelUp(levels: number): void {
    if (!this.player.alive) return;
    this.player.restoreHealth(this.player.maxHealth * ECONOMY_CONFIG.levelRestoreFraction * levels);
    this.player.restoreMana(this.player.maxMana * ECONOMY_CONFIG.levelRestoreFraction * levels);
    this.vfx.effect(this.player.x, this.player.y - 15, 650, (g, p) => {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, r = 12 + p * 30;
        pixel(g, Math.cos(a) * r, Math.sin(a) * r - p * 15, 2, i % 2 ? 0xeada92 : 0x9ee5c6, 1 - p);
      }
      if (p < .35) line(g, 0, 8, 0, -22, 0xffefb6, 2, 1 - p);
    });
  }
  public volatile(x: number, y: number): void {
    if (!this.player.alive) return;
    const c = VOLATILE_CONFIG;
    const root = this.scene.add.zone(x, y, c.radius * 2, c.radius * 2);
    this.scene.physics.add.existing(root);
    const body = root.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true); body.moves = false; body.updateFromGameObject();
    this.explosions.push({ x, y, at: this.scene.time.now + c.delayMs, root });
    this.vfx.effect(x, y, c.delayMs, (g, p, age) => {
      const color = Math.floor(age / Math.max(70, 180 - p * 90)) % 2 ? 0xffaf59 : 0xd95742;
      for (let i = 0; i < 48; i++) pixel(g, Math.cos(i * Math.PI / 24) * c.radius, Math.sin(i * Math.PI / 24) * c.radius, i % 3 ? 2 : 3, color);
      for (let i = 0; i < 8; i++) pixel(g, Math.cos(i * 3) * 18, Math.sin(i * 3) * 18 - p * 18, 2, color);
    }, true);
  }
  public update(time: number): void {
    while (this.dodgeFrames.length && time >= this.dodgeFrames[0]) {
      this.dodgeFrames.shift();
      if (this.player.dodging) {
        const color = this.player.activeClass === 'mage' ? 0xaf9ade : this.player.activeClass === 'archer' ? 0x93cca5 : 0xd1b582;
        this.vfx.afterimage(this.player.visual, color);
        this.vfx.effect(this.player.x, this.player.y, 220, (g, p) => {
          for (let i = 0; i < 5; i++) pixel(g, (i - 2) * (3 + p * 5), -p * (i % 2 ? 9 : 4), 2, color, 1 - p);
        }, true);
      }
    }
    for (const explosion of [...this.explosions]) {
      if (time < explosion.at) continue;
      this.explosions.splice(this.explosions.indexOf(explosion), 1);
      this.vfx.impact(explosion.x, explosion.y, 0xff9857, true);
      for (const target of combatTargets(this.scene).all()) {
        if (Math.hypot(target.x - explosion.x, target.y - explosion.y) <= VOLATILE_CONFIG.radius &&
            this.scene.physics.overlap(explosion.root, target.physicsRoot)) target.takeDamage(VOLATILE_CONFIG.damage, explosion.x, explosion.y);
      }
      explosion.root.destroy();
    }
    this.vfx.update(time);
  }
  public clear(): void { this.dodgeFrames = []; this.explosions.forEach(e => e.root.destroy()); this.explosions = []; this.vfx.destroy(); }
  public destroy(): void { this.clear(); }
}
