import type { PlayerClassId } from '../entities/player/playerTypes';

export type SkillBehavior = 'heavy-slash' | 'piercing-shot' | 'magic-burst';

export type SkillConfig = {
  id: string;
  classId: PlayerClassId;
  cooldownMs: number;
  damageMultiplier: number;
  rangeMultiplier: number;
  localizedNameKey: 'skill.warrior' | 'skill.archer' | 'skill.mage';
  behavior: SkillBehavior;
  projectile?: { maxHits: number; splashMultiplier?: number; splashRadius?: number };
  color: number;
};

export const SKILL_1_CONFIGS: Record<PlayerClassId, SkillConfig> = {
  warrior: { id: 'heavy-slash', classId: 'warrior', cooldownMs: 5000, damageMultiplier: 1.9, rangeMultiplier: 1.18, localizedNameKey: 'skill.warrior', behavior: 'heavy-slash', color: 0xffa63d },
  archer: { id: 'piercing-shot', classId: 'archer', cooldownMs: 5000, damageMultiplier: 2, rangeMultiplier: 1.2, localizedNameKey: 'skill.archer', behavior: 'piercing-shot', projectile: { maxHits: 1 }, color: 0xffdf69 },
  mage: { id: 'magic-burst', classId: 'mage', cooldownMs: 5000, damageMultiplier: 2, rangeMultiplier: 1, localizedNameKey: 'skill.mage', behavior: 'magic-burst', projectile: { maxHits: 1, splashMultiplier: 0.5, splashRadius: 62 }, color: 0xd7a0ff },
};
