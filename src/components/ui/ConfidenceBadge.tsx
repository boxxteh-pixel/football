import React from 'react';
import { Text, View } from 'react-native';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { ConfidenceTier } from '@/types/prediction';
import { useT } from '@/theme/i18n';

interface ConfidenceBadgeProps {
  tier: ConfidenceTier;
  compact?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ tier, compact = false }) => {
  const colors = useColors();
  const t = useT();

  const tierStyles: Record<ConfidenceTier, { bg: string; fg: string; labelKey: string; compactKey: string; border: string }> = {
    ELITE: {
      bg: colors.accent20,
      border: colors.accent40,
      fg: colors.primaryFixed,
      labelKey: 'confidence.elitePick',
      compactKey: 'confidence.elite',
    },
    HIGH: {
      bg: colors.accent15,
      border: colors.accent30,
      fg: colors.primaryFixed,
      labelKey: 'confidence.high',
      compactKey: 'confidence.highShort',
    },
    MEDIUM: {
      bg: 'rgba(2,102,255,0.15)',
      border: 'rgba(2,102,255,0.3)',
      fg: colors.secondaryFixed,
      labelKey: 'confidence.medium',
      compactKey: 'confidence.mediumShort',
    },
    LOW: {
      bg: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.1)',
      fg: colors.onSurfaceVariant,
      labelKey: 'confidence.low',
      compactKey: 'confidence.lowShort',
    },
  };

  const style = tierStyles[tier];
  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        borderWidth: 1,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 5,
        borderRadius: 8,
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
        {compact ? t(style.compactKey) : t(style.labelKey)}
      </Text>
    </View>
  );
};
