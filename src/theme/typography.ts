/**
 * Font family tokens. Matches the loaded Google fonts in app/_layout.tsx.
 */
export const fonts = {
  display: 'HankenGrotesk_800ExtraBold',
  headline: 'HankenGrotesk_700Bold',
  headlineMd: 'HankenGrotesk_600SemiBold',
  stats: 'HankenGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyBold: 'Inter_600SemiBold',
  label: 'Inter_600SemiBold',
} as const;

export type FontToken = keyof typeof fonts;
