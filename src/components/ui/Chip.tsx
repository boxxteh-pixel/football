import React from 'react';
import { Pressable, Text } from 'react-native';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, active, onPress }) => {
  const colors = useColors();
  const haptics = useHaptics();
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress?.();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: active ? colors.accent15 : 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: active ? colors.accent40 : 'rgba(255,255,255,0.1)',
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text
        style={{
          color: active ? colors.primaryFixed : colors.onSurfaceVariant,
          fontFamily: fonts.bodyBold,
          fontSize: 13,
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};
