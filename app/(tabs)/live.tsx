'use no memo';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { ResultListItem } from '@/components/match/ResultListItem';
import { DateStrip } from '@/components/match/DateStrip';
import { ResponsiveGrid } from '@/components/layouts/ResponsiveGrid';
import { useResponsive } from '@/hooks/useResponsive';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { NeonButton } from '@/components/ui/NeonButton';
import { Chip } from '@/components/ui/Chip';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useResults, type ResultRow } from '@/hooks/useResults';
import { useT } from '@/theme/i18n';

type MarketFilter = 'all' | '1X2' | 'goals' | 'btts';

export default function ResultsTab() {
  const colors = useColors();
  const t = useT();
  const { gridColumns } = useResponsive();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');

  const { rows, summary, isLoading, refetch, isRefetching, error } = useResults(selectedDate, 4);

  const filteredRows = useMemo(() => {
    if (marketFilter === 'all') return rows;
    return rows.filter((r) => {
      const m = r.prediction.topPick.market;
      if (marketFilter === '1X2') return m === 'WIN' || m === 'DRAW';
      if (marketFilter === 'goals') return m === 'OVER_2_5' || m === 'UNDER_2_5';
      if (marketFilter === 'btts') return m === 'BTTS';
      return true;
    });
  }, [rows, marketFilter]);

  const filters: Array<{ id: MarketFilter; label: string }> = [
    { id: 'all', label: t('results.filterAll') },
    { id: '1X2', label: t('results.filter1x2') },
    { id: 'goals', label: t('results.filterGoals') },
    { id: 'btts', label: t('results.filterBtts') },
  ];

  return (
    <ScreenContainer
      title="BORO"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryFixed} />
      }
    >
      <View style={{ gap: 18 }}>
        {/* Header */}
        <SectionHeader eyebrow={t('results.subtitle')} title={t('results.title')} />

        {/* Calendar date strip */}
        <DateStrip selected={selectedDate} onSelect={setSelectedDate} count={14} />

        {/* Accuracy summary */}
        {summary.total > 0 && (
          <GlassCard padding={18} style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SummaryStat
                label={t('results.accuracy')}
                value={`${Math.round(summary.hitRate)}%`}
                color={summary.hitRate >= 50 ? '#22c55e' : colors.onSurface}
              />
              <SummaryStat label={t('results.record')} value={`${summary.correct}/${summary.total}`} color={colors.onSurface} />
              <SummaryStat label={t('results.brier')} value={summary.brier.toFixed(3)} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${summary.hitRate}%`, backgroundColor: '#22c55e' }} />
              <View style={{ flex: 1, backgroundColor: '#ef4444' }} />
            </View>

            {/* Betting performance row: ROI, profit (flat 1u stakes), streak. */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SummaryStat
                label={t('results.roi')}
                value={`${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`}
                color={summary.roi >= 0 ? '#22c55e' : '#ef4444'}
              />
              <SummaryStat
                label={t('results.profit')}
                value={`${summary.profitUnits >= 0 ? '+' : ''}${summary.profitUnits.toFixed(2)}u`}
                color={summary.profitUnits >= 0 ? '#22c55e' : '#ef4444'}
              />
              <SummaryStat
                label={t('results.streak')}
                value={
                  summary.streak > 0 && summary.streakType
                    ? `${summary.streak}${summary.streakType === 'correct' ? 'W' : 'L'}`
                    : '—'
                }
                color={
                  summary.streakType === 'correct'
                    ? '#22c55e'
                    : summary.streakType === 'incorrect'
                      ? '#ef4444'
                      : colors.onSurfaceVariant
                }
              />
            </View>

            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
              {t('results.legend')}
            </Text>
          </GlassCard>
        )}

        {/* Market filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {filters.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={marketFilter === f.id}
              onPress={() => setMarketFilter(f.id)}
            />
          ))}
        </ScrollView>

        {/* Results list */}
        <View style={{ gap: 10 }}>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={84} radius={12} />
              ))}
            </View>
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : filteredRows.length === 0 ? (
            <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
              <BoroIcon name="history" size={40} color={colors.onSurfaceVariant} />
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
                  {selectedDate ? t('results.noDay') : t('results.empty.title')}
                </Text>
                {!selectedDate && (
                  <Text
                    style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 }}
                  >
                    {t('results.empty.sub')}
                  </Text>
                )}
              </View>
            </GlassCard>
          ) : (
            <ResponsiveGrid columns={gridColumns} gap={10}>
              {filteredRows.map((row: ResultRow) => (
                <ResultListItem key={row.fixture.fixture.id} row={row} />
              ))}
            </ResponsiveGrid>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const SummaryStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ color, fontFamily: fonts.stats, fontSize: 22 }}>{value}</Text>
    </View>
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
      <BoroIcon name={isQuota ? 'schedule' : 'error-outline'} size={40} color={colors.onSurfaceVariant} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
          {isQuota ? t('common.apiLimitTitle') : t('common.errorTitle')}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 }}>
          {isQuota ? t('common.apiLimitSub') : t('common.errorSub')}
        </Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <NeonButton label={t('common.retry')} onPress={onRetry} size="sm" variant="outline" fullWidth={false} />
      </View>
    </GlassCard>
  );
};
