import { isServer, SPEED_PRESETS, INTENSITY_PRESETS, speedState, lastGlitchedNodes } from './constants';
import { SchedulerOptions, GlowIntensity, EffectName, IntensityPresetKey } from './types';
import { getAllTextNodes, isNodeGlitching } from './wrapper';
import {
  scrambleMicro,
  swapWords,
  corruptChar,
  blipChar,
  jitterChar,
  shiftHoldChar,
  neonColorChar,
  scrambleText
} from './effects';

export class UnstableTextScheduler {
  container: HTMLElement | null;
  speedMultiplier: number;
  minInterval: number;
  maxInterval: number;
  minConcurrent: number;
  maxConcurrent: number;
  nodeCooldown: number;
  activeCount: number;
  timerId: any;
  isRunning: boolean;
  isPaused: boolean;
  isServer: boolean;
  isIntersecting: boolean;
  observer: IntersectionObserver | null;
  neonColor: string;
  glowIntensity: GlowIntensity;
  neonGlitchChance: number;
  neonFlickerEndChance: number;
  effects: Record<string, number>;
  onGlitchStart: ((targetNode: Node, effectName: EffectName) => void) | null;
  onGlitchEnd: ((targetNode: Node, effectName: EffectName) => void) | null;

  constructor(options: SchedulerOptions = {}) {
    if (isServer) {
      this.isServer = true;
      this.container = null;
      this.speedMultiplier = 1;
      this.minInterval = 600;
      this.maxInterval = 2000;
      this.minConcurrent = 1;
      this.maxConcurrent = 3;
      this.nodeCooldown = 4000;
      this.activeCount = 0;
      this.timerId = null;
      this.isRunning = false;
      this.isPaused = false;
      this.isIntersecting = false;
      this.observer = null;
      this.neonColor = 'GREEN';
      this.glowIntensity = 'normal';
      this.neonGlitchChance = 0.35;
      this.neonFlickerEndChance = 0.40;
      this.effects = {};
      this.onGlitchStart = null;
      this.onGlitchEnd = null;
      return;
    }

    this.isServer = false;
    this.container = options.container || (typeof document !== 'undefined' ? document.body : null);

    let mult = options.speedMultiplier || options.timeMultiplier || speedState.globalSpeedMultiplier;
    if (typeof mult === 'string') {
      mult = SPEED_PRESETS[mult.toUpperCase() as keyof typeof SPEED_PRESETS] || parseFloat(mult) || speedState.globalSpeedMultiplier;
    }
    this.speedMultiplier = mult;

    // Default intervals & concurrency range from INTENSITY_PRESETS.NORMAL
    const defaultIntensity = INTENSITY_PRESETS.NORMAL;
    const baseMin = options.minInterval || defaultIntensity.minInterval;
    const baseMax = options.maxInterval || defaultIntensity.maxInterval;
    this.minInterval = Math.round(baseMin * this.speedMultiplier);
    this.maxInterval = Math.round(baseMax * this.speedMultiplier);
    this.minConcurrent = options.minConcurrent || defaultIntensity.minConcurrent;
    this.maxConcurrent = options.maxConcurrent || defaultIntensity.maxConcurrent;

    const requestedIntensity = options.ambientIntensity || options.glitchFrequency;
    if (requestedIntensity) {
      this.setAmbientIntensity(requestedIntensity);
    }
    this.nodeCooldown = options.nodeCooldown !== undefined ? options.nodeCooldown : 4000;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.activeCount = 0;
    this.timerId = null;
    this.isRunning = false;
    this.isPaused = false;

    this.onGlitchStart = options.onGlitchStart || null;
    this.onGlitchEnd = options.onGlitchEnd || null;

    this.neonColor = options.neonColor || options.color || 'GREEN';
    this.glowIntensity = options.glowIntensity || options.intensity || 'normal';
    this.neonGlitchChance = options.neonGlitchChance !== undefined ? options.neonGlitchChance : 0.35;
    this.neonFlickerEndChance = options.neonFlickerEndChance !== undefined ? options.neonFlickerEndChance : 0.40;

    this.effects = {
      microChars: 2,
      microWords: 2,
      swapWords: 1,
      corruptChar: 1,
      blipChar: 2,
      jitterChar: prefersReducedMotion && !options.ignoreReducedMotion ? 0 : 1,
      shiftHoldChar: prefersReducedMotion && !options.ignoreReducedMotion ? 0 : 1,
      neonColorChar: 2,
      fullScramble: 0,
      ...(options.effects || {})
    };

    this.isIntersecting = true;
    this.observer = null;

    if (
      options.pauseOffscreen !== false &&
      typeof IntersectionObserver !== 'undefined' &&
      this.container &&
      typeof document !== 'undefined' &&
      this.container !== document.body
    ) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          this.isIntersecting = entry.isIntersecting;
        });
      }, { threshold: 0.1 });
      this.observer.observe(this.container);
    }
  }

  getEligibleTextNodes(): Node[] {
    if (this.isServer || !this.container) return [];
    return getAllTextNodes(this.container).filter((node) => !isNodeGlitching(node));
  }

  start(): void {
    if (this.isServer || this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this._ensureMinConcurrent();
    this._scheduleNext();
  }

  stop(): void {
    if (this.isServer) return;
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  pause(): void {
    if (this.isServer) return;
    this.isPaused = true;
  }

  resume(): void {
    if (this.isServer) return;
    this.isPaused = false;
    this._ensureMinConcurrent();
  }

  setAmbientIntensity(presetKey: IntensityPresetKey | string): void {
    if (this.isServer || typeof presetKey !== 'string') return;
    const key = presetKey.toUpperCase() as IntensityPresetKey;
    const preset = INTENSITY_PRESETS[key];
    if (preset) {
      this.minConcurrent = preset.minConcurrent;
      this.maxConcurrent = preset.maxConcurrent;
      this.minInterval = Math.round(preset.minInterval * this.speedMultiplier);
      this.maxInterval = Math.round(preset.maxInterval * this.speedMultiplier);
      this._ensureMinConcurrent();
    }
  }

  destroy(): void {
    if (this.isServer) return;
    this.stop();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container = null;
    this.onGlitchStart = null;
    this.onGlitchEnd = null;
  }

  _ensureMinConcurrent(): void {
    if (this.isServer || !this.isRunning || this.isPaused || !this.isIntersecting) return;
    let attempts = 0;
    while (this.activeCount < this.minConcurrent && attempts < 10) {
      attempts++;
      const prevCount = this.activeCount;
      this._triggerRandomGlitch();
      if (this.activeCount <= prevCount) break;
    }
  }

  _scheduleNext(): void {
    if (this.isServer || !this.isRunning) return;

    const delay = Math.floor(
      Math.random() * (this.maxInterval - this.minInterval + 1) + this.minInterval
    );

    this.timerId = setTimeout(() => {
      if (this.isIntersecting && !this.isPaused) {
        this._triggerRandomGlitch();
        this._ensureMinConcurrent();
      }
      this._scheduleNext();
    }, delay);
  }

  _triggerRandomGlitch(): void {
    if (this.isServer || this.isPaused || this.activeCount >= this.maxConcurrent) return;

    const candidates = this.getEligibleTextNodes();
    if (candidates.length === 0) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const freshCandidates = candidates.filter((node) => {
      const last = lastGlitchedNodes.get(node) || 0;
      return (now - last) >= this.nodeCooldown;
    });

    const pool = freshCandidates.length > 0 ? freshCandidates : candidates;
    const targetNode = pool[Math.floor(Math.random() * pool.length)];
    lastGlitchedNodes.set(targetNode, now);

    const parentEl = targetNode.parentElement;

    let effectiveSpeed = this.speedMultiplier;
    let allowedEffects: string[] | null = null;
    let customNeonColor = this.neonColor;
    let customGlowIntensity = this.glowIntensity;

    if (parentEl) {
      const dataSpeed = parentEl.getAttribute('data-glitch-speed') || parentEl.closest('[data-glitch-speed]')?.getAttribute('data-glitch-speed');
      if (dataSpeed) {
        effectiveSpeed = SPEED_PRESETS[dataSpeed.toUpperCase() as keyof typeof SPEED_PRESETS] || parseFloat(dataSpeed) || effectiveSpeed;
      }

      const dataEffects = parentEl.getAttribute('data-glitch-effects') || parentEl.closest('[data-glitch-effects]')?.getAttribute('data-glitch-effects');
      if (dataEffects) {
        allowedEffects = dataEffects.split(',').map((s) => s.trim());
      }

      const dataColor = parentEl.getAttribute('data-glitch-color') || parentEl.closest('[data-glitch-color]')?.getAttribute('data-glitch-color');
      if (dataColor) {
        customNeonColor = dataColor;
      }

      const dataIntensity = parentEl.getAttribute('data-glitch-intensity') || parentEl.closest('[data-glitch-intensity]')?.getAttribute('data-glitch-intensity');
      if (dataIntensity) {
        customGlowIntensity = dataIntensity as GlowIntensity;
      }
    }

    const candidateEffects: EffectName[] = [];
    Object.keys(this.effects).forEach((effName) => {
      const weight = this.effects[effName];
      if (weight > 0) {
        if (!allowedEffects || allowedEffects.includes(effName)) {
          for (let w = 0; w < weight; w++) {
            candidateEffects.push(effName as EffectName);
          }
        }
      }
    });

    if (candidateEffects.length === 0) return;

    const chosenEffect = candidateEffects[Math.floor(Math.random() * candidateEffects.length)];

    this.activeCount++;

    const applyNeon = Math.random() < this.neonGlitchChance;

    const opts = {
      speedMultiplier: effectiveSpeed,
      neonColor: applyNeon ? customNeonColor : undefined,
      glowIntensity: customGlowIntensity,
      neonFlickerEndChance: this.neonFlickerEndChance,
      onGlitchStart: this.onGlitchStart || undefined,
      onGlitchEnd: this.onGlitchEnd || undefined
    };

    let promise: Promise<void>;
    switch (chosenEffect) {
      case 'microChars':
        promise = scrambleMicro(targetNode, { mode: 'chars', ...opts });
        break;
      case 'microWords':
        promise = scrambleMicro(targetNode, { mode: 'words', ...opts });
        break;
      case 'swapWords':
        promise = swapWords(targetNode, opts);
        break;
      case 'corruptChar':
        promise = corruptChar(targetNode, opts);
        break;
      case 'blipChar':
        promise = blipChar(targetNode, opts);
        break;
      case 'jitterChar':
        promise = jitterChar(targetNode, opts);
        break;
      case 'shiftHoldChar':
        promise = shiftHoldChar(targetNode, opts);
        break;
      case 'neonColorChar':
        promise = neonColorChar(targetNode, { ...opts, neonColor: customNeonColor });
        break;
      case 'fullScramble':
        promise = scrambleText(targetNode, opts);
        break;
      default:
        promise = scrambleMicro(targetNode, opts);
    }

    promise.finally(() => {
      this.activeCount = Math.max(0, this.activeCount - 1);
    });
  }
}
