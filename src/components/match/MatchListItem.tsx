import React from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { router } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useFavoritesStore } from '@/store/favoritesStore';
import type { PolymarketEvent } from '@/services/api/polymarket';

interface MatchListItemProps {
  fixture: PolymarketEvent;
  prediction?: any;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheckboxToggle?: () => void;
  showForm?: boolean;
  hasInjuries?: boolean;
}

export const MatchListItem: React.FC<MatchListItemProps> = ({
  fixture,
  prediction,
  showCheckbox = false,
  checked = false,
  onCheckboxToggle,
}) => {
  const colors = useColors();
  const haptics = useHaptics();
  const favorites = useFavoritesStore();
  const isFav = favorites.isFavorite('fixtures', fixture.id);

  const handlePress = () => {
    haptics.light();
    if (showCheckbox && onCheckboxToggle) {
      onCheckboxToggle();
    } else {
      // Navigate to match detail screen (which will be our market detail screen)
      router.push(`/match/${fixture.id}`);
    }
  };

  const market = fixture.markets?.[0];
  const yesPrice = market?.outcomePrices?.[0] ?? 0.50;
  const noPrice = market?.outcomePrices?.[1] ?? (1 - yesPrice);

  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = Math.round(noPrice * 100);

  // Format Volume
  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(0)}k`;
    return `$${vol.toFixed(0)}`;
  };

  // Determine top outcome and prob
  const maxPriceIndex = market?.outcomePrices.reduce(
    (maxIdx, price, idx, arr) => (price > arr[maxIdx] ? idx : maxIdx),
    0
  ) ?? 0;
  const topOutcome = market?.outcomes[maxPriceIndex] || 'Yes';
  const topProbability = Math.round((market?.outcomePrices[maxPriceIndex] || 0.5) * 100);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: 10 })}
    >
      <GlassCard
        padding={14}
        style={isFav ? {
          borderColor: `${colors.primaryFixed}33`,
          borderWidth: 1,
        } : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Glass Checkbox Column */}
          {showCheckbox && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                haptics.light();
                onCheckboxToggle?.();
              }}
              style={{
                width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
                borderColor: checked ? colors.primaryFixed : 'rgba(255, 255, 255, 0.25)',
                backgroundColor: checked ? colors.accent15 : 'rgba(255, 255, 255, 0.02)',
                alignItems: 'center', justifyContent: 'center', marginRight: 4,
              }}
            >
              {checked && <BoroIcon name="check" size={14} color={colors.primaryFixed} />}
            </Pressable>
          )}

          {/* Event Image / Icon */}
          <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
            {fixture.image ? (
              <Image source={{ uri: fixture.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={{ fontSize: 20 }}>🔮</Text>
            )}
          </View>

          {/* Event details */}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{
                backgroundColor: colors.accent10,
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
              }}>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 9, fontWeight: 'bold' }}>
                  {fixture.category.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9 }}>
                {formatVolume(fixture.volume)} Vol.
              </Text>
              {isFav && (
                <BoroIcon name="favorite" size={10} color={colors.primaryFixed} />
              )}
            </View>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={2}>
              {fixture.title}
            </Text>
          </View>

          {/* Probability Indicator */}
          <View style={{ alignItems: 'flex-end', gap: 4, width: 80 }}>
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 16 }}>
              {topProbability}%
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, textAlign: 'right' }} numberOfLines={1}>
              {topOutcome}
            </Text>
            
            {/* Visual Probability Split Bar */}
            <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', overflow: 'hidden', marginTop: 2 }}>
              <View style={{ width: `${yesPercent}%`, height: '100%', backgroundColor: colors.primaryFixed }} />
              <View style={{ width: `${noPercent}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};
