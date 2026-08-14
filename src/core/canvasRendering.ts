import Phaser from 'phaser';

export function setCanvasPixelArt(game: Phaser.Game, enabled: boolean): void {
  game.canvas.classList.toggle('pixel-art-canvas', enabled);
  game.canvas.classList.toggle('smooth-ui-canvas', !enabled);
  game.canvas.style.imageRendering = enabled ? 'pixelated' : 'auto';
}
