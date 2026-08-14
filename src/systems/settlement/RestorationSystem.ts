import Phaser from 'phaser';

import forgeRuinedGroundUrl from '../../../assets/environments/ashvale-hub/building-layers/forge-ruined-ground.png';
import forgeRuinedBuildingUrl from '../../../assets/environments/ashvale-hub/building-layers/forge-ruined-building.png';
import forgeRestoredGroundUrl from '../../../assets/environments/ashvale-hub/building-layers/forge-restored-ground.png';
import forgeRestoredBuildingUrl from '../../../assets/environments/ashvale-hub/building-layers/forge-restored-building.png';
import infirmaryRuinedGroundUrl from '../../../assets/environments/ashvale-hub/building-layers/infirmary-ruined-ground.png';
import infirmaryRuinedBuildingUrl from '../../../assets/environments/ashvale-hub/building-layers/infirmary-ruined-building.png';
import infirmaryRestoredGroundUrl from '../../../assets/environments/ashvale-hub/building-layers/infirmary-restored-ground.png';
import infirmaryRestoredBuildingUrl from '../../../assets/environments/ashvale-hub/building-layers/infirmary-restored-building.png';
import restorationBoardUrl from '../../../assets/environments/ashvale-hub/props/restoration-board.png';
import heartIconUrl from '../../../assets/ui/hud/heart-full.png';
import coinIconUrl from '../../../assets/ui/hud/coin-icon.png';
import infirmaryFrameUrl from '../../../assets/ui/modals/infirmary-frame.png';
import restorationFrameUrl from '../../../assets/ui/modals/restoration-board-frame.png';
import type { PlayerCharacter } from '../../entities/player/PlayerCharacter';
import { gameProgressService } from '../save/GameProgressService';
import { createDomOverlay } from '../../ui/domOverlay';
import { t } from '../../i18n/LocalizationService';
import { HEAL_PER_COIN } from '../../data/gameplayEconomy';
import { ForgeSmokeEmitter } from './ForgeSmokeEmitter';

const TEXTURES = {
  forgeRuinedGround: 'world-forge-ruined-ground', forgeRuinedBuilding: 'world-forge-ruined-building',
  forgeRestoredGround: 'world-forge-restored-ground', forgeRestoredBuilding: 'world-forge-restored-building',
  infirmaryRuinedGround: 'world-infirmary-ruined-ground', infirmaryRuinedBuilding: 'world-infirmary-ruined-building',
  infirmaryRestoredGround: 'world-infirmary-restored-ground', infirmaryRestoredBuilding: 'world-infirmary-restored-building',
  board: 'world-restoration-board',
} as const;
const FORGE_RESTORED_LIVE_TEXTURE = 'world-forge-restored-building-live-smoke';

const FORGE_COST = 12;
const INFIRMARY_COST = 16;
const BOARD_POSITION = { x: 1920, y: 1218 } as const;
const INFIRMARY_INTERACTION_POSITION = { x: 2170, y: 1134 } as const;
const INTERACTION_RANGE = 110;
const BUILDING_SCALE = 0.28;
const BUILDING_ORIGIN = { x: 0.5, y: 1 } as const;
const BUILDING_POSITIONS = {
  forge: { x: 1670, y: 1105, baseY: 1084 },
  infirmary: { x: 2170, y: 1105, baseY: 1076 },
} as const;

const BUILDING_FOOTPRINTS = {
  forge: [
    { offsetX: -106, offsetY: -55, width: 116, height: 64 },
    { offsetX: 0, offsetY: -60, width: 116, height: 78 },
    { offsetX: 106, offsetY: -55, width: 132, height: 64 },
  ],
  infirmary: [
    { offsetX: -112, offsetY: -55, width: 124, height: 62 },
    { offsetX: 0, offsetY: -59, width: 128, height: 76 },
    { offsetX: 112, offsetY: -55, width: 124, height: 62 },
  ],
} as const;

type BuildingLayerPair = {
  ground: Phaser.GameObjects.Image;
  building: Phaser.GameObjects.Image;
};

type FantasyPanelKind = 'restoration' | 'healing';

