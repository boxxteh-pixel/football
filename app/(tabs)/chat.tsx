import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BoroIcon } from "@/components/ui/BoroIcon";
import { ScreenContainer } from "@/components/layouts/ScreenContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { useResponsive } from "@/hooks/useResponsive";
import { useColors } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useHaptics } from "@/hooks/useHaptics";
import { useTodayPredictions } from "@/hooks/useTodayPredictions";
import { useTodayFixtures } from "@/hooks/useFixtures";
import { isLive } from "@/types/match";
import type { Fixture } from "@/types/match";
import type { PredictionResult, ValueBetInfo } from "@/types/prediction";

// ─── Data-driven community bot reply ────────────────────────────────────────

function generateBotReply(
  query: string,
  fixtures: Fixture[],
  predictionMap: Map<number, PredictionResult>,
): string {
  const lower = query.toLowerCase();

  if (predictionMap.size === 0 || fixtures.length === 0) {
    return "⏳ I dati di oggi sono ancora in caricamento. Riprova tra qualche secondo...";
  }

  type Pair = { fixture: Fixture; pred: PredictionResult };
  const pairs: Pair[] = fixtures
    .map((f) => ({ fixture: f, pred: predictionMap.get(f.fixture.id) }))
    .filter((p): p is Pair => Boolean(p.pred));

  if (pairs.length === 0) {
    return "⏳ Previsioni non ancora disponibili per le partite di oggi. Riprova tra qualche minuto.";
  }

  // Most confident picks
  if (
    lower.includes("più sicure") ||
    lower.includes("sicura") ||
    lower.includes("sicure")
  ) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.topPick.probability - a.pred.topPick.probability)
      .slice(0, 3);
    let resp = `🎯 Le 3 più sicure oggi:\n\n`;
    sorted.forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      const pick = item.pred.topPick;
      resp +=
        `${i + 1}. ${home} vs ${away}\n` +
        `   → ${pick.selection} · ${Math.round(pick.probability)}% · @${pick.odds.toFixed(2)}\n\n`;
    });
    return resp.trim();
  }

  // Accumulator
  if (lower.includes("multipla") || lower.includes("raddoppio")) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.topPick.probability - a.pred.topPick.probability)
      .slice(0, 3);
    let combinedOdds = 1;
    let resp = `🔥 Multipla consigliata oggi:\n\n`;
    sorted.forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      const pick = item.pred.topPick;
      combinedOdds *= pick.odds;
      resp += `${i + 1}. ${home} vs ${away}: ${pick.selection} (@${pick.odds.toFixed(2)})\n`;
    });
    resp += `\n💰 Quota Multipla Totale: ${combinedOdds.toFixed(2)}x`;
    return resp;
  }

  // Value bets / underdogs
  if (
    lower.includes("valore") ||
    lower.includes("underdog") ||
    lower.includes("value")
  ) {
    const valueBets: Array<{ fixture: Fixture; vb: ValueBetInfo }> = [];
    pairs.forEach((item) => {
      (item.pred.valueBets ?? [])
        .filter((vb) => vb.edge >= 0.05)
        .forEach((vb) => {
          valueBets.push({ fixture: item.fixture, vb });
        });
    });
    valueBets.sort((a, b) => b.vb.edge - a.vb.edge);
    if (valueBets.length === 0) {
      return "⚠️ Nessuna value bet con edge ≥5% rilevata oggi. Il mercato sembra efficiente.";
    }
    let resp = `⚠️ Value Bets con Edge ≥5%:\n\n`;
    valueBets.slice(0, 5).forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      resp +=
        `${i + 1}. ${home} vs ${away}\n` +
        `   ${item.vb.selection} (${item.vb.market}) · Edge: +${Math.round(item.vb.edge * 100)}%\n\n`;
    });
    return resp.trim();
  }

  // Live
  if (lower.includes("live")) {
    const liveItems = pairs.filter((item) =>
      isLive(item.fixture.fixture.status.short),
    );
    if (liveItems.length === 0)
      return "📡 Nessuna partita live in questo momento.";
    let resp = `📡 Partite Live Ora:\n\n`;
    liveItems.forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      const gh = item.fixture.goals.home ?? 0;
      const ga = item.fixture.goals.away ?? 0;
      const elapsed = item.fixture.fixture.status.elapsed;
      resp +=
        `${i + 1}. ${home} ${gh}-${ga} ${away}` +
        ` (${elapsed ?? "?"}'\u2019)\n` +
        `   Pronostico: ${item.pred.topPick.selection} · ${Math.round(item.pred.topPick.probability)}%\n\n`;
    });
    return resp.trim();
  }

  // Over 2.5
  if (lower.includes("over 2.5")) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.over25Pct - a.pred.over25Pct)
      .slice(0, 3);
    let resp = `⚽ Top Over 2.5 oggi:\n\n`;
    sorted.forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      const odds = item.pred.bestOdds?.over25
        ? ` · @${item.pred.bestOdds.over25.toFixed(2)}`
        : "";
      resp += `${i + 1}. ${home} vs ${away}: ${Math.round(item.pred.over25Pct)}%${odds}\n`;
    });
    return resp;
  }

  // BTTS / Gol-Gol
  if (
    lower.includes("gol/gol") ||
    lower.includes("segnano") ||
    lower.includes("btts")
  ) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.bttsPct - a.pred.bttsPct)
      .slice(0, 3);
    let resp = `🥅 Top Gol/Gol oggi:\n\n`;
    sorted.forEach((item, i) => {
      const home = item.fixture.teams.home.name;
      const away = item.fixture.teams.away.name;
      const odds = item.pred.bestOdds?.bttsYes
        ? ` · @${item.pred.bestOdds.bttsYes.toFixed(2)}`
        : "";
      resp += `${i + 1}. ${home} vs ${away}: ${Math.round(item.pred.bttsPct)}%${odds}\n`;
    });
    return resp;
  }

  // Default summary
  const highConf = pairs.filter((p) => p.pred.topPick.probability >= 70);
  return (
    `🏆 Riepilogo di Oggi:\n\n` +
    `• Partite totali: ${fixtures.length}\n` +
    `• Con previsioni: ${pairs.length}\n` +
    `• Alta confidenza (≥70%): ${highConf.length}\n\n` +
    `Usa i pulsanti rapidi sopra per filtrare per tipo di scommessa.`
  );
}

