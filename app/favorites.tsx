import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { fetchFixtureById } from '@/services/api/apiFootball';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchListItem } from '@/components/match/MatchListItem';
import { ResponsiveGrid } from '@/components/layouts/ResponsiveGrid';
import { useResponsive } from '@/hooks/useResponsive';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useT } from '@/theme/i18n';
import { isLive } from '@/types/match';
import type { Fixture } from '@/types/match';

export default function FavoritesScreen() {
  const colors = useColors();
  const t = useT();
  const favorites = useFavoritesStore();
  const { gridColumns } = useResponsive();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<number[]>([]);

  // Batch query all favorite fixtures in parallel using useQueries
  const results = useQueries({
    queries: favorites.fixtures.map((id) => ({
      queryKey: ['fixture', id],
      queryFn: () => fetchFixtureById(id),
      staleTime: Infinity,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const favoriteMatches = useMemo<Fixture[]>(() => {
    return results
      .map((r) => r.data)
      .filter((f): f is Fixture => !!f);
  }, [results]);

  const favoriteMatchesCount = favorites.fixtures.length;

  // Group favorites by day (matching Home screen logic)
  const groupedFavorites = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: Fixture[] }> = [];
    favoriteMatches.forEach((f) => {
      const dateObj = new Date(f.fixture.timestamp * 1000);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      let label = '';
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isLive(f.fixture.status.short)) {
        label = 'Live';
      } else if (isSameDay(dateObj, today)) {
        label = t('common.today') || 'Today';
      } else if (isSameDay(dateObj, tomorrow)) {
        label = t('common.tomorrow') || 'Tomorrow';
      } else {
        label = dateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }

      const existing = groups.find((g) => g.dateLabel === label);
      if (existing) {
        existing.items.push(f);
      } else {
        groups.push({ dateLabel: label, items: [f] });
      }
    });

    return groups.sort((a, b) => {
      if (a.dateLabel === 'Live') return -1;
      if (b.dateLabel === 'Live') return 1;
      return 0;
    });
  }, [favoriteMatches, t]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer showBack title={t('favorites.title')}>
        <View style={{ gap: 20, paddingTop: 8, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
                {t('favorites.title')}
              </Text>
              {favoriteMatchesCount > 0 && (
                <View
                  style={{
                    backgroundColor: colors.accent12,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: colors.accent30,
                  }}
                >
                  <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 11, fontWeight: 'bold' }}>
                    {favoriteMatchesCount} {favoriteMatchesCount === 1 ? t('match.result').toLowerCase() : 'matches'}
                  </Text>
                </View>
              )}
            </View>

            {favoriteMatchesCount > 0 && (
              <Pressable
                onPress={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedFixtureIds([]);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelectionMode ? colors.accent15 : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: isSelectionMode ? colors.accent30 : 'rgba(255,255,255,0.08)',
                }}
              >
                <BoroIcon
                  name={isSelectionMode ? "close" : "add-task"}
                  size={18}
                  color={isSelectionMode ? colors.primaryFixed : colors.onSurface}
                />
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={84} radius={18} />
              ))}
            </View>
          ) : favoriteMatchesCount === 0 ? (
            <EmptyFavoritesState
              icon="sports-soccer"
              title={t('favorites.empty')}
              subtitle={t('favorites.emptySub')}
            />
          ) : (
            <View style={{ gap: 24 }}>
              {groupedFavorites.map((group) => (
                <View key={group.dateLabel} style={{ gap: 12 }}>
                  {/* Day Divider */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
                    <View style={{ height: 1, flex: 1, backgroundColor: colors.accent15 }} />
                    <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                      {group.dateLabel}
                    </Text>
                    <View style={{ height: 1, flex: 1, backgroundColor: colors.accent15 }} />
                  </View>
                  <ResponsiveGrid columns={gridColumns} gap={4}>
                    {group.items.map((f) => (
                      <MatchListItem
                        key={f.fixture.id}
                        fixture={f}
                        showCheckbox={isSelectionMode}
                        checked={selectedFixtureIds.includes(f.fixture.id)}
                        onCheckboxToggle={() => {
                          setSelectedFixtureIds((prev) =>
                            prev.includes(f.fixture.id)
                              ? prev.filter((id) => id !== f.fixture.id)
                              : [...prev, f.fixture.id]
                          );
                        }}
                      />
                    ))}
                  </ResponsiveGrid>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScreenContainer>

      {/* Floating Action Bar for Bulk Unfavoriting */}
      {isSelectionMode && selectedFixtureIds.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: Platform.OS === 'web' ? 24 : 84,
            left: 20,
            right: 20,
            zIndex: 100,
          }}
        >
          <GlassCard padding={16} activeBorder glow>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                {selectedFixtureIds.length} {selectedFixtureIds.length === 1 ? 'partita selezionata' : 'partite selezionate'}
              </Text>
              <Pressable
                onPress={async () => {
                  await favorites.removeMultiple('fixtures', selectedFixtureIds);
                  setIsSelectionMode(false);
                  setSelectedFixtureIds([]);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: colors.error,
                  shadowColor: colors.error,
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <BoroIcon name="delete-outline" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontFamily: fonts.label, fontSize: 13, fontWeight: 'bold' }}>
                  Rimuovi
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}
    </View>
  );
}

interface EmptyFavoritesStateProps {
  icon: string;
  title: string;
  subtitle: string;
}

const EmptyFavoritesState: React.FC<EmptyFavoritesStateProps> = ({ icon, title, subtitle }) => {
  const colors = useColors();
  return (
    <GlassCard padding={32} style={{ alignItems: 'center', gap: 16, marginTop: 12 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <BoroIcon name={icon} size={32} color={colors.onSurfaceVariant} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, textAlign: 'center' }}>
          {title}
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.body,
            fontSize: 13,
            textAlign: 'center',
            paddingHorizontal: 16,
            lineHeight: 19,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </GlassCard>
  );
};
