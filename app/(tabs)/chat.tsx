import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { MatchListItem } from '@/components/match/MatchListItem';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useTodayFixtures } from '@/hooks/useFixtures';
import { useTodayPredictions } from '@/hooks/useTodayPredictions';
import { useSettingsStore } from '@/store/settingsStore';
import { useHaptics } from '@/hooks/useHaptics';
import type { Fixture } from '@/types/match';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';
import { runBot } from '@/services/ai/botEngine';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  matches?: Fixture[];
}

export default function ChatScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const settings = useSettingsStore((s) => s.settings);
  const isIt = settings.language === 'it';
  const t = useT();
  const selectedLeagueIds = settings.selectedLeagueIds;

  const { data: todayFixtures = [], isLoading } = useTodayFixtures();
  const { predictionMap } = useTodayPredictions();

  // Filter fixtures to user-selected leagues for customized recommendations
  const fixtures = useMemo(() => {
    return todayFixtures.filter((f) => selectedLeagueIds.includes(f.league.id));
  }, [todayFixtures, selectedLeagueIds]);

  // Resolve the REAL prediction for a fixture (provider + odds). Returns null
  // when no real data exists — we never show a random/placeholder pick in chat.
  const predictFor = useMemo(
    () => (f: Fixture) => predictionMap.get(f.fixture.id) ?? null,
    [predictionMap],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize with greeting
  useEffect(() => {
    const greetingText = isIt
      ? 'Ciao! Sono BORO, il tuo assistente per i pronostici. 🤖⚽\n\nPosso dirti la partita più sicura, costruirti una multipla, trovare quote di valore, mostrarti le partite live, i migliori Over 2.5 o Gol/Gol — o analizzare una singola partita (scrivi "Inter vs Milan").\n\nUsa i pulsanti rapidi o scrivimi!'
      : "Hi! I'm BORO, your prediction assistant. 🤖⚽\n\nI can give you the safest match, build an accumulator, find value bets, show live matches, the best Over 2.5 or BTTS picks — or analyze a single game (type \"Arsenal vs Chelsea\").\n\nUse the quick buttons or just ask!";

    setMessages([
      {
        id: 'greet',
        sender: 'bot',
        text: greetingText,
        timestamp: new Date(),
      },
    ]);
  }, [isIt]);

  const quickPrompts = isIt
    ? [
        { key: 'safe', label: '🛡️ Più sicura' },
        { key: 'acc', label: '🔥 Multipla' },
        { key: 'value', label: '⚠️ Valore' },
        { key: 'live', label: '📡 Live ora' },
        { key: 'over', label: '⚽ Over 2.5' },
        { key: 'btts', label: '🥅 Gol/Gol' },
      ]
    : [
        { key: 'safe', label: '🛡️ Safest' },
        { key: 'acc', label: '🔥 Accumulator' },
        { key: 'value', label: '⚠️ Value' },
        { key: 'live', label: '📡 Live now' },
        { key: 'over', label: '⚽ Over 2.5' },
        { key: 'btts', label: '🥅 BTTS' },
      ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    haptics.light();
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Process reply after delay
    setTimeout(() => {
      // Ensure data is loaded
      if (isLoading) {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'bot',
            text: isIt
              ? 'Sto ancora caricando i dati delle partite. Riprova tra un istante!'
              : "I'm still loading match data. Please try again in a moment!",
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      const reply = runBot(text, {
        fixtures: fixtures.length > 0 ? fixtures : todayFixtures,
        predict: predictFor,
        isIt,
        formatSelection: (sel) => formatPredictionSelection(sel, t),
      });

      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: reply.text,
          matches: reply.matches && reply.matches.length > 0 ? reply.matches : undefined,
          timestamp: new Date(),
        },
      ]);

      // Scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 700);
  };

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={{ fontFamily: fonts.bodyBold, color: colors.primaryFixed }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer title="BORO" showLive={false} scroll={false} bottomSafe={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ flex: 1 }}>
            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              style={{ flex: 1 }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
              renderItem={({ item }) => {
                const isUser = item.sender === 'user';
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    {!isUser && (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: colors.accent12,
                          borderWidth: 1,
                          borderColor: colors.accent30,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                          marginTop: 4,
                        }}
                      >
                        <BoroIcon name="psychology" size={18} color={colors.primaryFixed} />
                      </View>
                    )}

                    <View style={{ flexShrink: 1, maxWidth: '80%' }}>
                      <GlassCard
                        padding={12}
                        style={{
                          backgroundColor: isUser ? 'rgba(195,244,0,0.06)' : 'rgba(255,255,255,0.03)',
                          borderColor: isUser ? colors.accent20 : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderBottomRightRadius: isUser ? 2 : 12,
                          borderBottomLeftRadius: isUser ? 12 : 2,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.onSurface,
                            fontFamily: fonts.body,
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          {renderFormattedText(item.text)}
                        </Text>
                      </GlassCard>

                      {/* Matched Fixture Cards (Tappable Navigation) */}
                      {item.matches && item.matches.length > 0 && (
                        <View style={{ marginTop: 8, gap: 8, width: 280 }}>
                          {item.matches.map((f: Fixture) => (
                            <MatchListItem key={f.fixture.id} fixture={f} />
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                isTyping ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 40, gap: 8 }}>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BoroIcon
                        name="hourglass-top"
                        size={14}
                        color={colors.primaryFixed}
                        style={{ opacity: 0.8 }}
                      />
                      <Text
                        style={{
                          color: colors.onSurfaceVariant,
                          fontFamily: fonts.body,
                          fontSize: 12,
                        }}
                      >
                        {isIt ? 'Analisi in corso...' : 'BORO is analyzing...'}
                      </Text>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* Quick Action Suggestion Chips */}
            <View style={{ paddingVertical: 10 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}
              >
                {quickPrompts.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => handleSend(p.label)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      backgroundColor: colors.accent18,
                      borderWidth: 1,
                      borderColor: colors.primaryFixed,
                      overflow: 'hidden',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.onSurface,
                        fontFamily: fonts.bodyBold,
                        fontSize: 12,
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Input Bar */}
            <GlassCard padding={6}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={isIt ? 'Chiedi a BORO...' : 'Ask BORO...'}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={{
                    flex: 1,
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 14,
                    paddingHorizontal: 12,
                    height: 40,
                  }}
                  onSubmitEditing={() => handleSend(inputText)}
                />
                <Pressable
                  onPress={() => handleSend(inputText)}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: inputText.trim() ? colors.primaryFixed : 'rgba(255,255,255,0.03)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  })}
                >
                  <BoroIcon
                    name="send"
                    size={16}
                    color={inputText.trim() ? colors.background : colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </View>
  );
}

