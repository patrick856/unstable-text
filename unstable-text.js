/**
 * Ambient Text Scramble Library — Refined & Robust Multi-Effect Engine
 */

const isServer = typeof window === 'undefined' || typeof document === 'undefined';

const SPEED_PRESETS = Object.freeze({
  VERY_FAST: 0.3, // 3.3x faster
  FAST: 0.6,      // 1.6x faster
  NORMAL: 1.0,    // Standard
  SLOW: 1.7,      // 1.7x slower
  VERY_SLOW: 2.5  // 2.5x slower
});

const INTENSITY_PRESETS = Object.freeze({
  SUBTLE: { maxConcurrent: 1, minInterval: 1500, maxInterval: 4000 },
  LOW: { maxConcurrent: 2, minInterval: 1000, maxInterval: 3000 },
  NORMAL: { maxConcurrent: 3, minInterval: 600, maxInterval: 2000 },
  HIGH: { maxConcurrent: 5, minInterval: 300, maxInterval: 1200 },
  CHAOTIC: { maxConcurrent: 8, minInterval: 150, maxInterval: 600 }
});

const NEON_COLORS = Object.freeze({
  GREEN: '#00ff66',
  RED: '#ff0055',
  BLUE: '#00f3ff'
});

let globalSpeedMultiplier = SPEED_PRESETS.NORMAL;
const lastGlitchedNodes = new WeakMap();

/**
 * Uniform Fisher-Yates Array Shuffle Helper
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Helper to resolve neon color and CSS light-reflecting text-shadow glow.
 * Accepts preset keys ('GREEN', 'RED', 'BLUE') or any arbitrary CSS color string (hex, rgb, hsl, named).
 * Accepts options.glowIntensity: 'subtle' (0.5x), 'normal' (1.0x, default), 'intense' (1.6x), or numeric multiplier.
 */
function getNeonGlowStyle(colorInput = NEON_COLORS.GREEN, options = {}) {
  let hexColor = (typeof colorInput === 'string' && NEON_COLORS[colorInput.toUpperCase()]) || colorInput || NEON_COLORS.GREEN;
  let intensity = options.glowIntensity || options.intensity || 'normal';
  let mult = 1.0;
  if (intensity === 'subtle') mult = 0.5;
  else if (intensity === 'intense') mult = 1.6;
  else if (typeof intensity === 'number') mult = intensity;

  const r1 = Math.max(1, Math.round(5 * mult));
  const r2 = Math.max(2, Math.round(12 * mult));
  const r3 = Math.max(3, Math.round(22 * mult));

  return {
    color: hexColor,
    textShadow: `0 0 ${r1}px ${hexColor}, 0 0 ${r2}px ${hexColor}, 0 0 ${r3}px ${hexColor}`
  };
}

/**
 * Helper for dying-neon flicker pulse at the end of neon glow effects (40% default chance)
 */
function runNeonFlickerEnd(targetSpan, duration, glowStyle, options = {}) {
  const flickerChance = options.neonFlickerEndChance !== undefined ? options.neonFlickerEndChance : 0.40;
  const shouldFlicker = Math.random() < flickerChance;

  if (!shouldFlicker || duration < 600) {
    return new Promise((resolve) => {
      setTimeout(() => {
        targetSpan.style.color = '';
        targetSpan.style.textShadow = '';
        resolve();
      }, duration);
    });
  }

  const solidHold = Math.max(100, duration - 400);

  return new Promise((resolve) => {
    setTimeout(() => {
      targetSpan.style.textShadow = 'none';
      targetSpan.style.color = 'inherit';

      setTimeout(() => {
        targetSpan.style.color = glowStyle.color;
        targetSpan.style.textShadow = glowStyle.textShadow;

        setTimeout(() => {
          targetSpan.style.textShadow = 'none';
          targetSpan.style.color = 'inherit';

          setTimeout(() => {
            targetSpan.style.color = glowStyle.color;
            targetSpan.style.textShadow = glowStyle.textShadow;

            setTimeout(() => {
              targetSpan.style.color = '';
              targetSpan.style.textShadow = '';
              resolve();
            }, 90);
          }, 70);
        }, 110);
      }, 80);
    }, solidHold);
  });
}

