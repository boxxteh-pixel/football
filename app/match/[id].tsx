import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiveScoreHero } from '@/components/match/LiveScoreHero';
import { AIInsightCard } from '@/components/match/AIInsightCard';
import { StatComparison } from '@/components/match/StatComparison';
import { QuickBetSlip } from '@/components/match/QuickBetSlip';
import { MatchTimeline } from '@/components/match/MatchTimeline';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import {
  useFixture,
  useFixtureEvents,
  useFixtureStats,
} from '@/hooks/useFixtures';
import { useFullPrediction } from '@/hooks/usePrediction';
import { useT } from '@/theme/i18n';
import { computeMomentumWindows, computePressureSwing, extractStatNumber } from '@/services/ai/momentum';
import { isLive } from '@/types/match';

export default function MatchDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const t = useT();

  const { data: fixture, isLoading, refetch, isRefetching } = useFixture(id);
  const live = fixture ? isLive(fixture.fixture.status.short) : false;
  const { data: events = [] } = useFixtureEvents(id, live);
  const { data: stats = [] } = useFixtureStats(id, live);
  const { data: prediction } = useFullPrediction(fixture ?? undefined);

  const momentumValues = useMemo(() => {
    if (!fixture) return Array(15).fill(0.4);
    const windows = computeMomentumWindows(events, fixture.teams.home.id, 6, 90);
    return windows.map((w) => Math.max(0.15, w.homePressure));
  }, [events, fixture]);

  const pressureSwing = useMemo(() => {
    if (!fixture) return 0;
    return computePressureSwing(events, fixture.teams.home.id, 10, fixture.fixture.status.elapsed ?? 90);
  }, [events, fixture]);

  if (isLoading || !fixture) {
    return (
      <ScreenContainer showBack title={t('common.loading')}>
        <View style={{ gap: 16, paddingTop: 12 }}>
          <Skeleton height={220} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </ScreenContainer>
    );
  }

  const homePoss = extractStatNumber(stats, fixture.teams.home.id, 'Ball Possession');
  const awayPoss = extractStatNumber(stats, fixture.teams.away.id, 'Ball Possession');
  const homeShots = extractStatNumber(stats, fixture.teams.home.id, 'Total Shots');
  const awayShots = extractStatNumber(stats, fixture.teams.away.id, 'Total Shots');
  const homeXgRaw = extractStatNumber(stats, fixture.teams.home.id, 'expected_goals');
  const awayXgRaw = extractStatNumber(stats, fixture.teams.away.id, 'expected_goals');
  const homeXg = homeXgRaw || prediction?.metrics.homeXg || 0;
  const awayXg = awayXgRaw || prediction?.metrics.awayXg || 0;

  const possessionTotal = (homePoss || 0) + (awayPoss || 0);
  const possessionPct = possessionTotal > 0 ? (homePoss / possessionTotal) * 100 : 50;
  const xgTotal = homeXg + awayXg;
  const xgPct = xgTotal > 0 ? (homeXg / xgTotal) * 100 : 50;

  return (
    <ScreenContainer
      showBack
      title="BORO"
      showLive={live}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryFixed} />
      }
    >
      <View style={{ gap: 20 }}>
        <LiveScoreHero fixture={fixture} momentumValues={momentumValues} pressureSwing={pressureSwing} />

        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="psychology" size={22} color={colors.primaryFixed} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.headlineMd,
                fontSize: 20,
                letterSpacing: -0.3,
              }}
            >
              {t('match.aiInsights')}
            </Text>
          </View>

          {!prediction ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={100} radius={16} />
              <Skeleton height={100} radius={16} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <AIInsightCard
                label={t('match.matchResult')}
                title={prediction.topPick.selection}
                subLabel={`${prediction.confidence.toLowerCase()} confidence`}
                subIcon={null}
                probability={prediction.topPick.probability}
                accentLeft
                ringColor={colors.primaryFixed}
              />
              <AIInsightCard
                label={t('match.predictedScore')}
                title={`${prediction.predictedScore.home} - ${prediction.predictedScore.away}`}
                subLabel={`Over 2.5: ${Math.round(prediction.over25Pct)}%`}
                subIcon="trending-up"
                probability={prediction.over25Pct}
                ringColor={colors.secondaryFixed}
              />
              <AIInsightCard
                label={t('match.btts')}
                title={prediction.bttsPct >= 50 ? 'Yes — Likely' : 'No — Unlikely'}
                subLabel={`xG total: ${(prediction.metrics.homeXg + prediction.metrics.awayXg).toFixed(2)}`}
                subIcon="analytics"
                probability={prediction.bttsPct}
              />
            </View>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }}>
            {t('match.liveStats')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatComparison
              label={t('match.possession')}
              home={`${Math.round(homePoss || 50)}%`}
              away={`${Math.round(awayPoss || 50)}%`}
              homePercent={possessionPct}
            />
            <StatComparison
              label={t('match.xg')}
              home={homeXg.toFixed(2)}
              away={awayXg.toFixed(2)}
              homePercent={xgPct}
            />
          </View>
          {homeShots > 0 || awayShots > 0 ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <StatComparison
                label={t('match.totalShots')}
                home={homeShots}
                away={awayShots}
                homePercent={(homeShots / Math.max(1, homeShots + awayShots)) * 100}
              />
              <StatComparison
                label={t('match.shotsOnTarget')}
                home={extractStatNumber(stats, fixture.teams.home.id, 'Shots on Goal')}
                away={extractStatNumber(stats, fixture.teams.away.id, 'Shots on Goal')}
                homePercent={50}
              />
            </View>
          ) : null}
        </View>

        {prediction && prediction.reasoning.length > 0 && (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.headlineMd,
                  fontSize: 18,
                  letterSpacing: -0.3,
                  flexShrink: 1,
                }}
              >
                {t('match.aiReasoning')}
              </Text>
              <ConfidenceBadge tier={prediction.confidence} />
            </View>
            <GlassCard padding={16} style={{ gap: 10 }}>
              {prediction.reasoning.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.primaryFixed,
                      marginTop: 7,
                    }}
                  />
                  <Text
                    style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}
                  >
                    {line}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  marginTop: 8,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.05)',
                  flexDirection: 'row',
                  gap: 16,
                }}
              >
                <MetricChip label="HOME ELO" value={prediction.metrics.homeElo} />
                <MetricChip label="AWAY ELO" value={prediction.metrics.awayElo} />
              </View>
            </GlassCard>
          </View>
        )}

        {prediction && (
          <QuickBetSlip
            options={[
              {
                label: prediction.over25Pct >= 50 ? 'Over 2.5' : 'Under 2.5',
                odds: Number((100 / Math.max(prediction.over25Pct, prediction.under25Pct)).toFixed(2)),
                highlight: true,
              },
              {
                label: prediction.topPick.selection.replace('to Win', '').trim() || 'Result',
                odds: prediction.topPick.odds,
              },
              {
                label: prediction.bttsPct >= 50 ? 'BTTS - Yes' : 'BTTS - No',
                odds: Number((100 / Math.max(prediction.bttsPct, 100 - prediction.bttsPct)).toFixed(2)),
              },
            ]}
          />
        )}

        {events.length > 0 && <MatchTimeline events={events} homeTeamId={fixture.teams.home.id} />}
      </View>
    </ScreenContainer>
  );
}

const MetricChip: React.FC<{ label: string; value: number | string }> = ({ label, value }) => {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 9,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 16, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
};
