import { isServer, SPEED_PRESETS, INTENSITY_PRESETS, NEON_COLORS, setGlobalSpeedMultiplier } from './core/constants';
import { EffectName, GlitchOptions } from './core/types';
import {
  scrambleText,
  scrambleMicro,
  swapWords,
  corruptChar,
  blipChar,
  jitterChar,
  shiftHoldChar,
  neonColorChar
} from './core/effects';
import { UnstableTextScheduler } from './core/scheduler';

export * from './core/types';
export * from './core/constants';
export * from './core/wrapper';
export * from './core/effects';
export * from './core/scheduler';

export function trigger(target: Node, effectName: EffectName = 'microChars', options: GlitchOptions = {}): Promise<void> {
  if (isServer || !target) return Promise.resolve();
  switch (effectName) {
    case 'microChars': return scrambleMicro(target, { mode: 'chars', ...options });
    case 'microWords': return scrambleMicro(target, { mode: 'words', ...options });
    case 'swapWords': return swapWords(target, options);
    case 'corruptChar': return corruptChar(target, options);
    case 'blipChar': return blipChar(target, options);
    case 'jitterChar': return jitterChar(target, options);
    case 'shiftHoldChar': return shiftHoldChar(target, options);
    case 'neonColorChar': return neonColorChar(target, options);
    case 'fullScramble': return scrambleText(target, options);
    default: return scrambleMicro(target, options);
  }
}

export const UnstableText = {
  scrambleText,
  scrambleMicro,
  swapWords,
  corruptChar,
  blipChar,
  jitterChar,
  shiftHoldChar,
  neonColorChar,
  SPEED_PRESETS,
  INTENSITY_PRESETS,
  NEON_COLORS,
  setGlobalSpeedMultiplier,
  trigger,
  Scheduler: UnstableTextScheduler,
  UnstableTextScheduler,
  AmbientScheduler: UnstableTextScheduler
};

export const AmbientGlitch = UnstableText;
export const AmbientScheduler = UnstableTextScheduler;

if (typeof window !== 'undefined') {
  (window as any).UnstableText = UnstableText;
  (window as any).AmbientGlitch = UnstableText;
}

export default UnstableText;
