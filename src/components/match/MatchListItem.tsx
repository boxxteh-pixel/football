import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useFixturePrediction } from '@/hooks/useFixturePrediction';
import { useHaptics } from '@/hooks/useHaptics';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';
import { isLive } from '@/types/match';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';

interface MatchListItemProps {
  fixture: Fixture;
  /** Optional pre-resolved prediction (from the batch map). If absent, the row
   *  resolves the SAME real prediction itself via the shared cache. */
  prediction?: PredictionResult;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheckboxToggle?: () => void;
}

export const MatchListItem: React.FC<MatchListItemProps> = ({
  fixture,
  prediction: provided,
  showCheckbox = false,
  checked = false,
  onCheckboxToggle,
}) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();
  const resolved = useFixturePrediction(provided ? null : fixture);
  const prediction = provided ?? resolved.prediction;
  const live = isLive(fixture.fixture.status.short);
  const time = format(parseISO(fixture.fixture.date), 'HH:mm');
  const isHigh = (prediction?.topPick.probability ?? 0) >= 80;
  const isMid = (prediction?.topPick.probability ?? 0) >= 60 && (prediction?.topPick.probability ?? 0) < 80;
  const probColor = isHigh ? colors.primaryFixed : isMid ? colors.onSurface : colors.onSurfaceVariant;

  const tagLabel = isHigh
    ? prediction?.confidence === 'ELITE'
      ? 'ELITE'
      : 'SAFE'
    : null;

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        if (showCheckbox && onCheckboxToggle) {
          onCheckboxToggle();
        } else {
          router.push(`/match/${fixture.fixture.id}`);
        }
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: 10 })}
    >
      <GlassCard
        padding={14}
        style={live ? {
          borderColor: 'rgba(255, 149, 0, 0.55)',
          borderWidth: 1.5,
        } : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          
          {/* Glass Checkbox Column */}
          {showCheckbox && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                haptics.light();
                onCheckboxToggle?.();
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: checked ? colors.primaryFixed : 'rgba(255, 255, 255, 0.25)',
                backgroundColor: checked ? colors.accent15 : 'rgba(255, 255, 255, 0.02)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              {checked && (
                <BoroIcon name="check" size={14} color={colors.primaryFixed} />
              )}
            </Pressable>
          )}
          
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
                    backgroundColor: 'rgba(255, 149, 0, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 149, 0, 0.5)',
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#FF9500',
                      fontFamily: fonts.label,
                      fontSize: 9,
                      fontWeight: 'bold',
                    }}
                  >
                    LIVE
                  </Text>
                </View>
                <Text
                  style={{
                    color: '#FF9500',
                    fontFamily: fonts.stats,
                    fontSize: 12,
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
                  {t('match.kickoff')}
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
            {prediction ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {tagLabel && (
                    <View
                      style={{
                        backgroundColor: live ? 'rgba(255, 255, 255, 0.06)' : colors.accent10,
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                        borderRadius: 3,
                        marginRight: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: live ? colors.onSurfaceVariant : colors.primaryFixed,
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
                      color: live ? colors.onSurface : probColor,
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
                    {formatPredictionSelection(prediction.topPick.selection, t)} • {prediction.topPick.odds.toFixed(2)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10 }}>
                {t('pick.analyzing')}
              </Text>
            )}
          </View>

        </View>
      </GlassCard>
    </Pressable>
  );
};