/**
 * Calculates scaled duration based on options or global speed multiplier fallback.
 */
function getScaledDuration(baseDuration, options = {}) {
  let mult = options.speedMultiplier || options.timeMultiplier;
  if (typeof mult === 'string') {
    mult = SPEED_PRESETS[mult.toUpperCase()] || parseFloat(mult) || globalSpeedMultiplier;
  }
  if (!mult) mult = globalSpeedMultiplier;
  return Math.max(50, Math.round(baseDuration * mult));
}

const BROKEN_CHARSET = [
  // Upside-down & inverted characters
  'ɐ', 'q', 'ɔ', 'p', 'ǝ', 'ɟ', 'ƃ', 'ɥ', 'ᴉ', 'ɾ', 'ʞ', 'l', 'ɯ', 'u', 'o', 'd', 'b', 'ɹ', 's', 'ʇ', 'n', 'ʌ', 'ʍ', 'x', 'ʎ', 'z',
  'Ɐ', 'ᗺ', 'Ɔ', 'ᗡ', 'Ǝ', 'Ⅎ', '⅁', 'H', 'I', 'ſ', 'Ꞁ', 'W', 'N', 'O', 'Ԁ', 'Ꝺ', 'ᴚ', 'S', '⊥', '∩', 'Ʌ', 'M', 'X', '⅄', 'Z',
  // Glitch & tech symbols
  '▓', '▒', '░', '╳', '⌖', '⯌', '█', '⍂', '⎔', 'ø', '∆', 'µ', '∯', '⟁', '⧖', '§', '‡', '¶', '©', '®', '†', '⁕'
];

// Combined charset pool for rich scrambling
const SCRAMBLE_CHARSET = [
  ...BROKEN_CHARSET,
  '!', '<', '>', '-', '_', '\\', '/', '[', ']', '{', '}', '—', '=', '+', '*', '^', '?', '#', '_', '_', '_'
];

/**
 * Checks if a target node or any of its ancestors/descendants is currently glitching.
 */
function isNodeGlitching(target) {
  if (!target) return true;
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  if (!el) return true;
  if (target._isGlitching || el._isGlitching || el.dataset.isGlitching === 'true') return true;
  if (el.closest('[data-is-glitching="true"], [data-glitch-wrapper="true"]')) return true;
  return false;
}

/**
 * Locks an element and its parent container against concurrent glitch calls.
 */
function lockGlitchNode(target) {
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  target._isGlitching = true;
  if (el) {
    el._isGlitching = true;
    el.dataset.isGlitching = 'true';
  }
}

/**
 * Unlocks an element and its parent container when a glitch completes.
 */
function unlockGlitchNode(target) {
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  delete target._isGlitching;
  if (el) {
    delete el._isGlitching;
    delete el.dataset.isGlitching;
    try { el.normalize(); } catch (e) {}
  }
}

/**
 * Wraps a target character range in a transient fixed-width inline-block span to eliminate layout shifts.
 * Uses overflow: visible and inherits line-height/font-size to guarantee 0px baseline floating.
 * Applies neon color text-shadow glow if options.neonColor / color is passed.
 */
