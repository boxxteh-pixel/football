import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
  const isWeb = Platform.OS === 'web';
  const inactiveBg = isWeb ? 'rgba(28, 27, 26, 0.32)' : 'rgba(28, 27, 26, 0.22)';

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress?.();
      }}
      style={({ pressed }) => ({
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: active ? colors.glassBorderActive : 'rgba(255,255,255,0.1)',
        backgroundColor: active ? colors.accent15 : inactiveBg,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        ...(isWeb
          ? ({
              backdropFilter: 'blur(16px) saturate(180%) brightness(1.05)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%) brightness(1.05)',
            } as any)
          : {}),
      })}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={active ? 35 : 20}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={{ paddingHorizontal: 16, paddingVertical: 9, position: 'relative', zIndex: 1 }}>
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
      </View>
    </Pressable>
  );
};
