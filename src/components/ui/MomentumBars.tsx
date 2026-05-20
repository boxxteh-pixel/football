import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColors} from '@/theme/colors';

interface MomentumBarsProps {
  values: number[]; // 0-1 each, length=any (will scale)
  height?: number;
  highlightIndex?: number;
  color?: string;
}

interface BarProps {
  value: number;
  maxHeight: number;
  highlight: boolean;
  color: string;
}

const Bar: React.FC<BarProps> = ({ value, maxHeight, highlight, color }) => {
  const colors = useColors();
  const h = useSharedValue(0);

  useEffect(() => {
    h.value = withSpring(Math.max(4, value * maxHeight), {
      damping: 14,
      stiffness: 110,
    });
  }, [value, maxHeight, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  const opacity = 0.35 + value * 0.65;

  return (
    <Animated.View
      style={[
        style,
        {
          flex: 1,
          marginHorizontal: 1,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: color,
          opacity: highlight ? 1 : opacity,
          ...(highlight
            ? {
                shadowColor: colors.primaryFixedDim,
                shadowOpacity: 0.6,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }
            : {}),
        },
      ]}
    />
  );
};

export const MomentumBars: React.FC<MomentumBarsProps> = ({
  values,
  height = 64,
  highlightIndex,
  color,
}) => {
  const colors = useColors();
  const resolvedColor = color || colors.primaryFixed;
  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        width: '100%',
      }}
    >
      {values.map((v, i) => (
        <Bar
          key={i}
          value={v}
          maxHeight={height}
          highlight={i === highlightIndex}
          color={resolvedColor}
        />
      ))}
    </View>
  );
};
