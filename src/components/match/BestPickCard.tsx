import React from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import { router } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import type { PolymarketEvent } from '@/services/api/polymarket';

interface BestPickCardProps {
  fixture: PolymarketEvent;
  prediction?: any;
}

export const BestPickCard: React.FC<BestPickCardProps> = ({ fixture, prediction }) => {
  const colors = useColors();
  const haptics = useHaptics();

  const handlePress = () => {
    haptics.medium();
    router.push(`/match/${fixture.id}`);
  };

  const market = fixture.markets?.[0];
  const maxPriceIndex = market?.outcomePrices.reduce(
    (maxIdx, price, idx, arr) => (price > arr[maxIdx] ? idx : maxIdx),
    0
  ) ?? 0;
  const topOutcome = market?.outcomes[maxPriceIndex] || 'Yes';
  const topProbability = Math.round((market?.outcomePrices[maxPriceIndex] || 0.5) * 100);
  const odds = market?.outcomePrices[maxPriceIndex] ? 1 / market.outcomePrices[maxPriceIndex] : 2.0;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <GlassCard
        rounded="2xl"
        padding={18}
        activeBorder
        style={{ width: 300, marginRight: 14, height: 200 }}
      >
        {/* Card Header: Category & Volume */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: colors.primaryFixed,
              fontFamily: fonts.label,
              fontSize: 10,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              flex: 1,
              fontWeight: 'bold',
            }}
            numberOfLines={1}
          >
            {fixture.category}
          </Text>
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 10,
              }}
            >
              Top Pick
            </Text>
          </View>
        </View>

        {/* Card Body: Title & Large Probability */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flex: 1,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.bodyBold,
                fontSize: 14,
              }}
              numberOfLines={3}
            >
              {fixture.title}
            </Text>
          </View>

          <View style={{ alignItems: 'center', justifyContent: 'center', width: 70 }}>
            <Text
              style={{
                color: colors.primaryFixed,
                fontFamily: fonts.display,
                fontSize: 24,
                letterSpacing: -1,
              }}
            >
              {topProbability}%
            </Text>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 8,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {topOutcome}
            </Text>
          </View>
        </View>

        {/* Card Footer: Pick & Odds details */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.06)',
            paddingTop: 10,
            marginTop: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>
              OUTCOME
            </Text>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 12 }} numberOfLines={1}>
              {topOutcome}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>
              IMPLIED ODDS
            </Text>
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 14 }}>
              {odds.toFixed(2)}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
