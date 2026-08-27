/** Scene-clock deadlines; active stuns cannot be refreshed or stacked. */
export class EnemyControl {
  private until = 0;
  private immuneUntil = 0;
  public isStunned(now: number): boolean { return now < this.until; }
  public apply(now: number, duration: number, recovery: number): boolean {
    if (duration <= 0 || now < this.immuneUntil) return false;
    this.until = now + duration;
    this.immuneUntil = this.until + recovery;
    return true;
  }
  public clear(): void { this.until = 0; this.immuneUntil = 0; }
}
