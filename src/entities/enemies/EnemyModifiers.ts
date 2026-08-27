import Phaser from 'phaser';
import { EnemyControl } from './EnemyControl';
import { ARCANE_BIND_CONTROL } from '../../data/arcane';
import { AFFIX_MULTIPLIERS, ELITE_CONFIG, type EliteAffix } from '../../data/elites';
import { t } from '../../i18n/LocalizationService';
export class EnemyModifiers {
  public readonly maxHealth: number;
  public readonly damageMultiplier: number;
  private staggerUntil = 0;
  private aura?: Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private nextDraw = 0;
  private readonly control = new EnemyControl();
  private bindArt?: Phaser.GameObjects.Graphics;
  private nextBindDraw = 0;
  private pausedByStun = false;
  public constructor(private readonly scene: Phaser.Scene, private readonly visual: Phaser.Physics.Arcade.Sprite, health: number, public readonly elite?: EliteAffix) {
    this.maxHealth = Math.round(health * (elite ? ELITE_CONFIG.health * AFFIX_MULTIPLIERS[elite].health : 1));
    this.damageMultiplier = elite ? ELITE_CONFIG.damage * AFFIX_MULTIPLIERS[elite].damage : 1;
    if (!elite) return;
    visual.setScale(ELITE_CONFIG.scale);
    this.aura = scene.add.graphics();
    this.label = scene.add.text(0, 0, '◆ ' + t(`elite.${elite}`), { fontFamily: 'Pixellari', fontSize: '11px', color: '#e5ca83', stroke: '#1b1820', strokeThickness: 2 }).setOrigin(.5, 1);
  }
  public get speedMultiplier(): number { return (this.elite ? AFFIX_MULTIPLIERS[this.elite].speed : 1); }
  public get stunned(): boolean { return this.control.isStunned(this.scene.time.now); }
  public stun(duration: number): boolean { return this.control.apply(this.scene.time.now, duration, ARCANE_BIND_CONTROL.recoveryMs); }
  public clearControl(): void {
    this.control.clear(); this.bindArt?.destroy(); this.bindArt = undefined;
    if (this.pausedByStun && this.visual.active) this.visual.anims.resume();
    this.pausedByStun = false;
  }
  public get staggered(): boolean { return this.scene.time.now < this.staggerUntil; }
  public stagger(duration: number): void { this.staggerUntil = this.scene.time.now + duration; }
  public update(time: number): void {
    if (this.stunned) {
      this.visual.setVelocity(0); this.visual.anims.pause(); this.pausedByStun = true;
      this.bindArt ??= this.scene.add.graphics();
      if (time >= this.nextBindDraw) {
        this.nextBindDraw = time + 80;
        const x = Math.round(this.visual.x), y = Math.round(this.visual.y);
        const g = this.bindArt.clear().setPosition(x, y).setDepth(y + 4);
        for (const side of [-1, 1]) {
          g.fillStyle(0x7868ba).fillRect(side * 26, -37, 3, 27);
          g.fillStyle(0xb6f2ff).fillRect(side * 26 - (side > 0 ? 5 : 0), -37, 8, 2).fillRect(side * 26 - (side > 0 ? 5 : 0), -10, 8, 2);
        }
        const shift = Math.floor(time / 120) % 3;
        for (let i = -1; i <= 1; i++) g.fillStyle(i ? 0xb39cec : 0xd9ffff).fillRect(i * 8 - 2, -58 - (i === shift - 1 ? 3 : 0), 4, 4);
      }
    } else {
      this.bindArt?.destroy(); this.bindArt = undefined;
      if (this.pausedByStun && this.visual.active) this.visual.anims.resume();
      this.pausedByStun = false;
    }
    this.label?.setPosition(Math.round(this.visual.x), Math.round(this.visual.y - 62)).setDepth(Math.floor(this.visual.y) + 5);
    if (!this.aura || time < this.nextDraw) return;
    this.nextDraw = time + 100;
    const x = Math.round(this.visual.x), y = Math.round(this.visual.y);
    this.aura.clear().setDepth(y - 1);
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6; this.aura.fillStyle(index % 3 ? 0x9f73c6 : 0xe2ba68, .7);
      this.aura.fillRect(Math.round(x + Math.cos(angle) * 29), Math.round(y + Math.sin(angle) * 11), 3, 2);
    }
    for (let index = 0; index < 3; index++) {
      const step = (Math.floor(time / 130) + index * 7) % 24;
      this.aura.fillStyle(0xe9c97d, .5); this.aura.fillRect(x - 25 + index * 24, y - step, 2, 2);
    }
  }
  public destroy(): void { this.clearControl(); this.aura?.destroy(); this.label?.destroy(); }
}
