import type { PlayerClassId } from '../entities/player/playerTypes';

export type SkillBehavior = 'heavy-slash' | 'piercing-shot' | 'arcane-blink';

export type SkillConfig = {
  id: string;
  classId: PlayerClassId;
  cooldownMs: number;
  damageMultiplier: number;
  rangeMultiplier: number;
  localizedNameKey: 'skill.warrior' | 'skill.archer' | 'skill.mage';
  behavior: SkillBehavior;
  projectile?: { maxHits: number; speedMultiplier: number };
  color: number;
};

export const SKILL_1_CONFIGS: Record<PlayerClassId, SkillConfig> = {
  warrior: { id: 'heavy-slash', classId: 'warrior', cooldownMs: 5000, damageMultiplier: 1.9, rangeMultiplier: 1.18, localizedNameKey: 'skill.warrior', behavior: 'heavy-slash', color: 0xffa63d },
  archer: { id: 'piercing-shot', classId: 'archer', cooldownMs: 5000, damageMultiplier: 2, rangeMultiplier: 1.2, localizedNameKey: 'skill.archer', behavior: 'piercing-shot', projectile: { maxHits: 3, speedMultiplier: 1.8 }, color: 0x85efc6 },
  mage: { id: 'arcane-blink', classId: 'mage', cooldownMs: 5000, damageMultiplier: 0, rangeMultiplier: 1, localizedNameKey: 'skill.mage', behavior: 'arcane-blink', color: 0x85eafa },
};
