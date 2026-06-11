import React, { useRef } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { FormDots } from '@/components/ui/FormDots';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useFixturePrediction } from '@/hooks/useFixturePrediction';
import { useTeamLastFixtures } from '@/hooks/useFixtures';
import { useHaptics } from '@/hooks/useHaptics';
import { useFavoritesStore } from '@/store/favoritesStore';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';
import { isLive } from '@/types/match';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';
import type { H2HRecord } from '@/types/match';

interface MatchListItemProps {
  fixture: Fixture;
  /** Optional pre-resolved prediction (from the batch map). */
  prediction?: PredictionResult;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheckboxToggle?: () => void;
  /** If true, show form dots for both teams */
  showForm?: boolean;
  /** If true, show injury badge when data is available */
  hasInjuries?: boolean;
}

// ─── Swipe action backgrounds ─────────────────────────────────────────────────
const FavAction: React.FC<{ colors: ReturnType<typeof useColors> }> = ({ colors }) => (
  <View style={{
    flex: 1,
    backgroundColor: `${colors.primaryFixed}22`,
    borderRadius: 18,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 20,
    marginBottom: 10,
  }}>
    <BoroIcon name="favorite" size={24} color={colors.primaryFixed} />
  </View>
);

const OpenAction: React.FC<{ colors: ReturnType<typeof useColors> }> = ({ colors }) => (
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
    marginBottom: 10,
  }}>
    <BoroIcon name="arrow-forward" size={24} color={colors.onSurface} />
  </View>
);

// ─── Team form row ─────────────────────────────────────────────────────────────
const TeamFormRow: React.FC<{ teamId: number; leagueId: number }> = ({ teamId, leagueId }) => {
  const { data } = useTeamLastFixtures(teamId, 5);

  if (!data || data.length === 0) return null;

  const results = data.map((f) => {
    const hg = f.goals.home ?? 0;
    const ag = f.goals.away ?? 0;
    if (hg === ag) return 'D' as const;
    const isHome = f.teams.home.id === teamId;
    const teamGoals = isHome ? hg : ag;
    const oppGoals = isHome ? ag : hg;
    return teamGoals > oppGoals ? 'W' as const : 'L' as const;
  });

  return <FormDots results={results} size={7} />;
};

