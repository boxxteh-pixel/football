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
        colors={['#16140f', '#100f0d', '#0d0c0b']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Warm ambient wash so glass cards have colour to refract. */}
      <View
        style={[
          {
            position: 'absolute',
            top: -120,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: 190,
            backgroundColor: colors.primaryFixed,
            opacity: 0.06,
          },
          isWeb ? ({ filter: 'blur(100px)' } as any) : null,
        ]}
      />
      {/* Secondary cool field, bottom-left — very subtle. */}
      <View
        style={[
          {
            position: 'absolute',
            bottom: -140,
            left: -110,
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: colors.secondaryContainer,
            opacity: 0.04,
          },
          isWeb ? ({ filter: 'blur(100px)' } as any) : null,
        ]}
      />
      {/* Warm mid-screen wash for depth continuity with glass surfaces. */}
      <View
        style={[
          {
            position: 'absolute',
            top: '30%',
            left: '20%',
            width: 500,
            height: 500,
            borderRadius: 250,
            backgroundColor: '#1c1b1a',
            opacity: 0.25,
          },
          isWeb ? ({ filter: 'blur(150px)' } as any) : null,
        ]}
      />
    </View>
  );
};
