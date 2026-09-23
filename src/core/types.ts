/**
 * Core Type Definitions for unstable-text
 */

export type SpeedPresetKey = 'VERY_FAST' | 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW';
export type IntensityPresetKey = 'SUBTLE' | 'LOW' | 'NORMAL' | 'HIGH' | 'CHAOTIC';
export type NeonColorPresetKey = 'GREEN' | 'RED' | 'BLUE';
export type GlowIntensity = 'subtle' | 'normal' | 'intense' | number;

export type EffectName =
  | 'microChars'
  | 'microWords'
  | 'swapWords'
  | 'corruptChar'
  | 'blipChar'
  | 'jitterChar'
  | 'shiftHoldChar'
  | 'neonColorChar'
  | 'fullScramble';

export interface SpeedPresets {
  readonly VERY_FAST: number;
  readonly FAST: number;
  readonly NORMAL: number;
  readonly SLOW: number;
  readonly VERY_SLOW: number;
}

export interface IntensityPreset {
  minConcurrent: number;
  maxConcurrent: number;
  minInterval: number;
  maxInterval: number;
}

export interface IntensityPresets {
  readonly SUBTLE: IntensityPreset;
  readonly LOW: IntensityPreset;
  readonly NORMAL: IntensityPreset;
  readonly HIGH: IntensityPreset;
  readonly CHAOTIC: IntensityPreset;
}

export interface NeonColors {
  readonly GREEN: string;
  readonly RED: string;
  readonly BLUE: string;
}

export interface GlitchOptions {
  duration?: number;
  speedMultiplier?: number | SpeedPresetKey;
  timeMultiplier?: number | SpeedPresetKey;
  neonColor?: NeonColorPresetKey | string;
  color?: string;
  glitchColor?: string;
  glowIntensity?: GlowIntensity;
  intensity?: GlowIntensity;
  neonFlickerEndChance?: number;
  charset?: string[];
  mode?: 'chars' | 'words';
  onGlitchStart?: (targetNode: Node, effectName: EffectName) => void;
  onGlitchEnd?: (targetNode: Node, effectName: EffectName) => void;
}

export interface EffectWeights {
  microChars?: number;
  microWords?: number;
  swapWords?: number;
  corruptChar?: number;
  blipChar?: number;
  jitterChar?: number;
  shiftHoldChar?: number;
  neonColorChar?: number;
  fullScramble?: number;
  [customEffect: string]: number | undefined;
}

export interface SchedulerOptions {
  container?: HTMLElement | null;
  ambientIntensity?: IntensityPresetKey;
  glitchFrequency?: IntensityPresetKey;
  minInterval?: number;
  maxInterval?: number;
  minConcurrent?: number;
  maxConcurrent?: number;
  nodeCooldown?: number;
  speedMultiplier?: number | SpeedPresetKey;
  timeMultiplier?: number | SpeedPresetKey;
  neonColor?: NeonColorPresetKey | string;
  color?: string;
  glowIntensity?: GlowIntensity;
  intensity?: GlowIntensity;
  neonGlitchChance?: number;
  neonFlickerEndChance?: number;
  pauseOffscreen?: boolean;
  ignoreReducedMotion?: boolean;
  effects?: EffectWeights;
  onGlitchStart?: (targetNode: Node, effectName: EffectName) => void;
  onGlitchEnd?: (targetNode: Node, effectName: EffectName) => void;
}
