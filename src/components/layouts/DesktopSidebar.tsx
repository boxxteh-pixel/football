import React from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useRateLimit } from '@/hooks/useRateLimit';
import { useT } from '@/theme/i18n';

interface NavItem {
  labelKey: string;
  fallback: string;
  icon: string;
  route: string;
  /** Match exactly (used for the home/index route). */
  exact?: boolean;
}

const PRIMARY: NavItem[] = [
  { labelKey: 'tabs.predictor', fallback: 'Predictor', icon: 'analytics', route: '/', exact: true },
  { labelKey: 'tabs.results', fallback: 'Results', icon: 'history', route: '/live' },
  { labelKey: 'tabs.chat', fallback: 'AI Chat', icon: 'psychology', route: '/chat' },
  { labelKey: 'insights.title', fallback: 'Discovery', icon: 'auto-awesome', route: '/insights' },
  { labelKey: 'favorites.title', fallback: 'Favorites', icon: 'favorite', route: '/favorites' },
  { labelKey: 'tabs.profile', fallback: 'Profile', icon: 'person', route: '/profile' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === '/' || pathname === '/index';
  return pathname === item.route || pathname.startsWith(item.route + '/');
}

/**
 * Persistent desktop navigation rail. Replaces the bottom tab bar on wide
 * screens, providing a true desktop app shell (global nav + account + API meter).
 */
export const DesktopSidebar: React.FC = () => {
  const colors = useColors();
  const t = useT();
  const pathname = usePathname();
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const session = useAuthStore((s) => s.session);
  const logOut = useAuthStore((s) => s.logOut);
  const rl = useRateLimit();

  const initial = session?.user.name?.[0]?.toUpperCase() ?? 'B';
  const apiRemaining = rl.remaining != null ? rl.compact : '\u221e';
  const apiProgress = rl.remainingPct != null ? rl.remainingPct / 100 : 1;
  const apiLow = rl.remainingPct != null && rl.remainingPct < 15;

  const logoSource =
    colorTheme === 'purple'
      ? require('../../../assets/images/logo2.png')
      : require('../../../assets/images/logo.png');

  const handleLogout = async () => {
    await logOut();
    await Promise.all([
      useSettingsStore.getState().hydrate(),
      useFavoritesStore.getState().hydrate(),
    ]);
    router.replace('/(auth)/intro');
  };

  return (
    <View
      style={{
        width: 248,
        height: '100%',
        backgroundColor: colors.surfaceContainerLowest,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.07)',
        paddingTop: 26,
        paddingBottom: 18,
        paddingHorizontal: 16,
      }}
    >
      {/* Brand */}
      <Pressable
        onPress={() => router.push('/')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 28 }}
      >
        <Image source={logoSource} style={{ width: 30, height: 30 }} resizeMode="contain" />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0 }}>BORO</Text>
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 12, opacity: 0.85 }}>AI</Text>
        </View>
      </Pressable>

      {/* Primary nav */}
      <View style={{ gap: 4, flex: 1 }}>
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item);
          return (
            <NavRow
              key={item.route}
              icon={item.icon}
              label={t(item.labelKey) || item.fallback}
              active={active}
              onPress={() => router.push(item.route as any)}
            />
          );
        })}
      </View>

      {/* API usage meter */}
      <View
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          backgroundColor: colors.white05,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.6 }}>
            API CREDITS
          </Text>
          <Text style={{ color: apiLow ? '#ef4444' : colors.primaryFixed, fontFamily: fonts.stats, fontSize: 12 }}>
            {apiRemaining}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.accent12, overflow: 'hidden' }}>
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

      {/* Settings */}
      <NavRow
        icon="settings"
        label={t('profile.settings') || 'Settings'}
        active={pathname.startsWith('/settings')}
        onPress={() => router.push('/settings')}
      />

      {/* Account / logout */}
      <View
        style={{
          marginTop: 10,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.accent30,
            backgroundColor: colors.accent08,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 16 }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
            {t('profile.signedInAs') || 'SIGNED IN AS'}
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
            {session?.user.name ?? t('common.guest')}
          </Text>
        </View>
        <Pressable
          onPress={handleLogout}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
        >
          <BoroIcon name="logout" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
};

const NavRow: React.FC<{ icon: string; label: string; active: boolean; onPress: () => void }> = ({
  icon,
  label,
  active,
  onPress,
}) => {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: active
          ? colors.accent15
          : hovered || pressed
            ? colors.white05
            : 'transparent',
        borderWidth: 1,
        borderColor: active ? colors.accent30 : 'transparent',
        ...(Platform.OS === 'web' ? ({ transition: 'background-color 120ms ease' } as any) : {}),
      })}
    >
      <BoroIcon name={icon} size={21} color={active ? colors.primaryFixed : colors.onSurfaceVariant} />
      <Text
        style={{
          color: active ? colors.primaryFixed : colors.onSurface,
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};
