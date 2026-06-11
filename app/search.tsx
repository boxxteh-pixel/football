import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Platform,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/layouts/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import type { Fixture } from '@/types/match';
import { isLive, isScheduled } from '@/types/match';
import { format, parseISO } from 'date-fns';
import { DEFAULT_LEAGUES } from '@/constants/leagues';

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  // Fetch today's fixtures across all leagues (no league filter)
  const { data: allFixtures = [], isLoading } = useTodayFixtures(undefined);

  const filtered = useMemo<Fixture[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return allFixtures.filter((f) =>
      f.teams.home.name.toLowerCase().includes(q) ||
      f.teams.away.name.toLowerCase().includes(q) ||
      f.league.name.toLowerCase().includes(q) ||
      f.league.country.toLowerCase().includes(q)
    );
  }, [allFixtures, query]);

  // Group by league
  const grouped = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    filtered.forEach((f) => {
      const key = `${f.league.id}::${f.league.name}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      leagueName: items[0].league.name,
      leagueCountry: items[0].league.country,
      items,
    }));
  }, [filtered]);

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
            placeholder="Cerca squadra, lega o paese..."
            placeholderTextColor={colors.onSurfaceVariant}
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
        data={grouped}
        keyExtractor={(item) => item.leagueName}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 0 ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
              <BoroIcon name="search-off" size={44} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
                Nessuna partita trovata per{'\n'}"{query}"
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
              <BoroIcon name="search" size={44} color={`${colors.primaryFixed}44`} />
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>
                Cerca tra tutte le leghe disponibili
              </Text>
              <Text style={{ color: `${colors.onSurfaceVariant}88`, fontFamily: fonts.label, fontSize: 11, textAlign: 'center' }}>
                Nome squadra, lega o paese
              </Text>
            </View>
          )
        }
        renderItem={({ item: group }) => (
          <View style={{ gap: 8 }}>
            {/* League header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <BoroIcon name="sports-soccer" size={14} color={colors.primaryFixed} />
              <Text style={{ color: colors.primaryFixed, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                {group.leagueName}
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
                · {group.leagueCountry}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </View>

            {/* Fixtures in this league */}
            {group.items.map((f) => {
              const live = isLive(f.fixture.status.short);
              const time = format(parseISO(f.fixture.date), 'HH:mm');
              return (
                <Pressable
                  key={f.fixture.id}
                  onPress={() => router.push(`/match/${f.fixture.id}`)}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
                >
                  <GlassCard padding={12} style={live ? { borderColor: 'rgba(255,149,0,0.5)', borderWidth: 1.5 } : undefined}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {/* Time */}
                      <View style={{ width: 44, alignItems: 'center' }}>
                        {live ? (
                          <Text style={{ color: '#FF9500', fontFamily: fonts.label, fontSize: 10, fontWeight: 'bold' }}>LIVE</Text>
                        ) : (
                          <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>{time}</Text>
                        )}
                      </View>

                      {/* Teams */}
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TeamCrest uri={f.teams.home.logo} size={18} />
                          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }} numberOfLines={1}>
                            {f.teams.home.name}
                          </Text>
                          {live && <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>{f.goals.home ?? 0}</Text>}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TeamCrest uri={f.teams.away.logo} size={18} />
                          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13, flex: 1 }} numberOfLines={1}>
                            {f.teams.away.name}
                          </Text>
                          {live && <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 13 }}>{f.goals.away ?? 0}</Text>}
                        </View>
                      </View>

                      <BoroIcon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
