import React from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors} from '@/theme/colors';
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
}

export const TopBar: React.FC<TopBarProps> = ({
  title = 'BORO AI',
  showBack = false,
  showLive = false,
  rightSlot,
  hideAvatar = false,
}) => {
  const colors = useColors();
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const showWordmark = title === 'BORO' || title === 'BORO AI';
  // The desktop sidebar owns the account/API meter, so never duplicate it here.
  const avatarHidden = hideAvatar || isDesktop;

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: Platform.OS === 'web' ? 'rgba(20,19,17,0.45)' : 'rgba(22,20,18,0.3)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        ...(Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(28px) saturate(180%) brightness(1.05)', WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.05)' } as any)
          : {}),
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={60}
          tint="dark"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
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
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showBack ? (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <BoroIcon name="arrow-back" size={26} color={colors.primaryFixed} />
            </Pressable>
          ) : null}
          {showWordmark ? (
            <BoroWordmark colorTheme={colorTheme} />
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

const BoroWordmark: React.FC<{ colorTheme: 'green' | 'purple' }> = ({ colorTheme }) => {
  const colors = useColors();
  const logoSource =
    colorTheme === 'purple'
      ? require('../../../assets/images/logo2.png')
      : require('../../../assets/images/logo.png');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={logoSource} style={{ width: 24, height: 24 }} resizeMode="contain" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.display,
            fontSize: 22,
            letterSpacing: 0,
            lineHeight: 26,
          }}
        >
          BORO
        </Text>
        <Text
          style={{
            color: colors.primaryFixed,
            fontFamily: fonts.label,
            fontSize: 12,
            opacity: 0.8,
            marginLeft: 4,
          }}
        >
          AI
        </Text>
      </View>
    </View>
  );
};
