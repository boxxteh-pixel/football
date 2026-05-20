import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import { config, hasApiKey } from '@/constants/config';
import { useEffect, useState } from 'react';
import { getQuota } from '@/services/api/client';
import { LOCALES, useT } from '@/theme/i18n';

export default function SettingsScreen() {
  const haptics = useHaptics();
  const colors = useColors();
  const settings = useSettingsStore((s) => s.settings);
  const toggleLeague = useSettingsStore((s) => s.toggleLeague);
  const setOddsFormat = useSettingsStore((s) => s.setOddsFormat);
  const setLiveNotifications = useSettingsStore((s) => s.setLiveNotifications);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const [quota, setQuota] = useState({ used: 0, date: '' });
  const t = useT();

  useEffect(() => {
    getQuota().then(setQuota);
  }, []);

  return (
    <ScreenContainer showBack title={t('settings.title')}>
      <View style={{ gap: 24 }}>
        <View>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 28, letterSpacing: -0.5 }}>
            {t('settings.title')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, marginTop: 4 }}>
            {t('settings.subtitle')}
          </Text>
        </View>

        <Section title={t('settings.leagues')}>
          <GlassCard padding={4}>
            {DEFAULT_LEAGUES.map((league, i) => {
              const active = settings.selectedLeagueIds.includes(league.id);
              return (
                <Pressable
                  key={league.id}
                  onPress={() => {
                    haptics.light();
                    toggleLeague(league.id);
                  }}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <MaterialIcons
                      name={league.isInternational ? 'public' : 'sports-soccer'}
                      size={22}
                      color={active ? colors.primaryFixed : colors.onSurfaceVariant}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                        {league.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.onSurfaceVariant,
                          fontFamily: fonts.label,
                          fontSize: 10,
                          letterSpacing: 0.5,
                        }}
                      >
                        {league.country.toUpperCase()}
                      </Text>
                    </View>
                    <Switch
                      value={active}
                      onValueChange={() => {
                        haptics.light();
                        toggleLeague(league.id);
                      }}
                      thumbColor={active ? colors.primaryFixed : '#666'}
                      trackColor={{ true: colors.accent40, false: 'rgba(255,255,255,0.1)' }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </GlassCard>
        </Section>

        <Section title={t('settings.preferences')}>
          <GlassCard padding={4}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                  {t('settings.liveNotifications')}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }}>
                  {t('settings.liveNotificationsDesc')}
                </Text>
              </View>
              <Switch
                value={settings.liveNotifications}
                onValueChange={(v) => {
                  haptics.light();
                  setLiveNotifications(v);
                }}
                thumbColor={settings.liveNotifications ? colors.primaryFixed : '#666'}
                trackColor={{ true: colors.accent40, false: 'rgba(255,255,255,0.1)' }}
              />
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                  {t('settings.oddsFormat')}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }}>
                  {settings.oddsFormat === 'decimal' ? 'Decimal (1.85)' : 'Fractional (17/20)'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  haptics.light();
                  setOddsFormat(settings.oddsFormat === 'decimal' ? 'fractional' : 'decimal');
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}
              >
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 12 }}>
                  {settings.oddsFormat.toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </Section>

        <Section title={t('settings.language')}>
          <GlassCard padding={4}>
            {LOCALES.map((loc, idx) => {
              const active = settings.language === loc.code;
              return (
                <React.Fragment key={loc.code}>
                  {idx > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}
                    />
                  )}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      setLanguage(loc.code);
                    }}
                    style={({ pressed }) => ({
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        height: 48,
                        backgroundColor: active ? colors.accent04 : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          marginRight: 12,
                        }}
                      >
                        {loc.flag}
                      </Text>
                      <Text
                        style={{
                          color: active ? colors.primaryFixed : colors.onSurface,
                          fontFamily: fonts.bodyBold,
                          fontSize: 14,
                          flex: 1,
                        }}
                      >
                        {loc.label}
                      </Text>
                      {active && (
                        <MaterialIcons name="check" size={20} color={colors.primaryFixed} />
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title={t('settings.colorTheme') || 'THEME'}>
          <GlassCard padding={4}>
            {(['green', 'purple'] as const).map((themeName, idx) => {
              const active = settings.colorTheme === themeName;
              const dotColor = themeName === 'green' ? '#c3f400' : '#a78bfa';
              const label = themeName === 'green' ? t('settings.green') : t('settings.purple');
              return (
                <React.Fragment key={themeName}>
                  {idx > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}
                    />
                  )}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      setColorTheme(themeName);
                    }}
                    style={({ pressed }) => ({
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        height: 48,
                        backgroundColor: active ? colors.accent04 : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: dotColor,
                          marginRight: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.2)',
                        }}
                      />
                      <Text
                        style={{
                          color: active ? colors.primaryFixed : colors.onSurface,
                          fontFamily: fonts.bodyBold,
                          fontSize: 14,
                          flex: 1,
                        }}
                      >
                        {label}
                      </Text>
                      {active && (
                        <MaterialIcons name="check" size={20} color={colors.primaryFixed} />
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title={t('settings.apiStatus')}>
          <GlassCard padding={16} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: hasApiKey() ? colors.primaryFixed : colors.error,
                }}
              />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                {hasApiKey() ? t('settings.apiConnected') : t('settings.apiMissing')}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
                  {t('settings.quotaToday')}
                </Text>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 14 }}>
                  {quota.used} / {config.app.dailyQuota}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.min(100, (quota.used / config.app.dailyQuota) * 100)}%`,
                    height: '100%',
                    backgroundColor: colors.primaryFixed,
                  }}
                />
              </View>
            </View>
          </GlassCard>
        </Section>

        <Section title={t('settings.about')}>
          <GlassCard padding={16} style={{ gap: 4 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>BORO</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
              {t('settings.about.version')}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 8 }}>
              {t('settings.about.disclaimer')}
            </Text>
          </GlassCard>
        </Section>
      </View>
    </ScreenContainer>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1 }}>
        {title}
      </Text>
      {children}
    </View>
  );
};
