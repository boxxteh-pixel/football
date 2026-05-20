import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { quickPredict } from '@/services/ai/predictor';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import type { Fixture } from '@/types/match';
import { useT } from '@/theme/i18n';

const TRENDS_ICON: keyof typeof MaterialIcons.glyphMap = 'insights';

export default function InsightsScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const { data, isLoading } = useTodayFixtures();
  const t = useT();

  const enriched = useMemo(() => {
    const list = (data ?? []).filter((f) => selectedLeagueIds.includes(f.league.id));
    return list
      .map((f) => ({ fixture: f, prediction: quickPredict(f) }))
      .sort((a, b) => b.prediction.topPick.probability - a.prediction.topPick.probability);
  }, [data, selectedLeagueIds]);

  const topPicks = enriched.slice(0, 3);
  const totalOdds = topPicks.reduce((acc, p) => acc * p.prediction.topPick.odds, 1);
  const avgConfidence =
    topPicks.length > 0
      ? topPicks.reduce((acc, p) => acc + p.prediction.topPick.probability, 0) / topPicks.length
      : 0;

  const valueAlerts = useMemo(() => {
    return enriched
      .filter((p) => p.prediction.topPick.probability >= 38 && p.prediction.topPick.probability <= 55)
      .slice(0, 3);
  }, [enriched]);

  const localizedTrends = useMemo(() => [
    { icon: 'sports-soccer', league: 'Premier League', country: 'ENGLAND', body: t('insights.trendEpl') },
    { icon: 'stadium', league: 'Serie A', country: 'ITALY', body: t('insights.trendSerieA') },
    { icon: 'trending-up', league: 'La Liga', country: 'SPAIN', body: t('insights.trendLaLiga') },
  ], [t]);

  return (
    <ScreenContainer showBack title={t('profile.insights')}>
      <View style={{ gap: 24 }}>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.onSurface,
              fontFamily: fonts.display,
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            {t('insights.title')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14 }}>
            {t('insights.subtitle')}
          </Text>
        </View>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="bolt" size={22} color={colors.primaryFixed} />
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 20, letterSpacing: -0.3 }}>
                  {t('predictor.accumulator')}
                </Text>
              </View>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
                {t('insights.accSubtitle')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 22 }}>
                {Math.round(avgConfidence)}%
              </Text>
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.label,
                  fontSize: 9,
                  letterSpacing: 0.5,
                }}
              >
                {t('insights.modelConfidence')}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={66} radius={10} />
              ))}
            </View>
          ) : topPicks.length === 0 ? (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              {t('insights.noData')}
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {topPicks.map(({ fixture, prediction }) => (
                <AccumulatorRow
                  key={fixture.fixture.id}
                  league={fixture.league.name}
                  pick={prediction.topPick.selection}
                  odds={prediction.topPick.odds}
                  probability={prediction.topPick.probability}
                  onPress={() => {
                    haptics.light();
                    router.push(`/match/${fixture.fixture.id}`);
                  }}
                />
              ))}
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.08)',
              paddingTop: 16,
            }}
          >
            <View>
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.label,
                  fontSize: 10,
                  letterSpacing: 0.5,
                }}
              >
                {t('insights.totalOdds')}
              </Text>
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 28, marginTop: 4 }}>
                {totalOdds.toFixed(2)}
              </Text>
            </View>
            <NeonButton label={t('insights.openPicks')} size="sm" fullWidth={false} onPress={() => router.push('/(tabs)')} />
          </View>
        </GlassCard>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="warning" size={22} color={colors.error} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
              {t('insights.highRiskTitle')}
            </Text>
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {t('insights.highRiskSubtitle')}
          </Text>
          {isLoading ? (
            <Skeleton height={96} radius={10} />
          ) : valueAlerts.length === 0 ? (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              {t('insights.noValue')}
            </Text>
          ) : (
            valueAlerts.map(({ fixture, prediction }) => (
              <ValueAlertRow
                key={fixture.fixture.id}
                tag={prediction.confidence === 'MEDIUM' ? t('insights.valueAlert') : t('insights.anomaly')}
                title={prediction.topPick.selection}
                sub={`${fixture.teams.home.name} vs ${fixture.teams.away.name}`}
                odds={prediction.topPick.odds}
                implied={prediction.topPick.probability}
                onPress={() => router.push(`/match/${fixture.fixture.id}`)}
                t={t}
              />
            ))
          )}
        </GlassCard>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name={TRENDS_ICON} size={22} color={colors.secondaryFixed} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
              {t('insights.trendsTitle')}
            </Text>
          </View>
          <View style={{ gap: 12 }}>
            {localizedTrends.map((tr, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  padding: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons name={tr.icon as keyof typeof MaterialIcons.glyphMap} size={20} color={colors.secondaryFixed} />
                  </View>
                  <View>
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                      {tr.league}
                    </Text>
                    <Text
                      style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}
                    >
                      {tr.country}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 }}>
                  {tr.body}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </View>
    </ScreenContainer>
  );
}

interface AccumulatorRowProps {
  league: string;
  pick: string;
  odds: number;
  probability: number;
  onPress: () => void;
}

const AccumulatorRow: React.FC<AccumulatorRowProps> = ({ league, pick, odds, probability, onPress }) => {
  const colors = useColors();
  const probColor = probability >= 80 ? colors.probHigh : probability >= 60 ? colors.probMid : colors.error;
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: probColor }} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {league.toUpperCase()}
          </Text>
          <Text
            style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}
            numberOfLines={1}
          >
            {pick}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>
          {odds.toFixed(2)}
        </Text>
        <Text style={{ color: probColor, fontFamily: fonts.body, fontSize: 11 }}>
          {Math.round(probability)}% prob
        </Text>
      </View>
    </View>
  );
};

interface ValueAlertRowProps {
  tag: string;
  title: string;
  sub: string;
  odds: number;
  implied: number;
  onPress: () => void;
  t: (key: string) => string;
}

const ValueAlertRow: React.FC<ValueAlertRowProps> = ({ tag, title, sub, odds, implied, onPress, t }) => {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ color: colors.error, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
          {tag.toUpperCase()}
        </Text>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>{odds.toFixed(2)}</Text>
      </View>
      <View>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 5, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <View
            style={{
              width: `${Math.min(100, implied)}%`,
              height: '100%',
              backgroundColor: colors.error,
              borderRadius: 9999,
            }}
          />
        </View>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
          {Math.round(implied)}% {t('insights.implied')}
        </Text>
      </View>
    </View>
  );
};
