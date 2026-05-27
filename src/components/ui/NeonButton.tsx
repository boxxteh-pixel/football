import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';

interface NeonButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  iconRight?: string;
  iconLeft?: string;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const NeonButton: React.FC<NeonButtonProps> = ({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  iconRight,
  iconLeft,
  fullWidth = true,
  ...rest
}) => {
  const colors = useColors();
  const scale = useSharedValue(1);
  const haptics = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const heights = { sm: 40, md: 48, lg: 56 } as const;
  const fontSizes = { sm: 14, md: 16, lg: 18 } as const;

  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';

  const bg = isPrimary
    ? colors.primaryFixed
    : isOutline
      ? 'transparent'
      : 'rgba(255,255,255,0.04)';
  const textColor = isPrimary ? colors.onPrimaryFixed : colors.onSurface;
  const borderColor = isOutline ? colors.primaryFixed : 'transparent';

  return (
    <AnimatedPressable
      onPress={(e) => {
        haptics.light();
        onPress?.(e);
      }}
      onPressIn={() => {
        scale.value = withSpring(0.96, { stiffness: 320, damping: 18 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 320, damping: 18 });
      }}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        {
          height: heights[size],
          paddingHorizontal: 24,
          borderRadius: 12,
          backgroundColor: bg,
          borderWidth: isOutline ? 1.5 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          ...(fullWidth ? { width: '100%' } : {}),
          ...(isPrimary
            ? {
                shadowColor: colors.primaryFixedDim,
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              }
            : {}),
          opacity: disabled || loading ? 0.5 : 1,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {iconLeft && <BoroIcon name={iconLeft} size={fontSizes[size] + 4} color={textColor} />}
          <Text
            style={{
              color: textColor,
              fontSize: fontSizes[size],
              fontFamily: fonts.headlineMd,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
          {iconRight && <BoroIcon name={iconRight} size={fontSizes[size] + 4} color={textColor} />}
        </View>
      )}
    </AnimatedPressable>
  );
};