function createGlitchWrapper(textNode, startIndex, endIndex, options = {}) {
  try {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return { span: null, textNode };
    const parent = textNode.parentElement;
    if (!parent) return { span: null, textNode };

    const range = document.createRange();
    const len = textNode.nodeValue ? textNode.nodeValue.length : 0;
    const safeStart = Math.max(0, Math.min(startIndex, len));
    const safeEnd = Math.max(safeStart, Math.min(endIndex, len));

    if (safeStart === 0 && safeEnd === len) {
      range.selectNodeContents(textNode);
    } else {
      range.setStart(textNode, safeStart);
      range.setEnd(textNode, safeEnd);
    }

    const rect = range.getBoundingClientRect();
    const width = rect.width;

    if (width > 0) {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.style.width = `${Math.ceil(width)}px`;
      span.style.textAlign = 'center';
      span.style.overflow = 'visible'; // 'visible' prevents W3C bottom-margin-edge baseline floating!
      span.style.verticalAlign = 'baseline';
      span.style.whiteSpace = 'pre';
      span.style.lineHeight = 'inherit';
      span.style.fontSize = 'inherit';
      span.dataset.glitchWrapper = 'true';

      // Apply neon color glow overlay if specified
      const colorOpt = options.neonColor || options.color || options.glitchColor;
      if (colorOpt) {
        const glowStyle = getNeonGlowStyle(colorOpt, options);
        span.style.color = glowStyle.color;
        span.style.textShadow = glowStyle.textShadow;
      }

      range.surroundContents(span);
      const innerTextNode = span.firstChild || span;
      return { span, textNode: innerTextNode };
    }
  } catch (e) {
    // Safe fallback if range creation encounters complex DOM state
  }
  return { span: null, textNode };
}

/**
 * Removes the transient wrapper span and normalizes parent DOM node structure.
 */
function removeGlitchWrapper(span) {
  if (!span || !span.parentNode) return;
  const parent = span.parentNode;
  const textContent = span.textContent;
  const textNode = document.createTextNode(textContent);
  parent.replaceChild(textNode, span);
  try { parent.normalize(); } catch (e) {}
}

/**
 * Collects all eligible visible text nodes inside a container, excluding controls.
 */
function getAllTextNodes(container) {
  if (isServer) return [];
  if (!container && typeof document !== 'undefined') container = document.body;
  if (!container) return [];
  const textNodes = [];
  const walk = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (isNodeGlitching(node) || isNodeGlitching(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        const tagName = parent.tagName.toLowerCase();
        const forbiddenTags = [
          'script', 'style', 'button', 'a', 'input',
          'textarea', 'select', 'option', 'code', 'pre', 'noscript'
        ];

        if (
          forbiddenTags.includes(tagName) ||
          parent.closest('button, a, input, textarea, select, [data-glitch-ignore]')
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let current;
  while ((current = walk.nextNode())) {
    textNodes.push(current);
  }
  return textNodes;
}

/**
 * Stackable Neon Glow Color Shift Effect with 40% Dying Neon Flicker End Chance
 */
function neonColorChar(textNode, options = {}) {
  const parent = textNode.nodeType === Node.TEXT_NODE ? textNode.parentElement : textNode;
  const existingWrapper = parent?.closest('[data-glitch-wrapper="true"]');

  const chosenColor = options.neonColor || options.color || 'GREEN';
  const glowStyle = getNeonGlowStyle(chosenColor);
  const baseDuration = options.duration || Math.floor(Math.random() * 2000) + 1000;
  const duration = getScaledDuration(baseDuration, options);

  if (existingWrapper) {
    existingWrapper.style.color = glowStyle.color;
    existingWrapper.style.textShadow = glowStyle.textShadow;
    if (typeof options.onGlitchStart === 'function') options.onGlitchStart(textNode, 'neonColorChar');

    return runNeonFlickerEnd(existingWrapper, duration, glowStyle, options).then(() => {
      if (typeof options.onGlitchEnd === 'function') options.onGlitchEnd(textNode, 'neonColorChar');
    });
  }

  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const nonSpaceIndices = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const targetIdx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)];

  const { span } = createGlitchWrapper(node, targetIdx, targetIdx + 1, { ...options, neonColor: chosenColor });
  if (!span) {
    unlockGlitchNode(textNode);
    return Promise.resolve();
  }

  span.style.transition = 'color 0.2s ease, text-shadow 0.2s ease';

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'neonColorChar');
  }

  return runNeonFlickerEnd(span, duration, glowStyle, options).then(() => {
    removeGlitchWrapper(span);
    unlockGlitchNode(textNode);
    if (typeof options.onGlitchEnd === 'function') {
      options.onGlitchEnd(textNode, 'neonColorChar');
    }
  });
}

