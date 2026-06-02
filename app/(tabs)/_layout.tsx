import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsive } from '@/hooks/useResponsive';
import { useT } from '@/theme/i18n';

const TABS: Array<{
  name: string;
  labelKey: string;
  icon: string;
}> = [
  { name: 'index', labelKey: 'tabs.predictor', icon: 'analytics' },
  { name: 'live', labelKey: 'tabs.results', icon: 'history' },
  { name: 'chat', labelKey: 'tabs.chat', icon: 'psychology' },
  { name: 'profile', labelKey: 'tabs.profile', icon: 'person' },
];

export default function TabsLayout() {
  const colors = useColors();
  const session = useAuthStore((s) => s.session);
  const t = useT();
  if (!session) return <Redirect href="/(auth)/intro" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.labelKey) }} />
      ))}
    </Tabs>
  );
}

interface GlassTabBarProps {
  state: any;
  navigation: any;
}

const GlassTabBar: React.FC<GlassTabBarProps> = ({ state, navigation }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const t = useT();
  const { isDesktop } = useResponsive();

  // On desktop the persistent sidebar replaces the bottom tab bar entirely.
  if (isDesktop) return null;

  const isWeb = Platform.OS === 'web';
  const bg = isWeb ? 'rgba(28,27,26,0.45)' : 'rgba(28,27,26,0.32)';

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        backgroundColor: bg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.14)',
        overflow: 'hidden',
        position: 'relative',
        ...(isWeb
          ? ({ backdropFilter: 'blur(30px) saturate(180%) brightness(1.05)', WebkitBackdropFilter: 'blur(30px) saturate(180%) brightness(1.05)' } as any)
          : {}),
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      )}

      {/* Diagonal glass sheen */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bright top hairline highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      />
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 10,
        }}
      >
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find((tb) => tb.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              hitSlop={8}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  haptics.light();
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => ({
                flex: focused ? 1.4 : 1,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              {focused ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 22,
                    backgroundColor: colors.accent15,
                    borderWidth: 1,
                    borderColor: colors.accent30,
                  }}
                >
                  <BoroIcon name={tab.icon} size={22} color={colors.primaryFixed} />
                  <Text
                    style={{
                      color: colors.primaryFixed,
                      fontFamily: fonts.label,
                      fontSize: 13,
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BoroIcon name={tab.icon} size={24} color={colors.onSurfaceVariant} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
