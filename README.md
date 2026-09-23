# unstable-text

A lightweight, zero-reflow ambient text scramble engine for modern web applications. Automatically detects visible text content, applies subtle glitch/decrypt animations, and guarantees 0px layout shift.

---

## Features

- **Zero Layout Reflow (0px Baseline Shift):** Transient inline-block wrapper spans with `overflow: visible; vertical-align: baseline` guarantee surrounding text never shifts or wraps.
- **8 Glitch Modes:** `microChars`, `microWords`, `swapWords`, `corruptChar`, `blipChar`, `jitterChar`, `shiftHoldChar`, `neonColorChar`, and `fullScramble`.
- **Neon Reflection & Glow:** Includes 3 neon color presets (`GREEN`, `RED`, `BLUE`) and supports any arbitrary CSS color string (`hex`, `rgb()`, `hsl()`, named colors) with customizable intensity (`subtle`, `normal`, `intense`).
- **40% Dying-Neon Flicker End:** Customizable probability for neon colors to rapidly pulse right before resolving like an extinguishing neon sign tube.
- **Per-Node Cooldown:** Automatic timestamp tracking ensures ambient glitches are evenly distributed across text nodes rather than clustering on the same paragraph.
- **SSR & SPA Safety:** Server-side guards prevent Node/Next.js/Nuxt crashes; `destroy()` method provides complete observer/timer teardown for React/Vue component unmounting.
- **Controls & Accessibility Protection:** Interactive elements (`<a>`, `<button>`, `<input>`, `<textarea>`, `<select>`, `<code>`) are automatically protected from glitches. Respects `prefers-reduced-motion`.

---

## Quick Start

### 1. Zero-Config Usage (Ambient Background Scheduler)

```javascript
import { UnstableTextScheduler } from 'unstable-text';

// Automatically targets eligible visible text in document.body
const scheduler = new UnstableTextScheduler();
scheduler.start();
```

---

### 2. Custom Scheduler Options

```javascript
import { UnstableTextScheduler, SPEED_PRESETS, NEON_COLORS } from 'unstable-text';

const scheduler = new UnstableTextScheduler({
  container: document.querySelector('#content'),
  speedMultiplier: SPEED_PRESETS.FAST, // 'VERY_FAST' | 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW'
  minInterval: 800,                    // Min delay between ambient glitches (ms)
  maxInterval: 2500,                   // Max delay between ambient glitches (ms)
  maxConcurrent: 3,                    // Max concurrent active glitches on screen
  nodeCooldown: 4000,                  // Cooldown per text node before re-glitching (ms)
  neonColor: '#00ff66',                // Accepts preset ('GREEN', 'RED', 'BLUE') or hex/rgb/hsl
  glowIntensity: 'intense',            // 'subtle' | 'normal' | 'intense' | numeric multiplier
  neonGlitchChance: 0.35,              // 35% chance for any effect to gain neon glow
  neonFlickerEndChance: 0.40,          // 40% chance for dying-neon flicker end
  pauseOffscreen: true,                // Auto-pause when container is scrolled offscreen
  effects: {
    microChars: 2,                     // Weighted frequency (0 = disabled)
    microWords: 2,
    swapWords: 1,
    corruptChar: 1,
    blipChar: 2,
    jitterChar: 1,
    shiftHoldChar: 1,
    neonColorChar: 2,
    fullScramble: 0
  },
  onGlitchStart: (node, effectName) => console.log('Glitch started:', effectName),
  onGlitchEnd: (node, effectName) => console.log('Glitch ended:', effectName)
});

scheduler.start();

// Pause / Resume on demand (e.g. user animation preference toggle)
scheduler.pause();
scheduler.resume();

// Full SPA / React teardown on component unmount
scheduler.destroy();
```

---

### 3. Manual Trigger API (`UnstableText.trigger`)

Fire specific glitch effects on click, hover, or custom events:

```javascript
import UnstableText from 'unstable-text';

const headerEl = document.querySelector('h1');

// Trigger single-effect manual glitches
UnstableText.trigger(headerEl, 'microChars', { duration: 400 });
UnstableText.trigger(headerEl, 'jitterChar', { duration: 1200 });
UnstableText.trigger(headerEl, 'blipChar', { duration: 2000 });
UnstableText.trigger(headerEl, 'neonColorChar', { neonColor: '#ff0055', glowIntensity: 'intense' });
UnstableText.trigger(headerEl, 'fullScramble', { speedMultiplier: 0.6 });
```

---

### 4. HTML Data-Attribute Overrides

Customize behavior per-element directly in HTML without touching JavaScript:

```html
<!-- Restrict effects and override speed/color for a specific element -->
<h2 
  data-glitch-effects="corruptChar,blipChar" 
  data-glitch-color="#00f3ff" 
  data-glitch-intensity="intense"
  data-glitch-speed="slow"
>
  Quantum Encrypted Subsystem
</h2>

<!-- Explicitly ignore an element from ambient glitching -->
<p data-glitch-ignore>
  This text will never be affected by ambient glitching.
</p>
```

---

### 5. React Integration Example

```tsx
import React, { useEffect, useRef } from 'react';
import { UnstableTextScheduler } from 'unstable-text';

export const ScrambleSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scheduler = new UnstableTextScheduler({
      container: containerRef.current,
      minInterval: 1000,
      maxInterval: 3000
    });

    scheduler.start();

    // Clean teardown on unmount prevents memory leaks & orphaned observers
    return () => {
      scheduler.destroy();
    };
  }, []);

  return (
    <div ref={containerRef}>
      <h1>Unstable Text System</h1>
      <p>High performance ambient text animations.</p>
    </div>
  );
};
```

---

## API Reference

### `SchedulerOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `container` | `HTMLElement` | `document.body` | Root container element to scan for text nodes. |
| `speedMultiplier` | `number \| string` | `1.0` (`NORMAL`) | Speed preset key or numeric multiplier (`0.3` = 3.3x faster). |
| `minInterval` | `number` | `600` | Minimum delay between background glitches (ms). |
| `maxInterval` | `number` | `2000` | Maximum delay between background glitches (ms). |
| `maxConcurrent` | `number` | `3` | Max concurrent active glitches across the page. |
| `nodeCooldown` | `number` | `4000` | Cooldown period per text node before re-targeting (ms). |
| `neonColor` | `string` | `'GREEN'` (`#00ff66`) | Preset key (`GREEN`, `RED`, `BLUE`) or any CSS color (`#hex`, `rgb()`, `hsl()`). |
| `glowIntensity` | `string \| number` | `'normal'` | Glow blur radius scale (`'subtle'`, `'normal'`, `'intense'`, or numeric multiplier). |
| `neonGlitchChance` | `number` | `0.35` | Chance (0.0 to 1.0) for any background glitch to gain neon glow. |
| `neonFlickerEndChance` | `number` | `0.40` | Chance (0.0 to 1.0) for dying-neon flicker pulse at effect completion. |
| `pauseOffscreen` | `boolean` | `true` | Auto-pause scheduling when container is scrolled out of viewport. |
| `effects` | `EffectWeights` | See defaults | Object mapping effect names to numeric selection weights (0 = disabled). |
| `onGlitchStart` | `Function` | `null` | Lifecycle callback `(node, effectName) => void`. |
| `onGlitchEnd` | `Function` | `null` | Lifecycle callback `(node, effectName) => void`. |

---

## License

MIT © Google DeepMind Antigravity Team
