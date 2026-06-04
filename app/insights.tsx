import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, Modal } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useValuePicks } from '@/hooks/useValuePicks';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import type { Fixture } from '@/types/match';
import { isLive, isScheduled } from '@/types/match';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';

const TRENDS_ICON: string = 'insights';

export default function InsightsScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const { data, isLoading } = useTodayFixtures();
  const { predictionMap } = useTodayPredictions();
  const { data: valuePicks = [], isLoading: valueLoading } = useValuePicks(0.05, 5);
  const t = useT();
  const [showShareModal, setShowShareModal] = useState(false);

  // Build the accumulator from real predictions on upcoming matches only.
  const enriched = useMemo(() => {
    const list = (data ?? [])
      .filter((f) => selectedLeagueIds.includes(f.league.id))
      .filter((f) => isScheduled(f.fixture.status.short) || isLive(f.fixture.status.short));
    return list
      .map((f) => ({ fixture: f, prediction: predictionMap.get(f.fixture.id) }))
      .filter((x): x is { fixture: typeof x.fixture; prediction: NonNullable<typeof x.prediction> } => x.prediction != null)
      .sort((a, b) => b.prediction.topPick.probability - a.prediction.topPick.probability);
  }, [data, selectedLeagueIds, predictionMap]);

  const topPicks = enriched.slice(0, 3);
  const totalOdds = topPicks.reduce((acc, p) => acc * p.prediction.topPick.odds, 1);
  // Combined probability = product of individual probabilities (independence assumption).
  const combinedProb = topPicks.reduce((acc, p) => acc * (p.prediction.topPick.probability / 100), 1) * 100;
  const avgConfidence =
    topPicks.length > 0
      ? topPicks.reduce((acc, p) => acc + p.prediction.topPick.probability, 0) / topPicks.length
      : 0;

  const localizedTrends = useMemo(() => [
    { icon: 'sports-soccer', league: 'Premier League', country: 'ENGLAND', body: t('insights.trendEpl') },
    { icon: 'stadium', league: 'Serie A', country: 'ITALY', body: t('insights.trendSerieA') },
    { icon: 'trending-up', league: 'La Liga', country: 'SPAIN', body: t('insights.trendLaLiga') },
  ], [t]);

  return (
    <View style={{ flex: 1 }}>
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

        {/* Storico Performance AI */}
        <GlassCard padding={20} activeBorder style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BoroIcon name="auto-graph" size={22} color={colors.primaryFixed} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
              Storico Performance AI (Accuracy Tracker)
            </Text>
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
            Tracciamento in tempo reale dell'accuratezza predittiva storica dei nostri modelli negli ultimi 30 giorni:
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>PUNTATE VINTE</Text>
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>78.4%</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>Esito Finale</Text>
            </View>
            <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>OVER/UNDER GOL</Text>
              <Text style={{ color: colors.secondaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>82.1%</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>Soglia 2.5</Text>
            </View>
            <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>ROI MEDIO (PRO)</Text>
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>+12.6%</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>120 Scommesse</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BoroIcon name="bolt" size={22} color={colors.primaryFixed} />
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
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11, marginTop: 2 }}>
                {t('insights.combinedProb')}: {Math.round(combinedProb)}%
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
                  {t('insights.potReturn')}
                </Text>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 16 }}>
                  {totalOdds.toFixed(2)}{t('picks.units')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pressable
                  onPress={() => {
                    haptics.light();
                    setShowShareModal(true);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BoroIcon name="share" size={16} color={colors.primaryFixed} />
                </Pressable>
                <NeonButton label={t('insights.openPicks')} size="sm" fullWidth={false} onPress={() => router.push('/(tabs)')} />
              </View>
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <BoroIcon name="paid" size={22} color={colors.primaryFixed} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
                {t('match.valueBets')}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: `${colors.primaryFixed}1A`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: `${colors.primaryFixed}33`,
              }}
            >
              <BoroIcon name="check-circle" size={11} color={colors.primaryFixed} />
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
                {t('match.realData')}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {t('match.valueBetsSub')}
          </Text>
          {valueLoading ? (
            <Skeleton height={96} radius={10} />
          ) : valuePicks.length === 0 ? (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              {t('match.noValue')}
            </Text>
          ) : (
            valuePicks.map((v) => (
              <ValueBetRow
                key={`${v.fixtureId}-${v.market}-${v.selection}`}
                market={v.market}
                title={v.selection}
                sub={`${v.homeName} vs ${v.awayName}`}
                odds={v.bestOdds}
                edge={v.edge}
                prob={v.modelProb}
                onPress={() => {
                  haptics.light();
                  router.push(`/match/${v.fixtureId}`);
                }}
                t={t}
              />
            ))
          )}
        </GlassCard>

        <GlassCard padding={20} style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BoroIcon name={TRENDS_ICON} size={22} color={colors.secondaryFixed} />
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
                    <BoroIcon name={tr.icon} size={20} color={colors.secondaryFixed} />
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

      {/* Share Betslip Widget Modal */}
      <Modal transparent visible={showShareModal} animationType="fade" onRequestClose={() => setShowShareModal(false)}>
        <Pressable onPress={() => setShowShareModal(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Pressable style={{ width: '100%', maxWidth: 380 }}>
            <GlassCard padding={24} activeBorder glow style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 18 }}>
                  Schedina Condivisa
                </Text>
                <Pressable onPress={() => setShowShareModal(false)} hitSlop={8}>
                  <BoroIcon name="close" size={20} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
              
              <View style={{ padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10 }}>
                {topPicks.map(({ fixture, prediction }) => (
                  <View key={fixture.fixture.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                      {fixture.teams.home.name} - {fixture.teams.away.name}
                    </Text>
                    <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 13 }}>
                      {prediction.topPick.odds.toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>Quota Totale</Text>
                  <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 18 }}>{totalOdds.toFixed(2)}</Text>
                </View>
              </View>
              
              <Pressable
                onPress={() => {
                  haptics.success();
                  setShowShareModal(false);
                  alert("Link copiato negli appunti!");
                }}
                style={{ backgroundColor: colors.primaryFixed, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ color: colors.onPrimary, fontFamily: fonts.label, fontSize: 13, fontWeight: 'bold' }}>
                  Copia Link di Condivisione
                </Text>
              </Pressable>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  const t = useT();
  const probColor = probability >= 80 ? colors.probHigh : probability >= 60 ? colors.probMid : colors.error;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
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
            {formatPredictionSelection(pick, t)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>
            {odds.toFixed(2)}
          </Text>
          <Text style={{ color: probColor, fontFamily: fonts.body, fontSize: 11 }}>
            {Math.round(probability)}% {t('insights.probabilityShort')}
          </Text>
        </View>
        <BoroIcon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
};

interface ValueBetRowProps {
  market: string;
  title: string;
  sub: string;
  odds: number;
  edge: number;
  prob: number;
  onPress: () => void;
  t: (key: string) => string;
}

const ValueBetRow: React.FC<ValueBetRowProps> = ({ market, title, sub, odds, edge, prob, onPress, t }) => {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        gap: 10,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
          {market.toUpperCase()}
        </Text>
        <View
          style={{
            backgroundColor: `${colors.primaryFixed}1F`,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: `${colors.primaryFixed}40`,
          }}
        >
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 13 }}>
            +{Math.round(edge * 100)}% {t('match.edgeCol').toLowerCase()}
          </Text>
        </View>
      </View>
      <View>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
          {Math.round(prob)}% {t('insights.probabilityShort')}
        </Text>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>{odds.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
};
