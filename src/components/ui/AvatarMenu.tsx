import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';

export const AvatarMenu: React.FC = () => {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const logOut = useAuthStore((s) => s.logOut);
  const haptics = useHaptics();
  const t = useT();

  const initial = session?.user.name?.[0]?.toUpperCase() ?? 'B';

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
          transform: [{ scale: pressed ? 0.92 : 1 }],
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.accent40,
            backgroundColor: colors.accent08,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 15 }}>
            {initial}
          </Text>
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
                  SIGNED IN AS
                </Text>
                <Text
                  style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {session?.user.name ?? 'Guest'}
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
  icon: keyof typeof MaterialIcons.glyphMap;
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
        <MaterialIcons name={icon} size={20} color={danger ? colors.error : colors.primaryFixed} />
      </View>
    </Pressable>
  );
};
