import Phaser from 'phaser';
import type { AdvancedSkillId } from '../../data/advancedSkills';

type Effect = { graphics: Phaser.GameObjects.Graphics; born: number; lifetime: number; draw: (g: Phaser.GameObjects.Graphics, progress: number, age: number) => void };
/** Shapes are rasterized into whole-pixel clusters; never a smooth filled AoE disc. */
export class PixelSkillVfx {
  private effects: Effect[] = [];
  public constructor(private readonly scene: Phaser.Scene) {}
  public effect(x: number, y: number, lifetime: number, draw: Effect['draw'], ground = false): void {
    if (this.effects.length >= 60) { this.effects.shift()?.graphics.destroy(); }
    const graphics = this.scene.add.graphics().setPosition(Math.round(x), Math.round(y)).setDepth(Math.floor(y) + (ground ? -2 : 8));
    this.effects.push({ graphics, born: this.scene.time.now, lifetime, draw });
  }
  public update(time: number): void {
    this.effects = this.effects.filter(effect => {
      const age = time - effect.born;
      if (age >= effect.lifetime) { effect.graphics.destroy(); return false; }
      effect.graphics.clear(); effect.draw(effect.graphics, age / effect.lifetime, age); return true;
    });
  }
  public destroy(): void { this.effects.forEach(effect => effect.graphics.destroy()); this.effects = []; }
  public telegraph(x: number, y: number, radius: number, color: number, duration: number, angle?: number): void {
    this.effect(x, y, duration, (g, p) => {
      const count = angle === undefined ? 48 : 25;
      for (let i = 0; i < count; i++) {
        const a = angle === undefined ? i / count * Math.PI * 2 : angle - .6 + i / (count - 1) * 1.2;
        pixel(g, Math.cos(a) * radius, Math.sin(a) * radius, i % 3 ? 2 : 4, color, .5 + p * .4);
      }
      if (angle !== undefined) {
        for (const side of [-.6, .6]) line(g, 0, 0, Math.cos(angle + side) * radius, Math.sin(angle + side) * radius, color, 2, .55);
      } else {
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const dx = Math.cos(a), dy = Math.sin(a); line(g, dx * (radius - 12), dy * (radius - 12), dx * (radius + 6), dy * (radius + 6), color, 2); }
        line(g, -7, 0, 7, 0, color, 2, .6); line(g, 0, -7, 0, 7, color, 2, .6);
      }
    }, true);
  }
  public anticipation(x: number, y: number, color: number, duration: number): void {
    this.effect(x, y - 15, duration, (g, p) => {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = 25 * (1 - p) + 8;
        pixel(g, Math.cos(a) * r, Math.sin(a) * r, 3, i % 2 ? color : 0xfff4c9, .8);
      }
    });
  }
  public impact(x: number, y: number, color: number, large = false): void {
    this.effect(x, y - 8, large ? 420 : 230, (g, p) => {
      const r = 5 + p * (large ? 62 : 23), count = large ? 20 : 9;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + .15;
        const size = p < .4 ? 4 : 2;
        pixel(g, Math.cos(a) * r, Math.sin(a) * r * .7, size, i % 3 ? color : 0xfff7df, 1 - p);
      }
      if (p < .25) { line(g, -9, 0, 9, 0, 0xfff7df, 3); line(g, 0, -10, 0, 6, 0xfff7df, 3); }
    });
  }
  public cast(id: AdvancedSkillId, x: number, y: number, radius: number, color: number, angle: number): void {
    if (id === 'whirlwind') {
      this.effect(x, y, 330, (g, p) => {
        for (let arc = 0; arc < 3; arc++) for (let step = 0; step < 26; step++) {
          const a = angle + arc * Math.PI * 2 / 3 + step * .045 + p * 2.2;
          const r = radius - arc * 8; const size = Math.max(2, Math.round(6 * (1 - step / 29)));
          pixel(g, Math.cos(a) * r, Math.sin(a) * r, size + 2, 0x9b4328, (1 - p) * .65);
          pixel(g, Math.cos(a) * r, Math.sin(a) * r, size, step < 8 ? 0xffebad : color, 1 - p);
        }
        for (let i = 0; i < 12; i++) pixel(g, Math.cos(i) * (radius + p * 12), Math.sin(i) * (radius + p * 12), 2, 0xc5aa71, (1 - p) * .5);
      });
    } else if (id === 'seismic-slam') {
      this.effect(x, y, 480, (g, p) => {
        for (let branch = -2; branch <= 2; branch++) {
          const a = angle + branch * .24; let lastX = 8 * Math.cos(a), lastY = 8 * Math.sin(a);
          for (let step = 1; step <= 8; step++) {
            const distance = step * radius / 8; if (distance > radius * Math.min(1, p * 3)) break;
            const jitter = step % 2 ? 5 : -5;
            const nx = Math.cos(a) * distance - Math.sin(a) * jitter, ny = Math.sin(a) * distance + Math.cos(a) * jitter;
            line(g, lastX, lastY, nx, ny, 0x73392c, 5, 1 - p); line(g, lastX, lastY, nx, ny, color, 2, 1 - p);
            lastX = nx; lastY = ny;
          }
        }
        const wave = Math.min(1, p * 2) * radius;
        for (let i = -12; i <= 12; i++) pixel(g, Math.cos(angle + i * .048) * wave, Math.sin(angle + i * .048) * wave, 4, i % 3 ? color : 0xfff0c7, 1 - p);
      }, true);
      this.impact(x + Math.cos(angle) * 28, y + Math.sin(angle) * 28, color, true);
    } else if (id === 'frost-nova') {
      this.effect(x, y, 450, (g, p) => {
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8; const r = 15 + Math.min(1, p * 1.8) * (radius - 15);
          const dx = Math.cos(a), dy = Math.sin(a), length = 12 + (i % 3) * 4;
          line(g, dx * (r - length), dy * (r - length), dx * r, dy * r, 0x527fc6, 6, 1 - p);
          line(g, dx * (r - length), dy * (r - length), dx * r, dy * r, i % 2 ? 0xe4ffff : color, 2, 1 - p);
          pixel(g, dx * (r + 5) - dy * 5, dy * (r + 5) + dx * 5, 2, 0xbca0ee, 1 - p);
        }
      });
      this.impact(x, y, color);
    } else if (id === 'arrow-rain') {
      this.effect(x, y, 460, (g, p) => {
        for (let i = 0; i < 13; i++) {
          const a = i * 2.399, r = Math.sqrt((i + 1) / 14) * radius * .9;
          const px = Math.cos(a) * r, py = Math.sin(a) * r, fall = Math.min(1, p * 1.7 + (i % 3) * .08);
          const top = py - (1 - fall) * 120;
          if (fall < 1) { line(g, px - 7, top - 22, px, top, 0xbfeeb8, 2); line(g, px - 10, top - 34, px - 7, top - 24, 0x4cae91, 2, .6); }
          else { line(g, px - 3, py - 10, px, py, 0xe7d49c, 2, 1 - p); pixel(g, px + 3, py - 3, 3, color, 1 - p); }
        }
      });
    } else if (id === 'arcane-meteor') {
      this.effect(x, y, 290, (g, p) => {
        const px = -65 * (1 - p), py = -180 * (1 - p);
        for (let i = 6; i >= 0; i--) {
          pixel(g, px - i * 5, py - i * 11, 14 - i, i % 2 ? 0x7955aa : 0x5caccf, .85 - i * .1);
        }
        pixel(g, px, py, 17, 0x9b80e7); pixel(g, px + 2, py + 3, 10, 0xa3f4f0); pixel(g, px + 4, py + 5, 5, 0xffffff);
      });
    } else this.impact(x, y - 20, color);
  }
}
export function pixel(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha = 1): void { g.fillStyle(color, Math.max(0, alpha)).fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size)); }
export function line(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, size = 2, alpha = 1): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2));
  for (let step = 0; step <= steps; step++) pixel(g, x1 + (x2 - x1) * step / steps, y1 + (y2 - y1) * step / steps, size, color, alpha);
}
