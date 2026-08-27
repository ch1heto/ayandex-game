export type BroodmotherAction = 'idle' | 'lunge-windup' | 'lunge' | 'venom-windup' | 'zone-windup';
export type BroodmotherPose = 'idle' | 'attack' | 'phase';
export type BroodmotherMotionInput = { time: number; action: BroodmotherAction; actionUntil: number; phase: number; specialUntil: number; recoveryUntil: number; venomAt: number; deathAt?: number };
/** Visual-only motion: no timers, physics mutation, damage or attack scheduling. */
export function broodmotherMotion(s: BroodmotherMotionInput) {
  const wave = Math.sin(s.time / 240), dead = s.deathAt !== undefined;
  const recovery = Math.max(0, Math.min(1, (s.recoveryUntil - s.time) / 180));
  const recoil = Math.max(0, 1 - Math.abs(s.time - s.venomAt) / 180);
  const anticipation = s.action === 'lunge-windup' ? Math.max(0, 1 - (s.actionUntil - s.time) / 700) : 0;
  const lunging = s.action === 'lunge';
  const pose: BroodmotherPose = dead ? 'phase' : lunging || anticipation > .25 || recovery > 0 ? 'attack'
    : s.time < s.specialUntil || s.action === 'zone-windup' ? 'phase' : 'idle';
  return {
    pose, bob: dead || lunging ? 0 : Math.round(wave),
    scaleX: 1 + wave * .006 + anticipation * .018 + (lunging ? .025 : 0),
    scaleY: 1 - wave * .006 - anticipation * .025 - recovery * .015 - recoil * .02,
    angle: lunging ? 0 : Math.sin(s.time / 390) * .35,
    glow: Math.min(.85, .1 + s.phase * .055 + (wave + 1) * .035 + recoil * .3),
    alpha: dead ? Math.max(0, 1 - (s.time - s.deathAt!) / 600) : 1,
    shadowScale: lunging ? .88 : 1,
  };
}
