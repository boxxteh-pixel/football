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
  const showWordmark = title === 'BORO' || title === 'BORO AI';

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: Platform.OS === 'web' ? 'rgba(19,19,19,0.55)' : 'rgba(19,19,19,0.3)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        ...(Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)' } as any)
          : {}),
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={30}
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
          paddingHorizontal: 16,
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
          {!hideAvatar && <AvatarMenu />}
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
