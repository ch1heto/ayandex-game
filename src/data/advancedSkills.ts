import { ECHO_CONFIG } from './echoes';
import type { PlayerClassId } from '../entities/player/playerTypes';
import type { TranslationKey } from '../i18n/LocalizationService';
export type AdvancedSkillId = 'whirlwind' | 'seismic-slam' | 'multishot' | 'arrow-rain' | 'arcane-bind' | 'arcane-echoes';
export type AdvancedSkillConfig = { id: AdvancedSkillId; name: TranslationKey; mana: number; cooldownMs: number; multiplier: number; radius: number; range: number; color: number; anticipationMs: number; pulses?: number; intervalMs?: number };
export const ADVANCED_SKILLS: Record<PlayerClassId, Record<2 | 3, AdvancedSkillConfig>> = {
  warrior: {
    2: { id: 'whirlwind', name: 'skill.whirlwind', mana: 25, cooldownMs: 7000, multiplier: 1.6, radius: 76, range: 0, color: 0xffbf55, anticipationMs: 160 },
    3: { id: 'seismic-slam', name: 'skill.seismic-slam', mana: 40, cooldownMs: 12000, multiplier: 2.2, radius: 112, range: 112, color: 0xffae47, anticipationMs: 260 },
  },
  archer: {
    2: { id: 'multishot', name: 'skill.multishot', mana: 20, cooldownMs: 6000, multiplier: .75, radius: 0, range: 430, color: 0x83f0b9, anticipationMs: 110 },
    3: { id: 'arrow-rain', name: 'skill.arrow-rain', mana: 40, cooldownMs: 12000, multiplier: .6, radius: 82, range: 270, color: 0x72e5ad, anticipationMs: 440, pulses: 4, intervalMs: 420 },
  },
  mage: {
    2: { id: 'arcane-bind', name: 'skill.arcane-bind', mana: 25, cooldownMs: 7000, multiplier: 1.1, radius: 0, range: 350, color: 0x92deff, anticipationMs: 140 },
    3: { id: 'arcane-echoes', name: 'skill.arcane-echoes', mana: ECHO_CONFIG.mana, cooldownMs: ECHO_CONFIG.cooldownMs, multiplier: ECHO_CONFIG.damageFraction, radius: 54, range: 0, color: 0xb397ff, anticipationMs: 220 },
  },
};
