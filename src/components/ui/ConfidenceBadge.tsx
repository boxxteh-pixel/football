import React from 'react';
import { Text, View } from 'react-native';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { ConfidenceTier } from '@/types/prediction';

interface ConfidenceBadgeProps {
  tier: ConfidenceTier;
  compact?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ tier, compact = false }) => {
  const colors = useColors();

  const tierStyles: Record<ConfidenceTier, { bg: string; fg: string; label: string; border: string }> = {
    ELITE: {
      bg: colors.accent20,
      border: colors.accent40,
      fg: colors.primaryFixed,
      label: 'ELITE PICK',
    },
    HIGH: {
      bg: colors.accent15,
      border: colors.accent30,
      fg: colors.primaryFixed,
      label: 'HIGH CONFIDENCE',
    },
    MEDIUM: {
      bg: 'rgba(2,102,255,0.15)',
      border: 'rgba(2,102,255,0.3)',
      fg: colors.secondaryFixed,
      label: 'MED CONFIDENCE',
    },
    LOW: {
      bg: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.1)',
      fg: colors.onSurfaceVariant,
      label: 'LOW CONFIDENCE',
    },
  };

  const style = tierStyles[tier];
  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        borderWidth: 1,
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 2 : 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: style.fg,
          fontFamily: fonts.label,
          fontSize: compact ? 9 : 11,
          letterSpacing: 1,
        }}
      >
        {compact ? tier : style.label}
      </Text>
    </View>
  );
};
