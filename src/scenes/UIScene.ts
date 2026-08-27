import Phaser from 'phaser';
import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { EquipmentPanels } from '../ui/EquipmentPanels';
import { SKILL_ICONS } from '../ui/itemIcons';
import { ADVANCED_SKILLS } from '../data/advancedSkills';
import { gameProgressService } from '../systems/save/GameProgressService';
import type { HudNotification } from '../systems/notifications/notifications';

import coinIconUrl from '../../assets/ui/hud/coin-icon.png';
import heartFullUrl from '../../assets/ui/hud/heart-full.png';
import heavySlashIconUrl from '../../assets/ui/skills/heavy-slash.png';
import piercingShotIconUrl from '../../assets/ui/skills/piercing-shot.svg';
import blinkIconUrl from '../../assets/ui/skills/arcane-blink.svg';
import { SceneKey } from '../core/sceneKeys';
import { PLAYER_CLASS_CONFIGS } from '../data/playerClasses';
import type { PlayerClassId } from '../entities/player/playerTypes';
import { t, type TranslationKey } from '../i18n/LocalizationService';

type BarParts = { fill: HTMLDivElement; value: HTMLSpanElement };
type HotbarSlot = { root: HTMLDivElement; icon: HTMLElement; count: HTMLSpanElement; cooldown: HTMLSpanElement };


