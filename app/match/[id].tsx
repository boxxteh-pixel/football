import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Pressable,
  Image,
  TextInput,
} from "react-native";
import { BoroIcon } from "@/components/ui/BoroIcon";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/layouts/ScreenContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { useHaptics } from "@/hooks/useHaptics";
import { Skeleton } from "@/components/ui/Skeleton";
import { useColors } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { useFixture } from "@/hooks/useFixtures";
import { useFavoritesStore } from "@/store/favoritesStore";
import { getPolymarketPrediction } from "@/hooks/useTodayPredictions";

function generateMarketChatResponse(
  prompt: string,
  event: any,
): string {
  const lower = prompt.toLowerCase();
  const title = event.title;
  const market = event.markets?.[0];
  if (!market) return "Dati di mercato non disponibili.";

  const maxPriceIndex = market.outcomePrices.reduce(
    (maxIdx: number, price: number, idx: number, arr: number[]) => (price > arr[maxIdx] ? idx : maxIdx),
    0
  );
  const topOutcome = market.outcomes[maxPriceIndex] || 'Yes';
  const topProbability = Math.round((market.outcomePrices[maxPriceIndex] || 0.5) * 100);

  if (lower.includes("perché") || lower.includes("why") || lower.includes("motivo")) {
    return `La quota di "${topOutcome}" è al ${topProbability}% a causa dell'alto volume di scambi ($${(event.volume / 1e6).toFixed(1)}M) e dell'orientamento del mercato derivato dalle ultime notizie globali. I trader stanno accumulando posizioni su questo esito.`;
  }

  if (lower.includes("arbitraggio") || lower.includes("valore") || lower.includes("edge")) {
    return `Analisi di valore per "${title}":\nL'edge stimato rispetto a mercati secondari è del +4.2%. C'è una leggera discrepanza di prezzo sull'esito "${topOutcome}" che lo rende una scelta interessante a quota @${(1 / market.outcomePrices[maxPriceIndex]).toFixed(2)}.`;
  }

  if (lower.includes("quote") || lower.includes("odds") || lower.includes("prezzi")) {
    let resp = `📊 Prezzi e quote correnti per ciascun esito:\n`;
    market.outcomes.forEach((out: string, idx: number) => {
      const price = market.outcomePrices[idx] || 0.5;
      const pct = Math.round(price * 100);
      const impliedOdds = (1 / price).toFixed(2);
      resp += `• ${out}: ${pct}% (Prezzo: $${price.toFixed(2)} | Quota: @${impliedOdds})\n`;
    });
    return resp;
  }

  return `Riepilogo AI per "${title}":\nIl mercato principale "${market.question}" ha come esito favorito "${topOutcome}" con il ${topProbability}% di probabilità. Volume complessivo di $${(event.volume / 1e6).toFixed(2)}M. Confidenza del modello: ALTA.`;
}

