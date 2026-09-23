# Ambient Text Scramble Effect — Build Plan

A reusable effect where random text elements on a page briefly "scramble"
(cycle through random characters) at random intervals, with multiple visual
presets of different durations/styles. Meant as a drop-in accent for
developer/tech/cyberpunk-leaning sites — not a full-page effect.

## Step 1 — Core scramble function (prove the effect looks good)

- Plain HTML file, no build tooling, no framework yet.
- Write one function that takes a DOM text node and:
  - Replaces its characters with random characters from a charset.
  - Over a set duration, progressively "locks in" the correct characters
    (classic scramble-to-reveal, left-to-right or randomized order).
  - Restores the original text exactly when done.
- Hardcode a single style first (random char → random char → settles).
- Trigger it manually with a button click on one `<h1>`. Do NOT build the
  scheduler yet — the goal of this step is only to confirm the visual
  effect itself looks good before building anything around it.

## Step 2 — Ambient scheduler

- A function that finds "eligible" text nodes on the page. Start simple:
  only elements manually marked with a `data-glitch` attribute — do not
  attempt to auto-detect all text on the page yet.
- Use `setTimeout` (recursive, with a randomized delay each time) to pick
  one eligible node at random and fire a scramble on it.
- Add a max-concurrent-scrambles guard so multiple elements don't glitch
  at once by accident.

## Step 3 — Multiple presets

Build 2–3 distinct "looks," each just a config object (duration, charset,
reveal order/pattern) fed into the same core scramble function:

- **Fast flicker** — ~0.3s, high character-change rate.
- **Slow decrypt** — ~1s, settles left-to-right.
- **Static/glitch** — very short bursts, using "broken" characters like
  `▓▒░#`.

Adding a 4th preset later should just mean adding a new config object, not
new logic.

## Step 4 — Package it

- Move the code into a Vite-built npm package (matches existing stack:
  React 18, TypeScript, Vite).
- Expose a simple API, e.g.:
  ```ts
  new AmbientGlitch(selector, options);
  ```
- Respect `prefers-reduced-motion` (disable or reduce frequency).
- Allow scoping to a specific container instead of the whole page.

## Step 5 — Demo it live

- Put a working demo on a real, multi-page site with a navbar so the
  ambient/random-interval behavior can be seen naturally while navigating
  — a single static page makes it hard to judge how "ambient" and
  non-repetitive it feels over time.
- Best candidate: SilentRose Studio's own site, since a live public demo
  also doubles as marketing for the studio.

## Non-goals for v1

- No auto-detection of arbitrary page text (opt-in via `data-glitch` only).
- No CMS/editor integration.
- No auto-glitching of interactive elements (buttons, nav, links) — text
  content only, to avoid breaking usability.