export const MatchListItem: React.FC<MatchListItemProps> = ({
  fixture,
  prediction: provided,
  showCheckbox = false,
  checked = false,
  onCheckboxToggle,
  showForm = true,
  hasInjuries = false,
}) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();
  const swipeRef = useRef<Swipeable>(null);
  const favorites = useFavoritesStore();
  const isFav = favorites.isFavorite('fixtures', fixture.fixture.id);

  const resolved = useFixturePrediction(provided ? null : fixture);
  const prediction = provided ?? resolved.prediction;
  const live = isLive(fixture.fixture.status.short);
  const time = format(parseISO(fixture.fixture.date), 'HH:mm');
  const isHigh = (prediction?.topPick.probability ?? 0) >= 80;
  const isMid = (prediction?.topPick.probability ?? 0) >= 60 && (prediction?.topPick.probability ?? 0) < 80;
  const probColor = isHigh ? colors.primaryFixed : isMid ? colors.onSurface : colors.onSurfaceVariant;

  const tagLabel = isHigh
    ? prediction?.confidence === 'ELITE' ? 'ELITE' : 'SAFE'
    : null;

  const handlePress = () => {
    haptics.light();
    if (showCheckbox && onCheckboxToggle) {
      onCheckboxToggle();
    } else {
      router.push(`/match/${fixture.fixture.id}`);
    }
  };

  const handleFav = async () => {
    if (haptics.medium) {
      haptics.medium();
    } else {
      haptics.light();
    }
    await favorites.toggle('fixtures', fixture.fixture.id);
    swipeRef.current?.close();
  };

  const cardContent = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: 10 })}
    >
      <GlassCard
        padding={14}
        style={live ? {
          borderColor: 'rgba(255, 149, 0, 0.55)',
          borderWidth: 1.5,
        } : isFav ? {
          borderColor: `${colors.primaryFixed}33`,
          borderWidth: 1,
        } : undefined}
      >
        <View style={{ gap: 8 }}>
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
                  width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
                  borderColor: checked ? colors.primaryFixed : 'rgba(255, 255, 255, 0.25)',
                  backgroundColor: checked ? colors.accent15 : 'rgba(255, 255, 255, 0.02)',
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}
              >
                {checked && <BoroIcon name="check" size={14} color={colors.primaryFixed} />}
              </Pressable>
            )}

            {/* 1. Time / Live Status */}
            <View style={{
              width: 50, alignItems: 'center', justifyContent: 'center',
              borderRightWidth: 1, borderRightColor: 'rgba(255, 255, 255, 0.06)', paddingRight: 8,
            }}>
              {live ? (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <View style={{
                    backgroundColor: 'rgba(255, 149, 0, 0.12)', borderWidth: 1,
                    borderColor: 'rgba(255, 149, 0, 0.5)', paddingHorizontal: 5,
                    paddingVertical: 1, borderRadius: 4,
                  }}>
                    <Text style={{ color: '#FF9500', fontFamily: fonts.label, fontSize: 9, fontWeight: 'bold' }}>LIVE</Text>
                  </View>
                  <Text style={{ color: '#FF9500', fontFamily: fonts.stats, fontSize: 12 }}>
                    {fixture.fixture.status.elapsed}'
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>{time}</Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, marginTop: 2 }}>
                    {t('match.kickoff')}
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Teams Stack */}
            <View style={{ flex: 1, paddingHorizontal: 12, gap: 8 }}>
              {/* Home */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TeamCrest uri={fixture.teams.home.logo} size={20} />
                <Text
                  style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }}
                  numberOfLines={1}
                >
                  {fixture.teams.home.name}
                </Text>
                {hasInjuries && (
                  <View style={{
                    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 4,
                    paddingHorizontal: 4, paddingVertical: 1,
                  }}>
                    <Text style={{ color: '#EF4444', fontFamily: fonts.label, fontSize: 9 }}>⚠</Text>
                  </View>
                )}
                {live && (
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>
                    {fixture.goals.home ?? 0}
                  </Text>
                )}
              </View>

              {/* Away */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TeamCrest uri={fixture.teams.away.logo} size={20} />
                <Text
                  style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }}
                  numberOfLines={1}
                >
                  {fixture.teams.away.name}
                </Text>
                {live && (
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>
                    {fixture.goals.away ?? 0}
                  </Text>
                )}
              </View>
            </View>

            {/* 3. Prediction (Right) */}
            <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 4 }}>
              {prediction ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {tagLabel && (
                      <View style={{
                        backgroundColor: live ? 'rgba(255, 255, 255, 0.06)' : colors.accent10,
                        paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 2,
                      }}>
                        <Text style={{
                          color: live ? colors.onSurfaceVariant : colors.primaryFixed,
                          fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5,
                        }}>
                          {tagLabel}
                        </Text>
                      </View>
                    )}
                    {isFav && !live && (
                      <BoroIcon name="favorite" size={11} color={colors.primaryFixed} />
                    )}
                    <Text style={{ color: live ? colors.onSurface : probColor, fontFamily: fonts.stats, fontSize: 14 }}>
                      {Math.round(prediction.topPick.probability)}%
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.06)', paddingHorizontal: 6,
                    paddingVertical: 2, borderRadius: 6,
                  }}>
                    <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9 }} numberOfLines={1}>
                      {formatPredictionSelection(prediction.topPick.selection, t)} • {prediction.topPick.odds.toFixed(2)}
                    </Text>
                  </View>
                  {/* Value bet indicator */}
                  {(prediction.valueBets?.length ?? 0) > 0 && (
                    <View style={{
                      backgroundColor: `${colors.primaryFixed}1A`, borderRadius: 4,
                      paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1,
                      borderColor: `${colors.primaryFixed}33`,
                    }}>
                      <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.3 }}>
                        VALUE
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10 }}>
                  {t('pick.analyzing')}
                </Text>
              )}
            </View>
          </View>

          {/* Form bars row */}
          {showForm && !live && (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingTop: 6, paddingHorizontal: 4,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
              gap: 8,
            }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, width: 50, textAlign: 'center' }}>
                forma
              </Text>
              <View style={{ flex: 1, flexDirection: 'column', gap: 3, paddingLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, width: 18 }}>C</Text>
                  <TeamFormRow teamId={fixture.teams.home.id} leagueId={fixture.league.id} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, width: 18 }}>O</Text>
                  <TeamFormRow teamId={fixture.teams.away.id} leagueId={fixture.league.id} />
                </View>
              </View>
            </View>
          )}
        </View>
      </GlassCard>
    </Pressable>
  );

  // Swipe only on native
  if (Platform.OS === 'web') return cardContent;

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={() => <OpenAction colors={colors} />}
      renderLeftActions={() => <FavAction colors={colors} />}
      onSwipeableLeftOpen={handleFav}
      onSwipeableRightOpen={() => {
        swipeRef.current?.close();
        haptics.light();
        router.push(`/match/${fixture.fixture.id}`);
      }}
    >
      {cardContent}
    </Swipeable>
  );
};
