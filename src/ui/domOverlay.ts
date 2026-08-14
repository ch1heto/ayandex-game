import Phaser from 'phaser';

export function createDomOverlay(scene: Phaser.Scene, className: string): HTMLDivElement {
  const app = scene.game.canvas.parentElement;
  if (!app) throw new Error('Game parent element is unavailable.');
  app.querySelectorAll('.ashvale-dom-ui').forEach((element) => element.remove());
  const overlay = document.createElement('div');
  overlay.className = `ashvale-dom-ui ${className}`;
  app.append(overlay);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => overlay.remove());
  return overlay;
}

export function createPixelSprite(
  url: string,
  frameWidth: number,
  frameHeight: number,
  frames: number,
  scale: number,
): HTMLDivElement {
  const sprite = document.createElement('div');
  sprite.className = 'dom-pixel-sprite';
  sprite.style.width = `${frameWidth * scale}px`;
  sprite.style.height = `${frameHeight * scale}px`;
  sprite.style.backgroundImage = `url("${url}")`;
  sprite.style.backgroundSize = `${frameWidth * frames * scale}px auto`;
  return sprite;
}
