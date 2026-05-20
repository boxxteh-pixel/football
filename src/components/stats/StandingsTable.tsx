import React from 'react';
import { Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { StandingRow } from '@/types/league';
import { useT } from '@/theme/i18n';

interface StandingsTableProps {
  rows: StandingRow[];
  aiPositions?: Map<number, number>; // teamId -> predicted final position
  maxRows?: number;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  aiPositions,
  maxRows = 10,
}) => {
  const colors = useColors();
  const display = rows.slice(0, maxRows);
  const t = useT();

  const headerCell = {
    color: colors.onSurfaceVariant,
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 0.5,
  } as const;

  return (
    <GlassCard style={{ overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      >
        <Text style={[headerCell, { flex: 1 }]}>#</Text>
        <Text style={[headerCell, { flex: 5 }]}>{t('stats.table.team')}</Text>
        <Text style={[headerCell, { flex: 2, textAlign: 'center' }]}>{t('stats.table.actual')}</Text>
        <Text style={[headerCell, { flex: 2, textAlign: 'center', color: colors.primaryFixed }]}>
          {t('stats.table.modelPos')}
        </Text>
      </View>
      {display.map((row, idx) => {
        const aiPos = aiPositions?.get(row.team.id) ?? row.rank;
        const delta = row.rank - aiPos; // positive = predicted higher
        const deltaLabel = delta === 0 ? '(=)' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
        const deltaBg =
          delta > 0
            ? colors.primaryFixed
            : delta < 0
              ? 'rgba(255,180,171,0.2)'
              : colors.accent10;
        const deltaFg = delta > 0 ? colors.background : delta < 0 ? colors.error : colors.primaryFixed;

        return (
          <View
            key={row.team.id}
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingVertical: 14,
              alignItems: 'center',
              borderTopWidth: idx === 0 ? 0 : 1,
              borderTopColor: 'rgba(255,255,255,0.04)',
              backgroundColor: idx === 1 ? 'rgba(195,244,0,0.02)' : 'transparent',
            }}
          >
            <Text style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.stats, fontSize: 14 }}>
              {row.rank}
            </Text>
            <View style={{ flex: 5, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamCrest uri={row.team.logo} size={28} />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.bodyBold,
                  fontSize: 13,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {row.team.name}
              </Text>
            </View>
            <Text
              style={{
                flex: 2,
                color: colors.onSurface,
                fontFamily: fonts.body,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              {row.points}
            </Text>
            <View style={{ flex: 2, alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: deltaBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: deltaFg,
                    fontFamily: fonts.label,
                    fontSize: 11,
                  }}
                >
                  {aiPos} {deltaLabel}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </GlassCard>
  );
};
