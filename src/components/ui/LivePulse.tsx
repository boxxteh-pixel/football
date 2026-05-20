import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface LivePulseProps {
  label?: string;
  color?: string;
  size?: number;
}

export const LivePulse: React.FC<LivePulseProps> = ({
  label = 'LIVE',
  color,
  size = 8,
}) => {
  const colors = useColors();
  const resolvedColor = color || colors.primaryFixedDim;
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 1000 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {label ? (
        <Text
          style={{
            color: resolvedColor,
            fontFamily: fonts.label,
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: resolvedColor,
            shadowColor: resolvedColor,
            shadowOpacity: 0.8,
            shadowRadius: 6,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};
