import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks/useHaptics';

const TABS: Array<{
  name: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { name: 'index', label: 'Predictor', icon: 'analytics' },
  { name: 'live', label: 'Live', icon: 'live-tv' },
  { name: 'chat', label: 'BORO AI', icon: 'psychology' },
  { name: 'stats', label: 'Stats', icon: 'leaderboard' },
  { name: 'profile', label: 'Profile', icon: 'person' },
];

export default function TabsLayout() {
  const colors = useColors();
  const session = useAuthStore((s) => s.session);
  if (!session) return <Redirect href="/(auth)/intro" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
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

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        backgroundColor: 'rgba(32,31,31,0.6)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
      }}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <View
        style={{
          height: 60,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 8,
        }}
      >
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find((t) => t.name === route.name);
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
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.88 : 1 }],
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? colors.accent12 : 'transparent',
                  borderWidth: focused ? 1 : 0,
                  borderColor: colors.accent30,
                }}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={24}
                  color={focused ? colors.primaryFixed : colors.onSurfaceVariant}
                />
              </View>

            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
