import Phaser from 'phaser';
import { combatTargets, TargetSelector } from '../../combat/CombatTargets';
import { EmberSpider } from './EmberSpider';
import { EmberSpiderAnimation } from './emberSpiderAssets';
import type { PlayerCharacter } from '../player/PlayerCharacter';
import { DUNGEON_CONFIG } from '../../data/dungeon';
import { PixelSkillVfx, line, pixel } from '../../systems/skills/PixelSkillVfx';
const C = DUNGEON_CONFIG.boss;
type Action = 'idle' | 'lunge-windup' | 'lunge' | 'venom-windup' | 'zone-windup';
type Zone = { root: Phaser.GameObjects.Zone; art: Phaser.GameObjects.Graphics; born: number; nextHit: number; x: number; y: number };
export class AshenBroodmother extends EmberSpider {
  private readonly lungeTargets: TargetSelector;
  private readonly lungeHits = new Set<string>();
  private phase = 1;
  private action: Action = 'idle';
  private actionUntil = 0;
  private nextAttack = 0;
  private attackIndex = 0;
  private aim = new Phaser.Math.Vector2(1, 0);
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly bolts: Phaser.Physics.Arcade.Group;
  private readonly collisions: Phaser.Physics.Arcade.Collider[] = [];
  private readonly effects: PixelSkillVfx;
  private zones: Zone[] = [];
  private adds: EmberSpider[] = [];
  private disposed = false;
  public constructor(
    private readonly bossScene: Phaser.Scene, x: number, y: number, private readonly hero: PlayerCharacter,
    onDeath: (spider: EmberSpider, x: number, y: number) => void, onEngage: (spider: EmberSpider) => void,
    private readonly summon: (x: number, y: number) => EmberSpider,
    obstacles: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  ) {
    super(bossScene, x, y, hero, onDeath, onEngage, undefined, C.maxHealth);
    this.lungeTargets = new TargetSelector(combatTargets(bossScene), 3);
    this.visual.setScale(C.scale); this.visual.setName('ashen-broodmother');
    const body = this.hurtbox.body as Phaser.Physics.Arcade.Body; body.setSize(108, 68); this.hurtbox.setSize(108, 68);
    this.overlay = bossScene.add.graphics(); this.telegraph = bossScene.add.graphics(); this.effects = new PixelSkillVfx(bossScene);
    this.nextAttack = bossScene.time.now + 1700;
    if (!bossScene.textures.exists('boss-venom')) {
      const g = bossScene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x332a45).fillRect(0, 3, 14, 7); g.fillStyle(0x8d5ba6).fillRect(3, 1, 8, 11);
      g.fillStyle(0xb8df86).fillRect(5, 3, 7, 6); g.fillStyle(0xf0f7bf).fillRect(8, 4, 3, 2);
      g.generateTexture('boss-venom', 14, 13); g.destroy(); bossScene.textures.get('boss-venom').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.bolts = bossScene.physics.add.group({ allowGravity: false });
    this.collisions.push(bossScene.physics.add.collider(this.bolts, obstacles, object => (object as Phaser.Physics.Arcade.Sprite).destroy()));
  }
  public override get isBoss(): boolean { return true; }
  public override get bossPhase(): number { return this.phase; }
  public override applyKnockback(): void { /* Boss keeps its telegraphed trajectory. */ }
  public override takeDamage(damage: number, sourceX: number, sourceY: number): boolean {
    const result = super.takeDamage(damage, sourceX, sourceY);
    if (this.currentHealth <= 0) this.clearHazards();
    return result;
  }
  public override update(time: number): void {
    if (this.disposed) return;
    this.visual.setDepth(Math.floor(this.visual.y));
    (this.hurtbox.body as Phaser.Physics.Arcade.Body).reset(this.visual.x, this.visual.y - 38);
    this.effects.update(time);
    if (this.currentHealth <= 0) { this.overlay.clear(); this.telegraph.clear(); return; }
    if (this.hero.currentHealth <= 0) { this.visual.setVelocity(0); this.clearHazards(); return; }
    const ratio = this.currentHealth / this.maxHealth;
    if (this.phase === 1 && ratio <= .65) {
      this.phase = 2; this.effects.impact(this.visual.x, this.visual.y, 0xb28ce4, true);
      this.adds.push(this.summon(this.visual.x - 85, this.visual.y + 90), this.summon(this.visual.x + 85, this.visual.y + 90));
    }
    if (this.phase === 2 && ratio <= .3) { this.phase = 3; this.effects.impact(this.visual.x, this.visual.y, 0xdf7999, true); }
    this.drawArmor(time); this.updateHazards(time);
    if (this.action === 'lunge') {
      for (const target of combatTargets(this.bossScene).all()) {
        if (!this.lungeHits.has(target.targetId) && this.bossScene.physics.overlap(this.hurtbox, target.physicsRoot)) {
          this.lungeHits.add(target.targetId); target.takeDamage(C.lungeDamage, this.visual.x, this.visual.y);
        }
      }
      if (time >= this.actionUntil) this.finishAction(time);
      return;
    }
    if (this.action !== 'idle') {
      this.visual.setVelocity(0); this.drawTelegraph();
      if (time < this.actionUntil) return;
      this.telegraph.clear();
      if (this.action === 'lunge-windup') {
        this.lungeHits.clear(); this.action = 'lunge'; this.actionUntil = time + C.lungeDurationMs;
        this.visual.play(EmberSpiderAnimation.Move, true);
        const speed = C.lungeSpeed * (this.phase === 3 ? 1.1 : 1) * this.modifiers.speedMultiplier;
        this.visual.setVelocity(this.aim.x * speed, this.aim.y * speed);
      } else {
        if (this.action === 'venom-windup') this.fireVenom(time); else this.createZones(time);
        this.finishAction(time);
      }
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.visual.x, this.visual.y, this.hero.x, this.hero.y);
    if (time >= this.nextAttack) {
      this.aim.set(this.hero.x - this.visual.x, this.hero.y - this.visual.y);
      if (!this.aim.lengthSq()) this.aim.set(1, 0); this.aim.normalize();
      const kind = this.attackIndex++ % (this.phase >= 2 ? 3 : 2);
      this.action = kind === 0 ? 'lunge-windup' : kind === 1 ? 'venom-windup' : 'zone-windup';
      if (kind === 0) {
        const target = this.lungeTargets.choose(time, this.visual.x, this.visual.y);
        if (target) { this.aim.set(target.x - this.visual.x, target.y - this.visual.y); if (!this.aim.lengthSq()) this.aim.set(1, 0); this.aim.normalize(); }
      }
      this.actionUntil = time + (this.action === 'lunge-windup' ? C.lungeWindupMs : 650);
      this.visual.setVelocity(0).play(EmberSpiderAnimation.Idle, true);
    } else if (distance > 155) {
      this.bossScene.physics.moveToObject(this.visual, this.hero.physicsRoot, 42 * (this.phase === 3 ? 1.15 : 1) * this.modifiers.speedMultiplier);
      this.visual.play(EmberSpiderAnimation.Move, true).setFlipX(this.hero.x < this.visual.x);
    } else this.visual.setVelocity(0).play(EmberSpiderAnimation.Idle, true);
  }
  private finishAction(time: number): void {
    this.visual.setVelocity(0).play(EmberSpiderAnimation.Idle, true); this.action = 'idle';
    this.nextAttack = time + (this.phase === 3 ? 950 : 1450);
  }
  private drawArmor(time: number): void {
    const g = this.overlay.clear().setPosition(Math.round(this.visual.x), Math.round(this.visual.y - 27)).setDepth(Math.floor(this.visual.y) + 1);
    for (let i = -2; i <= 2; i++) {
      const x = i * 12, y = -25 + Math.abs(i) * 5;
      line(g, x, y + 8, x + i * 2, y - 8, 0x43394f, 5);
      line(g, x, y + 6, x + i * 2, y - 7, this.phase === 3 ? 0xc48a9b : 0x8d799d, 2);
    }
    for (const x of [-13, 13]) pixel(g, x, -2, 3, this.phase === 3 ? 0xffa17d : 0xd594ba);
    for (let i = 0; i < this.phase + 1; i++) pixel(g, Math.cos(i * 2 + time / 850) * 42, 15 - ((time / 100 + i * 7) % 25), 2, 0xb693d0, .6);
  }
  private drawTelegraph(): void {
    const g = this.telegraph.clear().setPosition(Math.round(this.visual.x), Math.round(this.visual.y)).setDepth(Math.floor(this.visual.y) - 2);
    if (this.action === 'lunge-windup') {
      const length = C.lungeSpeed * C.lungeDurationMs / 1000 + 48;
      for (const side of [-1, 1]) line(g, -this.aim.y * 22 * side, this.aim.x * 22 * side, this.aim.x * length - this.aim.y * 22 * side, this.aim.y * length + this.aim.x * 22 * side, 0xe6a391, 2, .9);
      line(g, this.aim.x * length, this.aim.y * length, this.aim.x * (length - 20) - this.aim.y * 12, this.aim.y * (length - 20) + this.aim.x * 12, 0xffd4a1, 3);
    } else {
      for (let i = 0; i < 8; i++) pixel(g, Math.cos(i * Math.PI / 4) * 48, Math.sin(i * Math.PI / 4) * 22, 4, this.action === 'venom-windup' ? 0xc2dc8e : 0xc09adc);
    }
  }
  private fireVenom(time: number): void {
    const start = Math.atan2(this.aim.y, this.aim.x);
    for (let i = 0; i < C.venomCount; i++) {
      const angle = start + (i + .5) * Math.PI * 2 / C.venomCount;
      const bolt = this.bolts.create(this.visual.x + Math.cos(angle) * 45, this.visual.y - 16 + Math.sin(angle) * 35, 'boss-venom') as Phaser.Physics.Arcade.Sprite;
      bolt.setRotation(angle).setDepth(Math.floor(bolt.y) + 3).setVelocity(Math.cos(angle) * C.venomSpeed, Math.sin(angle) * C.venomSpeed);
      (bolt.body as Phaser.Physics.Arcade.Body).setSize(9, 9); bolt.setData('expires', time + 3400);
    }
  }
  private createZones(time: number): void {
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const x = Phaser.Math.Clamp(this.hero.x + Math.cos(angle) * 65, 2790, 3420);
      const y = Phaser.Math.Clamp(this.hero.y + Math.sin(angle) * 65, 100, 606);
      const root = this.bossScene.add.zone(x, y, C.zoneRadius * 2, C.zoneRadius * 2); this.bossScene.physics.add.existing(root);
      (root.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true).updateFromGameObject();
      const art = this.bossScene.add.graphics().setPosition(Math.round(x), Math.round(y)).setDepth(Math.floor(y) - 2);
      this.zones.push({ root, art, born: time, nextHit: time + C.zoneTelegraphMs, x, y });
    }
  }
  private updateHazards(time: number): void {
    for (const object of this.bolts.getChildren()) {
      const bolt = object as Phaser.Physics.Arcade.Sprite;
      if (time >= Number(bolt.getData('expires'))) { bolt.destroy(); continue; }
      bolt.setDepth(Math.floor(bolt.y) + 2);
      for (const target of combatTargets(this.bossScene).all()) {
        if (!bolt.active) break;
        if (this.bossScene.physics.overlap(bolt, target.physicsRoot) && target.takeDamage(C.venomDamage, bolt.x, bolt.y)) bolt.destroy();
      }
    }
    this.zones = this.zones.filter(zone => {
      const age = time - zone.born;
      if (age >= C.zoneTelegraphMs + C.zoneLifetimeMs) { zone.root.destroy(); zone.art.destroy(); return false; }
      const active = age >= C.zoneTelegraphMs, g = zone.art.clear();
      for (let spoke = 0; spoke < 8; spoke++) {
        const a = spoke * Math.PI / 4;
        line(g, Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * C.zoneRadius, Math.sin(a) * C.zoneRadius, active ? 0xa589b5 : 0xdfb3cf, 2, active ? .5 : .85);
        for (const r of [22, 42]) line(g, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a + Math.PI / 4) * r, Math.sin(a + Math.PI / 4) * r, active ? 0x9b75a9 : 0xd3b5c6, 2, .65);
      }
      if (active) for (let i = 0; i < 5; i++) pixel(g, Math.cos(i * 4) * 28, Math.sin(i * 4) * 28 - (Math.floor(time / 120) + i) % 9, 3, 0xb8c484, .7);
      if (active && time >= zone.nextHit) {
        zone.nextHit = time + C.zoneTickMs;
        for (const target of combatTargets(this.bossScene).all()) if (Math.hypot(zone.x - target.x, zone.y - target.y) < C.zoneRadius && this.bossScene.physics.overlap(zone.root, target.physicsRoot)) target.takeDamage(C.zoneDamage, zone.x, zone.y);
      }
      return true;
    });
  }
  private clearHazards(): void {
    this.bolts.clear(true, true); this.zones.forEach(zone => { zone.root.destroy(); zone.art.destroy(); }); this.zones = [];
    this.adds.forEach(add => { if (add.visual.active) add.destroy(); }); this.adds = []; this.telegraph.clear();
  }
  public override destroy(): void {
    if (this.disposed) return; this.disposed = true;
    this.clearHazards(); this.collisions.forEach(c => c.destroy()); this.bolts.destroy(true); this.effects.destroy();
    this.overlay.destroy(); this.telegraph.destroy(); super.destroy();
  }
}
