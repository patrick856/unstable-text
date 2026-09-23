# Ambient Text Scramble — Fixes & Additions (Pre-Packaging Pass)

Working from the current `scramble.js`. Apply these before moving to
Step 4 (packaging as an npm library).

## Bugs to fix

### 1. `swapWords` — inconsistent word-mapping between the two code paths

In `swapWords`, `chosenIndices` is built via a shuffle
(`.sort(() => Math.random() - 0.5).slice(...)`), so its order is already
randomized — not the original left-to-right token order.

- In the **wrapper path** (`if (span)` block), the code does:
  ```js
  chosenIndices.forEach((tokenIdx) => {
    const relIdx = tokenIdx - startTokenIdx;
    const origPos = chosenIndices.indexOf(tokenIdx); // always resolves to the forEach index itself
    segmentTokens[relIdx] = shuffledWords[origPos];
  });
  ```
  `chosenIndices.indexOf(tokenIdx)` inside a `forEach` over `chosenIndices`
  just returns the current iteration index again — it doesn't do anything
  useful, but happens to work by accident since it equals the loop index.

- In the **fallback path** (`else` block, no wrapper), the code does:
  ```js
  chosenIndices.forEach((tokenIdx, i) => {
    swappedTokens[tokenIdx] = shuffledWords[i];
  });
  ```
  This uses the plain iteration index `i` directly.

Both paths currently produce the same result today only because
`indexOf` happens to equal `i` in this specific loop — but this is
fragile and confusing, and any future refactor of `chosenIndices` (e.g.
sorting it, dedup logic, etc.) will silently break the wrapper path
without changing the fallback path, creating a real correctness bug.

**Fix:** unify both paths to use the same explicit index-based mapping
(`shuffledWords[i]` from a single `forEach((tokenIdx, i) => ...)`), and
remove the `indexOf` call entirely so there's one source of truth for
"which original word maps to which shuffled word."

### 2. Non-uniform shuffle (`Array.sort(() => Math.random() - 0.5)`)

Used twice in `swapWords` (for `chosenIndices` and for reshuffling
`shuffledWords` when it happens to equal the original order). This
pattern is a well-known biased shuffle — it does not produce a uniform
random permutation, because `Array.sort`'s comparator isn't called on
every pair with equal probability.

**Fix:** replace both usages with a proper Fisher-Yates shuffle helper,
e.g.:
```js
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

### 3. `globalSpeedMultiplier` fallback is inconsistent

`getScaledDuration` falls back to the module-level `globalSpeedMultiplier`
when no `speedMultiplier`/`timeMultiplier` is passed in `options`. This
works fine when called through `AmbientScheduler` (which always threads
`speedMultiplier` through via `opts`), but any direct call to an effect
function (e.g. `blipChar(node)`) with no options silently uses the
global default rather than any container- or instance-specific setting.

**Fix:** decide on one model and apply it consistently:
- Either make speed purely a per-`AmbientScheduler`-instance setting
  (remove the module-level global, require it to be passed explicitly
  through every call), or
- Keep a global default but document clearly that it's a page-wide
  fallback only, and ensure every public entry point (including any new
  manual-trigger API added below) explicitly resolves and passes it.

## Additions

Priority order: 1, 2, 3 first — the rest can follow.

### 1. Per-element overrides via `data-*` attributes
Allow a specific element to override ambient defaults without touching
JS config, e.g.:
```html
<h1 data-glitch-effects="corruptChar,blipChar" data-glitch-speed="slow">
```
`AmbientScheduler`'s eligibility/selection logic should read these
attributes (when present) and constrain which effects/speed apply to
that specific node.

### 2. Effect weighting (not just on/off)
Currently `_triggerRandomGlitch` hardcodes frequency by pushing some
effect names into `availableEffects` twice (e.g. `microChars` twice,
`blipChar` twice) to bias selection. Replace the boolean `effects: {}`
config with numeric weights, e.g.:
```js
effects: {
  microChars: 2,
  microWords: 2,
  swapWords: 1,
  corruptChar: 1,
  blipChar: 2,
  jitterChar: 1,
  shiftHoldChar: 1,
  fullScramble: 0 // 0 = disabled
}
```
Build the weighted candidate list from these values instead of hardcoded
duplication, so users can tune frequency per effect.

### 3. `prefers-reduced-motion` support
Check `window.matchMedia('(prefers-reduced-motion: reduce)')` at
`AmbientScheduler` init and either:
- skip `start()` entirely, or
- fall back to a much lower frequency / static-only mode (no motion-based
  effects like `jitterChar`/`shiftHoldChar`).
Make this the default behavior, with an explicit opt-out flag for users
who want to force-enable regardless.

### 4. Callbacks/events
Add optional hooks so consumers can react to glitch activity:
```js
new AmbientScheduler({
  onGlitchStart: (node, effectName) => {},
  onGlitchEnd: (node, effectName) => {},
});
```
Useful for sound effects, analytics, or custom visual accents tied to
glitch events.

### 5. Pause when offscreen
Use `IntersectionObserver` per container (or globally) to stop
scheduling/animating glitches on sections that are scrolled out of view.
Real performance win on long pages with many eligible text nodes.

### 6. Manual trigger API
Expose the existing effect functions as a clean public API separate from
the ambient scheduler, e.g.:
```js
AmbientGlitch.trigger(element, 'corruptChar', options);
```
So consumers can fire a specific effect on hover/click/load instead of
only relying on random ambient timing. The underlying functions already
exist — this is just a stable public export.

### 7. Color/style hooks for glitching characters
Add an option to tint or style characters while they're mid-glitch (e.g.
a CSS custom property set on the wrapper span, like
`--glitch-color: #0f0`), so the effect can be styled per-site rather than
always inheriting the surrounding text color as-is.