/**
 * Jitter Variation 1: Continuous rapid 2D jittering off-grid over duration.
 */
function jitterChar(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const nonSpaceIndices = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || Math.floor(Math.random() * 1000) + 1000;
  const duration = getScaledDuration(baseDuration, options);

  const charCount = Math.min(nonSpaceIndices.length, Math.floor(Math.random() * 2) + 1);
  const startPick = Math.floor(Math.random() * (nonSpaceIndices.length - charCount + 1));
  const startIndex = nonSpaceIndices[startPick];
  const endIndex = startIndex + charCount;

  const { span } = createGlitchWrapper(node, startIndex, endIndex, options);
  if (!span) {
    unlockGlitchNode(textNode);
    return Promise.resolve();
  }

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'jitterChar');
  }

  span.style.transition = 'transform 0.08s ease-in-out';

  return new Promise((resolve) => {
    const startTime = performance.now();
    let nextJitterTime = startTime;

    function update(now) {
      const elapsed = now - startTime;

      if (elapsed < duration) {
        if (now >= nextJitterTime) {
          const offsetX = (Math.random() * 6 - 3).toFixed(1);
          const offsetY = (Math.random() * 6 - 3).toFixed(1);
          span.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
          nextJitterTime = now + getScaledDuration(Math.floor(Math.random() * 100) + 90, options);
        }
        requestAnimationFrame(update);
      } else {
        span.style.transform = 'translate(0px, 0px)';
        setTimeout(() => {
          removeGlitchWrapper(span);
          unlockGlitchNode(textNode);
          if (typeof options.onGlitchEnd === 'function') {
            options.onGlitchEnd(textNode, 'jitterChar');
          }
          resolve();
        }, 90);
      }
    }

    requestAnimationFrame(update);
  });
}

/**
 * Jitter Variation 2: Moves 1-2 characters off-grid ONCE, holds offset for duration, then smoothly returns to origin.
 */
function shiftHoldChar(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const nonSpaceIndices = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || Math.floor(Math.random() * 1000) + 1200;
  const duration = getScaledDuration(baseDuration, options);

  const charCount = Math.min(nonSpaceIndices.length, Math.floor(Math.random() * 2) + 1);
  const startPick = Math.floor(Math.random() * (nonSpaceIndices.length - charCount + 1));
  const startIndex = nonSpaceIndices[startPick];
  const endIndex = startIndex + charCount;

  const { span } = createGlitchWrapper(node, startIndex, endIndex, options);
  if (!span) {
    unlockGlitchNode(textNode);
    return Promise.resolve();
  }

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'shiftHoldChar');
  }

  const animSpeed = getScaledDuration(250, options);
  span.style.transition = `transform ${animSpeed}ms ease-out`;

  const offsetX = (Math.random() * 6 - 3).toFixed(1);
  const offsetY = (Math.random() * 6 - 3).toFixed(1);

  requestAnimationFrame(() => {
    span.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  return new Promise((resolve) => {
    const holdTime = Math.max(100, duration - animSpeed);
    setTimeout(() => {
      span.style.transform = 'translate(0px, 0px)';
      setTimeout(() => {
        removeGlitchWrapper(span);
        unlockGlitchNode(textNode);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(textNode, 'shiftHoldChar');
        }
        resolve();
      }, animSpeed);
    }, holdTime);
  });
}

/**
 * Broken Lamp Effect
 */
