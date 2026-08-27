import Phaser from 'phaser';
import type { AdvancedSkillId } from '../../data/advancedSkills';

type Effect = { graphics: Phaser.GameObjects.Graphics; born: number; lifetime: number; draw: (g: Phaser.GameObjects.Graphics, progress: number, age: number) => void };
/** Shapes are rasterized into whole-pixel clusters; never a smooth filled AoE disc. */
export class PixelSkillVfx {
  private effects: Effect[] = [];
  private echoes: { image: Phaser.GameObjects.Image; born: number; lifetime: number }[] = [];
  public constructor(private readonly scene: Phaser.Scene) {}
  public effect(x: number, y: number, lifetime: number, draw: Effect['draw'], ground = false): void {
    if (this.effects.length >= 60) { this.effects.shift()?.graphics.destroy(); }
    const graphics = this.scene.add.graphics().setPosition(Math.round(x), Math.round(y)).setDepth(Math.floor(y) + (ground ? -2 : 8));
    draw(graphics, 0, 0);
    this.effects.push({ graphics, born: this.scene.time.now, lifetime, draw });
  }
  public update(time: number): void {
    this.echoes = this.echoes.filter(echo => {
      const progress = (time - echo.born) / echo.lifetime;
      if (progress >= 1) { echo.image.destroy(); return false; }
      echo.image.setAlpha((1 - progress) * .48); return true;
    });
    this.effects = this.effects.filter(effect => {
      const age = time - effect.born;
      if (age >= effect.lifetime) { effect.graphics.destroy(); return false; }
      effect.graphics.clear(); effect.draw(effect.graphics, age / effect.lifetime, age); return true;
    });
  }
  public destroy(): void {
    this.effects.forEach(effect => effect.graphics.destroy()); this.effects = [];
    this.echoes.forEach(echo => echo.image.destroy()); this.echoes = [];
  }
  public bowRelease(x: number, y: number, angle: number): void {
    this.effect(x, y, 170, (g, p) => {
      for (const side of [-1, 1]) {
        const a = angle + side * (.65 - p * .3);
        line(g, Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a) * (13 + p * 12), Math.sin(a) * (13 + p * 12), 0x80e6bd, 2, 1 - p);
      }
      line(g, Math.cos(angle) * 4, Math.sin(angle) * 4, Math.cos(angle) * (20 + p * 15), Math.sin(angle) * (20 + p * 15), 0xffedb6, 3, 1 - p);
    });
  }
  public blinkAnticipation(x: number, y: number): void {
    this.effect(x, y, 240, (g, p) => {
      const r = 23 - p * 10;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        line(g, Math.cos(a) * r, Math.sin(a) * r * .5, Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r * .5, i % 2 ? 0xa88be6 : 0x89ebee, 2);
      }
      for (let i = -1; i <= 1; i++) pixel(g, i * 9, -8 - p * 24, 2, 0xc5f8ff, 1 - p);
    }, true);
  }
  public blink(source: Phaser.GameObjects.Sprite, x: number, y: number, endX: number, endY: number): void {
    const dx = endX - x, dy = endY - y;
    for (const fraction of [0, .28, .58]) {
      if (this.echoes.length >= 9) this.echoes.shift()?.image.destroy();
      const image = this.scene.add.image(Math.round(x + dx * fraction), Math.round(y + dy * fraction), source.texture.key, source.frame.name)
        .setOrigin(source.originX, source.originY).setScale(source.scaleX, source.scaleY).setFlipX(source.flipX)
        .setTint(fraction ? 0x76dfe9 : 0xab88ed).setAlpha(.48).setDepth(Math.floor(y + dy * fraction) - 1);
      this.echoes.push({ image, born: this.scene.time.now, lifetime: 220 + fraction * 100 });
    }
    this.effect(x, y, 280, (g, p) => {
      for (let i = 1; i < 10; i++) {
        const f = i / 10, offset = Math.sin(i * 1.7) * 5;
        pixel(g, dx * f, dy * f - 10 + offset, i % 3 ? 2 : 3, i % 2 ? 0x75cbea : 0xb58fea, 1 - p);
      }
    });
    this.blinkAnticipation(endX, endY);
    this.effect(endX, endY - 14, 340, (g, p) => {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, r = 10 + p * 24;
        line(g, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 6), Math.sin(a) * (r + 6), i % 2 ? 0x98f4ff : 0xb495f0, 2, 1 - p);
      }
      if (p < .3) { line(g, -6, 0, 6, 0, 0xf3ffff, 3); line(g, 0, -12, 0, 8, 0xe1ffff, 2); }
    });
  }
  public bindImpact(x: number, y: number): void {
    this.effect(x, y - 20, 360, (g, p) => {
      const r = 28 - p * 12;
      for (const side of [-1, 1]) {
        line(g, side * r, -14, side * r, 10, 0xb19bee, 3, 1 - p);
        line(g, side * r, -14, side * (r - 8), -14, 0xa5f4ff, 2, 1 - p);
        line(g, side * r, 10, side * (r - 8), 10, 0xa5f4ff, 2, 1 - p);
      }
      for (let i = -2; i <= 2; i++) pixel(g, i * 7, -20 - p * 16, 2, 0xe1fcff, 1 - p);
    });
  }
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
    } else if (id === 'arrow-rain') {
      this.effect(x, y, 460, (g, p, age) => {
        for (let i = 0; i < 13; i++) {
          const a = i * 2.399, r = Math.sqrt((i + 1) / 14) * radius * .9;
          const px = Math.cos(a) * r, py = Math.sin(a) * r, fall = Math.min(1, age / 230);
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
