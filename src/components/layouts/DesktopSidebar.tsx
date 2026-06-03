import React, { useEffect } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { BoroIcon } from "@/components/ui/BoroIcon";
import { useColors } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useRateLimit } from "@/hooks/useRateLimit";
import { useT } from "@/theme/i18n";

interface NavItem {
  labelKey: string;
  fallback: string;
  icon: string;
  route: string;
  /** Match exactly (used for the home/index route). */
  exact?: boolean;
}

const MAIN_NAV: NavItem[] = [
  {
    labelKey: "tabs.predictor",
    fallback: "Predictor",
    icon: "analytics",
    route: "/",
    exact: true,
  },
  {
    labelKey: "tabs.results",
    fallback: "Results",
    icon: "history",
    route: "/live",
  },
  { labelKey: "tabs.chat", fallback: "Chat", icon: "chat", route: "/chat" },
];

const EXPLORE_NAV: NavItem[] = [
  {
    labelKey: "insights.title",
    fallback: "Discovery",
    icon: "auto-awesome",
    route: "/insights",
  },
  {
    labelKey: "favorites.title",
    fallback: "Favorites",
    icon: "favorite",
    route: "/favorites",
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === "/" || pathname === "/index";
  return pathname === item.route || pathname.startsWith(item.route + "/");
}

function navDomId(route: string): string {
  return route === "/"
    ? "home"
    : route.replace(/^\/+/, "").replace(/\//g, "-") || "home";
}

/**
 * Inject web-only CSS for hover states and transitions.
 * Row ids and label ids intentionally use different prefixes so desktop-only
 * effects never hit the Text node itself (fixes broken PC sidebar alignment).
 */
function useInjectSidebarCSS(primaryColor: string, accentRGB: string) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const STYLE_ID = "boro-sidebar-css";
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      #boro-sidebar {
        backdrop-filter: blur(48px) saturate(220%) brightness(0.95) !important;
        -webkit-backdrop-filter: blur(48px) saturate(220%) brightness(0.95) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
        box-shadow: 6px 0 32px rgba(0, 0, 0, 0.5);
        transition: background-color 0.24s ease;
      }

      .boro-section-label {
        text-transform: uppercase;
        letter-spacing: 1.5px;
        user-select: none;
        font-weight: 700;
        opacity: 0.45;
        margin-top: 14px !important;
        margin-bottom: 6px !important;
      }

      .boro-sidebar-row {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        cursor: pointer;
        isolation: isolate;
        transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        border: 1px solid transparent !important;
        margin-top: 6px !important;
        margin-bottom: 6px !important;
      }

      .boro-sidebar-row:hover {
        transform: translateX(4px);
        background-color: rgba(255, 255, 255, 0.05) !important;
        border-color: rgba(255, 255, 255, 0.08) !important;
      }

      /* Glowing neon active styling */
      .boro-sidebar-row.active {
        background-color: rgba(${accentRGB}, 0.08) !important;
        border-color: rgba(${accentRGB}, 0.22) !important;
        box-shadow: 0 4px 16px rgba(${accentRGB}, 0.08);
      }

      .boro-sidebar-row svg,
      #sidebar-action-settings svg,
      #sidebar-logout-btn svg {
        display: block;
        flex-shrink: 0;
        transition: transform 0.2s ease, stroke 0.2s ease;
      }

      .boro-sidebar-row:hover svg,
      #sidebar-action-settings:hover svg {
        transform: scale(1.06);
        stroke: ${primaryColor} !important;
      }

      [id^="sidebar-label-"] {
        transition: color 0.2s ease;
        padding-left: 4px !important;
      }

      .boro-sidebar-row:hover [id^="sidebar-label-"],
      #sidebar-action-settings:hover [id^="sidebar-label-"],
      #sidebar-logout-btn:hover [id^="sidebar-label-"],
      #sidebar-logout-btn:hover span,
      #sidebar-logout-btn:hover div,
      #sidebar-logout-btn:hover p,
      #sidebar-action-settings:hover span,
      #sidebar-action-settings:hover div,
      #sidebar-action-settings:hover p,
      .boro-sidebar-row:hover span,
      .boro-sidebar-row:hover div,
      .boro-sidebar-row:hover p {
        color: #ffffff !important;
      }

      #sidebar-brand {
        cursor: pointer;
        transition: opacity 0.2s ease;
        margin-bottom: 24px !important;
      }
      #sidebar-brand:hover {
        opacity: 0.92;
      }
      #sidebar-brand img {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #sidebar-brand:hover img {
        transform: rotate(6deg) scale(1.08);
      }

      #sidebar-api-meter {
        background-color: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        transition: all 0.25s ease;
        margin-bottom: 6px !important;
      }
      #sidebar-api-meter:hover {
        border-color: rgba(${accentRGB}, 0.22) !important;
        background-color: rgba(255, 255, 255, 0.035) !important;
        box-shadow: 0 4px 24px rgba(${accentRGB}, 0.08);
      }

      #sidebar-account {
        cursor: default;
        background-color: rgba(255, 255, 255, 0.015) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        backdrop-filter: blur(12px);
        transition: all 0.25s ease;
        margin-bottom: 6px !important;
      }
      #sidebar-account:hover {
        background-color: rgba(255, 255, 255, 0.04) !important;
        border-color: rgba(255, 255, 255, 0.09) !important;
        transform: translateY(-1px);
      }

      .boro-sidebar-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        margin-top: 12px !important;
        margin-bottom: 12px !important;
      }

      #sidebar-action-settings,
      #sidebar-logout-btn {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-start !important;
        cursor: pointer;
        background-color: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        margin-top: 4px !important;
        margin-bottom: 4px !important;
      }
      #sidebar-action-settings:hover {
        background-color: rgba(${accentRGB}, 0.06) !important;
        border-color: rgba(${accentRGB}, 0.2) !important;
      }
      #sidebar-logout-btn:hover {
        background-color: rgba(239, 68, 68, 0.08) !important;
        border-color: rgba(239, 68, 68, 0.25) !important;
      }
      #sidebar-logout-btn:hover svg {
        stroke: #ef4444 !important;
      }
    `;
  }, [primaryColor, accentRGB]);
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

  const userName = session?.user.name ?? "Guest";
  const initial = userName[0]?.toUpperCase() ?? "B";
  const apiRemaining = rl.remaining != null ? rl.compact : "\u221e";
  const apiProgress = rl.remainingPct != null ? rl.remainingPct / 100 : 1;
  const apiLow = rl.remainingPct != null && rl.remainingPct < 15;

  const logoSource =
    colorTheme === "purple"
      ? require("../../../assets/images/logo2.png")
      : require("../../../assets/images/logo.png");

  const isPurple = colorTheme === "purple";
  const accentRGB = isPurple ? "167, 139, 250" : "195, 244, 0";

  // Inject web CSS for hover effects (bypasses NativeWind entirely)
  useInjectSidebarCSS(colors.primaryFixed, accentRGB);

  const handleLogout = async () => {
    await logOut();
    await Promise.all([
      useSettingsStore.getState().hydrate(),
      useFavoritesStore.getState().hydrate(),
    ]);
    router.replace("/(auth)/intro");
  };

  return (
    <View
      nativeID="boro-sidebar"
      style={{
        width: 272,
        height: "100%",
        backgroundColor: "rgba(22, 21, 20, 0.55)",
        borderRightWidth: 1,
        borderRightColor: "rgba(255,255,255,0.06)",
        paddingTop: 24,
        paddingBottom: 16,
        paddingHorizontal: 16,
        justifyContent: "space-between",
        ...(Platform.OS === "web"
          ? ({
              backdropFilter: "blur(32px) saturate(200%) brightness(1.02)",
              WebkitBackdropFilter:
                "blur(32px) saturate(200%) brightness(1.02)",
            } as any)
          : {}),
      }}
    >
      {/* Top area: Brand + Main Nav */}
      <View style={{ gap: 6 }}>
        {/* Brand */}
        <Pressable
          nativeID="sidebar-brand"
          onPress={() => router.push("/")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 20,
          }}
        >
          <Image
            source={logoSource}
            style={{ width: 34, height: 34 }}
            resizeMode="contain"
          />
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
          >
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.display,
                fontSize: 26,
                letterSpacing: -0.5,
              }}
            >
              BORO
            </Text>
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.label,
                fontSize: 11,
                opacity: 0.9,
                letterSpacing: 0.5,
              }}
            >
              AI
            </Text>
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
                nativeID={`sidebar-row-${navDomId(item.route)}`}
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
          <View
            nativeID="boro-sidebar-divider-1"
            style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }}
          />
        </View>

        {/* Section: Explore */}
        <SectionLabel text="EXPLORE" />
        <View style={{ gap: 2 }}>
          {EXPLORE_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <NavRow
                key={item.route}
                nativeID={`sidebar-row-${navDomId(item.route)}`}
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
            backgroundColor: "rgba(255,255,255,0.025)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <BoroIcon
                name="analytics"
                size={13}
                color={colors.onSurfaceVariant}
              />
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.label,
                  fontSize: 10,
                  letterSpacing: 0.8,
                }}
              >
                API CREDITS
              </Text>
            </View>
            <Text
              style={{
                color: apiLow ? "#ef4444" : colors.primaryFixed,
                fontFamily: fonts.stats,
                fontSize: 13,
              }}
            >
              {apiRemaining}
            </Text>
          </View>
          <View
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${apiProgress * 100}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: apiLow ? "#ef4444" : colors.primaryFixed,
              }}
            />
          </View>
        </View>

        {/* Divider */}
        <View style={{ marginVertical: 2 }}>
          <View
            style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }}
          />
        </View>

        {/* Account card */}
        <View
          nativeID="sidebar-account"
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)",
            flexDirection: "row",
            alignItems: "center",
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
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.display,
                fontSize: 17,
              }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              {userName}
            </Text>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.body,
                fontSize: 11,
                opacity: 0.7,
              }}
              numberOfLines={1}
            >
              Free Plan
            </Text>
          </View>
        </View>

        {/* Settings button as full-width card */}
        <Pressable
          nativeID="sidebar-action-settings"
          onPress={() => router.push("/settings")}
          style={({ pressed }: any) => ({
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            minHeight: 46,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginVertical: 4,
            borderRadius: 14,
            borderWidth: 1,
            backgroundColor: pathname.startsWith("/settings")
              ? colors.accent08
              : "rgba(255,255,255,0.02)",
            borderColor: pathname.startsWith("/settings")
              ? colors.accent20
              : "rgba(255,255,255,0.06)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ width: 24, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
            <BoroIcon
              name="settings"
              size={18}
              color={
                pathname.startsWith("/settings")
                  ? colors.primaryFixed
                  : colors.onSurfaceVariant
              }
            />
          </View>
          <Text
            nativeID="sidebar-label-settings"
            style={{
              color: pathname.startsWith("/settings")
                ? colors.primaryFixed
                : colors.onSurfaceVariant,
              fontFamily: fonts.body,
              fontSize: 13,
              paddingLeft: 4,
              paddingTop: 1.5,
              lineHeight: 18,
            }}
          >
            {t("profile.settings") || "Settings"}
          </Text>
        </Pressable>

        {/* Logout button as full-width card */}
        <Pressable
          nativeID="sidebar-logout-btn"
          onPress={handleLogout}
          style={({ pressed }: any) => ({
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            minHeight: 46,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginVertical: 4,
            borderRadius: 14,
            borderWidth: 1,
            backgroundColor: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ width: 24, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
            <BoroIcon name="logout" size={17} color={colors.onSurfaceVariant} />
          </View>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.body,
              fontSize: 13,
              paddingLeft: 4,
              paddingTop: 1.5,
              lineHeight: 18,
            }}
          >
            Logout
          </Text>
        </Pressable>
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
      className={`boro-sidebar-row ${active ? "active" : ""}`}
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 46,
        paddingHorizontal: 16,
        paddingVertical: 11,
        marginVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        position: "relative",
        backgroundColor: active
          ? colors.accent08
          : hovered || pressed
            ? colors.white05
            : "transparent",
        borderColor: active ? colors.accent20 : "transparent",
      })}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 10,
          bottom: 10,
          width: 3.5,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          backgroundColor: active ? colors.primaryFixed : "transparent",
          opacity: active ? 1 : 0,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          width: 24,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 16, // Explicit right margin space for icon-text separation
        }}
      >
        <BoroIcon
          name={icon}
          size={19}
          color={active ? colors.primaryFixed : colors.onSurfaceVariant}
        />
      </View>
      <Text
        nativeID={`sidebar-label-${nativeID.replace("sidebar-row-", "")}`}
        style={{
          color: active ? colors.onSurface : colors.onSurfaceVariant,
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: 14,
          letterSpacing: 0.1,
          flexShrink: 1,
          paddingTop: 1.5, // Correct vertical centering offset for custom fonts on web
          lineHeight: 18,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};
