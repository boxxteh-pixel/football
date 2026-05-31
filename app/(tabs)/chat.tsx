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
      ? 'Ciao! Sono BORO, il tuo assistente intelligente per i pronostici calcistici. 🤖⚽\n\nPosso analizzare le statistiche ELO e xG delle partite di oggi per consigliarti le giocate più intelligenti.\n\nUsa i pulsanti rapidi sotto o scrivimi una domanda!'
      : 'Hello! I am BORO, your smart football prediction assistant. 🤖⚽\n\nI can analyze ELO and xG metrics for today\'s slate to recommend the smartest plays.\n\nUse the quick actions below or ask me anything!';

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
        { key: 'safe', label: '🛡️ Partita più sicura' },
        { key: 'acc', label: '🔥 Multipla consigliata' },
        { key: 'value', label: '⚠️ Quote di valore' },
        { key: 'help', label: '❓ Come funziona?' },
      ]
    : [
        { key: 'safe', label: '🛡️ Safest match today' },
        { key: 'acc', label: '🔥 Best accumulator' },
        { key: 'value', label: '⚠️ Underdog value plays' },
        { key: 'help', label: '❓ How to use?' },
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
      let replyText = '';
      let matchedFixtures: Fixture[] = [];
      const query = text.toLowerCase();

      // Ensure data is loaded
      if (isLoading) {
        replyText = isIt
          ? 'Sto ancora caricando i dati delle partite di oggi. Riprova tra un istante!'
          : 'I am still loading today\'s match data. Please try again in a moment!';
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: Math.random().toString(), sender: 'bot', text: replyText, timestamp: new Date() },
        ]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      // 1. SAFEST MATCH
      if (
        query.includes('safe') ||
        query.includes('sicur') ||
        query.includes('tranquill') ||
        query.includes('scudo') ||
        query.includes('shield') ||
        query.includes('proteg')
      ) {
        const pool = fixtures.length > 0 ? fixtures : todayFixtures;
        if (pool.length === 0) {
          replyText = isIt
            ? 'Non ho trovato partite in programma oggi per i tuoi campionati preferiti.'
            : 'I couldn\'t find any matches scheduled for today in your active leagues.';
        } else {
          // Sort by highest pick probability
          const sorted = [...pool]
            .map((f) => ({ fixture: f, prediction: predictFor(f) }))
            .filter((x): x is { fixture: Fixture; prediction: NonNullable<typeof x.prediction> } => x.prediction != null)
            .sort((a, b) => b.prediction.topPick.probability - a.prediction.topPick.probability);

          if (sorted.length === 0) {
            replyText = isIt
              ? 'Sto ancora analizzando le quote di oggi. Riprova tra poco.'
              : "I'm still analyzing today's odds. Try again shortly.";
          } else {
          const top = sorted[0];
          const topSelection = formatPredictionSelection(top.prediction.topPick.selection, t);
          matchedFixtures = [top.fixture];

          replyText = isIt
            ? `🛡️ **Il pronostico più sicuro di oggi:**\n\nHo scansionato il palinsesto odierno. La partita con la probabilità matematica più alta è **${top.fixture.teams.home.name} vs ${top.fixture.teams.away.name}** (${top.fixture.league.name}).\n\n• **Pronostico:** ${topSelection}\n• **Probabilità:** ${Math.round(top.prediction.topPick.probability)}%\n• **Quota:** ${top.prediction.topPick.odds.toFixed(2)}\n• **Confidenza:** ELEVATA\n\nTocca la scheda qui sotto per l'analisi ELO e xG completa!`
            : `🛡️ **The safest match today:**\n\nI scanned today's schedule. The match with the highest mathematical probability is **${top.fixture.teams.home.name} vs ${top.fixture.teams.away.name}** (${top.fixture.league.name}).\n\n• **Model Prediction:** ${topSelection}\n• **Probability:** ${Math.round(top.prediction.topPick.probability)}%\n• **Odds:** ${top.prediction.topPick.odds.toFixed(2)}\n• **Confidence:** HIGH\n\nTap the match card below to see the complete ELO & xG analysis!`;
          }
        }
      }
      // 2. ACCUMULATOR
      else if (
        query.includes('acc') ||
        query.includes('multipla') ||
        query.includes('combo') ||
        query.includes('bolla') ||
        query.includes('schedina')
      ) {
        const pool = fixtures.length > 0 ? fixtures : todayFixtures;
        if (pool.length < 2) {
          replyText = isIt
            ? 'Ci sono troppe poche partite oggi per comporre una multipla affidabile. Prova ad aggiungere altri campionati nelle impostazioni!'
            : 'There are too few matches today to construct a reliable accumulator. Try adding more leagues in your settings!';
        } else {
          const sorted = [...pool]
            .map((f) => ({ fixture: f, prediction: predictFor(f) }))
            .filter((x): x is { fixture: Fixture; prediction: NonNullable<typeof x.prediction> } => x.prediction != null)
            .sort((a, b) => b.prediction.topPick.probability - a.prediction.topPick.probability)
            .slice(0, 3);

          if (sorted.length < 2) {
            replyText = isIt
              ? 'Sto ancora analizzando le quote di oggi. Riprova tra poco.'
              : "I'm still analyzing today's odds. Try again shortly.";
          } else {
          matchedFixtures = sorted.map((s) => s.fixture);
          const totalOdds = sorted.reduce((acc, s) => acc * s.prediction.topPick.odds, 1);
          const avgProb = sorted.reduce((acc, s) => acc + s.prediction.topPick.probability, 0) / sorted.length;

          const matchLines = sorted
            .map(
              (s) =>
                `• ${s.fixture.teams.home.name} vs ${s.fixture.teams.away.name}: **${formatPredictionSelection(s.prediction.topPick.selection, t)}** (${s.prediction.topPick.odds.toFixed(2)})`
            )
            .join('\n');

          replyText = isIt
            ? `🔥 **Multipla consigliata da BORO (3 Eventi):**\n\nEcco una combinazione ad alta affidabilità per oggi:\n\n${matchLines}\n\n• **Quota Totale:** **${totalOdds.toFixed(2)}**\n• **Probabilità Media:** **${Math.round(avgProb)}%**\n\nTocca le schede delle singole partite qui sotto per studiare i dettagli.`
            : `🔥 **BORO Recommended Accumulator (3-Fold):**\n\nHere is a high-reliability combo for today's slate:\n\n${matchLines}\n\n• **Total Combined Odds:** **${totalOdds.toFixed(2)}**\n• **Average Probability:** **${Math.round(avgProb)}%**\n\nTap the match cards below to inspect ELO rating values.`;
          }
        }
      }
      // 3. VALUE PLAYS
      else if (
        query.includes('valore') ||
        query.includes('value') ||
        query.includes('underdog') ||
        query.includes('anomali') ||
        query.includes('sorpres')
      ) {
        const pool = fixtures.length > 0 ? fixtures : todayFixtures;
        const valuePicks = [...pool]
          .map((f) => ({ fixture: f, prediction: predictFor(f) }))
          .filter((x): x is { fixture: Fixture; prediction: NonNullable<typeof x.prediction> } => x.prediction != null)
          .filter(
            (p) =>
              p.prediction.topPick.probability >= 38 &&
              p.prediction.topPick.probability <= 60 &&
              p.prediction.topPick.odds >= 1.7
          )
          .sort((a, b) => b.prediction.topPick.odds - a.prediction.topPick.odds)
          .slice(0, 2);

        if (valuePicks.length === 0) {
          replyText = isIt
            ? 'Non ho rilevato anomalie di quota evidenti per le partite di oggi. I bookmaker hanno allineato bene le probabilità.'
            : 'I did not detect any significant odds value anomalies today. The bookmaker lines are well-aligned with mathematical outcomes.';
        } else {
          matchedFixtures = valuePicks.map((v) => v.fixture);
          const matchLines = valuePicks
            .map(
              (s) =>
                `• ${s.fixture.teams.home.name} vs ${s.fixture.teams.away.name}: **${formatPredictionSelection(s.prediction.topPick.selection, t)}** (Quota: **${s.prediction.topPick.odds.toFixed(2)}** | Prob: ${Math.round(s.prediction.topPick.probability)}%)`
            )
            .join('\n');

          replyText = isIt
            ? `⚠️ **Pronostici di Valore / Underdog rilevati:**\n\nEcco le giocate con il miglior rapporto rischio/rendimento matematico rispetto alle quote disponibili:\n\n${matchLines}\n\nQuesti mercati presentano quote più alte di quanto suggerito dai nostri modelli.`
            : `⚠️ **Value Plays & Underdogs detected:**\n\nHere are the matches displaying the best risk-to-reward ratio relative to implied model probabilities:\n\n${matchLines}\n\nThese picks offer value, meaning the bookmaker odds are higher than mathematical expectations.`;
        }
      }
      // 4. HELP / TUTORIAL
      else if (
        query.includes('help') ||
        query.includes('aiuto') ||
        query.includes('funziona') ||
        query.includes('come si usa') ||
        query.includes('guida') ||
        query.includes('info')
      ) {
        replyText = isIt
          ? `💡 **Guida all'uso di BORO:**\n\n• **Previsioni:** La pagina principale ti mostra il palinsesto delle partite di oggi. I migliori pronostici sono contrassegnati come "SAFE PICK" o "ELITE PICK".\n• **Analisi Partita:** Tocca qualsiasi partita per aprire i dettagli live, l'andamento della pressione (Momentum), xG ed ELO.\n• **Hub Statistiche:** Mostra classifiche avanzate dei campionati principali.\n• **Chat di Supporto:** Puoi chiedermi in tempo reale consigli personalizzati senza navigare tra i menù!`
          : `💡 **How to navigate BORO:**\n\n• **Predictor Tab:** View today's full slate. Matches with high mathematical probabilities are tagged "SAFE PICK" or "ELITE PICK".\n• **Match Details:** Tap any match to inspect expected goals (xG), real-time team ELO ratings, and Live Momentum graphs.\n• **Stats Tab:** View ELO rankings and league tables.\n• **Support Chat:** Converse directly with me to fetch quick summaries and calculations!`;
      }
      // 5. GREETINGS
      else if (
        query.includes('ciao') ||
        query.includes('buongiorno') ||
        query.includes('hello') ||
        query.includes('hi') ||
        query.includes('hey')
      ) {
        replyText = isIt
          ? 'Ciao! Come posso aiutarti oggi? Puoi chiedermi della partita più sicura, della schedina del giorno o delle quote di valore.'
          : 'Hello! How can I assist you today? You can ask me for the safest game, daily accumulator, or value odds.';
      }
      // 6. DEFAULT FALLBACK
      else {
        replyText = isIt
          ? 'Non sono sicuro di aver capito. Prova a chiedermi:\n\n• "Qual è la partita più sicura oggi?"\n• "Fammi una multipla consigliata"\n• "Ci sono quote di valore?"\n• "Come funziona?"'
          : 'I\'m not quite sure I understand. Try asking me:\n\n• "What is the safest match today?"\n• "Show me today\'s accumulator"\n• "Any value plays?"\n• "How do I use this?"';
      }

      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: replyText,
          matches: matchedFixtures.length > 0 ? matchedFixtures : undefined,
          timestamp: new Date(),
        },
      ]);

      // Scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1200);
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

