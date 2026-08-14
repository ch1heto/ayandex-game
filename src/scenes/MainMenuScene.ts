import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { localizationService, t, type Language } from '../i18n/LocalizationService';
import { createDomOverlay } from '../ui/domOverlay';
import { yandexGamesService } from '../yandex/YandexGamesService';

export class MainMenuScene extends Phaser.Scene {
  public constructor() { super(SceneKey.MainMenu); }

  public create(): void {
    const overlay = createDomOverlay(this, 'main-menu-ui');
    const panel = document.createElement('section');
    panel.className = 'main-menu-panel';
    panel.setAttribute('aria-label', 'Ashvale');
    const title = document.createElement('h1'); title.textContent = 'ASHVALE';
    const subtitle = document.createElement('p'); subtitle.className = 'ashvale-subtitle'; subtitle.textContent = t('menu.subtitle');
    const begin = this.createButton(t('menu.begin'), 'primary', () => this.scene.start(SceneKey.CharacterSelect));
    const hint = document.createElement('p'); hint.className = 'menu-hint'; hint.textContent = t('menu.hint');
    panel.append(title, subtitle, begin, hint, this.createButton(t('menu.settings'), 'secondary', () => this.openSettings()));
    if (import.meta.env.DEV) {
      const preview = this.createButton(t('menu.preview'), 'secondary', () => this.scene.start(SceneKey.SkinPreview));
      const devHint = document.createElement('p'); devHint.className = 'dev-hint'; devHint.textContent = t('menu.devHint');
      panel.append(preview, devHint);
    }
    const controls = document.createElement('p'); controls.className = 'menu-controls'; controls.textContent = t('menu.controls');
    panel.append(controls); overlay.append(panel);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(SceneKey.CharacterSelect));
    if (import.meta.env.DEV) this.input.keyboard?.once('keydown-K', () => this.scene.start(SceneKey.SkinPreview));
    yandexGamesService.markGameReady();
  }

  private openSettings(): void {
    const overlay = createDomOverlay(this, 'settings-ui');
    const panel = document.createElement('section'); panel.className = 'settings-panel';
    const heading = document.createElement('h2'); heading.textContent = t('settings.title');
    const label = document.createElement('p'); label.textContent = t('settings.language');
    const options = document.createElement('div'); options.className = 'language-options';
    options.append(this.createLanguageButton('ru', 'РУССКИЙ'), this.createLanguageButton('en', 'ENGLISH'));
    const close = this.createButton(t('settings.close'), 'secondary', () => this.scene.restart());
    panel.append(heading, label, options, close); overlay.append(panel);
  }

  private createLanguageButton(language: Language, label: string): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `language-button ${localizationService.language === language ? 'selected' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => { localizationService.setLanguage(language); this.scene.restart(); });
    return button;
  }

  private createButton(label: string, style: 'primary' | 'secondary', action: () => void): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = `menu-button ${style}`;
    button.textContent = label; button.addEventListener('click', action, { once: true }); return button;
  }
}
