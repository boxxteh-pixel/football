import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useRateLimit } from '@/hooks/useRateLimit';
import { USE_NATIVE_DRIVER } from '@/utils/anim';
import { useT } from '@/theme/i18n';

export const AvatarMenu: React.FC = () => {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const chevronProgress = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const logOut = useAuthStore((s) => s.logOut);
  const haptics = useHaptics();
  const t = useT();
  const rl = useRateLimit();

  const initial = session?.user.name?.[0]?.toUpperCase() ?? 'B';
  // Real remaining API calls (e.g. "52.9k"); falls back to ∞ only if unknown.
  const apiRequestsRemaining = rl.remaining != null ? rl.compact : '\u221e';
  const apiProgress = rl.remainingPct != null ? rl.remainingPct / 100 : 1;
  const apiLow = rl.remainingPct != null && rl.remainingPct < 15;

  useEffect(() => {
    Animated.timing(chevronProgress, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [chevronProgress, open]);

  const chevronStyle = {
    transform: [
      {
        rotate: chevronProgress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const handle = (action: () => void) => {
    haptics.light();
    setOpen(false);
    setTimeout(action, 80);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.light();
          setOpen(true);
        }}
        hitSlop={8}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <View
          style={{
            height: 38,
            width: 148,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: colors.accent30,
              backgroundColor: colors.accent08,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.display,
                fontSize: 18,
                lineHeight: 22,
                textAlign: 'center',
              }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.bodyBold,
                  fontSize: 11,
                  flexShrink: 1,
                  maxWidth: 68,
                }}
                numberOfLines={1}
              >
                {session?.user.name ?? t('common.guest')}
              </Text>
              <View
                style={{
                  minWidth: 17,
                  height: 17,
                  borderRadius: 5,
                  paddingHorizontal: 4,
                  backgroundColor: apiLow ? 'rgba(239,68,68,0.2)' : colors.accent20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ color: apiLow ? '#ef4444' : colors.primaryFixed, fontFamily: fonts.stats, fontSize: 10, lineHeight: 14 }}
                  numberOfLines={1}
                >
                  {apiRequestsRemaining}
                </Text>
              </View>
              <Animated.View style={chevronStyle}>
                <BoroIcon name="chevron-down" size={14} color={colors.onSurfaceVariant} />
              </Animated.View>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.accent12,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${apiProgress * 100}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: apiLow ? '#ef4444' : colors.primaryFixed,
                }}
              />
            </View>
          </View>
        </View>
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <View
            style={{
              position: 'absolute',
              top: insets.top + 56,
              right: 12,
              width: 240,
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(32,31,31,0.92)',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            {Platform.OS !== 'web' && (
              <BlurView intensity={40} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            )}

            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.06)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: colors.accent40,
                  backgroundColor: colors.accent08,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.headlineMd, fontSize: 16 }}>
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.6 }}
                >
                  {t('profile.signedInAs')}
                </Text>
                <Text
                  style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {session?.user.name ?? t('common.guest')}
                </Text>
              </View>
            </View>
            <MenuItem
              icon="settings"
              label={t('profile.settings')}
              onPress={() => handle(() => router.push('/settings'))}
            />
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <MenuItem
              icon="logout"
              label={t('profile.logout')}
              danger
              onPress={() =>
                handle(async () => {
                  await logOut();
                  await Promise.all([
                    useSettingsStore.getState().hydrate(),
                    useFavoritesStore.getState().hydrate(),
                  ]);
                  router.replace('/(auth)/intro');
                })
              }
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onPress, danger }) => {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.accent08 : 'transparent',
      })}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text
          style={{
            color: danger ? colors.error : colors.onSurface,
            fontFamily: fonts.bodyBold,
            fontSize: 14,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <BoroIcon name={icon} size={20} color={danger ? colors.error : colors.primaryFixed} />
      </View>
    </Pressable>
  );
};
