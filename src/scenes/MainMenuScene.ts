import Phaser from 'phaser';
import menuArt from '../../assets/ui/menu/ashvale-main-menu-original.png';
import { SceneKey } from '../core/sceneKeys';
import { localizationService, t, type Language } from '../i18n/LocalizationService';
import { createDomOverlay } from '../ui/domOverlay';
import { yandexGamesService } from '../yandex/YandexGamesService';

export class MainMenuScene extends Phaser.Scene {
  public constructor() { super(SceneKey.MainMenu); }
  public create(): void {
    const overlay = createDomOverlay(this, 'main-menu-ui menu-art-ui');
    const stage = document.createElement('div'); stage.className = 'menu-art-stage';
    const art = document.createElement('img'); art.className = 'menu-original-art'; art.src = menuArt; art.alt = 'Ashvale';
    stage.append(art); overlay.append(stage);
    const actions = [
      ['menu.begin', () => this.scene.start(SceneKey.CharacterSelect)],
      ['menu.settings', () => this.openSettings()],
      ['menu.preview', () => this.scene.start(import.meta.env.DEV ? SceneKey.SkinPreview : SceneKey.CharacterSelect)],
      ['menu.exit', () => {
        const hint = document.createElement('p'); hint.className = 'menu-exit-hint'; hint.textContent = t('menu.exitHint');
        overlay.querySelector('.menu-exit-hint')?.remove(); overlay.append(hint);
      }],
    ] as const;
    actions.forEach(([key, action], index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'menu-art-hit';
      button.setAttribute('aria-label', t(key)); button.style.top = ((400 + index * 91) / 941 * 100) + '%';
      const label = document.createElement('span'); label.textContent = t(key); button.append(label);
      button.classList.toggle('localized-label', localizationService.language === 'en');
      button.addEventListener('click', action); stage.append(button);
    });
    const fit = () => { const scale = Math.max(overlay.clientWidth / 1672, overlay.clientHeight / 941); stage.style.width = (1672 * scale) + 'px'; stage.style.height = (941 * scale) + 'px'; stage.style.setProperty('--menu-scale', String(scale)); };
    const observer = new ResizeObserver(fit); observer.observe(overlay); fit();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => observer.disconnect());
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
    const close = document.createElement('button'); close.type = 'button'; close.className = 'menu-button secondary'; close.textContent = t('settings.close');
    close.onclick = () => this.scene.restart(); panel.append(heading, label, options, close); overlay.append(panel);
  }
  private createLanguageButton(language: Language, label: string): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'language-button ' + (localizationService.language === language ? 'selected' : '');
    button.textContent = label;
    button.addEventListener('click', () => { localizationService.setLanguage(language); this.scene.restart(); });
    return button;
  }
}
