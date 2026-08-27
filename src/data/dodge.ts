export const DODGE_CONFIG = { durationMs: 200, cooldownMs: 1400, invulnerableMs: 180, speed: 360 } as const;
export class DodgeState {
  private started = Number.NEGATIVE_INFINITY;
  private ready = 0;
  public start(now: number): boolean {
    if (now < this.ready) return false;
    this.started = now; this.ready = now + DODGE_CONFIG.cooldownMs; return true;
  }
  public active(now: number): boolean { return now < this.started + DODGE_CONFIG.durationMs; }
  public invulnerable(now: number): boolean { return now < this.started + DODGE_CONFIG.invulnerableMs; }
  public cooldown(now: number): number { return Math.max(0, this.ready - now); }
  public cancel(): void { this.started = Number.NEGATIVE_INFINITY; }
}
