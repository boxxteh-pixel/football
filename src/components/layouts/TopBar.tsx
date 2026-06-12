import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Animated } from 'react-native';
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
import { useLiveFixtures } from '@/hooks/useFixtures';

// ─── Live Score Ticker ─────────────────────────────────────────────────────────
const LiveTicker: React.FC<{ leagueIds: number[] }> = ({ leagueIds }) => {
  const colors = useColors();
  // We use leagueIds string/number array mapping to category but we can just get trending events for the ticker
  const { data: liveData = [] } = useLiveFixtures('all', true);
  const scrollX = useRef(new Animated.Value(0)).current;
  const containerWidth = useRef(800);

  const tickerText = liveData
    .map((event) =>
      `${event.title} (Vol: $${Math.round(event.volume).toLocaleString()})`
    )
    .join('   •   ');

  useEffect(() => {
    if (liveData.length === 0) return;
    // Reset and start scroll
    scrollX.setValue(containerWidth.current);
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -(tickerText.length * 7.5),
        duration: tickerText.length * 80,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [tickerText]);

  if (liveData.length === 0) return null;

  return (
    <View
      style={{
        height: 22,
        overflow: 'hidden',
        backgroundColor: `${colors.primaryFixed}0D`,
        borderTopWidth: 1,
        borderTopColor: `${colors.primaryFixed}22`,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
    >
      {/* LIVE label */}
      <View style={{
        paddingHorizontal: 8, borderRightWidth: 1,
        borderRightColor: `${colors.primaryFixed}33`, height: '100%',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{
          color: '#FF9500', fontFamily: fonts.label,
          fontSize: 8, fontWeight: 'bold', letterSpacing: 1,
        }}>
          TRENDING
        </Text>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.label,
            fontSize: 10,
            letterSpacing: 0.3,
            transform: [{ translateX: scrollX }],
            paddingLeft: 12,
          }}
          numberOfLines={1}
        >
          {tickerText + '   •   ' + tickerText}
        </Animated.Text>
      </View>
    </View>
  );
};

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
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const showWordmark = title === 'BORO' || title === 'BORO AI' || title === 'BORO chat' || title === 'BORO CHAT';
  const avatarHidden = hideAvatar || isDesktop;
  const isWeb = Platform.OS === 'web';
  const bg = isWeb ? 'rgba(28,27,26,0.45)' : 'rgba(28,27,26,0.32)';

  // Show ticker only on the home TopBar
  const showTicker = showWordmark && !showBack;

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
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
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
          paddingHorizontal: isDesktop ? 44 : 16,
          width: '100%',
          maxWidth: isDesktop ? contentMaxWidth + 72 : undefined,
          alignSelf: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {showBack ? (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              hitSlop={12}
            >
              <BoroIcon name="arrow-back" size={26} color={colors.primaryFixed} />
            </Pressable>
          ) : null}
          {showWordmark ? (
            <BoroWordmark colorTheme={colorTheme} subText={wordmarkSub} />
          ) : (
            <Text style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: 0, color: colors.primaryFixed }}>
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

      {/* Live score ticker — appears below the main bar when there are live matches */}
      {showTicker && <LiveTicker leagueIds={selectedLeagueIds} />}
    </View>
  );
};
