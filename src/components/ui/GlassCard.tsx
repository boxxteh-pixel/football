import React from 'react';
import { Platform, View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors} from '@/theme/colors';

interface GlassCardProps extends ViewProps {
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
 * Glassmorphism container matching the HTML `.glass-surface` / `.glass-panel`.
 * Uses BlurView on iOS/Android, falls back to translucent rgba on web.
 * Automatically splits styling so layout styles apply to the inner children container.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 24,
  activeBorder = false,
  rounded = 'xl',
  padding,
  glow = false,
  style,
  ...rest
}) => {
  const colors = useColors();
  const radiusMap = { lg: 8, xl: 12, '2xl': 16 } as const;
  const borderColor = activeBorder ? colors.glassBorderActive : colors.glassBorder;
  const bg = Platform.OS === 'web' ? colors.glass : 'rgba(26,26,26,0.4)';

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

  return (
    <View
      style={[
        {
          borderRadius: radiusMap[rounded],
          overflow: 'hidden',
          borderWidth: 1,
          borderColor,
          backgroundColor: bg,
          ...(glow
            ? {
                shadowColor: 'transparent',
                elevation: 0,
              }
            : {}),
          ...(padding !== undefined ? { padding } : {}),
        },
        outerStyle,
      ]}
      {...rest}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={intensity}
          tint="dark"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}
      <View style={[{ position: 'relative', zIndex: 1 }, innerStyle]}>
        {children}
      </View>
    </View>
  );
};
