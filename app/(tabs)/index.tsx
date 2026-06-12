import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { SearchBar } from '@/components/ui/SearchBar';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { BestPickCard } from '@/components/match/BestPickCard';
import { MatchListItem } from '@/components/match/MatchListItem';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ResponsiveGrid } from '@/components/layouts/ResponsiveGrid';
import { useResponsive } from '@/hooks/useResponsive';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { DEFAULT_LEAGUES, getLeagueById } from '@/constants/leagues';
import { useT } from '@/theme/i18n';
import type { PolymarketEvent } from '@/services/api/polymarket';

type VolumeFilter = 'all' | 'high' | 'medium' | 'low';

const VOLUME_FILTERS: Array<{ id: VolumeFilter; label: string; icon: string }> = [
  { id: 'all',    label: 'All Markets', icon: 'apps' },
  { id: 'high',   label: '>$10M Vol',   icon: 'trending-up' },
  { id: 'medium', label: '$1M-$10M',    icon: 'bar-chart' },
  { id: 'low',    label: '<$1M Vol',    icon: 'show-chart' },
];

export default function PredictorTab() {
  const colors = useColors();
  const { gridColumns } = useResponsive();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>('all');
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const t = useT();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<string[]>([]);
  const favorites = useFavoritesStore();

  // Map category ID to its slug
  const activeSlug = activeCategory ? getLeagueById(activeCategory)?.slug : 'all';

  const { data = [], isLoading, refetch, isRefetching, error } = useTodayFixtures(activeSlug);
  const { predictionMap } = useTodayPredictions();

  // Filter events based on search and volume filter
  const filteredEvents = useMemo<PolymarketEvent[]>(() => {
    let list = [...data];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }

    if (volumeFilter !== 'all') {
      list = list.filter((f) => {
        if (volumeFilter === 'high') return f.volume >= 10000000;
        if (volumeFilter === 'medium') return f.volume >= 1000000 && f.volume < 10000000;
        return f.volume < 1000000;
      });
    }

    // Sort by volume descending
    return list.sort((a, b) => b.volume - a.volume);
  }, [data, search, volumeFilter]);

  const bestPicks = useMemo<PolymarketEvent[]>(() => {
    return [...data]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
  }, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer
        title="BORO Predictor"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryFixed}
          />
        }
      >
        <View style={{ gap: 28 }}>
          {/* ── Search + Category chips ── */}
          <View style={{ gap: 14 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search markets (e.g. Trump, Bitcoin)..." />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ gap: 10 }}
            >
              <Chip label="All Categories" active={activeCategory === null} onPress={() => setActiveCategory(null)} />
              {DEFAULT_LEAGUES.map((l) => (
                <Chip
                  key={l.id}
                  label={`${l.emoji} ${l.shortName}`}
                  active={activeCategory === l.id}
                  onPress={() => setActiveCategory(l.id === activeCategory ? null : l.id)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── Volume Filter chips ── */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BoroIcon name="filter-list" size={15} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Filter by Volume
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ gap: 8 }}
            >
              {VOLUME_FILTERS.map((vf) => {
                const active = volumeFilter === vf.id;
                return (
                  <Pressable
                    key={vf.id}
                    onPress={() => setVolumeFilter(vf.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.glassBorderActive : 'rgba(255,255,255,0.08)',
                      backgroundColor: active ? colors.accent12 : 'rgba(255,255,255,0.04)',
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}
                  >
                    <BoroIcon
                      name={vf.icon}
                      size={13}
                      color={active ? colors.primaryFixed : colors.onSurfaceVariant}
                    />
                    <Text style={{
                      color: active ? colors.primaryFixed : colors.onSurfaceVariant,
                      fontFamily: fonts.bodyBold,
                      fontSize: 12,
                    }}>
                      {vf.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Best Picks carousel ── */}
          <View style={{ gap: 14 }}>
            <SectionHeader eyebrow="HOT MARKETS" title="Trending Predictors" />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, marginTop: -6 }}>
              Markets with highest betting activity and consensus.
            </Text>
            {isLoading ? (
              <BestPicksSkeleton />
            ) : error ? (
              null
            ) : bestPicks.length === 0 ? (
              <EmptyState
                icon="event-busy"
                title="No Markets Found"
                subtitle="No active markets in this category currently."
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ width: '100%' }}
                contentContainerStyle={{ gap: 14 }}
              >
                {bestPicks.map((f) => (
                  <BestPickCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Active markets list ── */}
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Active Prediction Markets" />
              {filteredEvents.length > 0 && (
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
              <ListSkeleton />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : filteredEvents.length === 0 ? (
              <EmptyState
                icon="event-busy"
                title="No Results Found"
                subtitle="Try adjusting your filters or search terms."
              />
            ) : (
              <ResponsiveGrid columns={gridColumns} gap={12}>
                {filteredEvents.map((f) => (
                  <MatchListItem
                    key={f.id}
                    fixture={f}
                    prediction={predictionMap.get(f.id)}
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

          {/* ── Discovery / Insights CTA ── */}
          <View style={{ gap: 14 }}>
            <SectionHeader title="AI Insights Hub" />
            <GlassCard padding={20} activeBorder style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accent12,
                    borderWidth: 1,
                    borderColor: colors.accent30,
                  }}
                >
                  <BoroIcon name="auto-awesome" size={22} color={colors.primaryFixed} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16 }}>
                    AI Multi-Bet Accumulator
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
                    Let our AI compile the highest probability outcome predictions for maximum confidence.
                  </Text>
                </View>
              </View>
              <NeonButton
                label="Open Insights"
                iconRight="arrow-forward"
                size="md"
                onPress={() => router.push('/insights')}
              />
            </GlassCard>
          </View>
        </View>
      </ScreenContainer>

      {/* ── Multi-select action bar ── */}
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
                  await favorites.addMultiple('fixtures', selectedFixtureIds);
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
                  backgroundColor: colors.primaryFixed,
                  shadowColor: colors.primaryFixed,
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <BoroIcon name="favorite" size={16} color={colors.onPrimary} fill={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontFamily: fonts.label, fontSize: 13, fontWeight: 'bold' }}>
                  Add Favorites
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}
    </View>
  );
}

const BestPicksSkeleton: React.FC = () => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={{ marginRight: 14, width: 300 }}>
        <Skeleton height={200} radius={24} />
      </View>
    ))}
  </ScrollView>
);

const ListSkeleton: React.FC = () => (
  <View style={{ gap: 12 }}>
    {[0, 1, 2, 3].map((i) => (
      <Skeleton key={i} height={84} radius={18} />
    ))}
  </View>
);

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle }) => {
  const colors = useColors();
  return (
    <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
      <BoroIcon name={icon} size={40} color={colors.onSurfaceVariant} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 }}>
          {subtitle}
        </Text>
      </View>
    </GlassCard>
  );
};

const ErrorState: React.FC<{ error?: any; onRetry: () => void }> = ({ error, onRetry }) => {
  const colors = useColors();
  return (
    <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
      <BoroIcon name="error-outline" size={40} color={colors.onSurfaceVariant} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
          Error Loading Markets
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 }}>
          Something went wrong while fetching Polymarket data. Please check your internet connection and try again.
        </Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <NeonButton label="Retry" onPress={onRetry} size="sm" variant="outline" fullWidth={false} />
      </View>
    </GlassCard>
  );
};
