import './forge-shop.css';
import type Phaser from 'phaser';
import type { PlayerCharacter } from '../entities/player/PlayerCharacter';
import { EQUIPMENT_CONFIG, ITEM_DEFINITIONS, RARITY_COLORS, type ItemInstance } from '../data/equipment';
import { buyPrice, sellPrice, ECONOMY_CONFIG, type PotionKind } from '../data/gameplayEconomy';
import { gameProgressService } from '../systems/save/GameProgressService';
import { notify } from '../systems/notifications/notifications';
import { t, type TranslationKey } from '../i18n/LocalizationService';
import { ITEM_ICONS } from './itemIcons';
import { appendItemStats, appendComparison } from './ItemDetails';
import coinIcon from '../../assets/ui/hud/coin-icon.png';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.className = className; value.textContent = text; return value;
}
export class ForgeShop {
  private readonly overlay = node('div', 'forge-shop-overlay');
  private readonly panel = node('section', 'forge-shop-panel');
  private readonly content = node('div', 'forge-shop-content');
  private readonly balance = node('span', 'forge-shop-balance');
  private readonly message = node('p', 'forge-shop-message');
  private mode: 'buy' | 'sell' = 'buy';
  private confirmId?: string;
  private signature = '';
  public isOpen = false;
  public constructor(private readonly scene: Phaser.Scene, private readonly player: PlayerCharacter) {
    const header = node('header', 'equipment-heading');
    const coins = node('img', 'equipment-icon'); coins.src = coinIcon; coins.alt = '';
    header.append(node('h2', '', t('shop.title')), coins, this.balance, this.button('×', () => this.close()));
    const tabs = node('nav', 'forge-shop-tabs');
    for (const mode of ['buy', 'sell'] as const) tabs.append(this.button(t(mode === 'buy' ? 'shop.buyMode' : 'shop.sellMode'), () => { this.mode = mode; this.confirmId = undefined; this.render(); }));
    this.message.setAttribute('role', 'status');
    this.panel.append(header, tabs, this.content, this.message); this.overlay.append(this.panel);
    this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-modal', 'true'); this.panel.setAttribute('aria-label', t('shop.title'));
    this.overlay.hidden = true; this.overlay.inert = true;
    this.overlay.addEventListener('pointerdown', event => event.stopPropagation());
    this.content.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
    scene.game.canvas.parentElement!.append(this.overlay);
    window.addEventListener('keydown', this.keydown);
  }
  public open(): void {
    if (!gameProgressService.snapshot.buildings.forge || !this.player.alive) return;
    gameProgressService.ensureShop(this.player.activeClass); this.isOpen = true; this.mode = 'buy';
    this.confirmId = undefined; this.message.textContent = ''; this.overlay.hidden = false; this.overlay.inert = false;
    this.scene.registry.set('shopOpen', true); this.player.cancelDodge(); this.render();
  }
  public close(): void { this.isOpen = false; this.confirmId = undefined; this.overlay.hidden = true; this.overlay.inert = true; this.scene.registry.set('shopOpen', false); }
  public update(): void {
    if (!this.isOpen) return;
    if (!this.player.alive) { this.close(); return; }
    if (this.signature !== gameProgressService.version + ':' + this.player.activeClass) this.render();
  }
  public destroy(): void { this.close(); window.removeEventListener('keydown', this.keydown); this.overlay.remove(); }
  private keydown = (event: KeyboardEvent): void => { if (this.isOpen && event.code === 'Escape') { event.preventDefault(); this.close(); } };
  private button(label: string, action: () => void): HTMLButtonElement {
    const button = node('button', 'equipment-action', label); button.type = 'button';
    // Detached old buttons cannot charge again through queued double-click callbacks.
    button.onclick = () => { if (!button.isConnected || !this.isOpen) return; action(); };
    return button;
  }
  private result(result: string, selling = false): void {
    const key: TranslationKey = result === 'ok' ? (selling ? 'shop.sold' : 'shop.success') : result === 'coins' ? 'shop.coins' : result === 'full' ? 'equipment.full' : 'shop.missing';
    this.message.textContent = t(key); notify(this.scene, t(key), 'shop-result');
    this.render();
  }
  private render(): void {
    const offers = gameProgressService.ensureShop(this.player.activeClass), saved = gameProgressService.snapshot;
    this.signature = gameProgressService.version + ':' + this.player.activeClass;
    this.balance.textContent = String(saved.coins); this.content.replaceChildren();
    // Header/tab controls stay reusable; transaction controls below are replaced on every result.
    const tabs = this.panel.querySelector('nav')!; tabs.replaceChildren();
    for (const mode of ['buy', 'sell'] as const) {
      const button = this.button(t(mode === 'buy' ? 'shop.buyMode' : 'shop.sellMode'), () => { this.mode = mode; this.confirmId = undefined; this.render(); });
      button.classList.toggle('selected', this.mode === mode); tabs.append(button);
    }
    this.content.append(node('p', 'forge-shop-hint', t(this.mode === 'buy' ? 'shop.stockHint' : 'shop.sellHint')));
    const list = node('div', 'forge-shop-grid'); this.content.append(list);
    if (this.mode === 'buy') {
      for (const kind of ['health', 'mana'] as const) list.append(this.potion(kind, saved.coins));
      offers.forEach(item => list.append(this.item(item, false, saved.coins)));
      if (!offers.length) list.append(node('p', '', t('shop.empty')));
    } else {
      saved.inventory.forEach(item => list.append(this.item(item, true, saved.coins)));
      if (!saved.inventory.length) list.append(node('p', '', t('shop.empty')));
    }
    if (this.confirmId) {
      const item = saved.inventory.find(value => value.id === this.confirmId);
      if (!item) { this.confirmId = undefined; return; }
      const confirmation = node('div', 'forge-shop-confirm');
      confirmation.append(node('h3', '', t('shop.confirm')), node('p', '', t(`item.${item.kind}`) + ' · ' + t(`rarity.${item.rarity}`)),
        this.button(t('shop.sell') + ' · ' + t('shop.price', { coins: sellPrice(item) }), () => {
          const id = this.confirmId; this.confirmId = undefined;
          if (id) this.result(gameProgressService.sellItem(id, true), true);
        }), this.button(t('shop.cancel'), () => { this.confirmId = undefined; this.render(); }));
      list.inert = true; this.content.prepend(confirmation); this.content.scrollTop = 0;
    }
  }
  private potion(kind: PotionKind, coins: number): HTMLElement {
    const card = node('article', 'forge-shop-card potion-card slot-' + kind + '-potion');
    card.append(node('span', 'potion-glyph'), node('h3', '', t(kind === 'health' ? 'shop.health' : 'shop.mana')));
    const transactionId = crypto.randomUUID(), cost = ECONOMY_CONFIG.potionPrices[kind];
    const buy = this.button(t('shop.buy') + ' · ' + t('shop.price', { coins: cost }), () => this.result(gameProgressService.buyPotion(kind, transactionId)));
    buy.classList.toggle('unaffordable', coins < cost); card.append(buy); return card;
  }
  private item(item: ItemInstance, selling: boolean, coins: number): HTMLElement {
    const card = node('article', 'forge-shop-card'); card.style.setProperty('--rarity', RARITY_COLORS[item.rarity]);
    const icon = node('img', 'equipment-icon'); icon.src = ITEM_ICONS[item.kind]; icon.alt = '';
    const title = node('h3', '', t(`item.${item.kind}`)); title.style.color = RARITY_COLORS[item.rarity];
    card.append(icon, title, node('small', '', t(`rarity.${item.rarity}`) + ' · ' + t('equipment.level', { level: item.itemLevel })));
    const definition = ITEM_DEFINITIONS[item.kind];
    card.append(node('small', '', t(`equipment.${definition.slot}`) + (definition.classId ? ' · ' + t(`class.${definition.classId}`) : '')));
    appendItemStats(card, item);
    if (!selling) {
      const compare = node('details', 'shop-comparison'); compare.append(node('summary', '', t('equipment.onEquip')));
      appendComparison(compare, item, gameProgressService.snapshot.equipment, this.player.activeClass); card.append(compare);
    }
    const cost = selling ? sellPrice(item) : buyPrice(item);
    const button = this.button(t(selling ? 'shop.sell' : 'shop.buy') + ' · ' + t('shop.price', { coins: cost }), () => {
      if (!selling) { this.result(gameProgressService.buyEquipment(item.id, this.player.activeClass)); return; }
      const result = gameProgressService.sellItem(item.id);
      if (result === 'confirm') { this.confirmId = item.id; this.render(); } else this.result(result, true);
    });
    button.classList.toggle('unaffordable', !selling && coins < cost);
    button.disabled = !selling && gameProgressService.snapshot.inventory.length >= EQUIPMENT_CONFIG.capacity;
    if (button.disabled) button.title = t('equipment.full');
    card.append(button); return card;
  }
}
