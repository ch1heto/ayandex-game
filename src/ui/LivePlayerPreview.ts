import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { getCharacterSkin } from '../data/characterSkins';
import { t } from '../i18n/LocalizationService';

/** Mirrors the real player's loaded frame. No second actor, texture or animation loop. */
export class LivePlayerPreview {
  public readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private signature = '';

  public constructor(private readonly player: PlayerCharacter) {
    this.canvas.className = 'live-player-preview';
    this.canvas.width = 192; this.canvas.height = 176;
    this.canvas.setAttribute('role', 'img');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Player preview requires a 2D canvas.');
    this.context = context;
    this.refresh();
  }

  public refresh(): void {
    const visual = this.player.visual;
    if (!visual.active) return;
    const frame = visual.frame;
    const source = frame.source.image;
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) return;
    const signature = [this.player.activeSkin, visual.texture.key, frame.name, visual.flipX, visual.originX, visual.originY].join(':');
    if (signature === this.signature) return;
    this.signature = signature;
    const skin = getCharacterSkin(this.player.activeSkin);
    // Fit all states against the same root: an attack frame never changes preview zoom.
    const states = Object.values(skin.animations);
    const horizontal = Math.max(...states.map(state => {
      const root = state.rootX ?? skin.visualCenterX;
      return Math.max(root, state.frameWidth - root);
    }));
    const above = Math.max(...states.map(state => state.baseline ?? skin.baseline));
    const below = Math.max(...states.map(state => state.frameHeight - (state.baseline ?? skin.baseline)));
    const zoom = Math.max(1, Math.floor(Math.min(90 / horizontal, 144 / above, below ? 28 / below : 8)));
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = false;
    context.save();
    context.translate(96, 144);
    context.scale(visual.flipX ? -zoom : zoom, zoom);
    // Phaser has already flipped the display origin; recover the source-space root.
    const rootX = frame.width * (visual.flipX ? 1 - visual.originX : visual.originX);
    context.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      -Math.round(rootX), -Math.round(frame.height * visual.originY), frame.cutWidth, frame.cutHeight);
    context.restore();
    this.canvas.dataset.skin = this.player.activeSkin;
    this.canvas.dataset.playerClass = this.player.activeClass;
    this.canvas.setAttribute('aria-label', t('equipment.preview') + ': ' + t(`class.${this.player.activeClass}`) + ' · ' + skin.displayName);
  }

  public destroy(): void {
    this.canvas.remove();
    this.canvas.width = 0; this.canvas.height = 0;
  }
}
