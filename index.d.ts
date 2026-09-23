/**
 * Unstable Text Library — TypeScript Definitions
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

export class UnstableTextScheduler {
  container: HTMLElement | null;
  speedMultiplier: number;
  minInterval: number;
  maxInterval: number;
  maxConcurrent: number;
  nodeCooldown: number;
  activeCount: number;
  isRunning: boolean;
  isPaused: boolean;
  neonColor: string;
  glowIntensity: GlowIntensity;
  neonGlitchChance: number;
  neonFlickerEndChance: number;
  effects: Record<string, number>;
  onGlitchStart: ((targetNode: Node, effectName: EffectName) => void) | null;
  onGlitchEnd: ((targetNode: Node, effectName: EffectName) => void) | null;

  constructor(options?: SchedulerOptions);
  getEligibleTextNodes(): Node[];
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  setAmbientIntensity(presetKey: IntensityPresetKey | string): void;
  destroy(): void;
}

export namespace UnstableText {
  export const SPEED_PRESETS: SpeedPresets;
  export const INTENSITY_PRESETS: IntensityPresets;
  export const NEON_COLORS: NeonColors;

  export function scrambleText(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function scrambleMicro(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function swapWords(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function corruptChar(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function blipChar(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function jitterChar(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function shiftHoldChar(textNode: Node, options?: GlitchOptions): Promise<void>;
  export function neonColorChar(textNode: Node, options?: GlitchOptions): Promise<void>;

  export function setGlobalSpeedMultiplier(speed: number | SpeedPresetKey): void;
  export function trigger(target: Node, effectName?: EffectName, options?: GlitchOptions): Promise<void>;

  export const Scheduler: typeof UnstableTextScheduler;
  export const UnstableTextScheduler: typeof UnstableTextScheduler;
  export const AmbientScheduler: typeof UnstableTextScheduler;
}

export type AmbientScheduler = UnstableTextScheduler;
export type AmbientGlitch = typeof UnstableText;

export const SPEED_PRESETS: SpeedPresets;
export const INTENSITY_PRESETS: IntensityPresets;
export const NEON_COLORS: NeonColors;
export const setGlobalSpeedMultiplier: (speed: number | SpeedPresetKey) => void;
export const trigger: (target: Node, effectName?: EffectName, options?: GlitchOptions) => Promise<void>;
export const Scheduler: typeof UnstableTextScheduler;

export default UnstableText;
