import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Animated,
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
import { router } from "expo-router";
import { BoroIcon } from "@/components/ui/BoroIcon";
import { ScreenContainer } from "@/components/layouts/ScreenContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { TeamCrest } from "@/components/ui/TeamCrest";
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
import { format, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MatchAttachment {
  fixtureId: number;
  homeTeam: string;
  homeLogo?: string | null;
  awayTeam: string;
  awayLogo?: string | null;
  leagueName: string;
  kickoff: string; // formatted time string
  selection: string;
  probability: number;
  odds: number;
  isLiveMatch: boolean;
  homeGoals?: number | null;
  awayGoals?: number | null;
  elapsed?: number | null;
  highlightType?: "safe" | "value" | "over" | "btts" | "live" | "multi";
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  avatarInitial: string;
  color: string;
  isSelf: boolean;
  isSystem?: boolean;
  isAiReply?: boolean;
  attachments?: MatchAttachment[];
}

// ─── Bot response generator ───────────────────────────────────────────────────

interface BotResponse {
  text: string;
  attachments: MatchAttachment[];
}

function toAttachment(
  fixture: Fixture,
  pred: PredictionResult,
  highlightType?: MatchAttachment["highlightType"],
): MatchAttachment {
  const live = isLive(fixture.fixture.status.short);
  let kickoff = "";
  try {
    kickoff = format(parseISO(fixture.fixture.date), "HH:mm");
  } catch {
    kickoff = "--:--";
  }
  return {
    fixtureId: fixture.fixture.id,
    homeTeam: fixture.teams.home.name,
    homeLogo: fixture.teams.home.logo,
    awayTeam: fixture.teams.away.name,
    awayLogo: fixture.teams.away.logo,
    leagueName: fixture.league.name,
    kickoff,
    selection: pred.topPick.selection,
    probability: pred.topPick.probability,
    odds: pred.topPick.odds,
    isLiveMatch: live,
    homeGoals: fixture.goals.home,
    awayGoals: fixture.goals.away,
    elapsed: fixture.fixture.status.elapsed,
    highlightType,
  };
}

function generateBotResponse(
  query: string,
  fixtures: Fixture[],
  predictionMap: Map<number, PredictionResult>,
): BotResponse {
  const lower = query.toLowerCase();

  if (predictionMap.size === 0 || fixtures.length === 0) {
    return {
      text: "⏳ I dati di oggi sono ancora in caricamento. Riprova tra qualche secondo.",
      attachments: [],
    };
  }

  type Pair = { fixture: Fixture; pred: PredictionResult };
  // Deduplica per fixture ID prima di creare le coppie
  const seenIds = new Set<number>();
  const pairs: Pair[] = fixtures
    .filter((f) => {
      if (seenIds.has(f.fixture.id)) return false;
      seenIds.add(f.fixture.id);
      return true;
    })
    .map((f) => ({ fixture: f, pred: predictionMap.get(f.fixture.id) }))
    .filter((p): p is Pair => Boolean(p.pred));

  if (pairs.length === 0) {
    return {
      text: "⏳ Previsioni non ancora disponibili. Riprova tra qualche minuto.",
      attachments: [],
    };
  }

  // ── Più sicure ──
  if (
    lower.includes("più sicure") ||
    lower.includes("sicura") ||
    lower.includes("sicure")
  ) {
    const best = [...pairs]
      .sort((a, b) => b.pred.topPick.probability - a.pred.topPick.probability)
      .slice(0, 1);
    return {
      text: `🎯 La partita più sicura tra quelle di oggi (su ${pairs.length} analizzate):`,
      attachments: best.map((p) => toAttachment(p.fixture, p.pred, "safe")),
    };
  }

  // ── Multipla ──
  if (lower.includes("multipla") || lower.includes("raddoppio")) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.topPick.probability - a.pred.topPick.probability)
      .slice(0, 3);
    const combined = sorted.reduce((acc, p) => acc * p.pred.topPick.odds, 1);
    const jointProb = Math.round(
      sorted.reduce((a, p) => a * (p.pred.topPick.probability / 100), 1) * 100,
    );
    return {
      text: `🔥 La multipla consigliata di oggi — quota combinata @${combined.toFixed(2)} · prob. congiunta ~${jointProb}%:`,
      attachments: sorted.map((p) => toAttachment(p.fixture, p.pred, "multi")),
    };
  }

  // ── Value / valore ──
  if (
    lower.includes("valore") ||
    lower.includes("underdog") ||
    lower.includes("value")
  ) {
    const valueBets: Array<{
      fixture: Fixture;
      vb: ValueBetInfo;
      pred: PredictionResult;
    }> = [];
    pairs.forEach((item) => {
      (item.pred.valueBets ?? [])
        .filter((vb) => vb.edge >= 0.05)
        .forEach((vb) =>
          valueBets.push({ fixture: item.fixture, vb, pred: item.pred }),
        );
    });
    valueBets.sort((a, b) => b.vb.edge - a.vb.edge);

    if (valueBets.length === 0) {
      return {
        text: "⚠️ Nessuna value bet con edge ≥5% rilevata oggi. Il mercato sembra piuttosto efficiente al momento.",
        attachments: [],
      };
    }

    const top = valueBets.slice(0, 2);
    return {
      text: `⚡ La value bet migliore di oggi (edge modello vs mercato):`,
      attachments: top.map((item) => {
        const att = toAttachment(item.fixture, item.pred, "value");
        // Override selection with the specific value pick
        att.selection = item.vb.selection;
        att.probability = item.vb.modelProb;
        att.odds = item.vb.bestOdds;
        return att;
      }),
    };
  }

  // ── Live ──
  if (lower.includes("live")) {
    const liveItems = pairs.filter((p) =>
      isLive(p.fixture.fixture.status.short),
    );
    if (liveItems.length === 0) {
      return {
        text: "📡 Nessuna partita live in questo momento. Ricontrolla tra poco!",
        attachments: [],
      };
    }
    const topLive = liveItems.slice(0, 3);
    return {
      text: `📡 ${liveItems.length === 1 ? "Partita live in questo momento" : `${liveItems.length} partite live ora`}:`,
      attachments: topLive.map((p) => toAttachment(p.fixture, p.pred, "live")),
    };
  }

  // ── Over 2.5 ──
  if (lower.includes("over")) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.over25Pct - a.pred.over25Pct)
      .slice(0, 1);
    return {
      text: `⚽ La partita più probabile per Over 2.5 oggi:`,
      attachments: sorted.map((p) => {
        const att = toAttachment(p.fixture, p.pred, "over");
        att.selection = "Over 2.5 Goals";
        att.probability = p.pred.over25Pct;
        att.odds =
          p.pred.bestOdds?.over25 ??
          parseFloat((100 / p.pred.over25Pct).toFixed(2));
        return att;
      }),
    };
  }

  // ── BTTS / Gol-Gol ──
  if (
    lower.includes("gol/gol") ||
    lower.includes("segnano") ||
    lower.includes("btts")
  ) {
    const sorted = [...pairs]
      .sort((a, b) => b.pred.bttsPct - a.pred.bttsPct)
      .slice(0, 1);
    return {
      text: `🥅 La partita migliore per Gol/Gol oggi:`,
      attachments: sorted.map((p) => {
        const att = toAttachment(p.fixture, p.pred, "btts");
        att.selection = "Both Teams to Score";
        att.probability = p.pred.bttsPct;
        att.odds =
          p.pred.bestOdds?.bttsYes ??
          parseFloat((100 / p.pred.bttsPct).toFixed(2));
        return att;
      }),
    };
  }

  // ── Default ──
  const highConf = pairs.filter((p) => p.pred.topPick.probability >= 70);
  const top1 = [...pairs]
    .sort((a, b) => b.pred.topPick.probability - a.pred.topPick.probability)
    .slice(0, 1);
  return {
    text: `🏆 Oggi: ${fixtures.length} partite · ${pairs.length} con previsioni · ${highConf.length} ad alta confidenza. Migliore del momento:`,
    attachments: top1.map((p) => toAttachment(p.fixture, p.pred, "safe")),
  };
}