export class UIScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private health!: BarParts;
  private mana!: BarParts;
  private xp!: BarParts;
  private coinText!: HTMLSpanElement;
  private levelText!: HTMLSpanElement;
  private classText!: HTMLDivElement;
  private interactionNotice!: HTMLDivElement;
  private interactionText!: HTMLSpanElement;
  private dodgeIndicator!: HTMLDivElement;
  private skillSlot!: HotbarSlot;
  private healthPotion!: HotbarSlot;
  private manaPotion!: HotbarSlot;
  private targetPanel!: HTMLElement;
  private targetName!: HTMLSpanElement;
  private targetFill!: HTMLDivElement;
  private targetValue!: HTMLSpanElement;
  private minimapPlayer!: HTMLSpanElement;
  private objectives!: HTMLDivElement;
  private notifications!: HTMLDivElement;
  private panels!: EquipmentPanels;
  private advancedSlots!: Record<2 | 3, HotbarSlot>;
  private objectiveSignature = '';
  private dungeonIndicator!: HTMLElement;
  private nextRefresh = 0;
  private lastNotificationId = 0;
  private skillReadyLastFrame = true;
  private lastCoins = 0;
  private coinIcon!: HTMLImageElement;

  public constructor() { super(SceneKey.UI); }

  public create(data: { player: PlayerCharacter }): void {
    const app = this.game.canvas.parentElement;
    if (!app) throw new Error('Game parent element is unavailable.');
    app.querySelector('.ashvale-hud')?.remove();
    this.objectiveSignature = ''; this.lastNotificationId = 0; this.nextRefresh = 0; this.lastCoins = Number(this.registry.get('coins') ?? 0);
    const overlay = element('div', 'ashvale-hud');
    overlay.setAttribute('aria-label', t('hud.status'));

    const status = element('section', 'hud-status-panel');
    const healthRow = element('div', 'hud-primary-row');
    const heart = document.createElement('img'); heart.className = 'hud-heart'; heart.src = heartFullUrl; heart.alt = '';
    this.health = this.createBar('health', 'HP');
    healthRow.append(heart, this.health.fill.parentElement!);
    this.mana = this.createBar('mana', t('hud.mana'));
    this.xp = this.createBar('xp', t('hud.xp'));
    const meta = element('div', 'hud-meta-row');
    const coins = element('span', 'hud-coins');
    this.coinIcon = document.createElement('img'); this.coinIcon.src = coinIconUrl; this.coinIcon.alt = '';
    this.coinText = document.createElement('span'); coins.append(this.coinIcon, this.coinText);
    this.levelText = element('span', 'hud-level');
    meta.append(coins, this.levelText);
    this.classText = element('div', 'hud-class');
    status.append(healthRow, this.mana.fill.parentElement!, this.xp.fill.parentElement!, meta, this.classText);

    this.targetPanel = element('section', 'hud-target');
    this.targetName = element('span', 'hud-target-name');
    const targetTrack = element('div', 'hud-target-track');
    this.targetFill = element('div', 'hud-target-fill');
    this.targetValue = element('span', 'hud-target-value');
    targetTrack.append(this.targetFill, this.targetValue); this.targetPanel.append(this.targetName, targetTrack);

    const rightRail = element('aside', 'hud-right-rail');
    const minimap = element('div', 'hud-minimap');
    this.dungeonIndicator = element('div', 'dungeon-indicator'); rightRail.append(this.dungeonIndicator); minimap.setAttribute('aria-label', t('hud.minimap'));
    for (const [kind, x, y] of [['hub', 50, 60], ['forge', 43, 53], ['infirmary', 57, 53], ['board', 50, 57], ['slime', 18, 28], ['spider', 84, 31], ['dungeon', 95.42, 25.39]] as const) {
      const marker = element('span', `map-marker map-${kind}`); marker.style.left = `${x}%`; marker.style.top = `${y}%`; if (kind === 'dungeon') marker.title = t('dungeon.enter'); minimap.append(marker);
    }
    this.minimapPlayer = element('span', 'map-marker map-player'); minimap.append(this.minimapPlayer);
    this.objectives = element('div', 'hud-objectives');
    rightRail.append(minimap, this.objectives);

    const hotbar = element('nav', 'hud-hotbar');
    this.skillSlot = this.createHotbarSlot('1', 'skill');
    this.advancedSlots = { 2: this.createHotbarSlot('2', 'skill'), 3: this.createHotbarSlot('3', 'skill') };
    hotbar.append(this.skillSlot.root, this.advancedSlots[2].root, this.advancedSlots[3].root);
    this.healthPotion = this.createHotbarSlot('Q', 'health-potion');
    this.manaPotion = this.createHotbarSlot('E', 'mana-potion');
    hotbar.append(this.healthPotion.root, this.manaPotion.root);
    this.dodgeIndicator = element('div', 'hud-dodge'); hotbar.append(this.dodgeIndicator);

    const utility = element('div', 'hud-utility');
    const inventoryButton = this.utilityButton('I', t('hud.inventory'), () => this.togglePanel('inventory'));
    const characterButton = this.utilityButton('C', t('hud.character'), () => this.togglePanel('character'));
    utility.append(inventoryButton, characterButton);

    this.panels = new EquipmentPanels(this, data.player);

    this.notifications = element('div', 'hud-notifications');
    this.interactionNotice = element('div', 'interaction-notification');
    const interactionKey = document.createElement('kbd'); interactionKey.textContent = 'F'; this.interactionText = document.createElement('span');
    this.interactionNotice.append(interactionKey, this.interactionText);
    overlay.append(status, this.targetPanel, rightRail, hotbar, utility, this.panels.inventory, this.panels.character, this.notifications, this.interactionNotice);
    app.append(overlay); this.overlay = overlay;
    window.addEventListener('keydown', this.handleUiKey);
    this.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  public update(time: number): void { if (time < this.nextRefresh) return; this.nextRefresh = time + 50; this.refresh(); }

  private refresh(): void {
    if (!this.overlay) return;
    const classId = (this.registry.get('activeClass') ?? 'warrior') as PlayerClassId;
    const config = PLAYER_CLASS_CONFIGS[classId];
    const health = numberValue(this.registry.get('playerHealth'), config.maxHealth);
    const maxHealth = Math.max(1, numberValue(this.registry.get('playerMaxHealth'), config.maxHealth));
    const mana = numberValue(this.registry.get('playerMana'), 100);
    const maxMana = Math.max(1, numberValue(this.registry.get('playerMaxMana'), 100));
    const level = Math.max(1, Math.floor(numberValue(this.registry.get('playerLevel'), 1)));
    const xp = Math.max(0, numberValue(this.registry.get('playerXp'), 0));
    const xpRequired = Math.max(1, numberValue(this.registry.get('playerXpRequired'), 100));
    this.updateBar(this.health, health, maxHealth); this.updateBar(this.mana, mana, maxMana); this.updateBar(this.xp, xp, xpRequired);
    this.levelText.textContent = t('hud.level', { level });
    const coins = Math.max(0, Math.floor(numberValue(this.registry.get('coins'), 0))); this.coinText.textContent = String(coins);
    if (coins > this.lastCoins) { this.coinIcon.classList.remove('coin-gained'); void this.coinIcon.offsetWidth; this.coinIcon.classList.add('coin-gained'); } this.lastCoins = coins;
    const skin = String(this.registry.get('activeSkin') ?? '');
    this.classText.textContent = `${t(`class.${classId}` as TranslationKey)} · ${skin}${import.meta.env.DEV ? ' · DEV F1–F3 / ⇧Q ⇧E' : ''}`;
    this.classText.style.color = config.accentColor;
    this.refreshHotbar(classId);
    this.refreshTarget(); this.refreshMinimap(); this.refreshObjectives(); this.refreshNotifications(); this.refreshInteraction();
    this.panels.refresh();
  }

  private refreshHotbar(classId: PlayerClassId): void {
    const dodge = numberValue(this.registry.get('dodgeCooldownMs'), 0);
    this.dodgeIndicator.textContent = 'SPACE · ' + (dodge > 0 ? (dodge / 1000).toFixed(1) : t('dodge.ready'));
    this.dodgeIndicator.title = t('dodge.name'); this.dodgeIndicator.classList.toggle('cooldown', dodge > 0);
    const cooldown = Math.max(0, numberValue(this.registry.get('skill1CooldownMs'), 0));
    const total = Math.max(1, numberValue(this.registry.get('skill1CooldownTotalMs'), 5_000));
    const icon = this.skillSlot.icon as HTMLImageElement;
    icon.src = classId === 'warrior' ? heavySlashIconUrl : classId === 'archer' ? piercingShotIconUrl : blinkIconUrl;
    icon.title = t(`skill.${classId}` as TranslationKey);
    this.updateCooldown(this.skillSlot, cooldown, total); this.skillSlot.count.textContent = '0 MP';
    const ready = cooldown <= 0;
    if (ready && !this.skillReadyLastFrame) { this.skillSlot.root.classList.remove('ready-flash'); void this.skillSlot.root.offsetWidth; this.skillSlot.root.classList.add('ready-flash'); }
    this.skillReadyLastFrame = ready;
    for (const index of [2, 3] as const) {
      const skill = ADVANCED_SKILLS[classId][index]; const slot = this.advancedSlots[index];
      const image = slot.icon as HTMLImageElement;
      if (!image.src.endsWith(SKILL_ICONS[skill.id])) image.src = SKILL_ICONS[skill.id];
      image.title = t(skill.name); slot.root.setAttribute('aria-label', t(skill.name));
      slot.count.textContent = skill.mana + ' MP';
      this.updateCooldown(slot, numberValue(this.registry.get('skill' + index + 'CooldownMs'), 0), skill.cooldownMs * numberValue(this.registry.get('equipmentCooldownMultiplier'), 1));
      slot.root.classList.toggle('no-mana', numberValue(this.registry.get('playerMana'), 100) < skill.mana);
      slot.root.classList.toggle('cast-denied', numberValue(this.registry.get('skillDeniedSlot'), 0) === index && numberValue(this.registry.get('skillDeniedUntil'), 0) > numberValue(this.registry.get('gameTime'), 0));
    }
    this.healthPotion.count.textContent = String(Math.floor(numberValue(this.registry.get('healthPotions'), 0)));
    this.manaPotion.count.textContent = String(Math.floor(numberValue(this.registry.get('manaPotions'), 0)));
    const potionTotal = Math.max(1, numberValue(this.registry.get('potionCooldownTotalMs'), 2_000));
    this.updateCooldown(this.healthPotion, numberValue(this.registry.get('healthPotionCooldownMs'), 0), potionTotal);
    this.updateCooldown(this.manaPotion, numberValue(this.registry.get('manaPotionCooldownMs'), 0), potionTotal);
  }

  private refreshTarget(): void {
    const visible = this.registry.get('targetVisible') === true;
    this.targetPanel.classList.toggle('visible', visible);
    if (!visible) return;
    const key = this.registry.get('targetNameKey'); if (typeof key === 'string') this.targetName.textContent = String(this.registry.get('targetDisplayName') ?? '') || t(key as TranslationKey);
    this.targetPanel.classList.toggle('boss-target', this.registry.get('targetIsBoss') === true);
    const health = Math.max(0, numberValue(this.registry.get('targetHealth'), 0)); const max = Math.max(1, numberValue(this.registry.get('targetMaxHealth'), 1));
    this.targetFill.style.width = `${Phaser.Math.Clamp(health / max, 0, 1) * 100}%`; this.targetValue.textContent = `${Math.ceil(health)} / ${max}`;
  }

  private refreshMinimap(): void {
    const dungeon = this.registry.get('inDungeon') === true;
    this.minimapPlayer.parentElement!.classList.toggle('dungeon-hidden', dungeon);
    this.dungeonIndicator.classList.toggle('visible', dungeon);
    if (dungeon) { this.dungeonIndicator.textContent = t('dungeon.name') + '\n' + t('dungeon.room', { room: numberValue(this.registry.get('dungeonRoom'), 1) }); return; }
    const worldWidth = Math.max(1, numberValue(this.registry.get('worldWidth'), 3840)); const worldHeight = Math.max(1, numberValue(this.registry.get('worldHeight'), 2048));
    this.minimapPlayer.style.left = `${Phaser.Math.Clamp(numberValue(this.registry.get('playerX'), worldWidth / 2) / worldWidth, 0, 1) * 100}%`;
    this.minimapPlayer.style.top = `${Phaser.Math.Clamp(numberValue(this.registry.get('playerY'), worldHeight / 2) / worldHeight, 0, 1) * 100}%`;
  }

  private refreshObjectives(): void {
    const signature = String(gameProgressService.version);
    if (signature === this.objectiveSignature) return;
    this.objectiveSignature = signature;
    const rows: string[] = [];
    const slime = Math.floor(numberValue(this.registry.get('slimeKills'), 0)); const slimeTarget = Math.floor(numberValue(this.registry.get('slimeTarget'), 5));
    const spider = Math.floor(numberValue(this.registry.get('spiderKills'), 0)); const spiderTarget = Math.floor(numberValue(this.registry.get('spiderTarget'), 3));
    if (slime < slimeTarget) rows.push(`<span>${escapeHtml(t('objective.slime'))}</span><b>${slime}/${slimeTarget}</b>`);
    if (spider < spiderTarget) rows.push(`<span>${escapeHtml(t('objective.spider'))}</span><b>${spider}/${spiderTarget}</b>`);
    const milestones = gameProgressService.snapshot.milestones;
    if (rows.length === 0) {
      if (!milestones.eliteKilled) rows.push('<span>' + escapeHtml(t('objective.elite')) + '</span>');
      if (!milestones.dungeonEntered) rows.push('<span>' + escapeHtml(t('objective.dungeon')) + '</span>');
      if (!milestones.bossFirstKill) rows.push('<span>' + escapeHtml(t('objective.boss')) + '</span>');
    }
    this.objectives.innerHTML = rows.length ? `<h3>${escapeHtml(t('hud.objectives'))}</h3>${rows.map((row) => `<div>${row}</div>`).join('')}` : '';
    this.objectives.classList.toggle('empty', rows.length === 0);
  }

  private refreshNotifications(): void {
    const value = this.registry.get('hudNotifications'); if (!Array.isArray(value)) return;
    (value as HudNotification[]).forEach((item) => {
      if (item.id <= this.lastNotificationId) return;
      this.lastNotificationId = item.id;
      const node = element('div', 'hud-toast'); node.textContent = item.message; this.notifications.append(node);
      while (this.notifications.childElementCount > 4) this.notifications.firstElementChild?.remove();
      if (item.color) node.style.borderColor = item.color;
      this.time.delayedCall(2400, () => { node.classList.add('leaving'); this.time.delayedCall(220, () => node.remove()); });
    });
  }

  private refreshInteraction(): void {
    const promptKey = this.registry.get('interactionPromptKey'); const visible = typeof promptKey === 'string' && promptKey.length > 0;
    if (visible) this.interactionText.textContent = t(promptKey as TranslationKey); this.interactionNotice.classList.toggle('visible', visible);
  }

  private createBar(kind: string, label: string): BarParts {
    const track = element('div', `hud-resource hud-${kind}`); const caption = element('span', 'hud-resource-label'); caption.textContent = label;
    const fill = element('div', 'hud-resource-fill'); const value = element('span', 'hud-resource-value'); track.append(caption, fill, value); return { fill, value };
  }

  private updateBar(bar: BarParts, value: number, max: number): void { bar.fill.style.width = `${Phaser.Math.Clamp(value / max, 0, 1) * 100}%`; bar.value.textContent = `${Math.floor(value)} / ${Math.floor(max)}`; }

  private createHotbarSlot(key: string, kind: 'skill' | 'health-potion' | 'mana-potion'): HotbarSlot {
    const root = element('div', `hud-hotbar-slot slot-${kind}`); const iconWrap = element('div', 'hotbar-icon');
    const icon = kind === 'skill' ? document.createElement('img') : element('span', 'potion-glyph');
    if (kind !== 'skill') icon.setAttribute('title', t(kind === 'health-potion' ? 'potion.health' : 'potion.mana'));
    const keyNode = document.createElement('kbd'); keyNode.textContent = key; const count = element('span', 'hotbar-count'); const cooldown = element('span', 'hotbar-cooldown');
    iconWrap.append(icon, keyNode, count, cooldown); root.append(iconWrap); return { root, icon, count, cooldown };
  }

  private updateCooldown(slot: HotbarSlot, remaining: number, total: number): void {
    const value = Math.max(0, remaining); slot.cooldown.textContent = value > 0 ? (value / 1000).toFixed(1) : '';
    slot.root.style.setProperty('--cooldown', String(Phaser.Math.Clamp(value / total, 0, 1))); slot.root.classList.toggle('cooldown', value > 0);
  }

  private utilityButton(key: string, label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-utility-button'; button.innerHTML = `<kbd>${key}</kbd><span>${escapeHtml(label)}</span>`; button.addEventListener('click', action); return button;
  }

  private handleUiKey = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === 'Escape') this.panels.close();
    if (event.code === 'KeyI') this.togglePanel('inventory');
    if (event.code === 'KeyC') this.togglePanel('character');
  };

  private togglePanel(panel: 'inventory' | 'character'): void {
    if (this.registry.get('shopOpen') === true) return;
    this.panels.toggle(panel);
  }

  private shutdown(): void { this.panels.destroy(); window.removeEventListener('keydown', this.handleUiKey); this.overlay?.remove(); this.overlay = undefined; }
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.className = className; return node; }
function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function escapeHtml(value: string): string { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
