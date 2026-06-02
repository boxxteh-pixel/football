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

const MAIN_NAV: NavItem[] = [
  { labelKey: 'tabs.predictor', fallback: 'Predictor', icon: 'analytics', route: '/', exact: true },
  { labelKey: 'tabs.results', fallback: 'Results', icon: 'history', route: '/live' },
  { labelKey: 'tabs.chat', fallback: 'Chat', icon: 'chat', route: '/chat' },
];

const EXPLORE_NAV: NavItem[] = [
  { labelKey: 'insights.title', fallback: 'Discovery', icon: 'auto-awesome', route: '/insights' },
  { labelKey: 'favorites.title', fallback: 'Favorites', icon: 'favorite', route: '/favorites' },
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
        backdrop-filter: blur(32px) saturate(200%) brightness(1.02);
        -webkit-backdrop-filter: blur(32px) saturate(200%) brightness(1.02);
        transition: background-color 0.3s ease;
      }

      /* --- Section labels --- */
      .boro-section-label {
        text-transform: uppercase;
        letter-spacing: 1.2px;
        user-select: none;
      }

      /* --- Nav row items --- */
      [id^="sidebar-nav-"] {
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        position: relative;
      }

      [id^="sidebar-nav-"]:hover {
        transform: translateX(4px);
        background-color: rgba(255, 255, 255, 0.05) !important;
      }

      /* Active item styling */
      [id^="sidebar-nav-"].boro-active {
        background: linear-gradient(135deg, rgba(${accentRGB}, 0.14) 0%, rgba(${accentRGB}, 0.04) 100%) !important;
        border-color: rgba(${accentRGB}, 0.25) !important;
        box-shadow: 0 2px 16px rgba(${accentRGB}, 0.06), inset 0 0 0 1px rgba(${accentRGB}, 0.08);
      }

      /* Active neon left bar */
      [id^="sidebar-nav-"]::before {
        content: '';
        position: absolute;
        left: 0;
        top: 20%;
        height: 60%;
        width: 3px;
        border-radius: 0 4px 4px 0;
        background-color: transparent;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      [id^="sidebar-nav-"].boro-active::before {
        background-color: ${primaryColor} !important;
        box-shadow: 0 0 12px ${primaryColor}, 0 0 4px ${primaryColor};
      }

      /* SVG icon transitions */
      [id^="sidebar-nav-"] svg {
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), stroke 0.2s ease;
        flex-shrink: 0;
      }

      [id^="sidebar-nav-"]:hover svg {
        transform: scale(1.08);
        stroke: #ffffff !important;
      }

      [id^="sidebar-nav-"].boro-active svg {
        stroke: ${primaryColor} !important;
      }

      /* Label text transitions */
      [id^="sidebar-nav-"] [id$="-label"] {
        transition: color 0.2s ease;
      }

      [id^="sidebar-nav-"]:hover [id$="-label"] {
        color: #ffffff !important;
      }

      /* Brand hover */
      #sidebar-brand {
        cursor: pointer;
        transition: opacity 0.25s ease;
      }
      #sidebar-brand:hover {
        opacity: 0.85;
      }
      #sidebar-brand:hover img {
        transform: rotate(6deg) scale(1.06);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* API meter */
      #sidebar-api-meter {
        transition: all 0.3s ease;
      }
      #sidebar-api-meter:hover {
        border-color: rgba(${accentRGB}, 0.2) !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }

      /* Account box */
      #sidebar-account {
        cursor: default;
        transition: all 0.3s ease;
      }
      #sidebar-account:hover {
        background-color: rgba(255, 255, 255, 0.04) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }

      /* Divider line */
      .boro-sidebar-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
      }

      /* Logout button */
      #sidebar-logout-btn {
        cursor: pointer;
        transition: all 0.2s ease !important;
      }
      #sidebar-logout-btn:hover {
        background-color: rgba(239, 68, 68, 0.08) !important;
        border-color: rgba(239, 68, 68, 0.2) !important;
      }
      #sidebar-logout-btn:hover svg {
        stroke: #ef4444 !important;
      }
      #sidebar-logout-btn:hover [id="sidebar-logout-label"] {
        color: #ef4444 !important;
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

  const userName = session?.user.name ?? 'Guest';
  const initial = userName[0]?.toUpperCase() ?? 'B';
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
    [...MAIN_NAV, ...EXPLORE_NAV].forEach((item) => {
      if (isActive(pathname, item)) {
        const el = document.getElementById(`sidebar-nav-${item.route.replace(/\//g, '-') || 'home'}`);
        if (el) el.classList.add('boro-active');
      }
    });
    // Profile
    if (pathname === '/profile' || pathname.startsWith('/profile/')) {
      const el = document.getElementById('sidebar-nav--profile');
      if (el) el.classList.add('boro-active');
    }
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
        width: 272,
        height: '100%',
        backgroundColor: 'rgba(22, 21, 20, 0.55)',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.06)',
        paddingTop: 24,
        paddingBottom: 16,
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        ...(Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(32px) saturate(200%) brightness(1.02)', WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.02)' } as any)
          : {}),
      }}
    >
      {/* Top area: Brand + Main Nav */}
      <View style={{ gap: 6 }}>
        {/* Brand */}
        <Pressable
          nativeID="sidebar-brand"
          onPress={() => router.push('/')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20 }}
        >
          <Image source={logoSource} style={{ width: 34, height: 34 }} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.5 }}>BORO</Text>
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 11, opacity: 0.9, letterSpacing: 0.5 }}>AI</Text>
          </View>
        </Pressable>

        {/* Section: Main */}
        <SectionLabel text="MAIN" />
        <View style={{ gap: 2 }}>
          {MAIN_NAV.map((item) => {
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

        {/* Divider */}
        <View style={{ marginVertical: 10 }}>
          <View nativeID="boro-sidebar-divider-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </View>

        {/* Section: Explore */}
        <SectionLabel text="EXPLORE" />
        <View style={{ gap: 2 }}>
          {EXPLORE_NAV.map((item) => {
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
      </View>

      {/* Bottom area: API Meter + Account + Settings + Logout */}
      <View style={{ gap: 8 }}>
        {/* API usage meter */}
        <View
          nativeID="sidebar-api-meter"
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BoroIcon name="analytics" size={13} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.8 }}>
                API CREDITS
              </Text>
            </View>
            <Text style={{ color: apiLow ? '#ef4444' : colors.primaryFixed, fontFamily: fonts.stats, fontSize: 13 }}>
              {apiRemaining}
            </Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
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

        {/* Divider */}
        <View style={{ marginVertical: 2 }}>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </View>

        {/* Account card */}
        <View
          nativeID="sidebar-account"
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(255,255,255,0.02)',
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
              borderWidth: 1.5,
              borderColor: colors.accent30,
              backgroundColor: colors.accent08,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 17 }}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11, opacity: 0.7 }} numberOfLines={1}>
              Free Plan
            </Text>
          </View>
        </View>

        {/* Settings + Logout row */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            nativeID="sidebar-nav-settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }: any) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: pathname.startsWith('/settings') ? colors.accent15 : 'rgba(255,255,255,0.02)',
              borderColor: pathname.startsWith('/settings') ? colors.accent30 : 'rgba(255,255,255,0.06)',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <BoroIcon name="settings" size={17} color={pathname.startsWith('/settings') ? colors.primaryFixed : colors.onSurfaceVariant} />
            <Text
              nativeID="sidebar-nav-settings-label"
              style={{
                color: pathname.startsWith('/settings') ? colors.primaryFixed : colors.onSurfaceVariant,
                fontFamily: fonts.body,
                fontSize: 12,
              }}
            >
              {t('profile.settings') || 'Settings'}
            </Text>
          </Pressable>

          <Pressable
            nativeID="sidebar-logout-btn"
            onPress={handleLogout}
            style={({ pressed }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.06)',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <BoroIcon name="logout" size={16} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

/* ────────────────────── Sub-components ────────────────────── */

const SectionLabel: React.FC<{ text: string }> = ({ text }) => {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.onSurfaceVariant,
        fontFamily: fonts.label,
        fontSize: 10,
        letterSpacing: 1.4,
        opacity: 0.5,
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 6,
      }}
    >
      {text}
    </Text>
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
        gap: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: active
          ? colors.accent15
          : hovered || pressed
            ? colors.white05
            : 'transparent',
        borderColor: active ? colors.accent30 : 'transparent',
      })}
    >
      <BoroIcon name={icon} size={20} color={active ? colors.primaryFixed : colors.onSurfaceVariant} />
      <Text
        nativeID={`${nativeID}-label`}
        style={{
          color: active ? colors.primaryFixed : colors.onSurface,
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: 14,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};
