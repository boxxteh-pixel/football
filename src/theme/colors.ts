/**
 * BORO color palette — dynamic theme support (green / purple).
 * `useColors()` is the primary hook for React components.
 * `colors` is the static green fallback for non-React contexts.
 */
import { useSettingsStore } from '@/store/settingsStore';
import type { ColorTheme } from '@/services/storage/settings';

const base = {
  background: '#0a0a0a',
  surface: '#0a0a0a',
  surfaceDim: '#0a0a0a',
  surfaceBright: '#3a3939',
  surfaceContainer: '#161616',
  surfaceContainerLow: '#121212',
  surfaceContainerLowest: '#060606',
  surfaceContainerHigh: '#2a2a2a',
  surfaceContainerHighest: '#353534',
  surfaceVariant: '#353534',

  primary: '#ffffff',
  secondary: '#b3c5ff',
  secondaryFixed: '#dae1ff',
  secondaryFixedDim: '#b3c5ff',
  secondaryContainer: '#0266ff',
  onSecondary: '#002b75',

  tertiary: '#ffffff',
  tertiaryFixed: '#e5e2e1',
  onTertiary: '#313030',

  error: '#ffb4ab',
  errorContainer: '#93000a',
  onError: '#690005',

  onBackground: '#e5e2e1',
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#c4c9ac',
  outline: '#8e9379',
  outlineVariant: '#444933',

  // Probability tiers (semantic)
  probHigh: '#22C55E',
  probMid: '#EAB308',
  probLow: '#EF4444',

  // Translucent overlays (neutral)
  glass: 'rgba(26, 26, 26, 0.6)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  white05: 'rgba(255, 255, 255, 0.05)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white20: 'rgba(255, 255, 255, 0.2)',
} as const;

interface AccentPalette {
  primaryFixed: string;
  primaryFixedDim: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryFixed: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  glassBorderActive: string;
  neonGlow: string;
  accent04: string;
  accent08: string;
  accent10: string;
  accent12: string;
  accent15: string;
  accent18: string;
  accent20: string;
  accent30: string;
  accent40: string;
  textShadow: string;
}

const greenAccent: AccentPalette = {
  primaryFixed: '#c3f400',
  primaryFixedDim: '#abd600',
  primaryContainer: '#c3f400',
  onPrimary: '#283500',
  onPrimaryFixed: '#161e00',
  onPrimaryContainer: '#556d00',
  inversePrimary: '#506600',
  glassBorderActive: 'rgba(171, 214, 0, 0.3)',
  neonGlow: 'rgba(171, 214, 0, 0.4)',
  accent04: 'rgba(195, 244, 0, 0.04)',
  accent08: 'rgba(195, 244, 0, 0.08)',
  accent10: 'rgba(195, 244, 0, 0.1)',
  accent12: 'rgba(195, 244, 0, 0.12)',
  accent15: 'rgba(195, 244, 0, 0.15)',
  accent18: 'rgba(195, 244, 0, 0.18)',
  accent20: 'rgba(195, 244, 0, 0.2)',
  accent30: 'rgba(195, 244, 0, 0.3)',
  accent40: 'rgba(195, 244, 0, 0.4)',
  textShadow: 'rgba(204, 255, 0, 0.4)',
};

const purpleAccent: AccentPalette = {
  primaryFixed: '#a78bfa',
  primaryFixedDim: '#8b5cf6',
  primaryContainer: '#a78bfa',
  onPrimary: '#1e0a3e',
  onPrimaryFixed: '#12062a',
  onPrimaryContainer: '#4c1d95',
  inversePrimary: '#5b21b6',
  glassBorderActive: 'rgba(167, 139, 250, 0.3)',
  neonGlow: 'rgba(167, 139, 250, 0.4)',
  accent04: 'rgba(167, 139, 250, 0.04)',
  accent08: 'rgba(167, 139, 250, 0.08)',
  accent10: 'rgba(167, 139, 250, 0.1)',
  accent12: 'rgba(167, 139, 250, 0.12)',
  accent15: 'rgba(167, 139, 250, 0.15)',
  accent18: 'rgba(167, 139, 250, 0.18)',
  accent20: 'rgba(167, 139, 250, 0.2)',
  accent30: 'rgba(167, 139, 250, 0.3)',
  accent40: 'rgba(167, 139, 250, 0.4)',
  textShadow: 'rgba(167, 139, 250, 0.4)',
};

function buildPalette(accent: AccentPalette) {
  return { ...base, ...accent };
}

const greenPalette = buildPalette(greenAccent);
const purplePalette = buildPalette(purpleAccent);

export type BoroColors = typeof greenPalette;
export type ColorToken = keyof BoroColors;

/** Static green palette — use in non-React contexts only. */
export const colors = greenPalette;

/** Reactive hook — returns the current theme palette. */
export function useColors(): BoroColors {
  const theme = useSettingsStore((s) => s.settings.colorTheme);
  return theme === 'purple' ? purplePalette : greenPalette;
}

/** Get palette by theme name (for non-hook contexts). */
export function getColorsByTheme(theme: ColorTheme): BoroColors {
  return theme === 'purple' ? purplePalette : greenPalette;
}
