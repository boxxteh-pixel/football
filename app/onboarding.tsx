import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, Dimensions, Platform,
  ScrollView, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useSettingsStore } from '@/store/settingsStore';
import { requestNotificationPermissions } from '@/services/notifications/notificationService';

const { width: SCREEN_W } = Dimensions.get('window');

export const ONBOARDING_KEY = 'boro_onboarding_done_v1';

interface Slide {
  icon: string;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'sports-soccer',
    emoji: '⚽',
    title: 'Benvenuto in BORO',
    subtitle: 'Il tuo assistente AI per le predizioni di calcio e cricket. Analisi real-time, value bets e molto altro.',
    accent: '#c3f400',
  },
  {
    icon: 'psychology',
    emoji: '🧠',
    title: 'Predizioni Quantitative',
    subtitle: 'Il nostro modello combina ELO, xG, Poisson, Dixon-Coles e quote bookmaker per la massima precisione.',
    accent: '#a78bfa',
  },
  {
    icon: 'trending-up',
    emoji: '💰',
    title: 'Value Bets & Odds Drift',
    subtitle: 'BORO rileva automaticamente le giocate con edge positivo rispetto al mercato e le quote in calo.',
    accent: '#34d399',
  },
  {
    icon: 'notifications-active',
    emoji: '🔔',
    title: 'Notifiche Live',
    subtitle: 'Ricevi notifiche push 10 minuti prima del kick-off delle tue partite preferite.',
    accent: '#fb923c',
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeSport, setActiveSport] = useState<'football' | 'cricket'>('football');
  const progress = useSharedValue(0);
  const isLast = currentIdx === SLIDES.length - 1;

  const goNext = () => {
    if (currentIdx < SLIDES.length - 1) {
      setCurrentIdx(currentIdx + 1);
      progress.value = withTiming((currentIdx + 1) / (SLIDES.length - 1));
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      progress.value = withTiming((currentIdx - 1) / (SLIDES.length - 1));
    }
  };

  const finish = async () => {
    // Save selected sport
    await useSettingsStore.getState().setSport(activeSport);
    // Request notification permissions
    await requestNotificationPermissions();
    // Mark onboarding done
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  };

  const slide = SLIDES[currentIdx];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Gradient background */}
      <LinearGradient
        colors={[`${slide.accent}18`, colors.background, colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }]} pointerEvents="none">
        <View style={{
          width: 280, height: 280, borderRadius: 140,
          backgroundColor: slide.accent,
          opacity: 0.07,
          ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } as any : {}),
        }} />
      </View>

      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 28 }}>
        {/* Progress dots */}
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                height: 3,
                width: i === currentIdx ? 28 : 8,
                borderRadius: 2,
                backgroundColor: i === currentIdx ? slide.accent : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </View>

        {/* Icon */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 30,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: `${slide.accent}18`,
            borderWidth: 1, borderColor: `${slide.accent}40`,
          }}>
            <Text style={{ fontSize: 44 }}>{slide.emoji}</Text>
          </View>
        </View>

        {/* Text */}
        <View style={{ alignItems: 'center', gap: 14, flex: 1 }}>
          <Text style={{
            color: colors.onSurface, fontFamily: fonts.display,
            fontSize: 28, textAlign: 'center', letterSpacing: -0.5,
          }}>
            {slide.title}
          </Text>
          <Text style={{
            color: colors.onSurfaceVariant, fontFamily: fonts.body,
            fontSize: 15, textAlign: 'center', lineHeight: 23,
            maxWidth: 320,
          }}>
            {slide.subtitle}
          </Text>

          {/* Sport picker — shown on last slide */}
          {isLast && (
            <View style={{ marginTop: 24, gap: 12, width: '100%' }}>
              <Text style={{
                color: colors.onSurfaceVariant, fontFamily: fonts.label,
                fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center',
              }}>
                Scegli il tuo sport
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['football', 'cricket'] as const).map((s) => {
                  const active = activeSport === s;
                  const emoji = s === 'football' ? '⚽' : '🏏';
                  const label = s === 'football' ? 'Calcio' : 'Cricket';
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setActiveSport(s)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 18,
                        borderRadius: 16,
                        backgroundColor: active ? `${slide.accent}18` : 'rgba(255,255,255,0.04)',
                        borderWidth: 1.5,
                        borderColor: active ? `${slide.accent}66` : 'rgba(255,255,255,0.08)',
                        gap: 8,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <Text style={{ fontSize: 32 }}>{emoji}</Text>
                      <Text style={{
                        color: active ? slide.accent : colors.onSurfaceVariant,
                        fontFamily: fonts.bodyBold, fontSize: 15,
                      }}>
                        {label}
                      </Text>
                      {active && (
                        <View style={{
                          width: 20, height: 20, borderRadius: 10,
                          backgroundColor: slide.accent,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <BoroIcon name="check" size={12} color="#000" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {currentIdx > 0 && (
            <Pressable
              onPress={goPrev}
              style={({ pressed }) => ({
                width: 48, height: 48, borderRadius: 14,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <BoroIcon name="arrow-back" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          )}

          <Pressable
            onPress={isLast ? finish : goNext}
            style={({ pressed }) => ({
              flex: 1, height: 52, borderRadius: 16,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              backgroundColor: slide.accent,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ color: '#000', fontFamily: fonts.bodyBold, fontSize: 16 }}>
              {isLast ? 'Inizia con BORO' : 'Avanti'}
            </Text>
            {!isLast && <BoroIcon name="arrow-forward" size={20} color="#000" />}
          </Pressable>
        </View>

        {/* Skip */}
        {!isLast && (
          <Pressable onPress={finish} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
              Salta
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
