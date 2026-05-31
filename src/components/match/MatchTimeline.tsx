import React from 'react';
import { Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import type { FixtureEvent } from '@/types/match';

interface MatchTimelineProps {
  events: FixtureEvent[];
  homeTeamId: number;
}

const iconFor = (event: FixtureEvent): string => {
  if (event.type === 'Goal') return 'sports-soccer';
  if (event.type === 'Card') {
    return event.detail === 'Red Card' || event.detail === 'Second Yellow card' ? 'square' : 'square';
  }
  if (event.type === 'subst') return 'swap-horiz';
  return 'change-history';
};

import type { BoroColors } from '@/theme/colors';

const colorFor = (event: FixtureEvent, colors: BoroColors): string => {
  if (event.type === 'Goal') return colors.primaryFixed;
  if (event.detail === 'Red Card') return colors.error;
  if (event.detail === 'Yellow Card' || event.detail === 'Second Yellow card') return '#EAB308';
  return colors.onSurfaceVariant;
};

export const MatchTimeline: React.FC<MatchTimelineProps> = ({ events, homeTeamId }) => {
  const colors = useColors();
  const t = useT();
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => b.time.elapsed - a.time.elapsed);

  return (
    <GlassCard padding={16}>
      <Text
        style={{
          color: colors.onSurface,
          fontFamily: fonts.headlineMd,
          fontSize: 16,
          marginBottom: 12,
          letterSpacing: -0.3,
        }}
      >
        {t('match.events')}
      </Text>
      <View style={{ gap: 10 }}>
        {sorted.slice(0, 10).map((event, i) => {
          const isHome = event.team.id === homeTeamId;
          return (
            <View
              key={`${event.time.elapsed}-${event.player.name}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
              }}
            >
              <View style={{ width: 36, alignItems: 'center' }}>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.stats,
                    fontSize: 13,
                  }}
                >
                  {event.time.elapsed}'
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: isHome ? 'flex-start' : 'flex-end',
                  gap: 8,
                }}
              >
                {isHome && <BoroIcon name={iconFor(event)} size={18} color={colorFor(event, colors)} />}
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    textAlign: isHome ? 'left' : 'right',
                  }}
                  numberOfLines={1}
                >
                  {event.player.name ?? '—'}
                  {event.detail ? ` (${event.detail})` : ''}
                </Text>
                {!isHome && <BoroIcon name={iconFor(event)} size={18} color={colorFor(event, colors)} />}
              </View>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
};
