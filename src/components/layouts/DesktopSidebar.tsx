import React, { useEffect } from 'react';
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
 * Inject web-only CSS for hover states, transitions, and pseudo-elements.
 * Uses nativeID (which becomes `id` in the DOM) to target sidebar elements,
 * completely bypassing NativeWind's className processing.
 */
function useInjectSidebarCSS(primaryColor: string, accentRGB: string, accent30: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const STYLE_ID = 'boro-sidebar-css';
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      /* --- Sidebar container --- */
      #boro-sidebar {
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        transition: background-color 0.3s ease;
      }

      /* --- Nav row items --- */
      [id^="sidebar-nav-"] {
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        position: relative;
      }

      [id^="sidebar-nav-"]:hover {
        transform: translateX(6px);
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }

      /* Active gradient background */
      [id^="sidebar-nav-"].boro-active {
        background: linear-gradient(90deg, rgba(${accentRGB}, 0.18) 0%, rgba(${accentRGB}, 0.04) 100%) !important;
        border-color: ${accent30} !important;
        box-shadow: 0 4px 20px rgba(${accentRGB}, 0.08);
      }

      /* Active neon left bar */
      [id^="sidebar-nav-"]::before {
        content: '';
        position: absolute;
        left: 0;
        top: 22%;
        height: 56%;
        width: 3px;
        border-radius: 4px;
        background-color: transparent;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      [id^="sidebar-nav-"].boro-active::before {
        background-color: ${primaryColor} !important;
        box-shadow: 0 0 14px ${primaryColor}, 0 0 6px ${primaryColor};
      }

      /* SVG icon transitions */
      [id^="sidebar-nav-"] svg {
        transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), stroke 0.2s ease;
        flex-shrink: 0;
      }

      [id^="sidebar-nav-"]:hover svg {
        transform: scale(1.12) rotate(-3deg);
        stroke: #ffffff !important;
      }

      [id^="sidebar-nav-"].boro-active svg {
        stroke: ${primaryColor} !important;
        transform: scale(1.06);
      }

      /* Label text transitions */
      [id^="sidebar-nav-"]:hover [id$="-label"] {
        color: #ffffff !important;
      }

      /* Brand hover */
      #sidebar-brand {
        cursor: pointer;
        transition: opacity 0.25s ease;
      }
      #sidebar-brand:hover {
        opacity: 0.9;
      }
      #sidebar-brand:hover img {
        transform: rotate(8deg) scale(1.08);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* API meter hover */
      #sidebar-api-meter {
        transition: all 0.3s ease;
      }
      #sidebar-api-meter:hover {
        border-color: ${accent30} !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      }

      /* Account box hover */
      #sidebar-account {
        cursor: default;
        transition: all 0.3s ease;
      }
      #sidebar-account:hover {
        background-color: rgba(255, 255, 255, 0.04) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
    `;
  }, [primaryColor, accentRGB, accent30]);
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

  const isPurple = colorTheme === 'purple';
  const accentRGB = isPurple ? '167, 139, 250' : '195, 244, 0';

  // Inject web CSS for hover/active effects (bypasses NativeWind entirely)
  useInjectSidebarCSS(colors.primaryFixed, accentRGB, colors.accent30);

  const handleLogout = async () => {
    await logOut();
    await Promise.all([
      useSettingsStore.getState().hydrate(),
      useFavoritesStore.getState().hydrate(),
    ]);
    router.replace('/(auth)/intro');
  };

  // On web, after render, add the boro-active class to active nav items.
  // We do this via DOM because NativeWind strips className.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    // Clear all boro-active classes first
    document.querySelectorAll('[id^="sidebar-nav-"]').forEach((el) => {
      el.classList.remove('boro-active');
    });
    // Set boro-active on matching items
    PRIMARY.forEach((item) => {
      if (isActive(pathname, item)) {
        const el = document.getElementById(`sidebar-nav-${item.route.replace(/\//g, '-') || 'home'}`);
        if (el) el.classList.add('boro-active');
      }
    });
    // Settings
    if (pathname.startsWith('/settings')) {
      const el = document.getElementById('sidebar-nav-settings');
      if (el) el.classList.add('boro-active');
    }
  }, [pathname]);

  return (
    <View
      nativeID="boro-sidebar"
      style={{
        width: 248,
        height: '100%',
        backgroundColor: Platform.OS === 'web' ? 'rgba(28, 27, 26, 0.45)' : 'rgba(28, 27, 26, 0.32)',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.07)',
        paddingTop: 26,
        paddingBottom: 18,
        paddingHorizontal: 16,
        ...(Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(30px) saturate(180%) brightness(1.05)', WebkitBackdropFilter: 'blur(30px) saturate(180%) brightness(1.05)' } as any)
          : {}),
      }}
    >
      {/* Brand */}
      <Pressable
        nativeID="sidebar-brand"
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
              nativeID={`sidebar-nav-${item.route.replace(/\//g, '-') || 'home'}`}
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
        nativeID="sidebar-api-meter"
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
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
        nativeID="sidebar-nav-settings"
        icon="settings"
        label={t('profile.settings') || 'Settings'}
        active={pathname.startsWith('/settings')}
        onPress={() => router.push('/settings')}
      />

      {/* Account / logout */}
      <View
        nativeID="sidebar-account"
        style={{
          marginTop: 10,
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(255,255,255,0.02)',
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

interface NavRowProps {
  nativeID: string;
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

const NavRow: React.FC<NavRowProps> = ({
  nativeID,
  icon,
  label,
  active,
  onPress,
}) => {
  const colors = useColors();
  return (
    <Pressable
      nativeID={nativeID}
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: active
          ? colors.accent15
          : hovered || pressed
            ? colors.white05
            : 'transparent',
        borderColor: active ? colors.accent30 : 'transparent',
      })}
    >
      <BoroIcon name={icon} size={21} color={active ? colors.primaryFixed : colors.onSurfaceVariant} />
      <Text
        nativeID={`${nativeID}-label`}
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
