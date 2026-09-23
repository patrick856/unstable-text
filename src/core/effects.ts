import { isServer, SPEED_PRESETS, speedState, BROKEN_CHARSET, SCRAMBLE_CHARSET } from './constants';
import { GlitchOptions } from './types';
import {
  getNeonGlowStyle,
  isNodeGlitching,
  lockGlitchNode,
  unlockGlitchNode,
  createGlitchWrapper,
  removeGlitchWrapper
} from './wrapper';

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getScaledDuration(baseDuration: number, options: GlitchOptions = {}): number {
  let mult = options.speedMultiplier || options.timeMultiplier;
  if (typeof mult === 'string') {
    mult = SPEED_PRESETS[mult.toUpperCase() as keyof typeof SPEED_PRESETS] || parseFloat(mult) || speedState.globalSpeedMultiplier;
  }
  if (!mult) mult = speedState.globalSpeedMultiplier;
  return Math.max(50, Math.round(baseDuration * mult));
}

export function runNeonFlickerEnd(targetSpan: HTMLElement, duration: number, glowStyle: { color: string; textShadow: string }, options: GlitchOptions = {}): Promise<void> {
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

export function scrambleMicro(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  if (!originalText || originalText.trim().length === 0) return Promise.resolve();

  lockGlitchNode(textNode);

  const mode = options.mode || 'chars';
  const baseDuration = options.duration || (mode === 'words' ? 400 : 300);
  const duration = getScaledDuration(baseDuration, options);

  let startIndex = 0;
  let endIndex = originalText.length;
  let targetSlice = originalText;

  if (mode === 'words') {
    const words = originalText.split(/(\s+)/);
    const nonSpaceWords: number[] = [];
    words.forEach((w, idx) => {
      if (!/^\s+$/.test(w) && w.length > 0) nonSpaceWords.push(idx);
    });

    if (nonSpaceWords.length > 0) {
      const chosenWordIdx = nonSpaceWords[Math.floor(Math.random() * nonSpaceWords.length)];
      let charPos = 0;
      for (let i = 0; i < chosenWordIdx; i++) charPos += words[i].length;
      startIndex = charPos;
      endIndex = charPos + words[chosenWordIdx].length;
      targetSlice = words[chosenWordIdx];
    }
  } else {
    const nonSpaceIndices: number[] = [];
    for (let i = 0; i < originalText.length; i++) {
      if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
    }
    if (nonSpaceIndices.length === 0) {
      unlockGlitchNode(textNode);
      return Promise.resolve();
    }
    const count = Math.min(nonSpaceIndices.length, Math.floor(Math.random() * 5) + 1);
    const startPick = Math.floor(Math.random() * (nonSpaceIndices.length - count + 1));
    startIndex = nonSpaceIndices[startPick];
    endIndex = startIndex + count;
    targetSlice = originalText.substring(startIndex, endIndex);
  }

  const { span, textNode: activeNode } = createGlitchWrapper(node, startIndex, endIndex, options);
  const charset = options.charset || SCRAMBLE_CHARSET;

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, mode === 'words' ? 'microWords' : 'microChars');
  }

  return new Promise((resolve) => {
    const startTime = performance.now();

    function update(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        let result = '';
        for (let i = 0; i < targetSlice.length; i++) {
          if (/\s/.test(targetSlice[i])) {
            result += targetSlice[i];
          } else {
            result += charset[Math.floor(Math.random() * charset.length)];
          }
        }
        if (span) {
          activeNode.nodeValue = result;
        } else {
          node.nodeValue = originalText.substring(0, startIndex) + result + originalText.substring(endIndex);
        }
        requestAnimationFrame(update);
      } else {
        if (span) {
          activeNode.nodeValue = targetSlice;
          removeGlitchWrapper(span);
        } else {
          node.nodeValue = originalText;
        }
        unlockGlitchNode(textNode);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(textNode, mode === 'words' ? 'microWords' : 'microChars');
        }
        resolve();
      }
    }

    requestAnimationFrame(update);
  });
}

