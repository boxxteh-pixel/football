import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BoroWordmark } from '@/components/ui/BoroWordmark';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LivePulse } from '@/components/ui/LivePulse';
import { AvatarMenu } from '@/components/ui/AvatarMenu';
import { useSettingsStore } from '@/store/settingsStore';
import { useResponsive } from '@/hooks/useResponsive';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  showLive?: boolean;
  rightSlot?: React.ReactNode;
  hideAvatar?: boolean;
  wordmarkSub?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title = 'BORO AI',
  showBack = false,
  showLive = false,
  rightSlot,
  hideAvatar = false,
  wordmarkSub = 'AI',
}) => {
  const colors = useColors();
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const showWordmark = title === 'BORO' || title === 'BORO AI' || title === 'BORO chat' || title === 'BORO CHAT';
  // The desktop sidebar owns the account/API meter, so never duplicate it here.
  const avatarHidden = hideAvatar || isDesktop;
  const isWeb = Platform.OS === 'web';
  const bg = isWeb ? 'rgba(28,27,26,0.45)' : 'rgba(28,27,26,0.32)';

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: bg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.14)',
        position: 'relative',
        overflow: 'hidden',
        ...(isWeb
          ? ({ backdropFilter: 'blur(28px) saturate(180%) brightness(1.05)', WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.05)' } as any)
          : {}),
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={70}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Ambient diagonal glass sheen */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isDesktop ? 36 : 16,
          width: '100%',
          maxWidth: isDesktop ? contentMaxWidth + 72 : undefined,
          alignSelf: 'center',
          boxSizing: 'border-box',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showBack ? (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
              hitSlop={12}
            >
              <BoroIcon name="arrow-back" size={26} color={colors.primaryFixed} />
            </Pressable>
          ) : null}
          {showWordmark ? (
            <BoroWordmark colorTheme={colorTheme} subText={wordmarkSub} />
          ) : (
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                letterSpacing: 0,
                color: colors.primaryFixed,
              }}
            >
              {title}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showLive && <LivePulse label="" />}
          {rightSlot}
          {!avatarHidden && <AvatarMenu />}
        </View>
      </View>
    </View>
  );
};
