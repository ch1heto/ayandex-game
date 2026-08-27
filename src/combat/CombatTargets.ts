import type Phaser from 'phaser';
export interface CombatTarget {
  readonly targetId: string;
  readonly targetType: 'player' | 'summon';
  readonly priority: number;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly physicsRoot: Phaser.GameObjects.Zone;
  takeDamage(damage: number, sourceX: number, sourceY: number): boolean;
}
export class CombatTargets {
  private readonly targets = new Map<string, CombatTarget>();
  public add(target: CombatTarget): void { this.targets.set(target.targetId, target); }
  public remove(target: CombatTarget): void { if (this.targets.get(target.targetId) === target) this.targets.delete(target.targetId); }
  public get(id?: string): CombatTarget | undefined { const target = id ? this.targets.get(id) : undefined; return target?.alive ? target : undefined; }
  public all(): CombatTarget[] { return [...this.targets.values()].filter(target => target.alive); }
}
const registries = new WeakMap<object, CombatTargets>();
export function combatTargets(scene: object): CombatTargets {
  let registry = registries.get(scene);
  if (!registry) { registry = new CombatTargets(); registries.set(scene, registry); }
  return registry;
}
/** Keep only an ID: destroyed summons are never retained by enemy AI. */
export class TargetSelector {
  private id?: string;
  private nextAt = 0;
  public constructor(private readonly targets: CombatTargets, private readonly playerWeight = 1) {}
  public get current(): CombatTarget | undefined { return this.targets.get(this.id); }
  public choose(time: number, x: number, y: number): CombatTarget | undefined {
    const current = this.current;
    if (current && time < this.nextAt) return current;
    const score = (target: CombatTarget) => Math.hypot(target.x - x, target.y - y) / (target.priority * (target.targetType === 'player' ? this.playerWeight : 1));
    const best = this.targets.all().sort((a, b) => score(a) - score(b))[0];
    this.id = current && best && score(current) <= score(best) * 1.1 ? current.targetId : best?.targetId;
    this.nextAt = time + 400;
    return this.current;
  }
}
