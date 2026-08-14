import Phaser from 'phaser';
import idleUrl from '../../../assets/enemies/ember-spider/idle.png';
import moveUrl from '../../../assets/enemies/ember-spider/move.png';
import attackUrl from '../../../assets/enemies/ember-spider/attack.png';
import deathUrl from '../../../assets/enemies/ember-spider/death.png';

export const EmberSpiderAnimation = { Idle: 'ember-spider-idle', Move: 'ember-spider-move', Attack: 'ember-spider-attack', Death: 'ember-spider-death' } as const;
const SHEETS = { [EmberSpiderAnimation.Idle]: [idleUrl, 5, -1], [EmberSpiderAnimation.Move]: [moveUrl, 8, -1], [EmberSpiderAnimation.Attack]: [attackUrl, 10, 0], [EmberSpiderAnimation.Death]: [deathUrl, 8, 0] } as const;
export function preloadEmberSpiderAssets(scene: Phaser.Scene): void { Object.entries(SHEETS).forEach(([key, [url]]) => scene.load.spritesheet(key, url, { frameWidth: 64, frameHeight: 64 })); }
export function registerEmberSpiderAnimations(scene: Phaser.Scene): void { Object.entries(SHEETS).forEach(([key, [, frameRate, repeat]]) => { if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate, repeat }); }); }
