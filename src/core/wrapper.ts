import { NEON_COLORS, isServer } from './constants';
import { GlitchOptions, GlowIntensity } from './types';

/**
 * Helper to resolve neon color and CSS text-shadow glow style.
 */
export function getNeonGlowStyle(colorInput: string = NEON_COLORS.GREEN, options: GlitchOptions = {}) {
  let hexColor = (typeof colorInput === 'string' && NEON_COLORS[colorInput.toUpperCase() as keyof typeof NEON_COLORS]) || colorInput || NEON_COLORS.GREEN;
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
 * Checks if a target node or any of its ancestors/descendants is currently glitching.
 */
export function isNodeGlitching(target: Node | null): boolean {
  if (isServer || !target) return true;
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as HTMLElement);
  if (!el) return true;
  if ((target as any)._isGlitching || (el as any)._isGlitching || el.dataset.isGlitching === 'true') return true;
  if (el.closest('[data-is-glitching="true"], [data-glitch-wrapper="true"]')) return true;
  return false;
}

/**
 * Locks an element and its parent container against concurrent glitch calls.
 */
export function lockGlitchNode(target: Node): void {
  if (isServer || !target) return;
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as HTMLElement);
  (target as any)._isGlitching = true;
  if (el) {
    (el as any)._isGlitching = true;
    el.dataset.isGlitching = 'true';
  }
}

/**
 * Unlocks an element and its parent container when a glitch completes.
 */
export function unlockGlitchNode(target: Node): void {
  if (isServer || !target) return;
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as HTMLElement);
  delete (target as any)._isGlitching;
  if (el) {
    delete (el as any)._isGlitching;
    delete el.dataset.isGlitching;
    try { el.normalize(); } catch (e) {}
  }
}

/**
 * Creates a transient inline-block wrapper span with 0px baseline floating and fixed width.
 */
export function createGlitchWrapper(textNode: Node, startIndex: number, endIndex: number, options: GlitchOptions = {}) {
  if (isServer || !textNode || textNode.nodeType !== Node.TEXT_NODE) return { span: null, textNode };
  try {
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
      span.style.overflow = 'visible';
      span.style.verticalAlign = 'baseline';
      span.style.whiteSpace = 'pre';
      span.style.lineHeight = 'inherit';
      span.style.fontSize = 'inherit';
      span.dataset.glitchWrapper = 'true';

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
    // Safe fallback
  }
  return { span: null, textNode };
}

/**
 * Removes the transient wrapper span and normalizes DOM parent.
 */
export function removeGlitchWrapper(span: HTMLElement | null): void {
  if (isServer || !span || !span.parentNode) return;
  const parent = span.parentNode;
  const textContent = span.textContent || '';
  const textNode = document.createTextNode(textContent);
  parent.replaceChild(textNode, span);
  try { parent.normalize(); } catch (e) {}
}

/**
 * Collects eligible visible text nodes inside container.
 */
export function getAllTextNodes(container?: HTMLElement | null): Node[] {
  if (isServer) return [];
  if (!container && typeof document !== 'undefined') container = document.body;
  if (!container) return [];

  const textNodes: Node[] = [];
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

  let current: Node | null;
  while ((current = walk.nextNode())) {
    textNodes.push(current);
  }
  return textNodes;
}
