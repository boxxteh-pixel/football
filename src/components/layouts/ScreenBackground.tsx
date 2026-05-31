import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/theme/colors';

/**
 * App-wide premium backdrop rendered behind every screen.
 *
 * A subtle vertical gradient gives the dark canvas real depth (instead of a
 * flat fill), and two soft accent "glow" orbs in opposite corners add an
 * ambient, modern sportsbook feel. Theme-aware: the glow picks up the active
 * accent (lime / purple). Purely decorative — never intercepts touches.
 */
const Orb: React.FC<{
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  opacity?: number;
}> = ({ color, size, top, bottom, left, right, opacity = 0.5 }) => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      opacity,
      top,
      bottom,
      left,
      right,
    }}
  >
    <LinearGradient
      colors={[color, 'transparent']}
      start={{ x: 0.5, y: 0.2 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  </View>
);

export const ScreenBackground: React.FC = () => {
  const colors = useColors();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base vertical depth gradient (theme-neutral). */}
      <LinearGradient
        colors={['#181716', '#100f0f', '#0a0a0a']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Warm accent glow, top-right. */}
      <Orb color={colors.primaryFixed} size={420} top={-200} right={-140} opacity={0.1} />
      {/* Cool secondary glow, bottom-left. */}
      <Orb color={colors.secondaryContainer} size={380} bottom={-160} left={-130} opacity={0.08} />
    </View>
  );
};
