import {useWindowDimensions} from 'react-native';

/** Matches Android sw600dp — tablets and large foldables. */
export const TABLET_MIN_SHORTEST_SIDE = 600;

/**
 * Sidebar width on tablets (~¼ of the long edge, scaled by shortest side).
 * Clamped so phones never use this path.
 */
export function tabletRailWidth(width: number, height: number): number {
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  const byLong = Math.round(longest * 0.24);
  const byShort = Math.round(shortest * 0.38);
  return Math.min(360, Math.max(216, Math.max(byLong, byShort)));
}

/** Beaver art in the rail header — centered, scales with rail width. */
export function tabletRailLogoSize(railWidth: number): number {
  return Math.min(260, Math.max(152, Math.round(railWidth * 0.68)));
}

export function isTabletSize(width: number, height: number): boolean {
  return Math.min(width, height) >= TABLET_MIN_SHORTEST_SIDE;
}

export function booksGridColumns(width: number, height: number): number {
  if (!isTabletSize(width, height)) {
    return 1;
  }
  const longest = Math.max(width, height);
  if (longest >= 1200) {
    return 3;
  }
  return 2;
}

/** Logo diameter for phone header; uses shortest side so landscape stays sane. */
export function phoneHeaderLogoSize(width: number, height: number): number {
  const shortest = Math.min(width, height);
  return Math.min(shortest * 0.55, 260);
}

export function useResponsiveLayout() {
  const {width, height} = useWindowDimensions();
  const isTablet = isTabletSize(width, height);
  const booksColumns = booksGridColumns(width, height);
  const logoSize = phoneHeaderLogoSize(width, height);
  const railWidth = isTablet ? tabletRailWidth(width, height) : 0;
  const railLogoSize = isTablet ? tabletRailLogoSize(railWidth) : 0;
  return {width, height, isTablet, booksColumns, logoSize, railWidth, railLogoSize};
}
