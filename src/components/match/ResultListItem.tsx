/**
 * A finished-match row for the Results/History screen.
 * Outlined GREEN when the model's pick landed, RED when it missed, showing the
 * final score, the pick that was graded, and the actual market outcome.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';
import type { ResultRow } from '@/hooks/useResults';

export const ResultListItem: React.FC<{ row: ResultRow }> = ({ row }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();
  const { fixture, prediction, graded } = row;

  const correct = graded.grade === 'correct';
  const green = '#22c55e';
  const red = '#ef4444';
  const accent = correct ? green : red;
  const date = format(parseISO(fixture.fixture.date), 'd MMM');
  const hg = fixture.goals.home ?? 0;
  const ag = fixture.goals.away ?? 0;

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        router.push(`/match/${fixture.fixture.id}`);
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: 10 })}
    >
      <GlassCard padding={12} style={{ borderColor: `${accent}66`, borderWidth: 1.5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Grade indicator */}
          <View style={{ width: 34, alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: `${accent}22`,
                borderWidth: 1,
                borderColor: `${accent}66`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BoroIcon name={correct ? 'check' : 'close'} size={16} color={accent} />
            </View>
          </View>

          {/* Teams + score */}
          <View style={{ flex: 1, paddingHorizontal: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamCrest uri={fixture.teams.home.logo} size={18} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }} numberOfLines={1}>
                {fixture.teams.home.name}
              </Text>
              <Text style={{ color: hg >= ag ? colors.onSurface : colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 14 }}>
                {hg}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamCrest uri={fixture.teams.away.logo} size={18} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }} numberOfLines={1}>
                {fixture.teams.away.name}
              </Text>
              <Text style={{ color: ag >= hg ? colors.onSurface : colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 14 }}>
                {ag}
              </Text>
            </View>
          </View>

          {/* Pick + date */}
          <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 4, maxWidth: 120 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>
              {date.toUpperCase()}
            </Text>
            <View
              style={{
                backgroundColor: `${accent}1A`,
                borderColor: `${accent}40`,
                borderWidth: 1,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: accent, fontFamily: fonts.label, fontSize: 9 }} numberOfLines={1}>
                {formatPredictionSelection(graded.pick, t)}
              </Text>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 9 }}>
              {Math.round(graded.probability)}% · {graded.market}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
