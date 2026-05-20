import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_LEAGUES } from '@/constants/leagues';
import { quickPredict } from '@/services/ai/predictor';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import { useT } from '@/theme/i18n';

export default function PredictorTab() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [activeLeague, setActiveLeague] = useState<number | null>(null);
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const t = useT();

  const { data, isLoading, refetch, isRefetching, error } = useTodayFixtures(activeLeague ?? undefined);

  const fixtures = useMemo<Fixture[]>(() => {
    if (!data) return [];
    return data.filter((f) => {
      if (!selectedLeagueIds.includes(f.league.id) && !activeLeague) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        f.teams.home.name.toLowerCase().includes(q) ||
        f.teams.away.name.toLowerCase().includes(q) ||
        f.league.name.toLowerCase().includes(q)
      );
    });
  }, [data, selectedLeagueIds, search, activeLeague]);

  const bestPicks = useMemo(
    () =>
      [...fixtures]
        .map((f) => ({ fixture: f, prob: quickPredict(f).topPick.probability }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 5)
        .map((x) => x.fixture),
    [fixtures],
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
        <View style={{ gap: 24 }}>
          <View style={{ gap: 16 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('predictor.search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
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

          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 22 }}>
                {t('predictor.bestPicks')}
              </Text>
              <LivePulse />
            </View>
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
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {bestPicks.map((f) => (
                  <BestPickCard key={f.fixture.id} fixture={f} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 22 }}>
              {t('predictor.slate')}
            </Text>
            {isLoading ? (
              <ListSkeleton />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : fixtures.length === 0 ? (
              <EmptyState
                icon="search-off"
                title={t('common.noFiltersTitle')}
                subtitle={t('common.noFiltersSub')}
              />
            ) : (
              fixtures.map((f) => <MatchListItem key={f.fixture.id} fixture={f} />)
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 22 }}>
              {t('predictor.discovery')}
            </Text>
            <GlassCard padding={20} activeBorder style={{ gap: 16 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialIcons name="auto-awesome" size={20} color={colors.primaryFixed} />
                  <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16 }}>
                    {t('predictor.accumulator')}
                  </Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
                  {t('insights.accumulatorSubtitle')}
                </Text>
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
      <View key={i} style={{ marginRight: 16, width: 300 }}>
        <Skeleton height={220} radius={16} />
      </View>
    ))}
  </ScrollView>
);

const ListSkeleton: React.FC = () => (
  <View style={{ gap: 12 }}>
    {[0, 1, 2, 3].map((i) => (
      <Skeleton key={i} height={84} radius={12} />
    ))}
  </View>
);

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle }) => {
  const colors = useColors();
  return (
    <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
      <MaterialIcons name={icon} size={40} color={colors.onSurfaceVariant} />
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
      <MaterialIcons name={isQuota ? "schedule" : "error-outline"} size={40} color={isQuota ? colors.primaryFixed : colors.error} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
          {isQuota ? "API Limit Reached" : t('common.errorTitle')}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 }}>
          {isQuota
            ? "You have reached the daily limit of 100 requests on API-Football's free tier. Please wait until midnight UTC or upgrade your plan."
            : t('common.errorSub')}
        </Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <NeonButton label={t('common.retry')} onPress={onRetry} size="sm" fullWidth={false} />
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
            <MaterialIcons name="key" size={20} color={colors.primaryFixed} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}>
              API key required
            </Text>
          </View>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 }}>
            BORO fetches real football data from API-Football. Add your free key to
            <Text style={{ color: colors.primaryFixed }}> .env</Text> under
            <Text style={{ color: colors.primaryFixed }}> EXPO_PUBLIC_API_FOOTBALL_KEY</Text>, then restart
            the dev server.
          </Text>
        </View>
        <View style={{ marginTop: 14, gap: 6 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.5 }}>
            STEP 1
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 13 }}>
            Sign up at api-football.com (free 100 req/day)
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.5, marginTop: 8 }}>
            STEP 2
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 13 }}>
            Copy your key, paste it into .env, restart Expo.
          </Text>
        </View>
      </GlassCard>
    </View>
  );
};