const CHAT_STORAGE_KEY = "boro_community_chat_v2";
const MAX_MESSAGES = 100;

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  avatarInitial: string;
  color: string;
  isSelf: boolean;
  isSystem?: boolean;
}

// Fixed quick questions / prompt chips for quick bot interactions
const QUICK_BOT_SUGGESTIONS = [
  {
    text: "🛡️ Più sicura",
    query:
      "Quali sono le partite più sicure e con più alta confidenza di oggi?",
  },
  {
    text: "🔥 Multipla",
    query:
      "Consigliami una giocata multipla / raddoppio a quota interessante basata sui dati reali di oggi.",
  },
  {
    text: "⚠️ Valore",
    query:
      "Ci sono quote underdog o ad alto valore atteso positivo rispetto ai bookmaker?",
  },
  {
    text: "📡 Live ora",
    query:
      "Quali partite in corso hanno dinamiche interessanti o variazioni di pressione live?",
  },
  {
    text: "⚽ Over 2.5",
    query:
      "Quali partite di oggi hanno le probabilità più alte per l'esito Over 2.5?",
  },
  {
    text: "🥅 Gol/Gol",
    query:
      "Quali incontri offrono ottime statistiche per l'esito Entrambe le Squadre Segnano (Gol/Gol)?",
  },
];

