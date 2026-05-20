'use no memo';
import React from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { MatchListItem } from '@/components/match/MatchListItem';
import { GlassCard } from '@/components/ui/GlassCard';
import { LivePulse } from '@/components/ui/LivePulse';
import { Skeleton } from '@/components/ui/Skeleton';
import { NeonButton } from '@/components/ui/NeonButton';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useLiveFixtures } from '@/hooks/useFixtures';
import { useSettingsStore } from '@/store/settingsStore';
import { useT } from '@/theme/i18n';
import { useIsFocused } from '@react-navigation/native';

export default function LiveTab() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  const { data, isLoading, refetch, isRefetching, error } = useLiveFixtures(undefined, isFocused);
  const t = useT();

  const fixtures = (data ?? []).filter((f) => selectedLeagueIds.includes(f.league.id));

  return (
    <ScreenContainer
      title="BORO"
      showLive
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primaryFixed}
        />
      }
    >
      <View style={{ gap: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <View style={{ gap: 6, flex: 1, marginRight: 8 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 26, letterSpacing: -0.5 }}>
              {t('live.title')}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              {t('live.subtitle')}
            </Text>
          </View>
          <LivePulse label="LIVE" />
        </View>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={84} radius={12} />
            ))}
          </View>
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : fixtures.length === 0 ? (
          <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
            <MaterialIcons name="sports-soccer" size={40} color={colors.onSurfaceVariant} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
                {t('live.empty.title')}
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
                {t('live.empty.sub')}
              </Text>
            </View>
          </GlassCard>
        ) : (
          fixtures.map((f) => <MatchListItem key={f.fixture.id} fixture={f} />)
        )}
      </View>
    </ScreenContainer>
  );
}

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const colors = useColors();
  const t = useT();
  return (
    <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
      <MaterialIcons name="error-outline" size={40} color={colors.error} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
          {t('common.errorTitle')}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 }}>
          {t('common.errorSub')}
        </Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <NeonButton label={t('common.retry')} onPress={onRetry} size="sm" fullWidth={false} />
      </View>
    </GlassCard>
  );
};
