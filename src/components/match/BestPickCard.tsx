import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useFixturePrediction } from '@/hooks/useFixturePrediction';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';

interface BestPickCardProps {
  fixture: Fixture;
  /** Optional pre-resolved prediction; otherwise resolved from the shared cache. */
  prediction?: PredictionResult;
}

export const BestPickCard: React.FC<BestPickCardProps> = ({ fixture, prediction: provided }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();
  const resolved = useFixturePrediction(provided ? null : fixture);
  const prediction = provided ?? resolved.prediction;
  const isHigh = (prediction?.topPick.probability ?? 0) >= 80;
  const accentColor = isHigh ? colors.primaryFixed : colors.secondaryFixed;
  const kickoff = format(parseISO(fixture.fixture.date), 'HH:mm');

  if (!prediction) {
    return (
      <GlassCard rounded="2xl" padding={16} style={{ width: 300, marginRight: 14, height: 210, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>{t('pick.analyzing')}</Text>
      </GlassCard>
    );
  }

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
        padding={18}
        activeBorder={isHigh}
        style={{ width: 300, marginRight: 14 }}
      >
        {/* Card Header: League & Kickoff */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.8,
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
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
            }}
          >
            <BoroIcon name="schedule" size={11} color={colors.onSurfaceVariant} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.label,
                fontSize: 11,
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
            alignItems: 'flex-start',
            paddingVertical: 4,
          }}
        >
          {/* Home Team */}
          <View style={{ alignItems: 'center', gap: 8, width: 86 }}>
            <TeamCrest uri={fixture.teams.home.logo} size={48} glow={isHigh} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 12,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {fixture.teams.home.name}
            </Text>
          </View>

          {/* Prediction Middle Area */}
          <View style={{ alignItems: 'center', gap: 5, flex: 1, paddingTop: 6 }}>
            <Text
              style={{
                color: accentColor,
                fontFamily: fonts.display,
                fontSize: 26,
                letterSpacing: -1,
              }}
            >
              {Math.round(prediction.topPick.probability)}%
            </Text>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 8,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('match.probability')}
            </Text>
          </View>

          {/* Away Team */}
          <View style={{ alignItems: 'center', gap: 8, width: 86 }}>
            <TeamCrest uri={fixture.teams.away.logo} size={48} glow={isHigh} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 12,
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
            paddingTop: 12,
            marginTop: 14,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ gap: 3, flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {t('match.selection')}
              </Text>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
                {formatPredictionSelection(prediction.topPick.selection, t)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {t('match.odds')}
              </Text>
              <Text style={{ color: accentColor, fontFamily: fonts.stats, fontSize: 16 }}>
                {prediction.topPick.odds.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Progress Indicator Bar */}
          <View
            style={{
              width: '100%',
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${prediction.topPick.probability}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: accentColor,
              }}
            />
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
