import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/theme/colors';

/**
 * App-wide backdrop rendered behind every screen.
 *
 * A clean vertical depth gradient, plus VERY faint, heavily-blurred colour
 * fields in the corners. These are almost invisible on their own (not glowing
 * orbs) — their purpose is to give the frosted-glass cards something subtle to
 * refract, which is what makes iOS-style glass look alive instead of flat grey.
 * Purely decorative, never intercepts touches.
 */
export const ScreenBackground: React.FC = () => {
  const colors = useColors();
  const isWeb = Platform.OS === 'web';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#171615', '#101010', '#0b0b0b']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Faint accent field, top-right. Heavily blurred on web. */}
      <View
        style={[
          {
            position: 'absolute',
            top: -120,
            right: -100,
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: colors.primaryFixed,
            opacity: 0.05,
          },
          isWeb ? ({ filter: 'blur(90px)' } as any) : null,
        ]}
      />
      {/* Faint cool field, bottom-left. */}
      <View
        style={[
          {
            position: 'absolute',
            bottom: -140,
            left: -110,
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: colors.secondaryContainer,
            opacity: 0.05,
          },
          isWeb ? ({ filter: 'blur(90px)' } as any) : null,
        ]}
      />
    </View>
  );
};
