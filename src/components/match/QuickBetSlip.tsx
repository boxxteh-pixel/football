import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';

interface BetOption {
  label: string;
  odds: number;
  highlight?: boolean;
}

interface QuickBetSlipProps {
  options: BetOption[];
  topValueLabel?: string;
}

export const QuickBetSlip: React.FC<QuickBetSlipProps> = ({
  options,
  topValueLabel = 'TOP VALUE',
}) => {
  const colors = useColors();
  const haptics = useHaptics();
  return (
    <GlassCard padding={16} activeBorder>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16 }}>
          Quick Bet AI Suggestion
        </Text>
        <View
          style={{
            backgroundColor: colors.primaryFixed,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              color: colors.onPrimaryFixed,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {topValueLabel}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {options.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => haptics.medium()}
            style={({ pressed }) => ({
              flex: 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: opt.highlight ? colors.accent30 : 'rgba(255,255,255,0.08)',
              padding: 12,
              alignItems: 'center',
              gap: 4,
            })}
          >
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 10,
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            <Text
              style={{
                color: opt.highlight ? colors.primaryFixed : colors.onSurface,
                fontFamily: fonts.stats,
                fontSize: 18,
              }}
            >
              {opt.odds.toFixed(2)}
            </Text>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );
};
