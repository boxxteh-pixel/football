import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/theme/colors';
import { useSettingsStore } from '@/store/settingsStore';

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
  const oledMode = useSettingsStore((s) => s.settings.oledMode);

  if (oledMode) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} pointerEvents="none" />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient
        colors={['#23211f', '#1d1c1b', '#1a1918']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle tech radial dot grid pattern for Web/PC layout depth */}
      {isWeb && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            opacity: 0.45,
            // @ts-ignore
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Warm ambient wash so glass cards have colour to refract. */}
      <View
        style={[
          {
            position: 'absolute',
            top: -150,
            right: -150,
            width: isWeb ? 680 : 380,
            height: isWeb ? 680 : 380,
            borderRadius: isWeb ? 340 : 190,
            backgroundColor: colors.primaryFixed,
            opacity: isWeb ? 0.08 : 0.06,
          },
          isWeb ? ({ filter: 'blur(110px)' } as any) : null,
        ]}
      />
      {/* Secondary cool field, bottom-left — very subtle. */}
      <View
        style={[
          {
            position: 'absolute',
            bottom: -180,
            left: -150,
            width: isWeb ? 620 : 360,
            height: isWeb ? 620 : 360,
            borderRadius: isWeb ? 310 : 180,
            backgroundColor: colors.secondaryContainer,
            opacity: isWeb ? 0.06 : 0.04,
          },
          isWeb ? ({ filter: 'blur(110px)' } as any) : null,
        ]}
      />
      {/* Warm mid-screen wash for depth continuity with glass surfaces. */}
      <View
        style={[
          {
            position: 'absolute',
            top: '30%',
            left: '15%',
            width: isWeb ? 700 : 500,
            height: isWeb ? 700 : 500,
            borderRadius: isWeb ? 350 : 250,
            backgroundColor: '#1c1b1a',
            opacity: isWeb ? 0.35 : 0.25,
          },
          isWeb ? ({ filter: 'blur(160px)' } as any) : null,
        ]}
      />
    </View>
  );
};