export function swapWords(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  const tokens = originalText.split(/(\s+)/);

  const wordIndices: number[] = [];
  tokens.forEach((t, idx) => {
    if (!/^\s+$/.test(t) && t.length > 0) wordIndices.push(idx);
  });

  if (wordIndices.length < 2) return Promise.resolve();

  lockGlitchNode(textNode);

  const swapCount = Math.min(wordIndices.length, Math.floor(Math.random() * 3) + 2);
  const shuffledIndices = shuffleArray(wordIndices).slice(0, swapCount);

  const originalWords = shuffledIndices.map((idx) => tokens[idx]);
  let shuffledWords = shuffleArray(originalWords);

  if (shuffledWords.join('') === originalWords.join('')) {
    shuffledWords = [...originalWords].reverse();
  }

  const baseDuration = options.duration || Math.floor(Math.random() * 200) + 500;
  const duration = getScaledDuration(baseDuration, options);

  const minTokenIdx = Math.min(...shuffledIndices);
  const maxTokenIdx = Math.max(...shuffledIndices);

  let charStart = 0;
  for (let i = 0; i < minTokenIdx; i++) charStart += tokens[i].length;
  let charEnd = charStart;
  for (let i = minTokenIdx; i <= maxTokenIdx; i++) charEnd += tokens[i].length;

  const { span, textNode: activeNode } = createGlitchWrapper(node, charStart, charEnd, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'swapWords');
  }

  const swappedTokens = [...tokens];
  shuffledIndices.forEach((tokenIdx, i) => {
    swappedTokens[tokenIdx] = shuffledWords[i];
  });

  const segmentTokens = tokens.slice(minTokenIdx, maxTokenIdx + 1);
  shuffledIndices.forEach((tokenIdx, i) => {
    const relIdx = tokenIdx - minTokenIdx;
    segmentTokens[relIdx] = shuffledWords[i];
  });
  const swappedSegment = segmentTokens.join('');

  if (span) {
    activeNode.nodeValue = swappedSegment;
  } else {
    node.nodeValue = swappedTokens.join('');
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (span) {
        activeNode.nodeValue = tokens.slice(minTokenIdx, maxTokenIdx + 1).join('');
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

export function corruptChar(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  const nonSpaceIndices: number[] = [];
  for (let i = 0; i < originalText.length; i++) {
    if (!/\s/.test(originalText[i])) nonSpaceIndices.push(i);
  }

  if (nonSpaceIndices.length === 0) return Promise.resolve();

  lockGlitchNode(textNode);

  const baseDuration = options.duration || Math.floor(Math.random() * 3000) + 3000;
  const duration = getScaledDuration(baseDuration, options);

  const targetIdx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)];
  const origChar = originalText[targetIdx];
  const corruptCharVal = BROKEN_CHARSET[Math.floor(Math.random() * BROKEN_CHARSET.length)];

  const { span, textNode: activeNode } = createGlitchWrapper(node, targetIdx, targetIdx + 1, options);

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'corruptChar');
  }

  if (span) {
    activeNode.nodeValue = corruptCharVal;
  } else {
    node.nodeValue = originalText.substring(0, targetIdx) + corruptCharVal + originalText.substring(targetIdx + 1);
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

export function blipChar(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  const nonSpaceIndices: number[] = [];
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

    function update(now: number) {
      const elapsed = now - startTime;

      if (elapsed < duration) {
        if (now >= nextFlickerTime) {
          isStateA = !isStateA;
          const currentChar = isStateA ? stateA : stateB;

          if (span) {
            activeNode.nodeValue = currentChar;
          } else {
            node.nodeValue = originalText.substring(0, targetIdx) + currentChar + originalText.substring(targetIdx + 1);
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

export function jitterChar(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  const nonSpaceIndices: number[] = [];
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

  const targetSpan = span;

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'jitterChar');
  }

  targetSpan.style.transition = 'transform 0.08s ease-in-out';

  return new Promise((resolve) => {
    const startTime = performance.now();
    let nextJitterTime = startTime;

    function update(now: number) {
      const elapsed = now - startTime;

      if (elapsed < duration) {
        if (now >= nextJitterTime) {
          const offsetX = (Math.random() * 6 - 3).toFixed(1);
          const offsetY = (Math.random() * 6 - 3).toFixed(1);
          targetSpan.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
          nextJitterTime = now + getScaledDuration(Math.floor(Math.random() * 100) + 90, options);
        }
        requestAnimationFrame(update);
      } else {
        targetSpan.style.transform = 'translate(0px, 0px)';
        setTimeout(() => {
          removeGlitchWrapper(targetSpan);
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

export function shiftHoldChar(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || isNodeGlitching(textNode)) return Promise.resolve();

  const node = textNode.nodeType === Node.TEXT_NODE ? textNode : (textNode.firstChild || textNode);
  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = node.nodeValue || textNode.textContent || '';
  const nonSpaceIndices: number[] = [];
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

  const targetSpan = span;

  if (typeof options.onGlitchStart === 'function') {
    options.onGlitchStart(textNode, 'shiftHoldChar');
  }

  const animSpeed = getScaledDuration(250, options);
  targetSpan.style.transition = `transform ${animSpeed}ms ease-out`;

  const offsetX = (Math.random() * 6 - 3).toFixed(1);
  const offsetY = (Math.random() * 6 - 3).toFixed(1);

  requestAnimationFrame(() => {
    targetSpan.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  return new Promise((resolve) => {
    const holdTime = Math.max(100, duration - animSpeed);
    setTimeout(() => {
      targetSpan.style.transform = 'translate(0px, 0px)';
      setTimeout(() => {
        removeGlitchWrapper(targetSpan);
        unlockGlitchNode(textNode);
        if (typeof options.onGlitchEnd === 'function') {
          options.onGlitchEnd(textNode, 'shiftHoldChar');
        }
        resolve();
      }, animSpeed);
    }, holdTime);
  });
}

export function neonColorChar(textNode: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer) return Promise.resolve();
  const parent = textNode.nodeType === Node.TEXT_NODE ? textNode.parentElement : (textNode as HTMLElement);
  const existingWrapper = parent?.closest('[data-glitch-wrapper="true"]') as HTMLElement | null;

  const chosenColor = options.neonColor || options.color || 'GREEN';
  const glowStyle = getNeonGlowStyle(chosenColor, options);
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

  const originalText = node.nodeValue || textNode.textContent || '';
  const nonSpaceIndices: number[] = [];
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

export function scrambleText(target: Node, options: GlitchOptions = {}): Promise<void> {
  if (isServer || !target || isNodeGlitching(target)) return Promise.resolve();

  const isElement = target.nodeType === Node.ELEMENT_NODE;
  const el = isElement ? (target as HTMLElement) : target.parentElement;
  const node = isElement ? (target.firstChild || target) : target;

  if (!node || isNodeGlitching(node)) return Promise.resolve();

  const originalText = isElement ? target.textContent || '' : node.nodeValue || '';
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

    function update(now: number) {
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