export default function CommunityChatScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const { isDesktop } = useResponsive();
  const session = useAuthStore((s) => s.session);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const { predictionMap } = useTodayPredictions();
  const { data: todayFixtures = [] } = useTodayFixtures();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [nickname, setNickname] = useState("");
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // Resolve current username
  const currentUserName = useMemo(() => {
    if (session?.user?.name) return session.user.name;
    if (nickname) return nickname;
    return "Guest";
  }, [session, nickname]);

  // Load local chat history (up to 100 messages) on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          const updated = parsed.map((msg) => ({
            ...msg,
            isSelf: msg.senderName === currentUserName,
          }));
          setMessages(updated);
        } else {
          const defaultMsgs: ChatMessage[] = [
            {
              id: "init-1",
              senderName: "BORO AI BOT",
              text: "Benvenuti nella chat globale di BORO! Qui potete scambiare opinioni con altre persone vere sul sito o fare domande rapide toccando i suggerimenti sopra la barra di testo.",
              timestamp: new Date().toISOString(),
              avatarInitial: "🤖",
              color: colors.primaryFixed,
              isSelf: false,
              isSystem: true,
            },
          ];
          setMessages(defaultMsgs);
          await AsyncStorage.setItem(
            CHAT_STORAGE_KEY,
            JSON.stringify(defaultMsgs),
          );
        }
      } catch (err) {
        console.warn("Failed to load chat messages:", err);
      }
    };

    loadChat();

    // Check cached nickname or user session
    if (session?.user?.name) {
      setHasSetNickname(true);
    } else {
      AsyncStorage.getItem("boro_user_nickname").then((nick) => {
        if (nick) {
          setNickname(nick);
          setHasSetNickname(true);
        }
      });
    }
  }, [currentUserName]);

  // WebSocket Connection Lifecycle
  useEffect(() => {
    if (!hasSetNickname) return;

    // Use the user's dedicated PieSocket BORO cluster for global chat broadcasting
    const wsUrl =
      "wss://free.blr2.piesocket.com/v3/boro_global_chat?api_key=2tTwAggvcqEi0T6JumM94kqR71NIrySWQeWvTNUk&notify_self=1";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // System connection message hidden as requested
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.senderName && payload.text && payload.id) {
          setMessages((prev) => {
            // Check if the message is already in our list to prevent duplicates
            if (prev.some((m) => m.id === payload.id)) {
              return prev;
            }

            const receivedMsg: ChatMessage = {
              ...payload,
              isSelf: payload.senderName === currentUserName,
              timestamp: new Date().toISOString(), // set local timestamp
            };

            const combined = [...prev, receivedMsg].slice(-MAX_MESSAGES);
            AsyncStorage.setItem(
              CHAT_STORAGE_KEY,
              JSON.stringify(combined),
            ).catch(() => {});
            return combined;
          });
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: false }),
            50,
          );
        }
      } catch (e) {
        // Handle invalid payloads safely
      }
    };

    ws.onerror = (e) => {
      console.warn("WebSocket connection error:", e);
    };

    ws.onclose = () => {
      // Only trigger reconnect loop if connection dropped unexpectedly (not during cleanup)
      if (wsRef.current === ws) {
        console.log(
          "WebSocket disconnected silently, reconnecting in background...",
        );

        // Auto-reconnect silently in 5 seconds
        setTimeout(() => {
          if (wsRef.current === ws && hasSetNickname) {
            setReconnectTrigger((prev) => prev + 1);
          }
        }, 5000);
      }
    };

    return () => {
      // Clear reference first so ws.onclose knows it's an intentional disconnect
      wsRef.current = null;
      ws.close();
    };
  }, [hasSetNickname, currentUserName, reconnectTrigger]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    haptics.light();
    await AsyncStorage.setItem("boro_user_nickname", nickname);
    setHasSetNickname(true);
  };

  // Live broadcast message to WebSocket
  const broadcastMessage = (msg: ChatMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    haptics.light();
    const textToSend = inputText.trim();
    setInputText("");

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      senderName: currentUserName,
      text: textToSend,
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true,
    };

    // Save locally
    const nextMessages = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(nextMessages);

    // Broadcast globally via WebSocket
    broadcastMessage(userMsg);

    try {
      await AsyncStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(nextMessages),
      );
    } catch (err) {
      console.warn("Failed to save chat message:", err);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Fast AI quick action triggered
  const handleQuickAiAction = async (text: string, query: string) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: `ai-query-${Math.random()}`,
      senderName: currentUserName,
      text: text,
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true,
    };

    let updatedMsgs = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(updatedMsgs);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    // Broadcast user's visual action
    broadcastMessage(userMsg);

    // Trigger local AI response loading
    const loadingMsg: ChatMessage = {
      id: `ai-loading-${Math.random()}`,
      senderName: "BORO AI BOT",
      text: "✍️ Analisi in corso e calcolo probabilità in tempo reale...",
      timestamp: new Date().toISOString(),
      avatarInitial: "🤖",
      color: colors.primaryFixed,
      isSelf: false,
      isSystem: true,
    };

    setMessages((prev) => [...prev, loadingMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    // Generate real data-driven response
    setTimeout(async () => {
      const replyText = generateBotReply(query, todayFixtures, predictionMap);

      const aiReply: ChatMessage = {
        id: `ai-reply-${Math.random()}`,
        senderName: "BORO AI BOT",
        text: replyText,
        timestamp: new Date().toISOString(),
        avatarInitial: "🤖",
        color: colors.primaryFixed,
        isSelf: false,
      };

      setMessages((prev) => {
        // remove the temporary loading message and append true response
        const filtered = prev.filter((m) => !m.id.startsWith("ai-loading-"));
        const next = [...filtered, aiReply].slice(-MAX_MESSAGES);
        AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        50,
      );

      // Broadcast the AI response so other users see it too
      broadcastMessage(aiReply);
    }, 500);
  };

  if (!hasSetNickname) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenContainer
          title="BORO chat"
          wordmarkSub="chat"
          showLive={false}
          scroll={false}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <GlassCard
              padding={24}
              activeBorder
              style={{ width: "100%", maxWidth: 360, gap: 16 }}
            >
              <View style={{ alignItems: "center", gap: 8 }}>
                <BoroIcon name="groups" size={36} color={colors.primaryFixed} />
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.headlineMd,
                    fontSize: 20,
                    textAlign: "center",
                  }}
                >
                  Community Chat
                </Text>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  Inserisci un nickname per entrare nella chat globale in tempo
                  reale con gli altri tifosi di BORO.
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="Il tuo Nickname..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  maxLength={18}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 14,
                    paddingHorizontal: 12,
                    height: 44,
                    outlineStyle: "none",
                  }}
                />
                <Pressable
                  onPress={handleSaveNickname}
                  style={{
                    backgroundColor: colors.primaryFixed,
                    height: 44,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.onPrimary,
                      fontFamily: fonts.label,
                      fontSize: 13,
                      fontWeight: "bold",
                    }}
                  >
                    Entra nella Chat
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer
        title="BORO chat"
        wordmarkSub="chat"
        showLive={false}
        scroll={false}
        bottomSafe={false}
        maxWidth={880}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={{ flex: 1, paddingBottom: 0 }}>
            {isDesktop && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 18,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.accent12,
                    borderWidth: 1,
                    borderColor: colors.accent30,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BoroIcon
                    name="groups"
                    size={24}
                    color={colors.primaryFixed}
                  />
                </View>
                <View>
                  <Text
                    style={{
                      color: colors.onSurface,
                      fontFamily: fonts.headline,
                      fontSize: 20,
                    }}
                  >
                    Community Chat
                  </Text>
                  <Text
                    style={{
                      color: colors.onSurfaceVariant,
                      fontFamily: fonts.body,
                      fontSize: 13,
                    }}
                  >
                    Confrontati in tempo reale con gli altri utenti del sito
                  </Text>
                </View>
              </View>
            )}

            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              style={{ flex: 1 }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              renderItem={({ item }) => {
                const isSystemMsg = item.isSystem;

                if (isSystemMsg) {
                  return (
                    <View
                      style={{
                        width: "100%",
                        alignItems: "center",
                        marginVertical: 6,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "rgba(255,255,255,0.02)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.06)",
                          borderRadius: 12,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: item.color,
                            fontFamily: fonts.body,
                            fontSize: 11,
                            textAlign: "center",
                            lineHeight: 16,
                          }}
                        >
                          {item.text}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: item.isSelf ? "flex-end" : "flex-start",
                      width: "100%",
                    }}
                  >
                    {!item.isSelf && (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: `${item.color}1F`,
                          borderWidth: 1,
                          borderColor: `${item.color}4D`,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 8,
                          marginTop: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: item.color,
                            fontFamily: fonts.display,
                            fontSize: 12,
                          }}
                        >
                          {item.avatarInitial}
                        </Text>
                      </View>
                    )}

                    <View style={{ flexShrink: 1, maxWidth: "80%", gap: 3 }}>
                      {!item.isSelf && (
                        <Text
                          style={{
                            color: colors.onSurfaceVariant,
                            fontFamily: fonts.label,
                            fontSize: 9,
                            marginLeft: 4,
                          }}
                        >
                          {item.senderName}
                        </Text>
                      )}
                      <GlassCard
                        padding={12}
                        style={{
                          backgroundColor: item.isSelf
                            ? `${colors.primaryFixed}14`
                            : "rgba(255,255,255,0.03)",
                          borderColor: item.isSelf
                            ? colors.accent20
                            : "rgba(255,255,255,0.06)",
                          borderWidth: 1,
                          borderBottomRightRadius: item.isSelf ? 2 : 12,
                          borderBottomLeftRadius: item.isSelf ? 12 : 2,
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
                          {item.text}
                        </Text>
                      </GlassCard>
                      <Text
                        style={{
                          color: colors.onSurfaceVariant,
                          fontFamily: fonts.body,
                          fontSize: 8,
                          alignSelf: item.isSelf ? "flex-end" : "flex-start",
                          opacity: 0.6,
                          marginRight: item.isSelf ? 4 : 0,
                          marginLeft: !item.isSelf ? 4 : 0,
                        }}
                      >
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Suggestions/Quick Bot Prompts Header */}
            <View style={{ paddingVertical: 8, gap: 8 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: "row",
                  gap: 12,
                  paddingHorizontal: 4,
                }}
              >
                {QUICK_BOT_SUGGESTIONS.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleQuickAiAction(sug.text, sug.query)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.onSurface,
                        fontFamily: fonts.body,
                        fontSize: 12,
                      }}
                    >
                      {sug.text}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Input Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: 24,
                paddingHorizontal: 6,
                paddingVertical: 4,
                marginTop: 16,
                marginBottom: 2,
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Scrivi un messaggio nella community..."
                placeholderTextColor={colors.onSurfaceVariant}
                maxLength={160}
                style={{
                  flex: 1,
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  paddingHorizontal: 12,
                  height: 40,
                  outlineStyle: "none",
                  outlineWidth: 0,
                }}
                onSubmitEditing={handleSend}
              />
              <Pressable
                onPress={handleSend}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: inputText.trim()
                    ? colors.primaryFixed
                    : "rgba(255,255,255,0.03)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 6,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                })}
              >
                <BoroIcon
                  name="send"
                  size={16}
                  color={
                    inputText.trim()
                      ? colors.background
                      : colors.onSurfaceVariant
                  }
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </View>
  );
}
