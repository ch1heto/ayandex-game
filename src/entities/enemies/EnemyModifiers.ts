import Phaser from 'phaser';
import { AFFIX_MULTIPLIERS, ELITE_CONFIG, type EliteAffix } from '../../data/elites';
import { t } from '../../i18n/LocalizationService';
export class EnemyModifiers {
  public readonly maxHealth: number;
  public readonly damageMultiplier: number;
  private slowUntil = 0;
  private slowAmount = 0;
  private staggerUntil = 0;
  private aura?: Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private nextDraw = 0;
  public constructor(private readonly scene: Phaser.Scene, private readonly visual: Phaser.Physics.Arcade.Sprite, health: number, public readonly elite?: EliteAffix) {
    this.maxHealth = Math.round(health * (elite ? ELITE_CONFIG.health * AFFIX_MULTIPLIERS[elite].health : 1));
    this.damageMultiplier = elite ? ELITE_CONFIG.damage * AFFIX_MULTIPLIERS[elite].damage : 1;
    if (!elite) return;
    visual.setScale(ELITE_CONFIG.scale);
    this.aura = scene.add.graphics();
    this.label = scene.add.text(0, 0, '◆ ' + t(`elite.${elite}`), { fontFamily: 'Pixellari', fontSize: '11px', color: '#e5ca83', stroke: '#1b1820', strokeThickness: 2 }).setOrigin(.5, 1);
  }
  public get speedMultiplier(): number { return (this.elite ? AFFIX_MULTIPLIERS[this.elite].speed : 1) * (this.scene.time.now < this.slowUntil ? 1 - this.slowAmount : 1); }
  public get staggered(): boolean { return this.scene.time.now < this.staggerUntil; }
  public slow(amount: number, duration: number): void { this.slowAmount = Math.max(0, Math.min(.5, amount)); this.slowUntil = this.scene.time.now + duration; }
  public stagger(duration: number): void { this.staggerUntil = this.scene.time.now + duration; }
  public update(time: number): void {
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
  public destroy(): void { this.aura?.destroy(); this.label?.destroy(); }
}