function createFantasyPanel(kind: FantasyPanelKind, title: string): { panel: HTMLElement; body: HTMLElement } {
  const panel = document.createElement('section');
  panel.className = `fantasy-modal-panel ${kind}-panel`;
  const frame = document.createElement('img');
  frame.className = 'fantasy-frame-art';
  frame.src = kind === 'healing' ? infirmaryFrameUrl : restorationFrameUrl;
  frame.alt = '';
  frame.setAttribute('aria-hidden', 'true');

  const header = document.createElement('header');
  header.className = 'fantasy-modal-header';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const divider = document.createElement('span');
  divider.className = 'fantasy-divider';
  divider.setAttribute('aria-hidden', 'true');
  header.append(heading, divider);

  const body = document.createElement('div');
  body.className = 'fantasy-modal-body';
  const content = document.createElement('div');
  content.className = 'fantasy-modal-content';
  content.append(header, body);
  panel.append(frame, content);
  return { panel, body };
}

function createIconBadge(kind: string, imageUrl?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `fantasy-icon-badge ${kind}`;
  badge.setAttribute('aria-hidden', 'true');
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    badge.append(image);
  }
  return badge;
}

function createHealingRow(kind: 'health' | 'restore' | 'cost', label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = `fantasy-info-row ${kind}`;
  const icon = createIconBadge(kind, kind === 'health' ? heartIconUrl : kind === 'cost' ? coinIconUrl : undefined);
  const copy = document.createElement('p');
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  const valueElement = document.createElement('strong');
  valueElement.textContent = value;
  copy.append(labelElement, valueElement);
  row.append(icon, copy);
  return row;
}

export function preloadRestorationAssets(scene: Phaser.Scene): void {
  scene.load.image(TEXTURES.forgeRuinedGround, forgeRuinedGroundUrl);
  scene.load.image(TEXTURES.forgeRuinedBuilding, forgeRuinedBuildingUrl);
  scene.load.image(TEXTURES.forgeRestoredGround, forgeRestoredGroundUrl);
  scene.load.image(TEXTURES.forgeRestoredBuilding, forgeRestoredBuildingUrl);
  scene.load.image(TEXTURES.infirmaryRuinedGround, infirmaryRuinedGroundUrl);
  scene.load.image(TEXTURES.infirmaryRuinedBuilding, infirmaryRuinedBuildingUrl);
  scene.load.image(TEXTURES.infirmaryRestoredGround, infirmaryRestoredGroundUrl);
  scene.load.image(TEXTURES.infirmaryRestoredBuilding, infirmaryRestoredBuildingUrl);
  scene.load.image(TEXTURES.board, restorationBoardUrl);
}