function blipChar(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const nonSpaceIndices = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || Math.floor(Math.random() * 2000) + 2000;
  const duration = getScaledDuration(baseDuration, options);

  const targetIdx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)];
  const origChar = originalText[targetIdx];

  const stateA = origChar;
  const possibleStateB = ['-', ' ', BROKEN_CHARSET[Math.floor(Math.random() * BROKEN_CHARSET.length)]];
  const stateB = possibleStateB[Math.floor(Math.random() * possibleStateB.length)];

  const { span, textNode: activeNode } = createGlitchWrapper(node, targetIdx, targetIdx + 1, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'blipChar');
  }

  return new Promise((resolve) => {
    const startTime = performance.now();
    let isStateA = true;
    let nextFlickerTime = startTime + getScaledDuration(Math.floor(Math.random() * 300) + 600, options);

    function update(now) {
      const elapsed = now - startTime;

      if (elapsed < duration) {
        if (now >= nextFlickerTime) {
          isStateA = !isStateA;
          const currentChar = isStateA ? stateA : stateB;
          if (span) {
            activeNode.nodeValue = currentChar;
          } else {
            node.nodeValue =
              originalText.substring(0, targetIdx) +
              currentChar +
              originalText.substring(targetIdx + 1);
          }
          nextFlickerTime = now + getScaledDuration(Math.floor(Math.random() * 300) + 600, options);
        }
        requestAnimationFrame(update);
      } else {
        if (span) {
          activeNode.nodeValue = origChar;
          removeGlitchWrapper(span);
        } else {
          node.nodeValue = originalText;
        }
        unlockGlitchNode(textNode);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(textNode, 'blipChar');
        }
        resolve();
      }
    }

    requestAnimationFrame(update);
  });
}

/**
 * Micro-scramble
 */
function scrambleMicro(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const length = originalText.length;
  if (length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || (Math.floor(Math.random() * 200) + 300);
  const duration = getScaledDuration(baseDuration, options);

  const mode = options.mode || (Math.random() > 0.5 ? 'chars' : 'words');

  let startIndex = 0;
  let endIndex = 0;

  if (mode === 'words') {
    const words = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(originalText)) !== null) {
      words.push({ start: match.index, end: match.index + match[0].length });
    }

    if (words.length > 0) {
      const startWordIdx = Math.floor(Math.random() * words.length);
      const wordCount = Math.min(words.length - startWordIdx, Math.floor(Math.random() * 2) + 1);
      startIndex = words[startWordIdx].start;
      endIndex = words[startWordIdx + wordCount - 1].end;
    } else {
      startIndex = 0;
      endIndex = Math.min(length, 5);
    }
  } else {
    const nonSpaceIndices = [];
    for (let i = 0; i < length; i++) {
      if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
    }
    if (nonSpaceIndices.length > 0) {
      const pick = Math.floor(Math.random() * nonSpaceIndices.length);
      startIndex = nonSpaceIndices[pick];
      const charCount = Math.floor(Math.random() * 5) + 1;
      endIndex = Math.min(length, startIndex + charCount);
    }
  }

  if (endIndex <= startIndex) {
    unlockGlitchNode(textNode);
    return Promise.resolve();
  }

  const sliceText = originalText.substring(startIndex, endIndex);

  const { span, textNode: activeNode } = createGlitchWrapper(node, startIndex, endIndex, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'scrambleMicro');
  }

  return new Promise((resolve) => {
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        let result = '';
        for (let i = 0; i < sliceText.length; i++) {
          if (/\s/.test(sliceText[i])) {
            result += sliceText[i];
          } else {
            result += SCRAMBLE_CHARSET[Math.floor(Math.random() * SCRAMBLE_CHARSET.length)];
          }
        }
        if (span) {
          activeNode.nodeValue = result;
        } else {
          node.nodeValue =
            originalText.substring(0, startIndex) +
            result +
            originalText.substring(endIndex);
        }
        requestAnimationFrame(update);
      } else {
        if (span) {
          activeNode.nodeValue = sliceText;
          removeGlitchWrapper(span);
        } else {
          node.nodeValue = originalText;
        }
        unlockGlitchNode(textNode);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(textNode, 'scrambleMicro');
        }
        resolve();
      }
    }

    requestAnimationFrame(update);
  });
}

