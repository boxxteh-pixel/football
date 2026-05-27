import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { MomentumIndexCard } from '@/components/stats/MomentumIndexCard';
import { XgEloBento } from '@/components/stats/XgEloBento';
import { StandingsTable } from '@/components/stats/StandingsTable';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { useStandings } from '@/hooks/useFixtures';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';

/**
 * Reorder the actual standings into a model-predicted final position.
 */
const computeModelPositions = (
  rows: Array<{
    team: { id: number };
    rank: number;
    points: number;
    goalsDiff: number;
    form?: string;
    all: { played: number };
  }>,
): Map<number, number> => {
  const scored = rows.map((row) => {
    const ppg = row.all.played > 0 ? row.points / row.all.played : 0;
    const formChars = (row.form ?? '').slice(-5).split('');
    const formScore =
      formChars.reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) / 15;
    const score = ppg * 0.6 + formScore * 0.3 + row.goalsDiff * 0.005;
    return { teamId: row.team.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const map = new Map<number, number>();
  scored.forEach((s, idx) => map.set(s.teamId, idx + 1));
  return map;
};

export default function StatsTab() {
  const colors = useColors();
  const haptics = useHaptics();
  const [leagueId, setLeagueId] = useState<number>(DEFAULT_LEAGUES[0].id);
  const league = DEFAULT_LEAGUES.find((l) => l.id === leagueId);
  const { data: standings, isLoading } = useStandings(leagueId);
  const t = useT();

  const aiPositions = useMemo(
    () => (standings ? computeModelPositions(standings) : new Map()),
    [standings],
  );

  const momentumBars = useMemo(() => {
    if (!standings || standings.length === 0) return [0.4, 0.6, 0.5, 0.9, 0.75, 0.3, 0.15, 0.45, 0.85, 1];
    const top = standings[0];
    const ppg = top.all.played > 0 ? top.points / top.all.played : 1;
    const seed = top.team.id;
    const arr = Array.from({ length: 10 }, (_, i) => {
      const noise = ((seed * (i + 1)) % 50) / 50;
      return Math.max(0.15, Math.min(1, ppg / 3 + noise * 0.4));
    });
    return arr;
  }, [standings]);

  const topTeam = standings?.[0];
  const xgDiff = topTeam ? topTeam.goalsDiff / Math.max(1, topTeam.all.played) : 0;
  const eloRating = topTeam ? 1500 + topTeam.goalsDiff * 5 + topTeam.points * 4 : 1500;

  return (
    <ScreenContainer title="BORO">
      <View style={{ gap: 24 }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryFixed }} />
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.label,
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              {t('stats.liveUpdates')}
            </Text>
          </View>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
            {t('stats.title')}
          </Text>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.body,
              fontSize: 13,
            }}
          >
            {t('stats.subtitle')}
          </Text>
        </View>

        {isLoading ? (
          <Skeleton height={240} radius={16} />
        ) : (
          <MomentumIndexCard
            bars={momentumBars}
            attackDominancePct={Math.min(99, Math.round((topTeam?.points ?? 0) * 1.2))}
            threatLevel={
              eloRating > 1900
                ? 'Extreme'
                : eloRating > 1800
                  ? 'High'
                  : eloRating > 1700
                    ? 'Medium'
                    : 'Low'
            }
          />
        )}

        {isLoading ? (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Skeleton height={180} radius={16} style={{ flex: 1 }} />
            <Skeleton height={180} radius={16} style={{ flex: 1 }} />
          </View>
        ) : (
          <XgEloBento xgDiff={xgDiff} eloRating={eloRating} eloRank={topTeam?.rank ?? 1} percentile={99} />
        )}

        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.headlineMd,
                fontSize: 18,
                flex: 1,
              }}
            >
              {t('stats.standings')}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
            {DEFAULT_LEAGUES.slice(0, 8).map((l) => (
              <Chip
                key={l.id}
                label={l.shortName}
                active={l.id === leagueId}
                onPress={() => {
                  haptics.light();
                  setLeagueId(l.id);
                }}
              />
            ))}
          </ScrollView>

          {isLoading ? (
            <Skeleton height={320} radius={16} />
          ) : standings && standings.length > 0 ? (
            <StandingsTable rows={standings} aiPositions={aiPositions} maxRows={8} />
          ) : (
            <GlassCard padding={24} style={{ alignItems: 'center' }}>
              <BoroIcon name="auto-graph" size={32} color={colors.onSurfaceVariant} />
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.body,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                {t('stats.noStandings')}
              </Text>
            </GlassCard>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
