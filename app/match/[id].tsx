import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { useHaptics } from '@/hooks/useHaptics';
import { LiveScoreHero } from '@/components/match/LiveScoreHero';
import { LivePitch } from '@/components/match/LivePitch';
import { AIInsightCard } from '@/components/match/AIInsightCard';
import { StatComparison } from '@/components/match/StatComparison';
import { QuickBetSlip } from '@/components/match/QuickBetSlip';
import { MatchTimeline } from '@/components/match/MatchTimeline';
import { MarketIntelCard } from '@/components/match/MarketIntelCard';
import { SavePickButton } from '@/components/match/SavePickButton';
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
import { useLiveTracker } from '@/hooks/useLiveTracker';
import { useFixturePrediction } from '@/hooks/useFixturePrediction';
import { BoroPickFrame } from '@/components/match/BoroPickFrame';
import { useT } from '@/theme/i18n';
import { useFavoritesStore } from '@/store/favoritesStore';
import { computeMomentumWindows, computePressureSwing, extractStatNumber } from '@/services/ai/momentum';
import { isLive } from '@/types/match';
import { formatPredictionSelection, formatReasoningLine } from '@/utils/predictionText';

export default function MatchDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const t = useT();
  const haptics = useHaptics();
  const favorites = useFavoritesStore();
  const isFav = favorites.isFavorite('fixtures', id);
  const [activeMarketTab, setActiveMarketTab] = useState<'dc' | 'goals' | 'corners' | 'fh' | 'firstScore'>('dc');

  const { data: fixture, isLoading, refetch, isRefetching } = useFixture(id);
  const live = fixture ? isLive(fixture.fixture.status.short) : false;
  const { data: events = [] } = useFixtureEvents(id, live);
  const { data: stats = [] } = useFixtureStats(id, live);
  const { data: fullPrediction } = useFullPrediction(fixture ?? undefined);
  const { data: tracker } = useLiveTracker(fixture ?? undefined);
  const canonical = useFixturePrediction(fixture ?? undefined, { full: true });
  // SINGLE source of truth for everything shown on this page: the canonical
  // pick (same data the cards/Results use). Fall back to the richer ensemble
  // only when canonical insights aren't available yet.
  const prediction = canonical.prediction ?? fullPrediction;

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
  const confidenceKey = prediction
    ? ({
        ELITE: 'confidence.elite',
        HIGH: 'confidence.highShort',
        MEDIUM: 'confidence.mediumShort',
        LOW: 'confidence.lowShort',
      } as const)[prediction.confidence]
    : 'confidence.mediumShort';

  return (
    <ScreenContainer
      showBack
      title="BORO"
      showLive={live}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryFixed} />
      }
      rightSlot={
        <Pressable
          onPress={async () => {
            haptics.light();
            await favorites.toggle('fixtures', id);
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: 8,
            marginRight: -8,
          })}
        >
          <BoroIcon
            name={isFav ? 'favorite' : 'favorite-border'}
            size={24}
            color={isFav ? '#FF3B30' : colors.onSurfaceVariant}
            fill={isFav ? '#FF3B30' : 'none'}
          />
        </Pressable>
      }
    >
      <View style={{ gap: 20 }}>
        <LiveScoreHero fixture={fixture} momentumValues={momentumValues} pressureSwing={pressureSwing} />

        {live && (
          <LivePitch
            fixture={fixture}
            events={events}
            homePossession={homePoss || 0}
            awayPossession={awayPoss || 0}
            tracker={tracker}
          />
        )}

        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BoroIcon name="psychology" size={22} color={colors.primaryFixed} />
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

          {canonical.prediction && (
            <BoroPickFrame prediction={canonical.prediction} graded={canonical.graded} />
          )}

          {!prediction ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={100} radius={16} />
              <Skeleton height={100} radius={16} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Premium Trial Banner */}
              {prediction.source === 'HYBRID' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    backgroundColor: `${colors.primaryFixed}1A`,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${colors.primaryFixed}33`,
                    marginTop: -4,
                    marginBottom: 4,
                  }}
                >
                  <BoroIcon name="workspace-premium" size={14} color={colors.primaryFixed} />
                  <Text
                    style={{
                      color: colors.primaryFixed,
                      fontFamily: fonts.label,
                      fontSize: 10,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('match.proPowered')}
                  </Text>
                </View>
              )}

              <AIInsightCard
                label={t('match.matchResult')}
                title={
                  prediction.homeWinPct >= prediction.awayWinPct && prediction.homeWinPct >= prediction.drawPct
                    ? formatPredictionSelection(`${fixture.teams.home.name} to Win`, t)
                    : prediction.awayWinPct >= prediction.drawPct
                    ? formatPredictionSelection(`${fixture.teams.away.name} to Win`, t)
                    : t('prediction.draw')
                }
                subLabel={`${Math.round(Math.max(prediction.homeWinPct, prediction.drawPct, prediction.awayWinPct))}% ${t('match.confidence')}`}
                subIcon={null}
                probability={Math.max(prediction.homeWinPct, prediction.drawPct, prediction.awayWinPct)}
                accentLeft
                ringColor={colors.primaryFixed}
              />
              <AIInsightCard
                label={t('match.predictedScore')}
                title={`${prediction.predictedScore.home} - ${prediction.predictedScore.away}`}
                subLabel={`${t('match.over25')}: ${Math.round(prediction.over25Pct)}%`}
                subIcon="trending-up"
                probability={prediction.over25Pct}
                ringColor={colors.secondaryFixed}
              />
              <AIInsightCard
                label={t('match.btts')}
                title={prediction.bttsPct >= 50 ? t('match.yesLikely') : t('match.noUnlikely')}
                subLabel={`${t('match.xgTotal')}: ${(prediction.metrics.homeXg + prediction.metrics.awayXg).toFixed(2)}`}
                subIcon="analytics"
                probability={prediction.bttsPct}
              />

              {/* Top Correct Scores */}
              {prediction.correctScores && prediction.correctScores.length > 0 && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, letterSpacing: -0.3 }}>
                    {t('match.correctScores')}
                  </Text>
                  <GlassCard padding={16} style={{ gap: 10 }}>
                    {prediction.correctScores.slice(0, 5).map((scoreItem, idx) => (
                      <View key={idx} style={{ position: 'relative', height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', paddingHorizontal: 12 }}>
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${scoreItem.probability}%`, backgroundColor: idx === 0 ? `${colors.primaryFixed}33` : 'rgba(255, 255, 255, 0.08)' }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 15 }}>{scoreItem.score}</Text>
                          <Text style={{ color: idx === 0 ? colors.primaryFixed : colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 13 }}>{scoreItem.probability.toFixed(1)}%</Text>
                        </View>
                      </View>
                    ))}
                  </GlassCard>
                </View>
              )}

              {/* Advanced Pro Forecasts */}
              {(() => {
                const tabs = [];
                if (prediction.doubleChance) tabs.push({ id: 'dc', label: t('match.market.doubleChance') });
                if (prediction.overUnderGoals && prediction.overUnderGoals.length > 0) tabs.push({ id: 'goals', label: t('match.market.goals') });
                if (prediction.cornersOverUnder && prediction.cornersOverUnder.length > 0) tabs.push({ id: 'corners', label: t('match.market.corners') });
                if (prediction.halfTimeResult) tabs.push({ id: 'fh', label: t('match.market.halfTime') });
                if (prediction.teamToScoreFirst) tabs.push({ id: 'firstScore', label: t('match.market.firstGoal') });

                if (tabs.length === 0) return null;

                return (
                  <View style={{ gap: 12, marginTop: 8 }}>
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, letterSpacing: -0.3 }}>
                      {t('match.advancedForecasts')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                      {tabs.map((tab) => {
                        const active = activeMarketTab === tab.id;
                        return (
                          <Pressable
                            key={tab.id}
                            onPress={() => {
                              haptics.light();
                              setActiveMarketTab(tab.id as any);
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 7,
                              borderRadius: 18,
                              backgroundColor: active ? colors.primaryFixed : 'rgba(255,255,255,0.05)',
                              borderWidth: 1,
                              borderColor: active ? colors.primaryFixed : 'rgba(255,255,255,0.1)',
                            }}
                          >
                            <Text style={{ color: active ? colors.onPrimaryFixed : colors.onSurface, fontFamily: fonts.label, fontSize: 11 }}>
                              {tab.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <GlassCard padding={16} style={{ gap: 12 }}>
                      {activeMarketTab === 'dc' && prediction.doubleChance && (
                        <View style={{ gap: 10 }}>
                          <MarketRow label={t('match.homeDraw')} value={prediction.doubleChance.homeDraw} color={colors.primaryFixed} />
                          <MarketRow label={t('match.awayDraw')} value={prediction.doubleChance.awayDraw} color={colors.secondaryFixed} />
                          <MarketRow label={t('match.homeAway')} value={prediction.doubleChance.homeAway} color={colors.primaryFixed} />
                        </View>
                      )}

                      {activeMarketTab === 'goals' && prediction.overUnderGoals && (
                        <View style={{ gap: 10 }}>
                          {prediction.overUnderGoals.map((g, idx) => (
                            <MarketRow key={idx} label={g.label} value={g.probability} color={colors.primaryFixed} />
                          ))}
                        </View>
                      )}

                      {activeMarketTab === 'corners' && prediction.cornersOverUnder && (
                        <View style={{ gap: 10 }}>
                          {prediction.cornersOverUnder.map((c, idx) => (
                            <MarketRow key={idx} label={c.label} value={c.probability} color={colors.secondaryFixed} />
                          ))}
                        </View>
                      )}

                      {activeMarketTab === 'fh' && prediction.halfTimeResult && (
                        <View style={{ gap: 10 }}>
                          <MarketRow label={t('match.homeWinHt')} value={prediction.halfTimeResult.home} color={colors.primaryFixed} />
                          <MarketRow label={t('match.drawHt')} value={prediction.halfTimeResult.draw} color="rgba(255,255,255,0.4)" />
                          <MarketRow label={t('match.awayWinHt')} value={prediction.halfTimeResult.away} color={colors.secondaryFixed} />
                        </View>
                      )}

                      {activeMarketTab === 'firstScore' && prediction.teamToScoreFirst && (
                        <View style={{ gap: 10 }}>
                          <MarketRow label={t('match.homeScoresFirst')} value={prediction.teamToScoreFirst.home} color={colors.primaryFixed} />
                          <MarketRow label={t('match.awayScoresFirst')} value={prediction.teamToScoreFirst.away} color={colors.secondaryFixed} />
                          {prediction.teamToScoreFirst.draw > 0 && (
                            <MarketRow label={t('match.noGoalsDraw')} value={prediction.teamToScoreFirst.draw} color="rgba(255,255,255,0.4)" />
                          )}
                        </View>
                      )}
                    </GlassCard>
                  </View>
                );
              })()}
            </View>
          )}
        </View>

        {prediction && (
          <MarketIntelCard
            prediction={prediction}
            homeName={fixture.teams.home.name}
            awayName={fixture.teams.away.name}
          />
        )}

        {prediction && <SavePickButton fixture={fixture} prediction={prediction} />}

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
                    {formatReasoningLine(line, t)}
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
                <MetricChip label={t('match.homeElo')} value={prediction.metrics.homeElo} />
                <MetricChip label={t('match.awayElo')} value={prediction.metrics.awayElo} />
              </View>
            </GlassCard>
          </View>
        )}

        {prediction && (
          <QuickBetSlip
            options={[
              {
                label: prediction.over25Pct >= 50 ? t('match.over25') : t('match.under25'),
                odds: Number((100 / Math.max(prediction.over25Pct, prediction.under25Pct)).toFixed(2)),
                highlight: true,
              },
              {
                label: formatPredictionSelection(prediction.topPick.selection, t).trim() || t('match.result'),
                odds: prediction.topPick.odds,
              },
              {
                label: prediction.bttsPct >= 50 ? t('match.bttsYes') : t('match.bttsNo'),
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

const MarketRow: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 14 }}>{label}</Text>
        <Text style={{ color: color, fontFamily: fonts.stats, fontSize: 14 }}>{value.toFixed(1)}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${value}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
};
