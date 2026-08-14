import Phaser from 'phaser';

import coinIconUrl from '../../assets/ui/hud/coin-icon.png';
import heartFullUrl from '../../assets/ui/hud/heart-full.png';
import heavySlashIconUrl from '../../assets/ui/skills/heavy-slash.png';
import piercingShotIconUrl from '../../assets/ui/skills/piercing-shot.png';
import magicBurstIconUrl from '../../assets/ui/skills/magic-burst.png';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import type { PlayerClassId } from '../entities/player/playerTypes';
import { t } from '../i18n/LocalizationService';

export class UIScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private healthFill?: HTMLDivElement;
  private healthText?: HTMLSpanElement;
  private coinText?: HTMLSpanElement;
  private classText?: HTMLDivElement;
  private coinIcon?: HTMLImageElement;
  private skillSlot?: HTMLDivElement;
  private skillIcon?: HTMLImageElement;
  private skillName?: HTMLSpanElement;
  private skillCooldown?: HTMLSpanElement;
  private interactionNotice?: HTMLDivElement;
  private interactionText?: HTMLSpanElement;
  private skillReadyLastFrame = true;
  private lastCoins = 0;
  public constructor() { super(SceneKey.UI); }

  public create(): void {
    const app = this.game.canvas.parentElement; if (!app) throw new Error('Game parent element is unavailable.');
    app.querySelector('.ashvale-hud')?.remove();
    const overlay = document.createElement('div'); overlay.className = 'ashvale-hud'; overlay.setAttribute('aria-label', t('hud.status'));
    const panel = document.createElement('section'); panel.className = 'hud-panel';
    const heart = document.createElement('img'); heart.className = 'hud-heart'; heart.src = heartFullUrl; heart.alt = '';
    const health = document.createElement('div'); health.className = 'hud-health';
    const healthTrack = document.createElement('div'); healthTrack.className = 'hud-health-track';
    this.healthFill = document.createElement('div'); this.healthFill.className = 'hud-health-fill';
    this.healthText = document.createElement('span'); this.healthText.className = 'hud-health-value';
    healthTrack.append(this.healthFill, this.healthText); health.append(healthTrack);
    const coins = document.createElement('div'); coins.className = 'hud-coins';
    this.coinIcon = document.createElement('img'); this.coinIcon.src = coinIconUrl; this.coinIcon.alt = '';
    this.coinText = document.createElement('span'); coins.append(this.coinIcon, this.coinText);
    this.classText = document.createElement('div'); this.classText.className = 'hud-class';
    this.skillSlot = document.createElement('div'); this.skillSlot.className = 'hud-skill-slot';
    const iconWrap = document.createElement('div'); iconWrap.className = 'hud-skill-icon-wrap';
    this.skillIcon = document.createElement('img'); this.skillIcon.className = 'hud-skill-icon'; this.skillIcon.alt = '';
    const skillKey = document.createElement('kbd'); skillKey.textContent = '1';
    this.skillName = document.createElement('span'); this.skillName.className = 'hud-skill-name';
    this.skillCooldown = document.createElement('span'); this.skillCooldown.className = 'hud-skill-cooldown';
    iconWrap.append(this.skillIcon, skillKey, this.skillCooldown);
    this.skillSlot.append(iconWrap, this.skillName);
    this.interactionNotice = document.createElement('div'); this.interactionNotice.className = 'interaction-notification';
    const interactionKey = document.createElement('kbd'); interactionKey.textContent = 'F';
    this.interactionText = document.createElement('span');
    this.interactionNotice.append(interactionKey, this.interactionText);
    panel.append(heart, health, coins, this.classText); overlay.append(panel, this.skillSlot, this.interactionNotice); app.append(overlay); this.overlay = overlay;
    this.refresh(); this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }
  public update(): void { this.refresh(); }

  private refresh(): void {
    if (!this.healthFill || !this.healthText || !this.coinText || !this.classText || !this.coinIcon) return;
    const classId = (this.registry.get('activeClass') ?? 'warrior') as PlayerClassId;
    const config = PLAYER_CLASS_CONFIGS[classId];
    const health = Math.max(0, numberFromRegistry(this.registry.get('playerHealth'), config.maxHealth));
    const maxHealth = Math.max(1, numberFromRegistry(this.registry.get('playerMaxHealth'), config.maxHealth));
    const coins = Math.max(0, Math.floor(numberFromRegistry(this.registry.get('coins'), 0)));
    this.healthFill.style.width = `${Phaser.Math.Clamp(health / maxHealth, 0, 1) * 100}%`;
    this.healthText.textContent = `${Math.ceil(health)} / ${maxHealth}`; this.coinText.textContent = String(coins);
    const skin = String(this.registry.get('activeSkin') ?? ''); const devControls = import.meta.env.DEV ? ' · DEV F1–F3 / Q E' : '';
    this.classText.textContent = `${t(`class.${classId}`)} · ${skin}${devControls}`; this.classText.style.color = config.accentColor;
    if (coins > this.lastCoins) { this.coinIcon.classList.remove('coin-gained'); void this.coinIcon.offsetWidth; this.coinIcon.classList.add('coin-gained'); }
    this.lastCoins = coins;
    this.refreshSkill();
    this.refreshInteraction();
  }
  private refreshSkill(): void {
    if (!this.skillSlot || !this.skillIcon || !this.skillName || !this.skillCooldown) return;
    const classId = (this.registry.get('activeClass') ?? 'warrior') as PlayerClassId;
    const nameKey = this.registry.get('skill1NameKey');
    const cooldownMs = Math.max(0, numberFromRegistry(this.registry.get('skill1CooldownMs'), 0));
    const totalMs = Math.max(1, numberFromRegistry(this.registry.get('skill1CooldownTotalMs'), 5000));
    const ready = cooldownMs <= 0;
    if (typeof nameKey === 'string') this.skillName.textContent = t(nameKey as 'skill.warrior' | 'skill.archer' | 'skill.mage');
    this.skillIcon.src = classId === 'warrior' ? heavySlashIconUrl : classId === 'archer' ? piercingShotIconUrl : magicBurstIconUrl;
    this.skillCooldown.textContent = ready ? '' : (cooldownMs / 1000).toFixed(1);
    this.skillSlot.style.setProperty('--cooldown', String(Phaser.Math.Clamp(cooldownMs / totalMs, 0, 1)));
    this.skillSlot.classList.toggle('cooldown', !ready);
    if (ready && !this.skillReadyLastFrame) {
      this.skillSlot.classList.remove('ready-flash'); void this.skillSlot.offsetWidth; this.skillSlot.classList.add('ready-flash');
    }
    this.skillReadyLastFrame = ready;
  }
  private refreshInteraction(): void {
    if (!this.interactionNotice || !this.interactionText) return;
    const promptKey = this.registry.get('interactionPromptKey');
    const visible = promptKey === 'heal.interact' || promptKey === 'restore.interact';
    if (visible) this.interactionText.textContent = t(promptKey);
    this.interactionNotice.classList.toggle('visible', visible);
  }
  private shutdown(): void {
    this.overlay?.remove(); this.overlay = undefined; this.healthFill = undefined; this.healthText = undefined;
    this.coinText = undefined; this.classText = undefined; this.coinIcon = undefined;
    this.skillSlot = undefined; this.skillIcon = undefined; this.skillName = undefined; this.skillCooldown = undefined;
    this.interactionNotice = undefined; this.interactionText = undefined;
  }
}

function numberFromRegistry(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
