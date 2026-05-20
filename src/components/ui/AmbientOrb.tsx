import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface AmbientOrbProps {
  size?: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  color?: string;
  opacity?: number;
  delay?: number;
}

/**
 * Floating ambient glow used on auth screens. Matches the HTML `.ambient-orb`.
 */
export const AmbientOrb: React.FC<AmbientOrbProps> = ({
  size = 320,
  top,
  left,
  right,
  bottom,
  color = '#abd600',
  opacity = 0.35,
  delay = 0,
}) => {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  useEffect(() => {
    offsetX.value = withRepeat(
      withTiming(20, { duration: 6000 + delay, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    offsetY.value = withRepeat(
      withTiming(15, { duration: 5500 + delay, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [offsetX, offsetY, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          top: top as number,
          left: left as number,
          right: right as number,
          bottom: bottom as number,
        },
        animatedStyle,
      ]}
    >
      {Platform.OS !== 'web' ? (
        <LinearGradient
          colors={[color, 'transparent']}
          style={{ flex: 1, borderRadius: size / 2 }}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: 0.4,
          }}
        />
      )}
    </Animated.View>
  );
};
