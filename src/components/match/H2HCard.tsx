/**
 * H2HCard — Head-to-Head history visualizer.
 * Shows win/draw/loss record + last 5 matches as result bars.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BoroIcon } from '@/components/ui/BoroIcon';
import type { Fixture, H2HRecord } from '@/types/match';

interface H2HCardProps {
  fixture: Fixture;
  h2h: H2HRecord[];
}

export const H2HCard: React.FC<H2HCardProps> = ({ fixture, h2h }) => {
  const colors = useColors();
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;

  if (!h2h || h2h.length === 0) return null;

  const recent = [...h2h]
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, 5);

  // Compute record
  let homeWins = 0, draws = 0, awayWins = 0;
  h2h.forEach((m) => {
    const hg = m.goals.home ?? 0;
    const ag = m.goals.away ?? 0;
    const mHomeId = m.teams.home.id;
    if (hg === ag) { draws++; return; }
    const winner = hg > ag ? mHomeId : m.teams.away.id;
    if (winner === homeId) homeWins++;
    else if (winner === awayId) awayWins++;
  });

  const total = homeWins + draws + awayWins;

  const resultColor = (m: H2HRecord): string => {
    const hg = m.goals.home ?? 0;
    const ag = m.goals.away ?? 0;
    const mHomeId = m.teams.home.id;
    if (hg === ag) return '#EAB308';
    const winner = hg > ag ? mHomeId : m.teams.away.id;
    if (winner === homeId) return colors.primaryFixed;
    return '#EF4444';
  };

  const resultLabel = (m: H2HRecord): string => {
    const hg = m.goals.home ?? 0;
    const ag = m.goals.away ?? 0;
    const mHomeId = m.teams.home.id;
    if (hg === ag) return 'P';
    const winner = hg > ag ? mHomeId : m.teams.away.id;
    return winner === homeId ? 'V' : 'S';
  };

  return (
    <GlassCard padding={16} style={{ gap: 14 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BoroIcon name="history" size={18} color={colors.primaryFixed} />
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 15 }}>
          Testa a Testa
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginLeft: 4 }}>
          ({h2h.length} precedenti)
        </Text>
      </View>

      {/* Win/Draw/Loss bar */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TeamCrest uri={fixture.teams.home.logo} size={18} />
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.bodyBold, fontSize: 13, minWidth: 20 }}>
            {homeWins}
          </Text>
          <View style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row' }}>
            {total > 0 && (
              <>
                <View style={{ flex: homeWins / total, backgroundColor: colors.primaryFixed, opacity: 0.85 }} />
                <View style={{ flex: draws / total, backgroundColor: '#EAB308', opacity: 0.8 }} />
                <View style={{ flex: awayWins / total, backgroundColor: '#EF4444', opacity: 0.75 }} />
              </>
            )}
          </View>
          <Text style={{ color: '#EF4444', fontFamily: fonts.bodyBold, fontSize: 13, minWidth: 20, textAlign: 'right' }}>
            {awayWins}
          </Text>
          <TeamCrest uri={fixture.teams.away.logo} size={18} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 10 }}>
            {fixture.teams.home.name.split(' ')[0]} {homeWins}V
          </Text>
          <Text style={{ color: '#EAB308', fontFamily: fonts.label, fontSize: 10 }}>
            {draws} P
          </Text>
          <Text style={{ color: '#EF4444', fontFamily: fonts.label, fontSize: 10 }}>
            {awayWins}S {fixture.teams.away.name.split(' ')[0]}
          </Text>
        </View>
      </View>

      {/* Last 5 matches */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
          Ultimi incontri
        </Text>
        {recent.map((m, i) => {
          const hg = m.goals.home ?? 0;
          const ag = m.goals.away ?? 0;
          const rc = resultColor(m);
          const rl = resultLabel(m);
          const date = new Date(m.fixture.timestamp * 1000);
          const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderLeftWidth: 3,
                borderLeftColor: rc,
              }}
            >
              {/* Result badge */}
              <View style={{
                width: 22, height: 22, borderRadius: 5,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: `${rc}22`,
              }}>
                <Text style={{ color: rc, fontFamily: fonts.label, fontSize: 10, fontWeight: 'bold' }}>{rl}</Text>
              </View>

              {/* Teams + Score */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 12 }} numberOfLines={1}>
                  {m.teams.home.name} <Text style={{ color: colors.primaryFixed }}>{hg}</Text>
                  {' — '}
                  <Text style={{ color: '#EF4444' }}>{ag}</Text> {m.teams.away.name}
                </Text>
              </View>

              {/* Date */}
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10 }}>
                {dateStr}
              </Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
};