// ─── Rainbow CSS injection ────────────────────────────────────────────────────

function useRainbowCSS() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const STYLE_ID = "boro-rainbow-chat-css";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes boro-rainbow {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .boro-rainbow-border {
        background: linear-gradient(
          270deg,
          #c3f400, #00ffcc, #0066ff, #cc00ff, #ff0044, #ff8800, #c3f400
        );
        background-size: 300% 300%;
        animation: boro-rainbow 4s ease infinite;
        border-radius: 16px;
        padding: 2px;
      }
      .boro-rainbow-inner {
        background: rgba(22, 21, 20, 0.96);
        border-radius: 14px;
        overflow: hidden;
      }
      @keyframes boro-rainbow-card {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .boro-match-card-border {
        background: linear-gradient(
          135deg,
          #c3f400aa, #00ffcc88, #0066ffaa, #cc00ff88
        );
        background-size: 300% 300%;
        animation: boro-rainbow-card 6s ease infinite;
        border-radius: 14px;
        padding: 1.5px;
      }
      .boro-match-card-inner {
        background: rgba(22, 21, 20, 0.97);
        border-radius: 12.5px;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

// ─── RainbowBubble wrapper ────────────────────────────────────────────────────

const RainbowBubble: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Native: animated gradient via Animated
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") return;
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: false,
      }),
    ).start();
  }, [animValue]);

  if (Platform.OS === "web") {
    return (
      <div className="boro-rainbow-border">
        <div className="boro-rainbow-inner">{children}</div>
      </div>
    );
  }

  // Native fallback: simple accent border (gradient border needs complex trick)
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 2,
        backgroundColor: "rgba(195,244,0,0.6)",
      }}
    >
      <View
        style={{
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "rgba(22,21,20,0.97)",
        }}
      >
        {children}
      </View>
    </View>
  );
};

