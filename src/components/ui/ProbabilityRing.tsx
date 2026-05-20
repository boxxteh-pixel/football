import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface ProbabilityRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}

export const ProbabilityRing: React.FC<ProbabilityRingProps> = ({
  value,
  size = 64,
  strokeWidth = 4,
  color,
  trackColor = 'rgba(255,255,255,0.06)',
  label,
}) => {
  const colors = useColors();
  const resolvedColor = color || colors.primaryFixed;
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.stats,
            fontSize: size > 60 ? 18 : 14,
          }}
        >
          {Math.round(clamped)}%
        </Text>
        {label ? (
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 9,
              marginTop: 2,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
