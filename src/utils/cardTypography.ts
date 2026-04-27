import type {TextStyle, ViewStyle} from 'react-native';

/** Overrides merged onto base flashcard styles (padding, labels — not main body size). */
export type CardTypography = {
  facePad: number;
  cardText: TextStyle;
  cardLabel: TextStyle;
  tapHint: TextStyle;
  contextLabel: TextStyle;
  contextText: TextStyle;
  contextContainer: ViewStyle;
  typeBadgeText: TextStyle;
};

const comfortable: CardTypography = {
  facePad: 12,
  cardText: {},
  cardLabel: {},
  tapHint: {},
  contextLabel: {},
  contextText: {},
  contextContainer: {},
  typeBadgeText: {},
};

/**
 * Padding / chrome tiers when the card footprint is narrow or short.
 * Main cue/answer font size is computed separately (see getAdaptiveCardMainStyle).
 */
export function getCardTypography(
  maxW: number,
  maxH?: number | null,
): CardTypography {
  const h = maxH ?? Number.POSITIVE_INFINITY;
  if (maxW < 360 || h < 220) {
    return {
      facePad: 6,
      cardText: {},
      cardLabel: {fontSize: 10},
      tapHint: {fontSize: 12},
      contextLabel: {fontSize: 10},
      contextText: {fontSize: 12, lineHeight: 17},
      contextContainer: {marginTop: 12, padding: 12},
      typeBadgeText: {fontSize: 10},
    };
  }
  if (maxW < 440 || h < 300) {
    return {
      facePad: 8,
      cardText: {},
      cardLabel: {fontSize: 11},
      tapHint: {fontSize: 13},
      contextLabel: {fontSize: 10},
      contextText: {fontSize: 13, lineHeight: 19},
      contextContainer: {marginTop: 16, padding: 14},
      typeBadgeText: {fontSize: 10},
    };
  }
  return comfortable;
}

/** Vertical space reserved for FRONT/BACK label + tap hint (body region margins). */
const BODY_MARGIN_TOP = 18;
const BODY_MARGIN_BOTTOM = 22;

/** Approximate vertical space reserved on the front when CONTEXT is shown below the cue. */
const CONTEXT_BLOCK_RESERVE = 168;

/** Scales max adaptive font vs card-width tiers (1.5 = 50% larger than baseline). */
const ADAPTIVE_FONT_CARD_RATIO = 1.5;

function scaleAdaptiveTierMax(px: number): number {
  return Math.max(12, Math.round(px * ADAPTIVE_FONT_CARD_RATIO));
}

export type AdaptiveCardOptions = {
  /** Subtract from body height so front cue fits above a CONTEXT block (front only). */
  reservedBottom?: number;
  /**
   * Laid-out size of the `cardMainBody` view (from onLayout). When set, fit math uses the real
   * box instead of maxW/aspect/heuristic margins so type can fill the card.
   */
  measuredBodyWidth?: number;
  measuredBodyHeight?: number;
  /** Bottom padding inside the body (reduces usable text height in fit math). Back only. */
  bodyPaddingBottom?: number;
};

export type CardFaceSide = 'front' | 'back';

function estimateWrappedLines(
  text: string,
  innerW: number,
  fontSize: number,
  side: CardFaceSide,
): number {
  // Backs use emoji flags + semibold copy; chars run wider than 0.38×fontSize, so we
  // underestimate lines less (avoids picking a font that clips vertically).
  const avgCharPx = fontSize * (side === 'back' ? 0.44 : 0.38);
  const charsPerLine = Math.max(6, Math.floor(innerW / avgCharPx));
  const parts = text.split('\n');
  let lines = 0;
  for (const part of parts) {
    const chunk = part.length === 0 ? ' ' : part;
    lines += Math.max(1, Math.ceil(chunk.length / charsPerLine));
  }
  // RN line metrics / emojis / paragraph gaps: backs need more headroom than fronts.
  const slack = side === 'back' ? 1.14 : 1.08;
  return Math.max(1, Math.ceil(lines * slack));
}

function fitsBox(
  text: string,
  innerW: number,
  innerH: number,
  fontSize: number,
  lineScale: number,
  side: CardFaceSide,
): boolean {
  if (innerH < 24) {
    return false;
  }
  const lineHeight = fontSize * lineScale;
  const lines = estimateWrappedLines(text, innerW, fontSize, side);
  return lines * lineHeight <= innerH;
}

/**
 * Max font tier from card *width* (layout maxWidth), scaled by `ADAPTIVE_FONT_CARD_RATIO`.
 * fitsBox still clamps to the measured body when content is tall.
 */
function tierFontBounds(
  maxW: number,
  _maxH: number | null | undefined,
  side: CardFaceSide,
): {min: number; max: number} {
  if (maxW < 360) {
    return side === 'front'
      ? {min: 10, max: scaleAdaptiveTierMax(30)}
      : {min: 10, max: scaleAdaptiveTierMax(24)};
  }
  if (maxW < 440) {
    return side === 'front'
      ? {min: 10, max: scaleAdaptiveTierMax(40)}
      : {min: 10, max: scaleAdaptiveTierMax(32)};
  }
  return side === 'front'
    ? {min: 10, max: scaleAdaptiveTierMax(46)}
    : {min: 10, max: scaleAdaptiveTierMax(38)};
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) {
    return 0;
  }
  return t.split(/\s+/).filter(Boolean).length;
}

