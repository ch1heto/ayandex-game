import Phaser from 'phaser';
import { pixel, line } from '../systems/skills/PixelSkillVfx';
export class PixelPortal {
  private readonly art: Phaser.GameObjects.Graphics;
  public constructor(scene: Phaser.Scene, public readonly x: number, public readonly y: number) { this.art = scene.add.graphics().setPosition(x, y).setDepth(Math.floor(y)); }
  public update(time: number): void {
    const g = this.art.clear();
    g.fillStyle(0x141823).fillRect(-25, -60, 50, 59);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
      g.fillStyle(row % 2 ? 0x5b5668 : 0x494758).fillRect(side < 0 ? -34 : 23, -12 - row * 12, 11, 10);
      g.fillStyle(0x8b7f91).fillRect(side < 0 ? -33 : 24, -12 - row * 12, 9, 2);
    }
    g.fillStyle(0x655970).fillRect(-28, -67, 56, 8); g.fillStyle(0x9d88a5).fillRect(-24, -68, 48, 2);
    for (let i = 0; i < 11; i++) {
      const yy = -57 + i * 5, width = 16 + Math.round(Math.sin(i + time / 400) * 3);
      line(g, -width, yy, width, yy, i % 2 ? 0x302b57 : 0x252845, 3, .85);
    }
    for (let i = 0; i < 7; i++) {
      const phase = (Math.floor(time / 85) + i * 9) % 54;
      pixel(g, Math.sin(i * 4 + phase * .09) * 20, -phase - 4, 2, i % 2 ? 0x85d8e8 : 0xb49cdd, .8);
    }
    g.fillStyle(0x786479).fillRect(-32, -1, 64, 5);
  }
  public near(x: number, y: number): boolean { return Phaser.Math.Distance.Between(x, y, this.x, this.y) < 64; }
  public destroy(): void { this.art.destroy(); }
}