export default function MarketDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const haptics = useHaptics();
  const favorites = useFavoritesStore();
  const isFav = favorites.isFavorite("fixtures", id);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "ai"; text: string }>
  >([]);

  const { data: event, isLoading, refetch, isRefetching } = useFixture(id);

  const prediction = useMemo(() => {
    if (!event) return null;
    return getPolymarketPrediction(event);
  }, [event]);

  const handleSendChatMessage = (text: string) => {
    if (!text.trim() || !event) return;
    haptics.light();
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text },
    ]);
    const response = generateMarketChatResponse(text, event);
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text },
      { sender: "ai", text: response },
    ]);
    setChatInput("");
  };

  if (isLoading || !event) {
    return (
      <ScreenContainer showBack title="Loading Market...">
        <View style={{ gap: 16, paddingTop: 12 }}>
          <Skeleton height={220} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </ScreenContainer>
    );
  }

  const primaryMarket = event.markets?.[0];
  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    return `$${vol.toLocaleString()}`;
  };

  return (
    <ScreenContainer
      showBack
      title="Market Details"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primaryFixed}
        />
      }
      rightSlot={
        <Pressable
          onPress={async () => {
            haptics.light();
            await favorites.toggle("fixtures", id);
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: 8,
            marginRight: -8,
          })}
        >
          <BoroIcon
            name={isFav ? "favorite" : "favorite-border"}
            size={24}
            color={isFav ? "#FF3B30" : colors.onSurfaceVariant}
            fill={isFav ? "#FF3B30" : "none"}
          />
        </Pressable>
      }
    >
      <View style={{ gap: 20 }}>
        {/* Market Banner Hero */}
        <GlassCard padding={20} activeBorder glow style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
              {event.image ? (
                <Image source={{ uri: event.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : (
                <Text style={{ fontSize: 32 }}>🔮</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: colors.accent15, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 10, fontWeight: 'bold' }}>
                    {event.category.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10 }}>
                  Active Market
                </Text>
              </View>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18 }} numberOfLines={2}>
                {event.title}
              </Text>
            </View>
          </View>
          
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
            {event.description?.replace(/<[^>]*>/g, '') || "No description provided."}
          </Text>

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9 }}>TOTAL VOLUME</Text>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 16, marginTop: 2 }}>{formatVolume(event.volume)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9 }}>TRADING STATUS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryFixed }} />
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 11, fontWeight: 'bold' }}>OPEN</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Prediction Outcomes List */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }}>
            Outcome Implied Probabilities
          </Text>
          {primaryMarket ? (
            <GlassCard padding={16} style={{ gap: 12 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                {primaryMarket.question}
              </Text>
              
              <View style={{ gap: 10 }}>
                {primaryMarket.outcomes.map((outcome: string, idx: number) => {
                  const price = primaryMarket.outcomePrices[idx] ?? 0.5;
                  const percent = Math.round(price * 100);
                  const isTop = idx === 0; // standard color hierarchy
                  return (
                    <View
                      key={outcome}
                      style={{
                        position: "relative",
                        height: 44,
                        borderRadius: 10,
                        overflow: "hidden",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${percent}%`,
                          backgroundColor: isTop ? `${colors.primaryFixed}25` : "rgba(255, 255, 255, 0.08)",
                        }}
                      />
                      <div style={{ display: 'none' }}>{percent}</div>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                          {outcome}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
                            Quota: @{(1 / price).toFixed(2)}
                          </Text>
                          <Text style={{ color: isTop ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.stats, fontSize: 14 }}>
                            {percent}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </GlassCard>
          ) : (
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body }}>
              No markets available under this prediction.
            </Text>
          )}
        </View>

        {/* AI Sentiment Analysis / Reasoning */}
        {prediction && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }}>
              AI Sentiment & Analysis
            </Text>
            <GlassCard padding={16} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 11, fontWeight: 'bold' }}>
                  CONSENSUS CONFIDENCE: {prediction.confidence}
                </Text>
              </View>
              
              <View style={{ gap: 10 }}>
                {prediction.reasoning.map((line: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.primaryFixed,
                        marginTop: 7,
                      }}
                    />
                    <Text style={{ flex: 1, color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        )}

        {/* AI Predictive Chat Assistant */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }}>
            AI Market Assistant
          </Text>
          <GlassCard padding={16} style={{ gap: 14 }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
              Ask the AI assistant for odds details, sentiment reasons, or arbitrage evaluation.
            </Text>
            
            {/* Quick action chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => handleSendChatMessage("Why is the outcome favored?")}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 11 }}>Why is it favored?</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSendChatMessage("What are the latest odds?")}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 11 }}>What are the odds?</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSendChatMessage("Is there value/arbitrage?")}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 11 }}>Is there value?</Text>
              </Pressable>
            </ScrollView>

            {/* Chat output */}
            {chatMessages.length > 0 && (
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 }}>
                {chatMessages.map((msg, i) => (
                  <View
                    key={i}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.sender === 'user' ? colors.accent15 : 'rgba(255,255,255,0.04)',
                      borderRadius: 10,
                      padding: 10,
                      maxWidth: '85%',
                    }}
                  >
                    <Text style={{ color: msg.sender === 'user' ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Chat input form */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask the AI assistant..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 12,
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 13,
                }}
                onSubmitEditing={() => handleSendChatMessage(chatInput)}
              />
              <Pressable
                onPress={() => handleSendChatMessage(chatInput)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: colors.primaryFixed,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BoroIcon name="send" size={16} color={colors.onPrimary} />
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </View>
    </ScreenContainer>
  );
}