/**
 * Word Swap
 */
function swapWords(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const tokens = originalText.match(/(\S+|\s+)/g) || [];
  const wordIndices = [];

  tokens.forEach((token, index) => {
    if (/\S/.test(token) && token.length > 1) {
      wordIndices.push(index);
    }
  });

  if (wordIndices.length < 2) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || (Math.floor(Math.random() * 200) + 500);
  const duration = getScaledDuration(baseDuration, options);

  const swapCount = Math.min(wordIndices.length, Math.floor(Math.random() * 3) + 2);
  const chosenIndices = shuffleArray(wordIndices).slice(0, swapCount);

  const originalWords = chosenIndices.map((i) => tokens[i]);
  let shuffledWords = shuffleArray(originalWords);
  while (shuffledWords.join('') === originalWords.join('') && shuffledWords.length > 1) {
    shuffledWords = shuffleArray(originalWords);
  }

  let startTokenIdx = Math.min(...chosenIndices);
  let endTokenIdx = Math.max(...chosenIndices);

  let charStart = 0;
  for (let i = 0; i < startTokenIdx; i++) {
    charStart += tokens[i].length;
  }
  let charEnd = charStart;
  for (let i = startTokenIdx; i <= endTokenIdx; i++) {
    charEnd += tokens[i].length;
  }

  const segmentTokens = tokens.slice(startTokenIdx, endTokenIdx + 1);
  chosenIndices.forEach((tokenIdx, i) => {
    const relIdx = tokenIdx - startTokenIdx;
    segmentTokens[relIdx] = shuffledWords[i];
  });
  const swappedSegmentText = segmentTokens.join('');

  const { span, textNode: activeNode } = createGlitchWrapper(node, charStart, charEnd, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'swapWords');
  }

  if (span) {
    activeNode.nodeValue = swappedSegmentText;
  } else {
    const swappedTokens = [...tokens];
    chosenIndices.forEach((tokenIdx, i) => {
      swappedTokens[tokenIdx] = shuffledWords[i];
    });
    node.nodeValue = swappedTokens.join('');
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (span) {
        activeNode.nodeValue = tokens.slice(startTokenIdx, endTokenIdx + 1).join('');
        removeGlitchWrapper(span);
      } else {
        node.nodeValue = originalText;
      }
      unlockGlitchNode(textNode);
      if (typeof options.onGlitchEnd === 'function') {
        options.onGlitchEnd(textNode, 'swapWords');
      }
      resolve();
    }, duration);
  });
}

/**
 * Corrupt Char
 */
function corruptChar(textNode, options = {}) {
  if (isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent;
  const nonSpaceIndices = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);
  const baseDuration = options.duration || Math.floor(Math.random() * 3000) + 3000;
  const duration = getScaledDuration(baseDuration, options);

  const targetIdx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)];
  const origChar = originalText[targetIdx];
  const brokenChar = BROKEN_CHARSET[Math.floor(Math.random() * BROKEN_CHARSET.length)];

  const { span, textNode: activeNode } = createGlitchWrapper(node, targetIdx, targetIdx + 1, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'corruptChar');
  }

  if (span) {
    activeNode.nodeValue = brokenChar;
  } else {
    node.nodeValue =
      originalText.substring(0, targetIdx) +
      brokenChar +
      originalText.substring(targetIdx + 1);
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (span) {
        activeNode.nodeValue = origChar;
        removeGlitchWrapper(span);
      } else {
        node.nodeValue = originalText;
      }
      unlockGlitchNode(textNode);
      if (typeof options.onGlitchEnd === 'function') {
        options.onGlitchEnd(textNode, 'corruptChar');
      }
      resolve();
    }, duration);
  });
}

