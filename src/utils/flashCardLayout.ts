/**
 * Card shell dimensions for study/review flashcards.
 * Portrait: height follows available screen space and content length (not a fixed 1.5 aspect).
 * Landscape: wide card with max height so chrome (nav / ratings) is not overlapped.
 */

export type FlashCardLayout = {
  maxW: number;
  aspect: number;
  maxH?: number;
};

type Insets = {top: number; bottom: number};

function contentCharBudget(front: string, back: string, context?: string | null): number {
  const f = front?.length ?? 0;
  const b = back?.length ?? 0;
  const c = context?.length ?? 0;
  return Math.max(f + c, b, 48);
}

/**
 * @param mode study = bottom nav row; review = rating row (taller chrome).
 */
export function computeFlashCardLayout(
  winW: number,
  winH: number,
  insets: Insets,
  mode: 'study' | 'review',
  card: {front: string; back: string; context?: string | null} | null | undefined,
): FlashCardLayout {
  const landscape = winW > winH;
  const horizontalPad = 44;
  const portraitMaxWCap = winW >= 600 ? 620 : 500;

  const maxW = landscape
    ? Math.min(winW - horizontalPad, 960)
    : Math.min(winW - horizontalPad, portraitMaxWCap);

  if (!landscape) {
    const topChrome = insets.top + (mode === 'study' ? 132 : 128);
    const bottomChrome =
      insets.bottom + (mode === 'study' ? 108 : 168);
    const containerPad = 32;
    const availH = Math.max(240, winH - topChrome - bottomChrome - containerPad);

    const chars = contentCharBudget(
      card?.front ?? '',
      card?.back ?? '',
      card?.context,
    );
    const baseH = Math.min(availH * 0.91, maxW * 1.42);
    const stretch = 1 + Math.min(0.26, chars / 950);
    let targetH = Math.min(baseH * stretch, availH * 0.94);
    targetH = Math.max(maxW * 0.74, targetH);

    let aspect = maxW / targetH;
    aspect = Math.max(0.86, Math.min(1.58, aspect));

    return {maxW, aspect};
  }

  const topChrome = insets.top + 96;
  const bottomChrome = insets.bottom + (mode === 'study' ? 96 : 132);
  const cardVerticalPad = 48;
  const maxCardH = Math.max(
    130,
    winH - topChrome - bottomChrome - cardVerticalPad - 16,
  );
  let aspect = 2.4;
  if (maxW / aspect > maxCardH) {
    aspect = Math.max(maxW / maxCardH, 2.6);
  }
  return {maxW, aspect, maxH: maxCardH};
}
