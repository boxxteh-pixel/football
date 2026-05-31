import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * App-wide backdrop rendered behind every screen.
 *
 * A clean, subtle vertical gradient that gives the dark canvas a little depth
 * instead of a dead-flat fill. No glow orbs — kept deliberately minimal.
 * Purely decorative, never intercepts touches.
 */
export const ScreenBackground: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient
      colors={['#171615', '#101010', '#0b0b0b']}
      locations={[0, 0.55, 1]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);
