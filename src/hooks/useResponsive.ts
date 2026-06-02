import { Platform, useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Central responsive breakpoint hook.
 *
 * Native (iOS / Android) is ALWAYS treated as mobile — only the web build
 * adapts to tablet / desktop widths. This is what powers the dedicated desktop
 * layout (persistent sidebar, multi-column grids, centered content) instead of
 * stretching the phone layout across a wide monitor.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  const isDesktop = isWeb && width >= 1024;
  const isTablet = isWeb && width >= 700 && width < 1024;
  const isMobile = !isDesktop && !isTablet;

  const bp: Breakpoint = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';

  // Number of columns used by card grids on each surface.
  const gridColumns = isDesktop ? (width >= 1480 ? 3 : 2) : isTablet ? 2 : 1;

  // Comfortable reading column so content never stretches edge-to-edge.
  const contentMaxWidth = isDesktop ? 1180 : 760;

  // Persistent left navigation rail width (desktop only).
  const sidebarWidth = isDesktop ? 272 : 0;

  return {
    width,
    height,
    isWeb,
    isDesktop,
    isTablet,
    isMobile,
    bp,
    gridColumns,
    contentMaxWidth,
    sidebarWidth,
  };
}
