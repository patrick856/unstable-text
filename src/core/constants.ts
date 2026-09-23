import { SpeedPresets, NeonColors, SpeedPresetKey, IntensityPresets } from './types';

export const isServer = typeof window === 'undefined' || typeof document === 'undefined';

export const SPEED_PRESETS: SpeedPresets = Object.freeze({
  VERY_FAST: 0.3, // 3.3x faster
  FAST: 0.6,      // 1.6x faster
  NORMAL: 1.0,    // Standard
  SLOW: 1.7,      // 1.7x slower
  VERY_SLOW: 2.5  // 2.5x slower
});

export const INTENSITY_PRESETS: IntensityPresets = Object.freeze({
  SUBTLE: { minConcurrent: 1, maxConcurrent: 1, minInterval: 1500, maxInterval: 4000 },
  LOW: { minConcurrent: 1, maxConcurrent: 2, minInterval: 1000, maxInterval: 3000 },
  NORMAL: { minConcurrent: 2, maxConcurrent: 4, minInterval: 600, maxInterval: 2000 },
  HIGH: { minConcurrent: 3, maxConcurrent: 6, minInterval: 300, maxInterval: 1200 },
  CHAOTIC: { minConcurrent: 5, maxConcurrent: 10, minInterval: 150, maxInterval: 600 }
});

export const NEON_COLORS: NeonColors = Object.freeze({
  GREEN: '#00ff66',
  RED: '#ff0055',
  BLUE: '#00f3ff'
});

export const BROKEN_CHARSET = [
  'ɐ', 'q', 'ɔ', 'p', 'ǝ', 'ɟ', 'ƃ', 'ɥ', 'ᴉ', 'ɾ', 'ʞ', 'l', 'ɯ', 'u', 'o', 'd', 'b', 'ɹ', 's', 'ʇ', 'n', 'ʌ', 'ʍ', 'x', 'ʎ', 'z',
  'Ɐ', 'ᗺ', 'Ɔ', 'ᗡ', 'Ǝ', 'Ⅎ', '⅁', 'H', 'I', 'ſ', 'Ꞁ', 'W', 'N', 'O', 'Ԁ', 'Ꝺ', 'ᴚ', 'S', '⊥', '∩', 'Ʌ', 'M', 'X', '⅄', 'Z',
  '▓', '▒', '░', '╳', '⌖', '⯌', '█', '⍂', '⎔', 'ø', '∆', 'µ', '∯', '⟁', '⧖', '§', '‡', '¶', '©', '®', '†', '⁕'
];

export const SCRAMBLE_CHARSET = [
  ...BROKEN_CHARSET,
  '!', '<', '>', '-', '_', '\\', '/', '[', ']', '{', '}', '—', '=', '+', '*', '^', '?', '#', '_', '_', '_'
];

export const speedState = {
  globalSpeedMultiplier: SPEED_PRESETS.NORMAL
};

export function setGlobalSpeedMultiplier(speed: number | SpeedPresetKey): void {
  if (typeof speed === 'string') {
    speedState.globalSpeedMultiplier = SPEED_PRESETS[speed.toUpperCase() as keyof typeof SPEED_PRESETS] || parseFloat(speed) || 1.0;
  } else if (typeof speed === 'number') {
    speedState.globalSpeedMultiplier = speed;
  }
}

export const lastGlitchedNodes = new WeakMap<Node, number>();
