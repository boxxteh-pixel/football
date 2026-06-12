import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Platform,
  ActivityIndicator, KeyboardAvoidingView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/layouts/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useSearchEvents } from '@/hooks/useFixtures';

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const { data: results = [], isLoading } = useSearchEvents(query);

  const formatVolume = (vol: number) => {
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(0)}k`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenBackground />

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <BoroIcon name="arrow-back" size={24} color={colors.primaryFixed} />
        </Pressable>

        {/* Search input */}
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 14, height: 44,
        }}>
          <BoroIcon name="search" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search prediction markets (e.g. Trump, Crypto)..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{
              flex: 1,
              color: colors.onSurface,
              fontFamily: fonts.body,
              fontSize: 15,
              ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {isLoading && <ActivityIndicator size="small" color={colors.primaryFixed} />}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 1 ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
              <BoroIcon name="search-off" size={44} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
                No prediction markets found for{'\n'}"{query}"
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
              <BoroIcon name="search" size={44} color={`${colors.primaryFixed}44`} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
                Search Polymarket prediction board
              </Text>
              <Text style={{ color: `${colors.onSurfaceVariant}88`, fontFamily: fonts.label, fontSize: 11, textAlign: 'center' }}>
                Type politics, crypto, pop culture or sports keywords
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const primaryMarket = item.markets?.[0];
          const yesPrice = primaryMarket?.outcomePrices?.[0] ?? 0.5;
          const topPercent = Math.round(yesPrice * 100);
          
          return (
            <Pressable
              onPress={() => router.push(`/match/${item.id}`)}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <GlassCard padding={12}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Event image */}
                  <View style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    ) : (
                      <Text style={{ fontSize: 18 }}>🔮</Text>
                    )}
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 9, fontWeight: 'bold' }}>
                        {item.category.toUpperCase()}
                      </Text>
                      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9 }}>
                        {formatVolume(item.volume)} Vol.
                      </Text>
                    </View>
                    <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>

                  {/* Primary Probability */}
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 14 }}>
                      {topPercent}%
                    </Text>
                    <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8 }}>
                      Yes
                    </Text>
                  </View>
                  
                  <BoroIcon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}
