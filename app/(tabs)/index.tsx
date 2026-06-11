import React, { useMemo, useState, useCallback } from 'react';
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
import { LivePulse } from '@/components/ui/LivePulse';
import { BestPickCard } from '@/components/match/BestPickCard';
import { MatchListItem } from '@/components/match/MatchListItem';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ResponsiveGrid } from '@/components/layouts/ResponsiveGrid';
import { useResponsive } from '@/hooks/useResponsive';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures, useLiveFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import { isLive, isScheduled } from '@/types/match';
import { useT } from '@/theme/i18n';
import { useIsFocused } from '@react-navigation/native';
import type { PredictionResult } from '@/types/prediction';

type MarketFilter = 'all' | 'value' | 'goals' | 'btts' | 'drift';

// ─── Sport Switcher pill rendered in TopBar's rightSlot ───────────────────────
const SportSwitcher: React.FC = () => {
  const colors = useColors();
  const sport = useSettingsStore((s) => s.settings.sport);
  const activeSport = sport ?? 'football';

  const handlePress = useCallback((s: 'football' | 'cricket') => {
    if (s !== activeSport) {
      useSettingsStore.getState().setSport(s);
    }
  }, [activeSport]);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.glassBorderActive,
        backgroundColor: 'rgba(0,0,0,0.25)',
      }}
    >
      {(['football', 'cricket'] as const).map((s) => {
        const active = activeSport === s;
        const emoji = s === 'football' ? '⚽' : '🏏';
        return (
          <Pressable
            key={s}
            onPress={() => handlePress(s)}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: active ? colors.accent15 : 'transparent',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// ─── Market filter chips ───────────────────────────────────────────────────────
const MARKET_FILTERS: Array<{ id: MarketFilter; label: string; icon: string }> = [
  { id: 'all',   label: 'Tutti',      icon: 'apps' },
  { id: 'value', label: 'Value Bets', icon: 'trending-up' },
  { id: 'goals', label: 'Over Gol',   icon: 'sports-soccer' },
  { id: 'btts',  label: 'BTTS',       icon: 'handshake' },
  { id: 'drift', label: 'Odds Drift', icon: 'moving' },
];

function applyMarketFilter(
  list: Fixture[],
  filter: MarketFilter,
  predictionMap: Map<number, PredictionResult>,
): Fixture[] {
  if (filter === 'all') return list;

  return list.filter((f) => {
    const pred = predictionMap.get(f.fixture.id);
    if (!pred) return false;

    switch (filter) {
      case 'value':
        return (pred.valueBets?.length ?? 0) > 0;

      case 'goals': {
        const m = pred.topPick.market;
        return m === 'OVER_2_5' || m === 'UNDER_2_5';
      }

      case 'btts':
        return pred.topPick.market === 'BTTS';

      case 'drift': {
        // Odds drift: detected when the model overround efficiency score is low
        // (sharp market moved against opening) OR when valueBets exist with
        // very high edge (market moved significantly from opening).
        // We approximate this by: has market overround data AND has at least
        // one value bet with edge >= 5% (meaning odds moved meaningfully vs model).
        const hasSharpMove =
          pred.marketOverround != null && pred.marketOverround < 1.06;
        const hasBigEdge =
          (pred.valueBets?.some((vb) => vb.edge >= 0.05)) ?? false;
        return hasSharpMove || hasBigEdge;
      }

      default:
        return true;
    }
  });
}

export default function PredictorTab() {
  const colors = useColors();
  const { gridColumns } = useResponsive();
  const [search, setSearch] = useState('');
  const [activeLeague, setActiveLeague] = useState<number | null>(null);
  const [activeMarket, setActiveMarket] = useState<MarketFilter>('all');
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const isFocused = useIsFocused();
  const t = useT();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<number[]>([]);
  const favorites = useFavoritesStore();

  const { data, isLoading, refetch, isRefetching, error } = useTodayFixtures(activeLeague ?? undefined);
  const { predictionMap } = useTodayPredictions();
  const { data: liveData = [] } = useLiveFixtures(selectedLeagueIds, isFocused);

  // Home shows ONLY live + not-yet-started matches. Merge the dedicated live
  // feed (freshest scores/minute) with scheduled fixtures from the day's slate.
  const baseFixtures = useMemo<Fixture[]>(() => {
    const byId = new Map<number, Fixture>();

    // Live matches first (from the live feed), filtered to selected/active league.
    liveData
      .filter((f) => isLive(f.fixture.status.short))
      .filter((f) => (activeLeague ? f.league.id === activeLeague : selectedLeagueIds.includes(f.league.id)))
      .forEach((f) => byId.set(f.fixture.id, f));

    // Upcoming (not started) from the slate.
    (data ?? [])
      .filter((f) => isLive(f.fixture.status.short) || isScheduled(f.fixture.status.short))
      .filter((f) => (activeLeague ? f.league.id === activeLeague : selectedLeagueIds.includes(f.league.id)))
      .forEach((f) => {
        if (!byId.has(f.fixture.id)) byId.set(f.fixture.id, f);
      });

    let list = [...byId.values()];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.teams.home.name.toLowerCase().includes(q) ||
          f.teams.away.name.toLowerCase().includes(q) ||
          f.league.name.toLowerCase().includes(q),
      );
    }

    // Live first, then by kickoff time.
    return list.sort((a, b) => {
      const al = isLive(a.fixture.status.short) ? 0 : 1;
      const bl = isLive(b.fixture.status.short) ? 0 : 1;
      if (al !== bl) return al - bl;
      return a.fixture.timestamp - b.fixture.timestamp;
    });
  }, [data, liveData, selectedLeagueIds, search, activeLeague]);

  // Apply market filter on top of the base list
  const fixtures = useMemo<Fixture[]>(
    () => applyMarketFilter(baseFixtures, activeMarket, predictionMap),
    [baseFixtures, activeMarket, predictionMap],
  );

  const liveCount = useMemo(() => fixtures.filter((f) => isLive(f.fixture.status.short)).length, [fixtures]);

  const groupedFixtures = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: Fixture[] }> = [];
    fixtures.forEach((f) => {
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
  }, [fixtures, t]);

  const bestPicks = useMemo(
    () =>
      [...baseFixtures]
        .map((f) => ({ fixture: f, prob: predictionMap.get(f.fixture.id)?.topPick.probability ?? -1 }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 5)
        .map((x) => x.fixture),
    [baseFixtures, predictionMap],
  );

  // Count how many fixtures match each non-all filter (for badge display)
  const filterCounts = useMemo<Record<MarketFilter, number>>(() => {
    const base = baseFixtures;
    return {
      all:    base.length,
      value:  applyMarketFilter(base, 'value', predictionMap).length,
      goals:  applyMarketFilter(base, 'goals', predictionMap).length,
      btts:   applyMarketFilter(base, 'btts',  predictionMap).length,
      drift:  applyMarketFilter(base, 'drift', predictionMap).length,
    };
  }, [baseFixtures, predictionMap]);

  if (!hasApiKey()) {
    return (
      <ScreenContainer title="BORO">
        <MissingKeyNotice />
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer
        title="BORO"
        rightSlot={<SportSwitcher />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryFixed}
          />
        }
      >
        <View style={{ gap: 28 }}>
          {/* ── Search + League chips ── */}
          <View style={{ gap: 14 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('predictor.search')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ gap: 10 }}
            >
              <Chip label={t('predictor.allPicks')} active={activeLeague === null} onPress={() => setActiveLeague(null)} />
              {DEFAULT_LEAGUES.filter((l) => selectedLeagueIds.includes(l.id)).map((l) => (
                <Chip
                  key={l.id}
                  label={l.shortName}
                  active={activeLeague === l.id}
                  onPress={() => setActiveLeague(l.id === activeLeague ? null : l.id)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── Market Filter chips ── */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BoroIcon name="filter-list" size={15} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Filtra mercato
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ gap: 8 }}
            >
              {MARKET_FILTERS.map((mf) => {
                const active = activeMarket === mf.id;
                const count = filterCounts[mf.id];
                const hasCount = mf.id !== 'all' && count > 0;
                return (
                  <Pressable
                    key={mf.id}
                    onPress={() => setActiveMarket(mf.id)}
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
                      name={mf.icon}
                      size={13}
                      color={active ? colors.primaryFixed : colors.onSurfaceVariant}
                    />
                    <Text style={{
                      color: active ? colors.primaryFixed : colors.onSurfaceVariant,
                      fontFamily: fonts.bodyBold,
                      fontSize: 12,
                    }}>
                      {mf.label}
                    </Text>
                    {hasCount && (
                      <View style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.primaryFixed : colors.accent15,
                        paddingHorizontal: 4,
                      }}>
                        <Text style={{
                          color: active ? colors.onPrimary : colors.primaryFixed,
                          fontFamily: fonts.label,
                          fontSize: 10,
                          fontWeight: 'bold',
                        }}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Odds Drift info banner when active */}
            {activeMarket === 'drift' && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.accent08,
                borderWidth: 1,
                borderColor: colors.accent15,
              }}>
                <BoroIcon name="info-outline" size={15} color={colors.primaryFixed} />
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, flex: 1, lineHeight: 17 }}>
                  Partite con mercato sharp (overround {'<'} 1.06) o value edge ≥ 5% rispetto all'apertura.
                </Text>
              </View>
            )}
          </View>

          {/* ── Best Picks carousel ── */}
          <View style={{ gap: 14 }}>
            <SectionHeader eyebrow={t('predictor.topConfidence')} title={t('predictor.bestPicks')} />
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, marginTop: -6 }}>
              {t('predictor.bestPicksHelp')}
            </Text>
            {isLoading ? (
              <BestPicksSkeleton />
            ) : error ? (
              null
            ) : bestPicks.length === 0 ? (
              <EmptyState
                icon="event-busy"
                title={t('common.noMatchesTitle')}
                subtitle={t('common.noMatchesSub')}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ width: '100%' }}
                contentContainerStyle={{ gap: 14 }}
              >
                {bestPicks.map((f) => (
                  <BestPickCard key={f.fixture.id} fixture={f} prediction={predictionMap.get(f.fixture.id)} />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Live / Upcoming list ── */}
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader
                title={t('predictor.liveUpcoming')}
                right={liveCount > 0 ? <LivePulse label={`${liveCount} LIVE`} /> : undefined}
              />
              {fixtures.length > 0 && (
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

            {/* Market filter result label */}
            {activeMarket !== 'all' && !isLoading && (
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12, marginTop: -6 }}>
                {fixtures.length === 0
                  ? 'Nessuna partita corrisponde al filtro selezionato.'
                  : `${fixtures.length} partita${fixtures.length !== 1 ? 'e' : ''} con filtro "${MARKET_FILTERS.find(f => f.id === activeMarket)?.label}"`}
              </Text>
            )}

            {isLoading ? (
              <ListSkeleton />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : fixtures.length === 0 ? (
              <EmptyState
                icon={activeMarket !== 'all' ? 'filter-list-off' : 'event-busy'}
                title={activeMarket !== 'all' ? 'Nessun risultato' : t('predictor.noLiveUpcoming')}
                subtitle={
                  activeMarket !== 'all'
                    ? `Nessuna partita soddisfa il filtro "${MARKET_FILTERS.find(f => f.id === activeMarket)?.label}". Prova un altro filtro.`
                    : t('predictor.noLiveUpcomingSub')
                }
              />
            ) : (
              <View style={{ gap: 24 }}>
                {groupedFixtures.map((group) => (
                  <View key={group.dateLabel} style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
                      <View style={{ height: 1, flex: 1, backgroundColor: colors.accent15 }} />
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                        {group.dateLabel}
                      </Text>
                      <View style={{ height: 1, flex: 1, backgroundColor: colors.accent15 }} />
                    </View>
                    <ResponsiveGrid columns={gridColumns} gap={12}>
                      {group.items.map((f) => {
                        const pred = predictionMap.get(f.fixture.id);
                        const hasDrift = activeMarket === 'drift'
                          || (pred?.marketOverround != null && pred.marketOverround < 1.06)
                          || ((pred?.valueBets?.some((vb) => vb.edge >= 0.05)) ?? false);
                        return (
                          <MatchListItem
                            key={f.fixture.id}
                            fixture={f}
                            prediction={pred}
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
                        );
                      })}
                    </ResponsiveGrid>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Discovery / Insights CTA ── */}
          <View style={{ gap: 14 }}>
            <SectionHeader title={t('predictor.discovery')} />
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
                    {t('predictor.accumulator')}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
                    {t('insights.accumulatorSubtitle')}
                  </Text>
                </View>
              </View>
              <NeonButton
                label={t('predictor.openInsights')}
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
                {selectedFixtureIds.length} {selectedFixtureIds.length === 1 ? 'partita selezionata' : 'partite selezionate'}
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
                  Aggiungi
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
        <Skeleton height={210} radius={24} />
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
  const t = useT();
  const isQuota =
    error?.name === 'QuotaExceededError' ||
    error?.message?.toLowerCase().includes('quota') ||
    error?.message?.toLowerCase().includes('limit');

  return (
    <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
      <BoroIcon name={isQuota ? "schedule" : "error-outline"} size={40} color={colors.onSurfaceVariant} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
          {isQuota ? t('common.apiLimitTitle') : t('common.errorTitle')}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 }}>
          {isQuota
            ? t('common.apiLimitSub')
            : t('common.errorSub')}
        </Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <NeonButton label={t('common.retry')} onPress={onRetry} size="sm" variant="outline" fullWidth={false} />
      </View>
    </GlassCard>
  );
};

const MissingKeyNotice: React.FC = () => {
  const colors = useColors();
  return (
    <View style={{ gap: 16, paddingTop: 16 }}>
      <GlassCard padding={20} activeBorder glow style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BoroIcon name="key" size={20} color={colors.primaryFixed} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
              Sportmonks Token Required
            </Text>
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 }}>
            BORO fetches live football predictions and match data from Sportmonks Pro. Add your API token to
            <Text style={{ color: colors.primaryFixed }}> .env</Text> under
            <Text style={{ color: colors.primaryFixed }}> EXPO_PUBLIC_SPORTMONKS_KEY</Text>, then restart the dev server.
          </Text>
        </View>
        <View style={{ marginTop: 14, gap: 6 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.5 }}>
            ACTIVATION STEP
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 13 }}>
            Copy your Sportmonks Pro API token and paste it as <Text style={{ color: colors.primaryFixed }}>EXPO_PUBLIC_SPORTMONKS_KEY</Text>.
          </Text>
        </View>
      </GlassCard>
    </View>
  );
};
