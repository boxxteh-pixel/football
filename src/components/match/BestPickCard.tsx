import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { GlassCard } from '@/components/ui/GlassCard';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useQuickPrediction } from '@/hooks/usePrediction';
import type { Fixture } from '@/types/match';

interface BestPickCardProps {
  fixture: Fixture;
}

export const BestPickCard: React.FC<BestPickCardProps> = ({ fixture }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const prediction = useQuickPrediction(fixture);
  const isHigh = prediction.topPick.probability >= 80;
  const accentColor = isHigh ? colors.primaryFixed : colors.secondaryFixed;
  const kickoff = format(parseISO(fixture.fixture.date), 'HH:mm');

  return (
    <Pressable
      onPress={() => {
        haptics.medium();
        router.push(`/match/${fixture.fixture.id}`);
      }}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <GlassCard
        rounded="2xl"
        padding={16}
        activeBorder={isHigh}
        glow={isHigh}
        style={{ width: 280, marginRight: 14 }}
      >
        {/* Card Header: League & Kickoff */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              flex: 1,
              marginRight: 8,
            }}
            numberOfLines={1}
          >
            {fixture.league.name}
          </Text>
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.label,
                fontSize: 10,
              }}
            >
              {kickoff}
            </Text>
          </View>
        </View>

        {/* Card Body: Teams & Prediction Summary */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
          }}
        >
          {/* Home Team */}
          <View style={{ alignItems: 'center', gap: 6, width: 80 }}>
            <TeamCrest uri={fixture.teams.home.logo} size={40} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 11,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {fixture.teams.home.name}
            </Text>
          </View>

          {/* Prediction Middle Area */}
          <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <View
              style={{
                backgroundColor: isHigh ? colors.accent12 : 'rgba(255, 255, 255, 0.05)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isHigh ? colors.accent30 : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text
                style={{
                  color: accentColor,
                  fontFamily: fonts.stats,
                  fontSize: 14,
                }}
              >
                {Math.round(prediction.topPick.probability)}%
              </Text>
            </View>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 9,
                letterSpacing: 0.5,
              }}
            >
              PROBABILITY
            </Text>
          </View>

          {/* Away Team */}
          <View style={{ alignItems: 'center', gap: 6, width: 80 }}>
            <TeamCrest uri={fixture.teams.away.logo} size={40} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 11,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {fixture.teams.away.name}
            </Text>
          </View>
        </View>

        {/* Card Footer: Pick & Odds details */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.06)',
            paddingTop: 10,
            marginTop: 10,
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
                Selection
              </Text>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
                {prediction.topPick.selection}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
                Odds
              </Text>
              <Text style={{ color: accentColor, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                {prediction.topPick.odds.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Progress Indicator Bar */}
          <View
            style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.surfaceContainerHighest,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${prediction.topPick.probability}%`,
                height: '100%',
                backgroundColor: accentColor,
              }}
            />
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
