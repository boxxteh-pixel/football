import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import { LOCALES, useT } from '@/theme/i18n';

const RISK_PROFILES = ['default', 'conservative', 'aggressive'] as const;
const COLOR_THEMES = ['green', 'purple'] as const;

export default function SettingsScreen() {
  const haptics = useHaptics();
  const colors = useColors();
  const settings = useSettingsStore((s) => s.settings);
  const toggleLeague = useSettingsStore((s) => s.toggleLeague);
  const setOddsFormat = useSettingsStore((s) => s.setOddsFormat);
  const setLiveNotifications = useSettingsStore((s) => s.setLiveNotifications);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const t = useT();

  return (
    <ScreenContainer showBack title={t('settings.title')}>
      <View style={{ gap: 24 }}>
        <View>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 28, letterSpacing: -0.5 }}>
            {t('settings.title')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, marginTop: 4 }}>
            Customize your predictor platform.
          </Text>
        </View>

        <Section title="ACTIVE CATEGORIES">
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
                    <Text style={{ fontSize: 20 }}>{league.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                        {league.name}
                      </Text>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
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
                  Receive notifications on sudden odds shifts and results.
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

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />

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
                  {settings.oddsFormat === 'decimal'
                    ? `${t('settings.decimal')} (1.85)`
                    : `${t('settings.fractional')} (17/20)`}
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

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />

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
                  Extreme Night (OLED)
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }}>
                  Turn off background blur to optimize OLED screen battery.
                </Text>
              </View>
              <Switch
                value={settings.oledMode}
                onValueChange={(v) => {
                  haptics.light();
                  useSettingsStore.getState().setOledMode(v);
                }}
                thumbColor={settings.oledMode ? colors.primaryFixed : '#666'}
                trackColor={{ true: colors.accent40, false: 'rgba(255,255,255,0.1)' }}
              />
            </View>
          </GlassCard>
        </Section>

        <Section title="AI RISK PROFILE">
          <GlassCard padding={4}>
            {RISK_PROFILES.map((profile, idx) => {
              const active = settings.riskProfile === profile || (profile === 'default' && !settings.riskProfile);
              const label = profile === 'default' ? 'Default (Balanced)' : profile === 'conservative' ? 'Conservative (High Certainty)' : 'Aggressive (Value Seek)';
              const sub = profile === 'default' ? 'AI predictions balanced with standard consensus.' : profile === 'conservative' ? 'Prioritizes high consensus (>80% probability) markets.' : 'Highlights speculative options with high edge.';
              return (
                <React.Fragment key={profile}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      useSettingsStore.getState().setRiskProfile(profile);
                    }}
                    style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: active ? colors.accent04 : 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: active ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
                        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11, marginTop: 2 }}>{sub}</Text>
                      </View>
                      {active && <BoroIcon name="check" size={20} color={colors.primaryFixed} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title={t('settings.language')}>
          <GlassCard padding={4}>
            {LOCALES.map((loc, idx) => {
              const active = settings.language === loc.code;
              return (
                <React.Fragment key={loc.code}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
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
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{loc.flag}</Text>
                      <Text style={{ color: active ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14, flex: 1 }}>
                        {loc.label}
                      </Text>
                      {active && <BoroIcon name="check" size={20} color={colors.primaryFixed} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title="COLOR THEME">
          <GlassCard padding={4}>
            {COLOR_THEMES.map((themeName, idx) => {
              const active = settings.colorTheme === themeName;
              const dotColor = themeName === 'green' ? '#c3f400' : '#a78bfa';
              const label = themeName === 'green' ? t('settings.green') : t('settings.purple');
              return (
                <React.Fragment key={themeName}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
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
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dotColor, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                      <Text style={{ color: active ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14, flex: 1 }}>
                        {label}
                      </Text>
                      {active && <BoroIcon name="check" size={20} color={colors.primaryFixed} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title="API STATUS">
          <GlassCard padding={16} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryFixed }} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                Polymarket API — Connected
              </Text>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 }}>
              Gamma API is public and free of charge. No keys or signatures required.
            </Text>
          </GlassCard>
        </Section>

        <Section title={t('settings.about')}>
          <GlassCard padding={16} style={{ gap: 4 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>BORO AI Predictor</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
              {t('settings.about.version')}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 8 }}>
              Predictions represent crowd sentiment and contract pricing on Polymarket. Entertainment only.
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
