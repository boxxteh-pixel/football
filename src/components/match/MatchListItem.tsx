import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useQuickPrediction } from '@/hooks/usePrediction';
import { useHaptics } from '@/hooks/useHaptics';
import type { Fixture } from '@/types/match';
import { isLive } from '@/types/match';

interface MatchListItemProps {
  fixture: Fixture;
}

export const MatchListItem: React.FC<MatchListItemProps> = ({ fixture }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const prediction = useQuickPrediction(fixture);
  const live = isLive(fixture.fixture.status.short);
  const time = format(parseISO(fixture.fixture.date), 'HH:mm');
  const isHigh = prediction.topPick.probability >= 80;
  const isMid = prediction.topPick.probability >= 60 && prediction.topPick.probability < 80;
  const probColor = isHigh ? colors.primaryFixed : isMid ? colors.onSurface : colors.onSurfaceVariant;

  const tagLabel = isHigh
    ? prediction.confidence === 'ELITE'
      ? 'ELITE'
      : 'SAFE'
    : null;

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        router.push(`/match/${fixture.fixture.id}`);
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: 10 })}
    >
      <GlassCard padding={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          
          {/* 1. Time / Live Status Column */}
          <View
            style={{
              width: 50,
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: 1,
              borderRightColor: 'rgba(255, 255, 255, 0.06)',
              paddingRight: 8,
            }}
          >
            {live ? (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <View
                  style={{
                    backgroundColor: colors.accent15,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryFixed,
                      fontFamily: fonts.label,
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  >
                    LIVE
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.primaryFixed,
                    fontFamily: fonts.stats,
                    fontSize: 11,
                  }}
                >
                  {fixture.fixture.status.elapsed}'
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.stats,
                    fontSize: 13,
                  }}
                >
                  {time}
                </Text>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.label,
                    fontSize: 8,
                    marginTop: 2,
                  }}
                >
                  KICKOFF
                </Text>
              </View>
            )}
          </View>

          {/* 2. Teams Stack Column (Middle) */}
          <View style={{ flex: 1, paddingHorizontal: 12, gap: 8 }}>
            {/* Home Team */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamCrest uri={fixture.teams.home.logo} size={20} />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.bodyBold,
                  fontSize: 13,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {fixture.teams.home.name}
              </Text>
              {live && (
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.stats,
                    fontSize: 13,
                  }}
                >
                  {fixture.goals.home ?? 0}
                </Text>
              )}
            </View>

            {/* Away Team */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamCrest uri={fixture.teams.away.logo} size={20} />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.bodyBold,
                  fontSize: 13,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {fixture.teams.away.name}
              </Text>
              {live && (
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.stats,
                    fontSize: 13,
                  }}
                >
                  {fixture.goals.away ?? 0}
                </Text>
              )}
            </View>
          </View>

          {/* 3. Prediction & Probabilities (Right) */}
          <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {tagLabel && (
                <View
                  style={{
                    backgroundColor: colors.accent10,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 3,
                    marginRight: 2,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryFixed,
                      fontFamily: fonts.label,
                      fontSize: 8,
                      letterSpacing: 0.5,
                    }}
                  >
                    {tagLabel}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  color: probColor,
                  fontFamily: fonts.stats,
                  fontSize: 14,
                }}
              >
                {Math.round(prediction.topPick.probability)}%
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.06)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.label,
                  fontSize: 9,
                }}
                numberOfLines={1}
              >
                {prediction.topPick.selection} • {prediction.topPick.odds.toFixed(2)}
              </Text>
            </View>
          </View>

        </View>
      </GlassCard>
    </Pressable>
  );
};
