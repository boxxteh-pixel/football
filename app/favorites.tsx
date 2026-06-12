import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { fetchEventById } from '@/services/api/polymarket';
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
import type { PolymarketEvent } from '@/services/api/polymarket';

export default function FavoritesScreen() {
  const colors = useColors();
  const favorites = useFavoritesStore();
  const { gridColumns } = useResponsive();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<string[]>([]);

  // Query favorite markets in parallel
  const results = useQueries({
    queries: favorites.fixtures.map((id) => ({
      queryKey: ['polymarket', 'event', id],
      queryFn: () => fetchEventById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const favoriteEvents = useMemo<PolymarketEvent[]>(() => {
    return results
      .map((r) => r.data)
      .filter((f): f is PolymarketEvent => !!f);
  }, [results]);

  const favoriteMarketsCount = favorites.fixtures.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer showBack title="Favorites">
        <View style={{ gap: 20, paddingTop: 8, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
                Favorite Markets
              </Text>
              {favoriteMarketsCount > 0 && (
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
                    {favoriteMarketsCount} saved
                  </Text>
                </View>
              )}
            </View>

            {favoriteMarketsCount > 0 && (
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
          ) : favoriteMarketsCount === 0 ? (
            <EmptyFavoritesState
              icon="star"
              title="No Favorite Markets"
              subtitle="Tap the heart icon on any prediction market to keep track of its price and crowd consensus here."
            />
          ) : (
            <ResponsiveGrid columns={gridColumns} gap={4}>
              {favoriteEvents.map((f) => (
                <MatchListItem
                  key={f.id}
                  fixture={f}
                  showCheckbox={isSelectionMode}
                  checked={selectedFixtureIds.includes(f.id)}
                  onCheckboxToggle={() => {
                    setSelectedFixtureIds((prev) =>
                      prev.includes(f.id)
                        ? prev.filter((id) => id !== f.id)
                        : [...prev, f.id]
                    );
                  }}
                />
              ))}
            </ResponsiveGrid>
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
                {selectedFixtureIds.length} {selectedFixtureIds.length === 1 ? 'market selected' : 'markets selected'}
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
                  Remove
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
