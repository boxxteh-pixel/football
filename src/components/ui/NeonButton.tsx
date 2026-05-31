import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    ? 'transparent'
    : isOutline
      ? 'transparent'
      : 'rgba(255,255,255,0.05)';
  const textColor = isPrimary ? colors.onPrimaryFixed : colors.onSurface;
  const borderColor = isOutline ? colors.primaryFixed : 'transparent';

  const content = loading ? (
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
  );

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
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: isOutline ? 1.5 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          overflow: 'hidden',
          ...(fullWidth ? { width: '100%' } : {}),
          ...(isPrimary
            ? {
                shadowColor: colors.primaryFixed,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }
            : {}),
          opacity: disabled || loading ? 0.5 : 1,
        },
      ]}
      {...rest}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[colors.primaryFixed, colors.primaryFixedDim]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            ...StyleSheetAbsolute,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            paddingHorizontal: 24,
          }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={{
            flex: 1,
            width: '100%',
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          {content}
        </View>
      )}
    </AnimatedPressable>
  );
};

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
