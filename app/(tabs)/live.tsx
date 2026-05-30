'use no memo';
import React from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { MatchListItem } from '@/components/match/MatchListItem';
import { ResultListItem } from '@/components/match/ResultListItem';
import { GlassCard } from '@/components/ui/GlassCard';
import { LivePulse } from '@/components/ui/LivePulse';
import { Skeleton } from '@/components/ui/Skeleton';
import { NeonButton } from '@/components/ui/NeonButton';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useLiveFixtures } from '@/hooks/useFixtures';
import { useResults } from '@/hooks/useResults';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/theme/i18n';
import { useIsFocused } from '@react-navigation/native';

export default function ResultsTab() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const t = useT();

  const { data: liveData, isRefetching: liveRefetching } = useLiveFixtures(selectedLeagueIds, isFocused);
  const { rows, summary, isLoading, refetch, isRefetching, error } = useResults(4);

  const liveFixtures = (liveData ?? []).filter((f) => selectedLeagueIds.includes(f.league.id));

  return (
    <ScreenContainer
      title="BORO"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || liveRefetching}
          onRefresh={refetch}
          tintColor={colors.primaryFixed}
        />
      }
    >
      <View style={{ gap: 20 }}>
        {/* Header */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
            {t('results.title')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {t('results.subtitle')}
          </Text>
        </View>

        {/* Accuracy summary */}
        {summary.total > 0 && (
          <GlassCard padding={18} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SummaryStat
                label={t('results.accuracy')}
                value={`${Math.round(summary.hitRate)}%`}
                color={summary.hitRate >= 50 ? '#22c55e' : colors.onSurface}
              />
              <SummaryStat label={t('results.record')} value={`${summary.correct}/${summary.total}`} color={colors.onSurface} />
              <SummaryStat label={t('results.brier')} value={summary.brier.toFixed(3)} color={colors.onSurfaceVariant} />
            </View>
            {/* Hit-rate bar */}
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${summary.hitRate}%`, backgroundColor: '#22c55e' }} />
              <View style={{ flex: 1, backgroundColor: '#ef4444' }} />
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
              {t('results.legend')}
            </Text>
          </GlassCard>
        )}

        {/* Live now */}
        {liveFixtures.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 }}>
                {t('results.liveNow')}
              </Text>
              <LivePulse label="LIVE" />
            </View>
            {liveFixtures.map((f) => (
              <MatchListItem key={f.fixture.id} fixture={f} />
            ))}
          </View>
        )}

        {/* Recent results */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 }}>
            {t('results.recent')}
          </Text>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={84} radius={12} />
              ))}
            </View>
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : rows.length === 0 ? (
            <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
              <BoroIcon name="history" size={40} color={colors.onSurfaceVariant} />
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
                  {t('results.empty.title')}
                </Text>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    textAlign: 'center',
                    paddingHorizontal: 12,
                  }}
                >
                  {t('results.empty.sub')}
                </Text>
              </View>
            </GlassCard>
          ) : (
            rows.map((row) => <ResultListItem key={row.fixture.fixture.id} row={row} />)
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