/**
 * Standard Full Scramble
 */
function scrambleText(target, options = {}) {
  if (isNodeGlitching(target)) return Promise.resolve();

  const isElement = target.nodeType !== Node.TEXT_NODE;
  const el = isElement ? target : target.parentElement;

  if (isNodeGlitching(el)) return Promise.resolve();
  if (el) try { el.normalize(); } catch (e) {}

  const node = target.nodeType === Node.TEXT_NODE ? target : (target.firstChild || target);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = isElement ? target.textContent : node.nodeValue;
  const length = originalText.length;
  if (length === 0) return Promise.resolve();

  lockGlitchNode(target);
  if (el) lockGlitchNode(el);

  const baseDuration = options.duration || 800;
  const duration = getScaledDuration(baseDuration, options);

  const charset = options.charset || SCRAMBLE_CHARSET;

  const { span, textNode: activeNode } = createGlitchWrapper(node, 0, length, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(target, 'fullScramble');
  }

  return new Promise((resolve) => {
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const lockedCount = Math.floor(progress * length);

      if (progress < 1) {
        let result = '';
        for (let i = 0; i < length; i++) {
          if (/\s/.test(originalText[i]) || i < lockedCount) {
            result += originalText[i];
          } else {
            result += charset[Math.floor(Math.random() * charset.length)];
          }
        }
        if (span) {
          activeNode.nodeValue = result;
        } else if (isElement) {
          target.textContent = result;
        } else {
          node.nodeValue = result;
        }
        requestAnimationFrame(update);
      } else {
        if (span) {
          activeNode.nodeValue = originalText;
          removeGlitchWrapper(span);
        } else if (isElement) {
          target.textContent = originalText;
        } else {
          node.nodeValue = originalText;
        }
        unlockGlitchNode(target);
        if (el) unlockGlitchNode(el);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(target, 'fullScramble');
        }
        resolve();
      }
    }

    requestAnimationFrame(update);
  });
}

/**
 * UnstableText Scheduler managing automatic background glitching across page text nodes.
 */
