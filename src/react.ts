import { useEffect, useRef, useCallback } from 'react';
import { UnstableTextScheduler } from './core/scheduler';
import { SchedulerOptions, GlitchOptions, EffectName } from './core/types';
import { trigger as coreTrigger } from './index';

export interface UseUnstableTextReturn<T extends HTMLElement = HTMLDivElement> {
  ref: React.RefObject<T | null>;
  scheduler: React.RefObject<UnstableTextScheduler | null>;
  trigger: (effectName?: EffectName, options?: GlitchOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
}

/**
 * Custom React hook for unstable-text.
 * Automatically initializes ambient scheduler on container mount and cleanly calls destroy() on unmount.
 */
export function useUnstableText<T extends HTMLElement = HTMLDivElement>(
  options: SchedulerOptions = {}
): UseUnstableTextReturn<T> {
  const containerRef = useRef<T | null>(null);
  const schedulerRef = useRef<UnstableTextScheduler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scheduler = new UnstableTextScheduler({
      container: containerRef.current,
      ...options
    });

    schedulerRef.current = scheduler;
    scheduler.start();

    return () => {
      scheduler.destroy();
      schedulerRef.current = null;
    };
  }, [options.minInterval, options.maxInterval, options.speedMultiplier, options.neonColor, options.neonGlitchChance]);

  const trigger = useCallback((effectName: EffectName = 'microChars', glitchOpts: GlitchOptions = {}) => {
    if (containerRef.current) {
      return coreTrigger(containerRef.current, effectName, glitchOpts);
    }
    return Promise.resolve();
  }, []);

  const pause = useCallback(() => {
    schedulerRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    schedulerRef.current?.resume();
  }, []);

  return {
    ref: containerRef,
    scheduler: schedulerRef,
    trigger,
    pause,
    resume
  };
}

export default useUnstableText;
