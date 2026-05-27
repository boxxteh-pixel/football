import React, { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AmbientOrb } from '@/components/ui/AmbientOrb';
import { NeonButton } from '@/components/ui/NeonButton';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useSettingsStore } from '@/store/settingsStore';

export default function IntroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const scale = useSharedValue(1);
  const glow = useSharedValue(10);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withTiming(25, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scale, glow]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowRadius: glow.value,
  }));

  const logoSource = colorTheme === 'purple'
    ? require('../../assets/images/logo2.png')
    : require('../../assets/images/logo.png');

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 24,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <Animated.View style={logoStyle}>
          <Image
            key={colorTheme}
            source={logoSource}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              color: colors.primaryFixed,
              fontFamily: fonts.display,
              fontSize: 44,
              letterSpacing: -1.2,
            }}
          >
            BORO
          </Text>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.body,
              fontSize: 16,
              textAlign: 'center',
              maxWidth: 280,
              opacity: 0.85,
            }}
          >
            Precision analytics for the modern predictor.
          </Text>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', gap: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, opacity: 0.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BoroIcon name="security" size={16} color={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>Secure</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BoroIcon name="bolt" size={16} color={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>Real-time</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BoroIcon name="insights" size={16} color={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>Accurate</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <NeonButton
            label="Log In"
            iconRight="login"
            onPress={() => {
              haptics.light();
              router.push('/(auth)/login');
            }}
          />
          <Pressable
            onPress={() => {
              haptics.light();
              router.push('/(auth)/signup');
            }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              backgroundColor: 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 15 }}>
              Create Account
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
