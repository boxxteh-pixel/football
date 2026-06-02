import React from 'react';
import { Platform, View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/theme/colors';

interface GlassCardProps extends ViewProps {
  /** Blur strength. Defaults tuned for an iOS-like frosted look. */
  intensity?: number;
  activeBorder?: boolean;
  rounded?: 'lg' | 'xl' | '2xl';
  padding?: number;
  glow?: boolean;
}

const LAYOUT_KEYS = [
  'alignItems',
  'justifyContent',
  'flexDirection',
  'flexWrap',
  'gap',
  'rowGap',
  'columnGap',
  'alignContent',
  'alignSelf',
  'flex',
];

/**
 * iOS-style frosted glass surface.
 *
 * The Apple look comes from FOUR layers stacked together:
 *   1. A heavy background blur with high saturation + slight brightness so the
 *      colours behind bleed through vividly (not greyed out). On web this is a
 *      real CSS `backdrop-filter`; on native it's an expo-blur `BlurView`.
 *   2. A translucent fill tint (kept fairly transparent so the blur shows).
 *   3. A diagonal sheen gradient (light catching the top-left of the glass).
 *   4. A bright 1px top hairline + soft hairline border = the glass rim.
 * A soft ambient drop-shadow makes it float.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 28,
  activeBorder = false,
  rounded = 'xl',
  padding,
  glow = false,
  style,
  ...rest
}) => {
  const colors = useColors();
  const radiusMap = { lg: 16, xl: 20, '2xl': 26 } as const;
  const borderColor = activeBorder ? colors.glassBorderActive : 'rgba(255,255,255,0.14)';
  const isWeb = Platform.OS === 'web';
  // Keep the fill translucent so the blur behind is clearly visible (iOS look).
  const bg = isWeb ? 'rgba(28,27,26,0.45)' : 'rgba(28,27,26,0.32)';

  // Real frosted glass on web: heavy blur + high saturation + slight brightness + soft float shadow
  const webBlur = isWeb
    ? ({
        backdropFilter: `blur(${intensity}px) saturate(180%) brightness(1.05)`,
        WebkitBackdropFilter: `blur(${intensity}px) saturate(180%) brightness(1.05)`,
        boxShadow: glow ? '0 16px 40px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.3)',
        transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease',
      } as unknown as ViewStyle)
    : null;

  const flatStyle = StyleSheet.flatten(style) || {};
  const outerStyle: ViewStyle = {};
  const innerStyle: ViewStyle = {};

  Object.keys(flatStyle).forEach((key) => {
    if (LAYOUT_KEYS.includes(key)) {
      // @ts-ignore
      innerStyle[key] = flatStyle[key];
    } else {
      // @ts-ignore
      outerStyle[key] = flatStyle[key];
    }
  });

  const radiusValue = radiusMap[rounded];

  return (
    <View
      style={[
        {
          borderRadius: radiusValue,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor,
          backgroundColor: bg,
          // Ambient float shadow (always on for glass depth; softer on web).
          shadowColor: '#000',
          shadowOpacity: isWeb ? 0 : glow ? 0.4 : 0.28,
          shadowRadius: glow ? 22 : 14,
          shadowOffset: { width: 0, height: glow ? 10 : 6 },
          elevation: glow ? 10 : 5,
          ...(webBlur ?? {}),
          ...(padding !== undefined ? { padding } : {}),
        },
        outerStyle,
      ]}
      {...rest}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={Math.min(100, intensity * 2.6)}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Diagonal sheen — light catching the top-left of the glass. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)', 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bright top hairline = the glass rim highlight. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      />

      <View style={[{ position: 'relative', zIndex: 1 }, innerStyle]}>{children}</View>
    </View>
  );
};
