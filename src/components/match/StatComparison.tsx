import React from 'react';
import { Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface StatComparisonProps {
  label: string;
  home: number | string;
  away: number | string;
  homePercent: number; // 0-100
}

export const StatComparison: React.FC<StatComparisonProps> = ({
  label,
  home,
  away,
  homePercent,
}) => {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(100, homePercent));

  return (
    <GlassCard padding={16} style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 11,
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 22 }}>{home}</Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 22, opacity: 0.5 }}>
          {away}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          marginTop: 10,
          borderRadius: 9999,
          backgroundColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${clamped}%`,
            backgroundColor: colors.primaryFixed,
            height: '100%',
          }}
        />
        <View
          style={{
            width: `${100 - clamped}%`,
            backgroundColor: 'rgba(255,255,255,0.2)',
            height: '100%',
          }}
        />
      </View>
    </GlassCard>
  );
};
