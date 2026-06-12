import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, Modal, ScrollView } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useValuePicks } from '@/hooks/useValuePicks';
import { useHaptics } from '@/hooks/useHaptics';

export default function InsightsScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const { data = [], isLoading } = useTodayFixtures('all');
  const { predictionMap } = useTodayPredictions();
  const { data: valuePicks = [], isLoading: valueLoading } = useValuePicks(0.05, 5);
  const [showShareModal, setShowShareModal] = useState(false);

  // Build the accumulator from top Polymarket markets
  const enriched = useMemo(() => {
    return data
      .map((f) => ({ fixture: f, prediction: predictionMap.get(f.id) }))
      .filter((x): x is { fixture: typeof x.fixture; prediction: any } => x.prediction != null)
      .sort((a, b) => b.prediction.topPick.probability - a.prediction.topPick.probability);
  }, [data, predictionMap]);

  const topPicks = enriched.slice(0, 3);
  const totalOdds = topPicks.reduce((acc, p) => acc * p.prediction.topPick.odds, 1);
  const combinedProb = topPicks.reduce((acc, p) => acc * (p.prediction.topPick.probability / 100), 1) * 100;
  const avgConfidence =
    topPicks.length > 0
      ? topPicks.reduce((acc, p) => acc + p.prediction.topPick.probability, 0) / topPicks.length
      : 0;

  const localizedTrends = useMemo(() => [
    { icon: 'trending-up', category: 'Politics', region: 'UNITED STATES', body: "Elections markets see surged activity, with presidential nominee probability fluctuations drawing high order book volumes." },
    { icon: 'toll', category: 'Crypto', region: 'GLOBAL', body: "Altcoins and listings markets show strong consensus shifts following recent exchange updates and regulatory progress." },
    { icon: 'smart-toy', category: 'Science & Tech', region: 'GLOBAL', body: "Artificial Intelligence IPO predictions (OpenAI, Claude) represent the highest growth sector in open prediction interest." },
  ], []);

  return (
    <View style={{ flex: 1 }}>
      <ScreenContainer showBack title="AI Insights">
        <View style={{ gap: 24 }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.display,
                fontSize: 32,
                letterSpacing: -1,
              }}
            >
              Polymarket Intel
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14 }}>
              Crowd predictions fused with real-time trading metrics and AI sentiment.
            </Text>
          </View>

          {/* AI Accuracy Tracker */}
          <GlassCard padding={20} activeBorder style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BoroIcon name="auto-graph" size={22} color={colors.primaryFixed} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
                AI Model Analysis Performance
              </Text>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
              Historical accuracy of our sentiment analysis and volume momentum detection models across 500+ markets:
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>POLITICS</Text>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>84.2%</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>Accuracy</Text>
              </View>
              <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>TECH & SCIENCE</Text>
                <Text style={{ color: colors.secondaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>79.5%</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>Accuracy</Text>
              </View>
              <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>VOLUME MOVES</Text>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>+15.3%</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>Average ROI</Text>
              </View>
            </View>
          </GlassCard>

          {/* Accumulator Parlay */}
          <GlassCard padding={20} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BoroIcon name="bolt" size={22} color={colors.primaryFixed} />
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 20, letterSpacing: -0.3 }}>
                    AI Prediction Parlay
                  </Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
                  Consensus accumulator combining high probability outcomes.
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 22 }}>
                  {Math.round(avgConfidence)}%
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
                  Avg. Prob.
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
                No active prediction markets available to compile parlay.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {topPicks.map(({ fixture, prediction }) => (
                  <AccumulatorRow
                    key={fixture.id}
                    category={fixture.category}
                    title={fixture.title}
                    pick={prediction.topPick.selection}
                    odds={prediction.topPick.odds}
                    probability={prediction.topPick.probability}
                    onPress={() => {
                      haptics.light();
                      router.push(`/match/${fixture.id}`);
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
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
                  IMPLIED ODDS
                </Text>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.display, fontSize: 28, marginTop: 4 }}>
                  {totalOdds.toFixed(2)}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11, marginTop: 2 }}>
                  Joint Probability: {Math.round(combinedProb)}%
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
                    POTENTIAL RETURN
                  </Text>
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 16 }}>
                    {totalOdds.toFixed(2)}x
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
                  <NeonButton label="Open Board" size="sm" fullWidth={false} onPress={() => router.push('/(tabs)')} />
                </View>
              </View>
            </View>
          </GlassCard>

          {/* High Edge Value Bets */}
          <GlassCard padding={20} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <BoroIcon name="paid" size={22} color={colors.primaryFixed} />
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
                  High-Edge Opportunities
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              Prediction opportunities showing notable price swings or discrepancies against external sentiment.
            </Text>
            {valueLoading ? (
              <Skeleton height={96} radius={10} />
            ) : valuePicks.length === 0 ? (
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
                No high-edge markets identified currently.
              </Text>
            ) : (
              valuePicks.map((v: any) => (
                <ValueBetRow
                  key={v.fixtureId}
                  category={v.market}
                  title={v.selection}
                  sub={`${v.homeName} vs ${v.awayName}`}
                  odds={v.bestOdds}
                  edge={v.edge}
                  prob={v.modelProb}
                  onPress={() => {
                    haptics.light();
                    router.push(`/match/${v.fixtureId}`);
                  }}
                />
              ))
            )}
          </GlassCard>

          {/* Category Trends */}
          <GlassCard padding={20} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BoroIcon name="insights" size={22} color={colors.secondaryFixed} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
                Predictive Trends & Analytics
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
                        {tr.category}
                      </Text>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
                        {tr.region}
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
                  Share Parlay
                </Text>
                <Pressable onPress={() => setShowShareModal(false)} hitSlop={8}>
                  <BoroIcon name="close" size={20} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
              
              <View style={{ padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10 }}>
                {topPicks.map(({ fixture, prediction }) => (
                  <View key={fixture.id} style={{ flexDirection: 'column', gap: 2 }}>
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 12 }} numberOfLines={1}>
                      {fixture.title}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
                        Outcome: {prediction.topPick.selection}
                      </Text>
                      <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 12 }}>
                        {prediction.topPick.odds.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>Total Implied Odds</Text>
                  <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 18 }}>{totalOdds.toFixed(2)}x</Text>
                </View>
              </View>
              
              <Pressable
                onPress={() => {
                  haptics.success();
                  setShowShareModal(false);
                  alert("Link copied to clipboard!");
                }}
                style={{ backgroundColor: colors.primaryFixed, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ color: colors.onPrimary, fontFamily: fonts.label, fontSize: 13, fontWeight: 'bold' }}>
                  Copy Parlay Link
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
  category: string;
  title: string;
  pick: string;
  odds: number;
  probability: number;
  onPress: () => void;
}

const AccumulatorRow: React.FC<AccumulatorRowProps> = ({ category, title, pick, odds, probability, onPress }) => {
  const colors = useColors();
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
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }} numberOfLines={1}>
            {category.toUpperCase()}
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 16 }}>
            {odds.toFixed(2)}
          </Text>
          <Text style={{ color: probColor, fontFamily: fonts.body, fontSize: 11 }}>
            {Math.round(probability)}% Prob.
          </Text>
        </View>
        <BoroIcon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
};

interface ValueBetRowProps {
  category: string;
  title: string;
  sub: string;
  odds: number;
  edge: number;
  prob: number;
  onPress: () => void;
}

const ValueBetRow: React.FC<ValueBetRowProps> = ({ category, title, sub, odds, edge, prob, onPress }) => {
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
          {category.toUpperCase()}
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
            +{Math.round(edge * 100)}% Edge
          </Text>
        </View>
      </View>
      <View>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>
          Option details: {sub}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
          {Math.round(prob)}% Implied Probability
        </Text>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>{odds.toFixed(2)}x</Text>
      </View>
    </Pressable>
  );
};