export class RestorationSystem {
  private readonly forge: BuildingLayerPair;
  private readonly infirmary: BuildingLayerPair;
  private readonly forgeSmoke: ForgeSmokeEmitter;
  private modal?: HTMLDivElement;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerCharacter,
    collisionGroup: Phaser.Physics.Arcade.StaticGroup,
    private readonly onCoinsChanged: (coins: number) => void,
  ) {
    this.ensureAnimatedForgeTexture();
    Object.values(TEXTURES).forEach((key) => scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST));
    const progress = gameProgressService.snapshot;
    this.forge = this.createBuildingLayers('forge', progress.buildings.forge);
    this.infirmary = this.createBuildingLayers('infirmary', progress.buildings.infirmary);
    scene.add.image(BOARD_POSITION.x, BOARD_POSITION.y, TEXTURES.board).setOrigin(.5, 1).setDepth(BOARD_POSITION.y);
    this.addBuildingFootprints(collisionGroup, 'forge');
    this.addBuildingFootprints(collisionGroup, 'infirmary');
    this.addFootprint(collisionGroup, BOARD_POSITION.x, BOARD_POSITION.y - 12, 72, 24);
    this.forgeSmoke = new ForgeSmokeEmitter(scene, BUILDING_POSITIONS.forge.x + 112, BUILDING_POSITIONS.forge.y - 319, BUILDING_POSITIONS.forge.baseY + 2);
    if (progress.buildings.forge) this.forgeSmoke.start();
  }

  public get isModalOpen(): boolean { return this.modal !== undefined; }

  public update(): void {
    if (this.modal) { this.scene.registry.set('interactionPromptKey', ''); return; }
    const progress = gameProgressService.snapshot;
    const nearInfirmary = progress.buildings.infirmary && this.isNear(INFIRMARY_INTERACTION_POSITION);
    const nearBoard = this.isNear(BOARD_POSITION);
    this.scene.registry.set('interactionPromptKey', nearInfirmary ? 'heal.interact' : nearBoard ? 'restore.interact' : '');
  }

  public interact(): boolean {
    if (this.modal) return false;
    if (gameProgressService.snapshot.buildings.infirmary && this.isNear(INFIRMARY_INTERACTION_POSITION)) {
      this.openHealingModal();
      return true;
    }
    if (!this.isNear(BOARD_POSITION)) return false;
    this.openRestorationModal();
    return true;
  }

  public destroy(): void {
    this.modal?.remove();
    this.modal = undefined;
    this.scene.registry.set('interactionPromptKey', '');
    this.forgeSmoke.destroy();
  }

  private addBuildingFootprints(group: Phaser.Physics.Arcade.StaticGroup, building: 'forge' | 'infirmary'): void {
    const position = BUILDING_POSITIONS[building];
    BUILDING_FOOTPRINTS[building].forEach((part) => {
      this.addFootprint(group, position.x + part.offsetX, position.y + part.offsetY, part.width, part.height);
    });
  }

  private addFootprint(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, width: number, height: number): void {
    const zone = this.scene.add.zone(x, y, width, height);
    this.scene.physics.add.existing(zone, true);
    group.add(zone);
  }

  private createBuildingLayers(building: 'forge' | 'infirmary', restored: boolean): BuildingLayerPair {
    const position = BUILDING_POSITIONS[building];
    const textures = this.texturePair(building, restored);
    const configure = (image: Phaser.GameObjects.Image, depth: number): Phaser.GameObjects.Image => image
      .setOrigin(BUILDING_ORIGIN.x, BUILDING_ORIGIN.y)
      .setScale(BUILDING_SCALE)
      .setDepth(depth);
    return {
      ground: configure(this.scene.add.image(position.x, position.y, textures.ground), 1),
      building: configure(this.scene.add.image(position.x, position.y, textures.building), position.baseY),
    };
  }

  private texturePair(building: 'forge' | 'infirmary', restored: boolean): { ground: string; building: string } {
    if (building === 'forge') return restored
      ? {
          ground: TEXTURES.forgeRestoredGround,
          building: this.scene.textures.exists(FORGE_RESTORED_LIVE_TEXTURE)
            ? FORGE_RESTORED_LIVE_TEXTURE
            : TEXTURES.forgeRestoredBuilding,
        }
      : { ground: TEXTURES.forgeRuinedGround, building: TEXTURES.forgeRuinedBuilding };
    return restored
      ? { ground: TEXTURES.infirmaryRestoredGround, building: TEXTURES.infirmaryRestoredBuilding }
      : { ground: TEXTURES.infirmaryRuinedGround, building: TEXTURES.infirmaryRuinedBuilding };
  }

  private ensureAnimatedForgeTexture(): void {
    if (this.scene.textures.exists(FORGE_RESTORED_LIVE_TEXTURE)) return;
    const source = this.scene.textures.get(TEXTURES.forgeRestoredBuilding).getSourceImage();
    if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);
    // The restored source contains a baked plume above the chimney. Remove
    // only that transparent-background area at runtime, leaving the authored
    // building pixels and chimney untouched for animated smoke to replace it.
    context.clearRect(974, 0, 108, 118);
    this.scene.textures.addCanvas(FORGE_RESTORED_LIVE_TEXTURE, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private setBuildingState(building: 'forge' | 'infirmary', restored: boolean): void {
    const pair = building === 'forge' ? this.forge : this.infirmary;
    const textures = this.texturePair(building, restored);
    pair.ground.setTexture(textures.ground);
    pair.building.setTexture(textures.building);
  }

  private isNear(position: { x: number; y: number }): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, position.x, position.y) < INTERACTION_RANGE;
  }

  private openRestorationModal(): void {
    const overlay = createDomOverlay(this.scene, 'restoration-ui');
    this.modal = overlay;
    const progress = gameProgressService.snapshot;
    const { panel, body } = createFantasyPanel('restoration', t('restore.title'));
    const balance = document.createElement('p'); balance.className = 'restoration-balance fantasy-balance-row';
    const coin = createIconBadge('coin', coinIconUrl);
    const coinCopy = document.createElement('span'); coinCopy.textContent = t('restore.coins', { coins: progress.coins });
    balance.append(coin, coinCopy);
    const options = document.createElement('div'); options.className = 'restoration-building-list building-list';
    options.append(
      this.buildButton('forge', FORGE_COST, progress.buildings.forge),
      this.buildButton('infirmary', INFIRMARY_COST, progress.buildings.infirmary),
    );
    body.append(balance, options);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'ui-button fantasy-button fantasy-primary modal-close'; close.textContent = t('restore.close');
    close.addEventListener('click', () => this.closeModal());
    body.append(close);
    overlay.append(panel);
  }

  private openHealingModal(): void {
    const overlay = createDomOverlay(this.scene, 'healing-ui');
    this.modal = overlay;
    const missingHealth = Math.max(0, this.player.maxHealth - this.player.currentHealth);
    const healCost = missingHealth > 0 ? Math.max(1, Math.ceil(missingHealth / HEAL_PER_COIN)) : 0;
    const { panel, body } = createFantasyPanel('healing', t('heal.title'));
    const treatment = document.createElement('div'); treatment.className = 'healing-stats';
    treatment.append(createHealingRow('health', t('heal.healthLabel'), `${this.player.currentHealth} / ${this.player.maxHealth}`));
    body.append(treatment);
    if (missingHealth === 0) {
      const message = document.createElement('p'); message.className = 'healing-message'; message.textContent = t('heal.notNeeded');
      const heal = document.createElement('button');
      heal.type = 'button';
      heal.className = 'ui-button fantasy-button fantasy-primary heal';
      heal.textContent = t('heal.action');
      heal.disabled = true;
      treatment.append(
        createHealingRow('restore', t('heal.restoreLabel'), '0 HP'),
        createHealingRow('cost', t('heal.costLabel'), `0 ${t('heal.coinsUnit')}`),
        message,
      );
      body.append(heal);
    } else {
      const message = document.createElement('p'); message.className = 'healing-message';
      const heal = document.createElement('button'); heal.type = 'button'; heal.className = 'ui-button fantasy-button fantasy-primary heal'; heal.textContent = t('heal.action');
      heal.addEventListener('click', () => {
        if (!gameProgressService.spendCoins(healCost)) {
          message.textContent = t('heal.insufficient');
          return;
        }
        this.player.restoreFullHealth();
        this.onCoinsChanged(gameProgressService.snapshot.coins);
        this.closeModal();
      });
      treatment.append(
        createHealingRow('restore', t('heal.restoreLabel'), `${missingHealth} HP`),
        createHealingRow('cost', t('heal.costLabel'), `${healCost} ${t('heal.coinsUnit')}`),
        message,
      );
      body.append(heal);
    }
    const close = document.createElement('button'); close.type = 'button'; close.className = 'ui-button fantasy-button fantasy-secondary modal-close'; close.textContent = t('restore.close');
    close.addEventListener('click', () => this.closeModal()); body.append(close); overlay.append(panel);
  }

  private buildButton(building: 'forge' | 'infirmary', cost: number, restored: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `fantasy-row building-option ${building}${restored ? ' restored' : ''}`;
    const buildingName = t(building === 'forge' ? 'restore.forge' : 'restore.infirmary');
    const symbol = createIconBadge(`building-symbol ${building}`);
    const copy = document.createElement('span'); copy.className = 'building-copy';
    const name = document.createElement('strong'); name.textContent = buildingName;
    const status = document.createElement('small'); status.textContent = restored ? t('restore.restored') : t('restore.price', { cost });
    copy.append(name, status);
    const result = document.createElement('span');
    result.className = `fantasy-status-badge building-result${restored ? ' confirmed' : ' cost-badge'}`;
    result.setAttribute('aria-hidden', 'true');
    if (!restored) {
      const priceIcon = document.createElement('img');
      priceIcon.src = coinIconUrl;
      priceIcon.alt = '';
      const price = document.createElement('span');
      price.textContent = `${cost}`;
      result.append(priceIcon, price);
    }
    button.append(symbol, copy, result);
    button.disabled = restored;
    button.addEventListener('click', () => {
      if (!gameProgressService.restoreBuilding(building, cost)) return;
      const progress = gameProgressService.snapshot;
      this.onCoinsChanged(progress.coins);
      this.scene.registry.set(`${building}Restored`, true);
      this.setBuildingState(building, true);
      if (building === 'forge') this.forgeSmoke.start();
      this.closeModal();
    });
    return button;
  }

  private closeModal(): void {
    this.modal?.remove();
    this.modal = undefined;
  }
}