/**
 * Soft cap from letter/word count. The binary search + fitsBox still enforces no clipping.
 * Front: step down for long prompts.
 * Back: taper by words + chars so bilingual / multi-section cards start smaller before fitsBox.
 */
function lengthBasedFontCeiling(
  side: CardFaceSide,
  chars: number,
  words: number,
  tierMax: number,
  text: string,
): number {
  if (side === 'front') {
    if (chars <= 18 && words <= 3) {
      return tierMax;
    }
    if (chars <= 40 && words <= 8) {
      return Math.min(tierMax, Math.floor(tierMax * 0.92));
    }
    if (chars <= 85) {
      return Math.min(tierMax, Math.floor(tierMax * 0.82));
    }
    if (chars <= 160) {
      return Math.min(tierMax, Math.floor(tierMax * 0.72));
    }
    return Math.min(tierMax, Math.floor(tierMax * 0.62));
  }

  const blockCount = Math.max(1, text.split('\n').filter(p => p.trim().length > 0).length);

  let cap = tierMax;
  if (words <= 8 && chars <= 55 && blockCount <= 2) {
    cap = tierMax;
  } else if (words <= 14 && chars <= 95 && blockCount <= 3) {
    cap = Math.floor(tierMax * 0.92);
  } else if (words <= 22 && chars <= 160 && blockCount <= 4) {
    cap = Math.floor(tierMax * 0.84);
  } else if (words <= 35 && chars <= 240) {
    cap = Math.floor(tierMax * 0.76);
  } else if (words <= 55 && chars <= 360) {
    cap = Math.floor(tierMax * 0.68);
  } else if (chars <= 520) {
    cap = Math.floor(tierMax * 0.6);
  } else if (chars <= 900) {
    cap = Math.floor(tierMax * 0.52);
  } else {
    cap = Math.floor(tierMax * 0.44);
  }

  if (blockCount >= 5) {
    cap = Math.min(cap, Math.floor(tierMax * 0.72));
  } else if (blockCount >= 4) {
    cap = Math.min(cap, Math.floor(cap * 0.92));
  }

  if (words > 85) {
    cap = Math.min(cap, Math.floor(tierMax * 0.55));
  } else if (words > 55) {
    cap = Math.min(cap, Math.floor(cap * 0.88));
  } else if (words > 40) {
    cap = Math.min(cap, Math.floor(cap * 0.93));
  }

  return Math.max(8, Math.min(cap, tierMax));
}

/**
 * Chooses font size so wrapped text fits the usable card body.
 * Front and back use separate tier ceilings and separate letter/word scaling.
 */
export function getAdaptiveCardMainStyle(
  side: CardFaceSide,
  maxW: number,
  maxH: number | null | undefined,
  aspect: number,
  text: string,
  options?: AdaptiveCardOptions,
): Pick<TextStyle, 'fontSize' | 'lineHeight'> {
  const tier = getCardTypography(maxW, maxH);
  const {min, max} = tierFontBounds(maxW, maxH, side);
  // Backs use a slightly taller line factor in the fit check so chosen sizes survive RN layout.
  const lineScale = side === 'back' ? 1.32 : 1.3;

  const reserved = options?.reservedBottom ?? 0;
  const mw = options?.measuredBodyWidth;
  const mh = options?.measuredBodyHeight;
  const bodyPadBottom = options?.bodyPaddingBottom ?? 0;

  let innerW: number;
  let innerH: number;
  const verticalSlack = side === 'back' ? 8 : 0;
  if (mw != null && mh != null && mw > 8 && mh > 8) {
    innerW = Math.max(48, mw - tier.facePad * 2);
    innerH = Math.max(24, mh - reserved - bodyPadBottom - verticalSlack);
  } else {
    const hFromAspect = maxW / aspect;
    const cardH = maxH != null ? Math.min(hFromAspect, maxH) : hFromAspect;
    innerW = Math.max(72, maxW - tier.facePad * 2);
    innerH = Math.max(
      32,
      cardH -
        BODY_MARGIN_TOP -
        BODY_MARGIN_BOTTOM -
        reserved -
        bodyPadBottom -
        verticalSlack,
    );
  }

  const t = text.trim();
  if (!t) {
    const baseEmpty = side === 'front' ? 24 : 22;
    const fs = Math.min(Math.round(baseEmpty * ADAPTIVE_FONT_CARD_RATIO), max);
    return {fontSize: fs, lineHeight: Math.round(fs * lineScale)};
  }

  const chars = t.length;
  const words = countWords(t);
  const lengthCeiling = lengthBasedFontCeiling(side, chars, words, max, t);
  const hi = Math.max(min, Math.min(lengthCeiling, max));

  let lo = min;
  let best = min;

  let low = lo;
  let high = hi;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fitsBox(t, innerW, innerH, mid, lineScale, side)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let fontSize = Math.max(min, Math.min(best, hi));
  while (fontSize > 6 && !fitsBox(t, innerW, innerH, fontSize, lineScale, side)) {
    fontSize -= 1;
  }

  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineScale),
  };
}

export const cardBodyMargins = {
  marginTop: BODY_MARGIN_TOP,
  marginBottom: BODY_MARGIN_BOTTOM,
  contextReserve: CONTEXT_BLOCK_RESERVE,
};
