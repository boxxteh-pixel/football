import React from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProbabilityRing } from '@/components/ui/ProbabilityRing';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface AIInsightCardProps {
  label: string;
  title: string;
  subLabel?: string;
  subLabelColor?: string;
  subIcon?: keyof typeof MaterialIcons.glyphMap | null;
  probability: number;
  accentLeft?: boolean;
  ringColor?: string;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  label,
  title,
  subLabel,
  subLabelColor,
  subIcon = 'trending-up',
  probability,
  accentLeft = false,
  ringColor,
}) => {
  const colors = useColors();
  const resolvedSubLabelColor = subLabelColor || colors.primaryFixedDim;
  const resolvedRingColor = ringColor || colors.primaryFixed;
  return (
    <GlassCard padding={16} style={{ position: 'relative', overflow: 'hidden' }}>
      {accentLeft && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: resolvedRingColor,
          }}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingLeft: accentLeft ? 8 : 0,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {label}
          </Text>
          <Text
            style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {subIcon ? (
                <MaterialIcons name={subIcon} size={14} color={resolvedSubLabelColor} />
              ) : null}
              <Text style={{ color: resolvedSubLabelColor, fontFamily: fonts.body, fontSize: 13 }}>{subLabel}</Text>
            </View>
          ) : null}
        </View>
        <ProbabilityRing value={probability} color={resolvedRingColor} size={64} />
      </View>
    </GlassCard>
  );
};
