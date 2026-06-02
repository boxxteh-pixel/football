import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View, ScrollView, Platform } from 'react-native';
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
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures, useLiveFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import { isLive, isScheduled } from '@/types/match';
import { useT } from '@/theme/i18n';
import { useIsFocused } from '@react-navigation/native';

export default function PredictorTab() {
  const colors = useColors();
  const { gridColumns } = useResponsive();
  const [search, setSearch] = useState('');
  const [activeLeague, setActiveLeague] = useState<number | null>(null);
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const isFocused = useIsFocused();
  const t = useT();

  const { data, isLoading, refetch, isRefetching, error } = useTodayFixtures(activeLeague ?? undefined);
  const { predictionMap } = useTodayPredictions();
  const { data: liveData = [] } = useLiveFixtures(selectedLeagueIds, isFocused);

  // Home shows ONLY live + not-yet-started matches. Merge the dedicated live
  // feed (freshest scores/minute) with scheduled fixtures from the day's slate.
  const fixtures = useMemo<Fixture[]>(() => {
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
      [...fixtures]
        .map((f) => ({ fixture: f, prob: predictionMap.get(f.fixture.id)?.topPick.probability ?? -1 }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 5)
        .map((x) => x.fixture),
    [fixtures, predictionMap],
  );

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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryFixed}
          />
        }
      >
        <View style={{ gap: 28 }}>
          <View style={{ gap: 14 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('predictor.search')} />
            <View style={{ width: '100%', overflow: 'hidden' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ width: '100%', marginHorizontal: -16 }}
                contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
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
          </View>

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
              <View style={{ width: '100%', overflow: 'hidden' }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ width: '100%', marginHorizontal: -16 }}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                  {bestPicks.map((f) => (
                    <BestPickCard key={f.fixture.id} fixture={f} prediction={predictionMap.get(f.fixture.id)} />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ gap: 14 }}>
            <SectionHeader
              title={t('predictor.liveUpcoming')}
              right={liveCount > 0 ? <LivePulse label={`${liveCount} LIVE`} /> : undefined}
            />
            {isLoading ? (
              <ListSkeleton />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : fixtures.length === 0 ? (
              <EmptyState
                icon="event-busy"
                title={t('predictor.noLiveUpcoming')}
                subtitle={t('predictor.noLiveUpcomingSub')}
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
                      {group.items.map((f) => (
                        <MatchListItem key={f.fixture.id} fixture={f} prediction={predictionMap.get(f.fixture.id)} />
                      ))}
                    </ResponsiveGrid>
                  </View>
                ))}
              </View>
            )}
          </View>

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
