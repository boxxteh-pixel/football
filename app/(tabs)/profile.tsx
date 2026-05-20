import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';
import { getPlainPassword } from '@/services/auth/localAuth';

export default function ProfileTab() {
  const colors = useColors();
  const session = useAuthStore((s) => s.session);
  const logOut = useAuthStore((s) => s.logOut);
  const favorites = useFavoritesStore();
  const settings = useSettingsStore((s) => s.settings);
  const haptics = useHaptics();
  const t = useT();
  const [revealPwd, setRevealPwd] = useState(false);
  const [storedPwd, setStoredPwd] = useState<string | null>(null);

  const user = session?.user;
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  useEffect(() => {
    if (!user) return;
    getPlainPassword(user.id).then(setStoredPwd);
  }, [user]);

  return (
    <ScreenContainer title="BORO" hideAvatar={true}>
      <View style={{ gap: 24 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
          {t('profile.title')}
        </Text>

        <GlassCard padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: colors.accent30,
                backgroundColor: colors.accent08,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 28 }}>
                {initial}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}
                numberOfLines={1}
              >
                {user?.name ?? 'Guest'}
              </Text>
              <Pressable
                onPress={() => {
                  haptics.light();
                  setRevealPwd((v) => !v);
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  marginTop: 2,
                })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="lock" size={14} color={colors.primaryFixed} />
                    <Text
                      style={{
                        color: colors.onSurfaceVariant,
                        fontFamily: fonts.body,
                        fontSize: 13,
                        letterSpacing: revealPwd ? 0.5 : 1.5,
                      }}
                      numberOfLines={1}
                    >
                      {revealPwd ? (storedPwd ?? '—') : '••••••••'}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={revealPwd ? 'visibility-off' : 'visibility'}
                    size={24}
                    color={colors.onSurfaceVariant}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={16}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ProfileStat label={t('profile.leagues')} value={settings.selectedLeagueIds.length} />
            <ProfileStat label={t('profile.favorites')} value={favorites.teams.length + favorites.fixtures.length} />
            <ProfileStat
              label={t('profile.memberSince')}
              value={
                user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                  : '—'
              }
            />
          </View>
        </GlassCard>

        <View style={{ gap: 16 }}>
          <SectionHeader title={t('profile.insights')} />
          <ActionRow
            icon="auto-awesome"
            label={t('profile.insights')}
            onPress={() => {
              haptics.light();
              router.push('/insights');
            }}
          />
        </View>

        <View style={{ gap: 16 }}>
          <SectionHeader title={t('profile.favorites')} />
          <ActionRow
            icon="favorite"
            label={t('profile.myFavorites')}
            value={`${favorites.teams.length + favorites.fixtures.length} ${t('tabs.leagues').toLowerCase()}`}
            onPress={() => router.push('/profile')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const ProfileStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        padding: 12,
        gap: 4,
      }}
    >
      <Text
        style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
      <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 16 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.onSurfaceVariant,
        fontFamily: fonts.label,
        fontSize: 11,
        letterSpacing: 1,
      }}
    >
      {title.toUpperCase()}
    </Text>
  );
};

interface ActionRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ icon, label, value, onPress }) => {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <GlassCard padding={16}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MaterialIcons name={icon} size={22} color={colors.primaryFixed} />
          <Text style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
            {label}
          </Text>
          {value ? (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
              {value}
            </Text>
          ) : null}
          <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
        </View>
      </GlassCard>
    </Pressable>
  );
};