// ─── RainbowMatchCard ─────────────────────────────────────────────────────────

const HIGHLIGHT_COLOR: Record<
  NonNullable<MatchAttachment["highlightType"]>,
  string
> = {
  safe: "#c3f400",
  value: "#ffaa00",
  over: "#00ccff",
  btts: "#cc66ff",
  live: "#ff6600",
  multi: "#ff3399",
};

const RainbowMatchCard: React.FC<{
  att: MatchAttachment;
  onPress: () => void;
}> = ({ att, onPress }) => {
  const colors = useColors();
  const accent = HIGHLIGHT_COLOR[att.highlightType ?? "safe"];
  const probPct = Math.round(att.probability);

  if (Platform.OS === "web") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <div className="boro-match-card-border">
          <div className="boro-match-card-inner">
            <MatchCardContent
              att={att}
              accent={accent}
              probPct={probPct}
              colors={colors}
            />
          </div>
        </div>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        marginTop: 8,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: `${accent}88`,
        overflow: "hidden",
        backgroundColor: "rgba(22,21,20,0.97)",
      })}
    >
      <MatchCardContent
        att={att}
        accent={accent}
        probPct={probPct}
        colors={colors}
      />
    </Pressable>
  );
};

const MatchCardContent: React.FC<{
  att: MatchAttachment;
  accent: string;
  probPct: number;
  colors: ReturnType<typeof useColors>;
}> = ({ att, accent, probPct, colors }) => (
  <View style={{ paddingHorizontal: 14, paddingVertical: 11, gap: 8 }}>
    {/* Header: league + kickoff/live */}
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          flex: 1,
          marginRight: 8,
        }}
        numberOfLines={1}
      >
        {att.leagueName}
      </Text>
      {att.isLiveMatch ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: "rgba(255,100,0,0.12)",
            borderWidth: 1,
            borderColor: "rgba(255,100,0,0.4)",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#ff6600",
            }}
          />
          <Text
            style={{ color: "#ff6600", fontFamily: fonts.label, fontSize: 9 }}
          >
            {att.elapsed ?? "?"}'
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <BoroIcon name="schedule" size={9} color={colors.onSurfaceVariant} />
          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.label,
              fontSize: 9,
            }}
          >
            {att.kickoff}
          </Text>
        </View>
      )}
    </View>

    {/* Teams row */}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <TeamCrest uri={att.homeLogo} size={28} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.bodyBold,
            fontSize: 13,
          }}
          numberOfLines={1}
        >
          {att.homeTeam}
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.body,
            fontSize: 11,
          }}
          numberOfLines={1}
        >
          {att.awayTeam}
        </Text>
      </View>
      {att.isLiveMatch &&
      att.homeGoals !== null &&
      att.homeGoals !== undefined ? (
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.stats,
            fontSize: 18,
          }}
        >
          {att.homeGoals} – {att.awayGoals}
        </Text>
      ) : (
        <TeamCrest uri={att.awayLogo} size={28} />
      )}
    </View>

    {/* Pick row */}
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.06)",
      }}
    >
      <View style={{ flex: 1, gap: 3, marginRight: 8 }}>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.label,
            fontSize: 8,
            letterSpacing: 0.5,
          }}
        >
          SELEZIONE
        </Text>
        <Text
          style={{ color: accent, fontFamily: fonts.bodyBold, fontSize: 12 }}
          numberOfLines={1}
        >
          {att.selection}
        </Text>
      </View>
      <View style={{ alignItems: "center", gap: 2, marginRight: 12 }}>
        <Text style={{ color: accent, fontFamily: fonts.stats, fontSize: 17 }}>
          {probPct}%
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.label,
            fontSize: 7,
            letterSpacing: 0.3,
          }}
        >
          PROB.
        </Text>
      </View>
      <View
        style={{
          backgroundColor: `${accent}1A`,
          borderWidth: 1,
          borderColor: `${accent}44`,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: accent, fontFamily: fonts.stats, fontSize: 14 }}>
          @{att.odds.toFixed(2)}
        </Text>
      </View>
    </View>

    {/* Probability bar */}
    <View
      style={{
        height: 3,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.min(100, probPct)}%` as `${number}%`,
          backgroundColor: accent,
          borderRadius: 2,
        }}
      />
    </View>
  </View>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = "boro_community_chat_v3";
const MAX_MESSAGES = 100;

const QUICK_BOT_SUGGESTIONS = [
  {
    text: "🛡️ Più sicure",
    query:
      "Quali sono le partite più sicure e con più alta confidenza di oggi?",
  },
  {
    text: "🔥 Multipla",
    query: "Consigliami una giocata multipla basata sui dati reali di oggi.",
  },
  {
    text: "⚡ Valore",
    query: "Ci sono value bet con edge positivo rispetto ai bookmaker?",
  },
  { text: "📡 Live ora", query: "Quali partite live ci sono adesso?" },
  {
    text: "⚽ Over 2.5",
    query: "Quali partite di oggi hanno più probabilità per Over 2.5?",
  },
  {
    text: "🥅 Gol/Gol",
    query: "Quali incontri hanno le migliori statistiche per Gol/Gol?",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommunityChatScreen() {
  const colors = useColors();
  const haptics = useHaptics();
  const { isDesktop } = useResponsive();
  const session = useAuthStore((s) => s.session);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const { predictionMap } = useTodayPredictions();
  const { data: todayFixtures = [] } = useTodayFixtures();

  useRainbowCSS();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [nickname, setNickname] = useState("");
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const currentUserName = useMemo(() => {
    if (session?.user?.name) return session.user.name;
    if (nickname) return nickname;
    return "Guest";
  }, [session, nickname]);

  useEffect(() => {
    const loadChat = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          setMessages(
            parsed.map((msg) => ({
              ...msg,
              isSelf: msg.senderName === currentUserName,
            })),
          );
        } else {
          const defaultMsgs: ChatMessage[] = [
            {
              id: "init-1",
              senderName: "BORO AI BOT",
              text: "👋 Benvenuti nella chat globale di BORO! Scambiate opinioni con altri utenti o usate i pulsanti rapidi in basso per ottenere analisi AI in tempo reale sulle partite di oggi.",
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
        console.warn("Failed to load chat:", err);
      }
    };
    loadChat();

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

  useEffect(() => {
    if (!hasSetNickname) return;
    const wsUrl =
      "wss://free.blr2.piesocket.com/v3/boro_global_chat?api_key=2tTwAggvcqEi0T6JumM94kqR71NIrySWQeWvTNUk&notify_self=1";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.senderName && payload?.text && payload?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev;
            const msg: ChatMessage = {
              ...payload,
              isSelf: payload.senderName === currentUserName,
              timestamp: new Date().toISOString(),
            };
            const combined = [...prev, msg].slice(-MAX_MESSAGES);
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
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setTimeout(() => {
          if (wsRef.current === ws && hasSetNickname)
            setReconnectTrigger((p) => p + 1);
        }, 5000);
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [hasSetNickname, currentUserName, reconnectTrigger]);

  const broadcastMessage = (msg: ChatMessage) => {
    // Strip attachments before broadcasting (raw fixture data is too large for WS)
    const toSend = { ...msg, attachments: undefined, isAiReply: undefined };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(toSend));
    }
  };

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    haptics.light();
    await AsyncStorage.setItem("boro_user_nickname", nickname);
    setHasSetNickname(true);
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
    const next = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(next);
    broadcastMessage(userMsg);
    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleQuickAiAction = async (chipText: string, query: string) => {
    haptics.medium();

    const userMsg: ChatMessage = {
      id: `ai-query-${Math.random()}`,
      senderName: currentUserName,
      text: chipText,
      timestamp: new Date().toISOString(),
      avatarInitial: currentUserName[0].toUpperCase(),
      color: colors.primaryFixed,
      isSelf: true,
    };
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    broadcastMessage(userMsg);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    // Loading indicator
    const loadingId = `ai-loading-${Math.random()}`;
    const loadingMsg: ChatMessage = {
      id: loadingId,
      senderName: "BORO AI BOT",
      text: "✍️  Analisi in corso…",
      timestamp: new Date().toISOString(),
      avatarInitial: "🤖",
      color: colors.primaryFixed,
      isSelf: false,
      isSystem: true,
    };
    setMessages((prev) => [...prev, loadingMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);

    setTimeout(() => {
      const { text, attachments } = generateBotResponse(
        query,
        todayFixtures,
        predictionMap,
      );

      const aiReply: ChatMessage = {
        id: `ai-reply-${Math.random()}`,
        senderName: "BORO AI BOT",
        text,
        timestamp: new Date().toISOString(),
        avatarInitial: "🤖",
        color: colors.primaryFixed,
        isSelf: false,
        isAiReply: true,
        attachments,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        const next = [...filtered, aiReply].slice(-MAX_MESSAGES);
        AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }, 600);
  };

  // ── Nickname gate ──
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
                  Inserisci un nickname per entrare nella chat globale con gli
                  altri utenti BORO.
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

  // ── Main chat UI ──
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
          <View style={{ flex: 1 }}>
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
                    Confrontati in tempo reale con gli altri utenti · AI bot con
                    dati live
                  </Text>
                </View>
              </View>
            )}

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              style={{ flex: 1 }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              renderItem={({ item }) => (
                <MessageRow item={item} colors={colors} />
              )}
            />

            {/* Quick chips */}
            <View style={{ paddingVertical: 8 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {QUICK_BOT_SUGGESTIONS.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleQuickAiAction(sug.text, sug.query)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 20,
                      backgroundColor: pressed
                        ? colors.accent08
                        : "rgba(255,255,255,0.03)",
                      borderWidth: 1,
                      borderColor: pressed
                        ? colors.accent30
                        : "rgba(255,255,255,0.08)",
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

            {/* Input bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                borderRadius: 24,
                paddingHorizontal: 6,
                paddingVertical: 4,
                marginTop: 10,
                marginBottom: 2,
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Scrivi nella community…"
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
                  transform: [{ scale: pressed ? 0.88 : 1 }],
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

// ─── MessageRow ───────────────────────────────────────────────────────────────

const MessageRow: React.FC<{
  item: ChatMessage;
  colors: ReturnType<typeof useColors>;
}> = ({ item, colors }) => {
  if (item.isSystem) {
    return (
      <View style={{ width: "100%", alignItems: "center", marginVertical: 4 }}>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: 12,
            paddingVertical: 7,
            paddingHorizontal: 14,
            maxWidth: "85%",
          }}
        >
          <Text
            style={{
              color: item.color,
              fontFamily: fonts.body,
              fontSize: 11,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  }

  // AI reply with rainbow border + attachment cards
  if (item.isAiReply) {
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        {/* Bot avatar */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "rgba(195,244,0,0.1)",
            borderWidth: 1.5,
            borderColor: "rgba(195,244,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
            marginTop: 2,
          }}
        >
          <Text style={{ fontSize: 16 }}>🤖</Text>
        </View>

        <View style={{ flexShrink: 1, maxWidth: "84%", gap: 2 }}>
          <Text
            style={{
              color: colors.primaryFixed,
              fontFamily: fonts.label,
              fontSize: 9,
              marginLeft: 2,
              letterSpacing: 0.5,
            }}
          >
            BORO AI BOT
          </Text>

          {/* Rainbow bubble — solo il testo */}
          <RainbowBubble>
            <View style={{ padding: 14 }}>
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {item.text}
              </Text>
            </View>
          </RainbowBubble>

          {/* Card partite — sotto il bubble, fuori dal frame */}
          {item.attachments && item.attachments.length > 0 && (
            <View style={{ gap: 8, marginTop: 6 }}>
              {item.attachments.map((att) => (
                <RainbowMatchCard
                  key={att.fixtureId}
                  att={att}
                  onPress={() => router.push(`/match/${att.fixtureId}` as any)}
                />
              ))}
            </View>
          )}

          <Text
            style={{
              color: colors.onSurfaceVariant,
              fontFamily: fonts.body,
              fontSize: 8,
              opacity: 0.5,
              marginLeft: 4,
              marginTop: 2,
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
  }

  // Normal user / other message
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
};
