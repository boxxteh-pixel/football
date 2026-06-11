import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { useSettingsStore } from '@/store/settingsStore';
import { useLearningStore } from '@/store/learningStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useRateLimit } from '@/hooks/useRateLimit';
import { config, hasApiKey } from '@/constants/config';
import { useEffect, useState } from 'react';
import { LOCALES, useT } from '@/theme/i18n';

const RISK_PROFILES = ['default', 'conservative', 'aggressive'] as const;
const NEWS_FREQUENCIES = ['always', 'daily', 'off'] as const;
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
  const rateLimit = useRateLimit();
  const t = useT();

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

        <Section title="SPORT">
          <GlassCard padding={4}>
            {(['football', 'cricket'] as const).map((sport, idx) => {
              const active = settings.sport === sport || (sport === 'football' && !settings.sport);
              const label = sport === 'football' ? '⚽  Football' : '🏏  Cricket';
              const sub = sport === 'football'
                ? 'Serie A, Premier League, Champions League e tutti i campionati.'
                : 'IPL, T20 World Cup, ODI, Test matches e campionati internazionali.';
              return (
                <React.Fragment key={sport}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      useSettingsStore.getState().setSport(sport);
                    }}
                    style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: active ? colors.accent04 : 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: active ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 15 }}>{label}</Text>
                        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11, marginTop: 3 }}>{sub}</Text>
                      </View>
                      {active && <BoroIcon name="check" size={20} color={colors.primaryFixed} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

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
                    <BoroIcon
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
                  Notte Estrema (OLED)
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }}>
                  Spegni completamente lo sfondo per la massima durata di batteria su schermi OLED.
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

        <Section title="CALIBRO DEL RISCHIO AI">
          <GlassCard padding={4}>
            {RISK_PROFILES.map((profile, idx) => {
              const active = settings.riskProfile === profile || (profile === 'default' && !settings.riskProfile);
              const label = profile === 'default' ? 'Default (Bilanciato)' : profile === 'conservative' ? 'Prudente (Massima Sicurezza)' : 'Aggressivo (Value Odds)';
              const sub = profile === 'default' ? 'I pronostici standard calibrati dall\'algoritmo.' : profile === 'conservative' ? 'Predilige partite ad altissima probabilità (>80%) ed ELITE.' : 'Cerca quote di valore e potenziali sbilanciamenti di mercato.';
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

        <Section title="FUSO ORARIO">
          <GlassCard padding={4}>
            {['Europe/Rome', 'Europe/London', 'America/New_York'].map((tz, idx) => {
              const active = settings.timezone === tz || (tz === 'Europe/Rome' && !settings.timezone);
              const label = tz === 'Europe/Rome' ? 'Italia (Europe/Rome - default)' : tz === 'Europe/London' ? 'Regno Unito (GMT/BST)' : 'Stati Uniti Est (EST/EDT)';
              return (
                <React.Fragment key={tz}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      useSettingsStore.getState().setTimezone(tz);
                    }}
                    style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: active ? colors.accent04 : 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: active ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
                      {active && <BoroIcon name="check" size={20} color={colors.primaryFixed} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Section>

        <Section title="FEED NOTIZIE AI">
          <GlassCard padding={4}>
            {NEWS_FREQUENCIES.map((freq, idx) => {
              const active = settings.newsFrequency === freq || (freq === 'always' && !settings.newsFrequency);
              const label = freq === 'always' ? 'Sempre Attivo' : freq === 'daily' ? 'Solo Sommario Giornaliero' : 'Disattivato';
              const sub = freq === 'always' ? 'Aggiornamenti in tempo reale su infortuni, squalifiche e news tattiche.' : freq === 'daily' ? 'Ricevi un unico report quotidiano al mattino.' : 'Nessuna notizia o notifica sul feed notizie.';
              return (
                <React.Fragment key={freq}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      useSettingsStore.getState().setNewsFrequency(freq);
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
                        <BoroIcon name="check" size={20} color={colors.primaryFixed} />
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
            {COLOR_THEMES.map((themeName, idx) => {
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
                        <BoroIcon name="check" size={20} color={colors.primaryFixed} />
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
                  {t('settings.callsUsed')}
                </Text>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 14 }}>
                  {rateLimit.limit != null
                    ? `${(rateLimit.used ?? 0).toLocaleString()} / ${rateLimit.limit.toLocaleString()}`
                    : t('settings.unlimitedPro')}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${rateLimit.usedPct != null ? Math.max(2, Math.min(100, rateLimit.usedPct)) : (hasApiKey() ? 4 : 0)}%`,
                    height: '100%',
                    backgroundColor: (rateLimit.usedPct ?? 0) > 85 ? colors.error : colors.primaryFixed,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
                  {t('settings.callsRemaining')}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 12 }}>
                  {rateLimit.remaining != null ? rateLimit.remaining.toLocaleString() : '—'}
                </Text>
              </View>
              {rateLimit.resetsInSeconds != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
                    {t('settings.resetsIn')}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 12 }}>
                    {Math.floor(rateLimit.resetsInSeconds / 60)}m {rateLimit.resetsInSeconds % 60}s
                  </Text>
                </View>
              )}
            </View>
          </GlassCard>
        </Section>

        {/* ── AI Model Accuracy ── */}
        <AIAccuracySection />

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

const AIAccuracySection: React.FC = () => {
  const colors = useColors();
  const haptics = useHaptics();
  const learning = useLearningStore((s) => s);
  const [resetting, setResetting] = useState(false);

  const total = learning.totalPredictionsAnalyzed;
  const correct = learning.correctPredictionsCount;
  const rate = total > 0 ? Math.round((correct / total) * 100) : null;

  const biases = [
    { label: 'ELO', value: learning.eloBias, icon: 'leaderboard' },
    { label: 'Poisson', value: learning.poissonBias, icon: 'scatter-plot' },
    { label: 'Form', value: learning.formBias, icon: 'trending-up' },
  ] as const;

  const handleReset = async () => {
    haptics.light();
    setResetting(true);
    await learning.resetLearning();
    setResetting(false);
  };

  // Ring chart approximation using View borders
  const ringSize = 100;
  const pct = rate ?? 0;
  const ringColor = pct >= 65 ? colors.primaryFixed : pct >= 50 ? '#EAB308' : '#EF4444';

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1 }}>
        MODELLO AI
      </Text>
      <GlassCard padding={16} style={{ gap: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BoroIcon name="psychology" size={18} color={colors.primaryFixed} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 15 }}>
            Accuratezza Predizioni
          </Text>
        </View>

        {total === 0 ? (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }}>
            Nessuna predizione registrata. Il modello impara automaticamente dai risultati delle partite finite.
          </Text>
        ) : (
          <View style={{ gap: 14 }}>
            {/* Win rate */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              {/* Big percentage */}
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                borderWidth: 4, borderColor: ringColor,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: `${ringColor}15`,
              }}>
                <Text style={{ color: ringColor, fontFamily: fonts.display, fontSize: 22 }}>
                  {rate}%
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                  {correct} / {total} corrette
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
                  Predizioni analizzate
                </Text>
                <View style={{
                  alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 6, backgroundColor: `${ringColor}22`,
                }}>
                  <Text style={{ color: ringColor, fontFamily: fonts.label, fontSize: 10 }}>
                    {pct >= 65 ? '✅ OTTIMO' : pct >= 50 ? '⚡ BUONO' : '📊 IN APPRENDIMENTO'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bias indicators */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 1 }}>
                BIAS COMPONENTI
              </Text>
              {biases.map((b) => {
                const bias = b.value;
                const barPct = Math.min(100, Math.abs(bias) / 0.15 * 50 + 50);
                const bColor = bias > 0.02 ? colors.primaryFixed : bias < -0.02 ? '#EF4444' : colors.onSurfaceVariant;
                return (
                  <View key={b.label} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>{b.label}</Text>
                      <Text style={{ color: bColor, fontFamily: fonts.stats, fontSize: 11 }}>
                        {bias > 0 ? '+' : ''}{(bias * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <View style={{ width: `${barPct}%`, height: '100%', backgroundColor: bColor, opacity: 0.7 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Reset button */}
        {total > 0 && (
          <Pressable
            onPress={handleReset}
            disabled={resetting}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 10, borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              opacity: resetting ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <BoroIcon name="restart-alt" size={16} color={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 13 }}>
              Reset modello
            </Text>
          </Pressable>
        )}
      </GlassCard>
    </View>
  );
};
