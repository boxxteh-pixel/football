import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import type { ResultRow } from '@/hooks/useResults';

export const ResultListItem: React.FC<{ row: ResultRow }> = ({ row }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const { fixture, prediction, graded } = row;

  const correct = graded.grade === 'correct';
  const green = '#22c55e';
  const red = '#ef4444';
  const accent = correct ? green : red;

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

          {/* Event title & outcomes */}
          <View style={{ flex: 1, paddingHorizontal: 12, gap: 4 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {fixture.league.name.toUpperCase()} Market
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={2}>
              {fixture.teams.home.name} (Yes) vs {fixture.teams.away.name} (No)
            </Text>
          </View>

          {/* Pick + status */}
          <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 4, maxWidth: 120 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>
              RESOLVED
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
                {prediction.topPick.selection}
              </Text>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 9 }}>
              {Math.round(prediction.topPick.probability)}% Prob.
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
