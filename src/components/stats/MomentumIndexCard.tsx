import React from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { MomentumBars } from '@/components/ui/MomentumBars';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';

interface MomentumIndexCardProps {
  bars: number[];
  attackDominancePct: number;
  threatLevel: 'Extreme' | 'High' | 'Medium' | 'Low' | 'Neutral';
  rangeLabel?: string;
}

export const MomentumIndexCard: React.FC<MomentumIndexCardProps> = ({
  bars,
  attackDominancePct,
  threatLevel,
  rangeLabel = "LAST 10'",
}) => {
  const colors = useColors();
  const t = useT();

  return (
    <GlassCard padding={16}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="bolt" size={20} color={colors.primaryFixed} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16 }}>
            {t('stats.momentum.index')}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {rangeLabel}
          </Text>
        </View>
      </View>

      <MomentumBars values={bars} height={128} />

      <View
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          gap: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {t('stats.momentum.attack')}
          </Text>
          <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20, marginTop: 4 }}>
            {Math.round(attackDominancePct)}%
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {t('stats.momentum.threat')}
          </Text>
          <Text style={{ color: colors.secondaryFixed, fontFamily: fonts.stats, fontSize: 20, marginTop: 4 }}>
            {t(`stats.threat.${threatLevel.toLowerCase()}` as any)}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
};
