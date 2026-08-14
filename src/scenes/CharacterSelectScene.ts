import Phaser from 'phaser';

import { SceneKey } from '../core/sceneKeys';
import { GAMEPLAY_SKINS_BY_CLASS, PORTRAIT_SKIN_BY_CLASS, getCharacterSkin } from '../data/characterSkins';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import { PLAYER_CLASS_IDS, type PlayerClassId } from '../entities/player/playerTypes';
import { t } from '../i18n/LocalizationService';
import { createDomOverlay, createPixelSprite } from '../ui/domOverlay';

export class CharacterSelectScene extends Phaser.Scene {
  private selectedClass: PlayerClassId = 'warrior';
  private skinIndex: Record<PlayerClassId, number> = { warrior: 0, archer: 0, mage: 0 };
  private overlay!: HTMLDivElement;
  public constructor() { super(SceneKey.CharacterSelect); }

  public create(): void {
    this.overlay = createDomOverlay(this, 'character-select-ui');
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.render();
  }

  private render(): void {
    this.overlay.replaceChildren();
    const shell = document.createElement('section'); shell.className = 'character-select-shell';
    const heading = document.createElement('header');
    heading.innerHTML = `<h1>${t('select.title')}</h1><p>${t('select.intro')}</p>`;
    shell.append(heading);
    const classes = document.createElement('div'); classes.className = 'class-card-grid';
    PLAYER_CLASS_IDS.forEach((classId) => classes.append(this.createClassCard(classId))); shell.append(classes);
    const selector = document.createElement('section'); selector.className = 'skin-selector-panel';
    const selectorHeading = document.createElement('div'); selectorHeading.className = 'selector-heading';
    selectorHeading.innerHTML = `<div><span>${t('select.skin')}</span><h2>${t(`class.${this.selectedClass}`)}</h2></div><small>${t('select.sideHelp')}</small>`;
    selector.append(selectorHeading);
    const skinGrid = document.createElement('div'); skinGrid.className = 'skin-card-grid';
    GAMEPLAY_SKINS_BY_CLASS[this.selectedClass].forEach((skin, index) => skinGrid.append(this.createSkinCard(skin.id, index)));
    selector.append(skinGrid);
    const footer = document.createElement('footer');
    const back = document.createElement('button'); back.type = 'button'; back.className = 'ui-button ghost'; back.textContent = t('select.back');
    back.addEventListener('click', () => this.scene.start(SceneKey.MainMenu));
    const play = document.createElement('button'); play.type = 'button'; play.className = 'ui-button play'; play.textContent = t('select.play');
    play.addEventListener('click', () => this.playSelectedSkin()); footer.append(back, play); selector.append(footer); shell.append(selector); this.overlay.append(shell);
  }

  private createClassCard(classId: PlayerClassId): HTMLButtonElement {
    const config = PLAYER_CLASS_CONFIGS[classId]; const portrait = getCharacterSkin(PORTRAIT_SKIN_BY_CLASS[classId]);
    const button = document.createElement('button'); button.type = 'button';
    button.className = `class-card ${classId === this.selectedClass ? 'selected' : ''}`; button.style.setProperty('--class-accent', config.accentColor);
    const art = document.createElement('div'); art.className = 'class-portrait'; art.append(createPixelSprite(portrait.animations.idle.url, 64, 64, 1, 2));
    const copy = document.createElement('div'); copy.className = 'class-card-copy';
    copy.innerHTML = `<strong>${t(`class.${classId}`)}</strong><span>${config.maxHealth} HP · ${config.moveSpeed} SPD</span>`;
    button.append(art, copy); button.addEventListener('click', () => { this.selectedClass = classId; this.render(); }); return button;
  }

  private createSkinCard(skinId: string, index: number): HTMLButtonElement {
    const skin = getCharacterSkin(skinId); const selected = index === this.skinIndex[this.selectedClass];
    const button = document.createElement('button'); button.type = 'button'; button.className = `skin-card ${selected ? 'selected' : ''}`;
    const art = document.createElement('div'); art.className = 'skin-card-art'; const animation = skin.animations.idle;
    const maxScale = Math.max(1, Math.floor(Math.min(150 / animation.frameWidth, 108 / animation.frameHeight)));
    const previewScale = skin.id === 'skeleton-warrior' ? 2 : Math.min(maxScale, Math.max(1, Math.round(skin.displayScale)));
    art.append(createPixelSprite(animation.url, animation.frameWidth, animation.frameHeight, animation.frames, previewScale));
    const copy = document.createElement('div'); copy.className = 'skin-card-copy';
    copy.innerHTML = `<strong>${skin.displayName}</strong><span>${skin.compatibility === 'SIDE_VIEW_ONLY' ? t('select.sideOnly') : skin.compatibility.replaceAll('_', ' ')}</span>`;
    button.append(art, copy); button.addEventListener('click', () => { this.skinIndex[this.selectedClass] = index; this.render(); }); return button;
  }

  private playSelectedSkin(): void {
    const skin = GAMEPLAY_SKINS_BY_CLASS[this.selectedClass][this.skinIndex[this.selectedClass]]; if (!skin) return;
    this.registry.set('selectedClass', this.selectedClass); this.registry.set('selectedSkin', skin.id);
    this.registry.set(`selectedSkin:${this.selectedClass}`, skin.id); this.scene.start(SceneKey.Game);
  }
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Digit1') this.selectClass('warrior'); if (event.code === 'Digit2') this.selectClass('archer'); if (event.code === 'Digit3') this.selectClass('mage');
    if (event.code === 'ArrowLeft') this.cycleSkin(-1); if (event.code === 'ArrowRight') this.cycleSkin(1);
    if (event.code === 'Enter') this.playSelectedSkin(); if (event.code === 'Escape') this.scene.start(SceneKey.MainMenu);
  }
  private selectClass(classId: PlayerClassId): void { this.selectedClass = classId; this.render(); }
  private cycleSkin(delta: number): void { const skins = GAMEPLAY_SKINS_BY_CLASS[this.selectedClass]; this.skinIndex[this.selectedClass] = Phaser.Math.Wrap(this.skinIndex[this.selectedClass] + delta, 0, skins.length); this.render(); }
  private shutdown(): void { this.input.keyboard?.off('keydown', this.handleKeyDown, this); }
}
