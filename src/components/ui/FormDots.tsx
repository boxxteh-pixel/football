/**
 * FormDots — last N match results as coloured dots.
 * W = green accent, D = yellow, L = red.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface FormDotsProps {
  results: Array<'W' | 'D' | 'L'>;
  size?: number;
}

export const FormDots: React.FC<FormDotsProps> = ({ results, size = 8 }) => {
  const colors = useColors();

  const dotColor = (r: 'W' | 'D' | 'L'): string => {
    if (r === 'W') return colors.primaryFixed;
    if (r === 'D') return '#EAB308';
    return '#EF4444';
  };

  const letter = (r: 'W' | 'D' | 'L'): string => {
    return r; // W / D / L
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {results.slice(-5).map((r, i) => (
        <View
          key={i}
          style={{
            width: size + 8,
            height: size + 4,
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${dotColor(r)}22`,
            borderWidth: 1,
            borderColor: `${dotColor(r)}55`,
          }}
        >
          <Text
            style={{
              color: dotColor(r),
              fontFamily: fonts.label,
              fontSize: size - 1,
              fontWeight: 'bold',
            }}
          >
            {letter(r)}
          </Text>
        </View>
      ))}
    </View>
  );
};