class UnstableTextScheduler {
  constructor(options = {}) {
    if (isServer) {
      this.isServer = true;
      return;
    }

    this.container = options.container || (typeof document !== 'undefined' ? document.body : null);

    let mult = options.speedMultiplier || options.timeMultiplier || globalSpeedMultiplier;
    if (typeof mult === 'string') {
      mult = SPEED_PRESETS[mult.toUpperCase()] || parseFloat(mult) || globalSpeedMultiplier;
    }
    this.speedMultiplier = mult;

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

    // Check prefers-reduced-motion
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

    // Default neon color & glow intensity selection
    this.neonColor = options.neonColor || options.color || 'GREEN';
    this.glowIntensity = options.glowIntensity || options.intensity || 'normal';

    // Customizable chance (default: 35%) for ANY background effect to trigger in default neon color
    this.neonGlitchChance = options.neonGlitchChance !== undefined ? options.neonGlitchChance : 0.35;

    // Customizable chance (default: 40%) for a dying-neon flicker at the end of neon color effects
    this.neonFlickerEndChance = options.neonFlickerEndChance !== undefined ? options.neonFlickerEndChance : 0.40;

    // Numeric weights
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

    // IntersectionObserver for offscreen pause
    this.isIntersecting = true;
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

  getEligibleTextNodes() {
    if (this.isServer || !this.container) return [];
    return getAllTextNodes(this.container).filter((node) => !isNodeGlitching(node));
  }

  start() {
    if (this.isServer || this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this._ensureMinConcurrent();
    this._scheduleNext();
  }

  stop() {
    if (this.isServer) return;
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  pause() {
    if (this.isServer) return;
    this.isPaused = true;
  }

  resume() {
    if (this.isServer) return;
    this.isPaused = false;
    this._ensureMinConcurrent();
  }

  setAmbientIntensity(presetKey) {
    if (this.isServer || typeof presetKey !== 'string') return;
    const key = presetKey.toUpperCase();
    const preset = INTENSITY_PRESETS[key];
    if (preset) {
      this.minConcurrent = preset.minConcurrent;
      this.maxConcurrent = preset.maxConcurrent;
      this.minInterval = Math.round(preset.minInterval * this.speedMultiplier);
      this.maxInterval = Math.round(preset.maxInterval * this.speedMultiplier);
      this._ensureMinConcurrent();
    }
  }

  destroy() {
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

  _ensureMinConcurrent() {
    if (this.isServer || !this.isRunning || this.isPaused || !this.isIntersecting) return;
    let attempts = 0;
    while (this.activeCount < this.minConcurrent && attempts < 10) {
      attempts++;
      const prevCount = this.activeCount;
      this._triggerRandomGlitch();
      if (this.activeCount <= prevCount) break;
    }
  }

  _scheduleNext() {
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

  _triggerRandomGlitch() {
    if (this.isServer || this.isPaused || this.activeCount >= this.maxConcurrent) return;

    const candidates = this.getEligibleTextNodes();
    if (candidates.length === 0) return;

    // Per-node cooldown filtering to space out glitch targeting evenly
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
    let allowedEffects = null;
    let customNeonColor = this.neonColor;
    let customGlowIntensity = this.glowIntensity;

    if (parentEl) {
      const dataSpeed = parentEl.getAttribute('data-glitch-speed') || parentEl.closest('[data-glitch-speed]')?.getAttribute('data-glitch-speed');
      if (dataSpeed) {
        effectiveSpeed = SPEED_PRESETS[dataSpeed.toUpperCase()] || parseFloat(dataSpeed) || effectiveSpeed;
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
        customGlowIntensity = dataIntensity;
      }
    }

    const candidateEffects = [];
    Object.keys(this.effects).forEach((effName) => {
      const weight = this.effects[effName];
      if (weight > 0) {
        if (!allowedEffects || allowedEffects.includes(effName)) {
          for (let w = 0; w < weight; w++) {
            candidateEffects.push(effName);
          }
        }
      }
    });

    if (candidateEffects.length === 0) return;

    const chosenEffect = candidateEffects[Math.floor(Math.random() * candidateEffects.length)];

    this.activeCount++;

    // Customizable 35% chance for any effect to trigger with the default set neon color
    const applyNeon = Math.random() < this.neonGlitchChance;

    const opts = {
      speedMultiplier: effectiveSpeed,
      neonColor: applyNeon ? customNeonColor : undefined,
      glowIntensity: customGlowIntensity,
      neonFlickerEndChance: this.neonFlickerEndChance,
      onGlitchStart: this.onGlitchStart,
      onGlitchEnd: this.onGlitchEnd
    };

    let promise;
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

/**
 * Public Namespace & Trigger API
 */
const UnstableText = {
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

  setGlobalSpeedMultiplier(speed) {
    if (typeof speed === 'string') {
      globalSpeedMultiplier = SPEED_PRESETS[speed.toUpperCase()] || parseFloat(speed) || 1.0;
    } else if (typeof speed === 'number') {
      globalSpeedMultiplier = speed;
    }
  },

  trigger(target, effectName = 'microChars', options = {}) {
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
  },

  Scheduler: UnstableTextScheduler,
  UnstableTextScheduler,
  AmbientScheduler: UnstableTextScheduler
};

const AmbientGlitch = UnstableText;

if (typeof window !== 'undefined') {
  window.UnstableText = UnstableText;
  window.AmbientGlitch = UnstableText;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnstableText;
  module.exports.UnstableText = UnstableText;
  module.exports.UnstableTextScheduler = UnstableTextScheduler;
  module.exports.AmbientGlitch = UnstableText;
  module.exports.AmbientScheduler = UnstableTextScheduler;
}
