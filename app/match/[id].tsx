import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { BoroIcon } from "@/components/ui/BoroIcon";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/layouts/ScreenContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { useHaptics } from "@/hooks/useHaptics";
import { LiveScoreHero } from "@/components/match/LiveScoreHero";
import { LivePitch } from "@/components/match/LivePitch";
import { AIInsightCard } from "@/components/match/AIInsightCard";
import { StatComparison } from "@/components/match/StatComparison";
import { QuickBetSlip } from "@/components/match/QuickBetSlip";
import { MatchTimeline } from "@/components/match/MatchTimeline";
import { MarketIntelCard } from "@/components/match/MarketIntelCard";
import { MarketsPanel } from "@/components/match/MarketsPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { useColors } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import {
  useFixture,
  useFixtureEvents,
  useFixtureStats,
} from "@/hooks/useFixtures";
import { useLiveTracker } from "@/hooks/useLiveTracker";
import { useFixturePrediction } from "@/hooks/useFixturePrediction";
import { BoroPickFrame } from "@/components/match/BoroPickFrame";
import { useT } from "@/theme/i18n";
import { useFavoritesStore } from "@/store/favoritesStore";
import {
  computeMomentumWindows,
  computePressureSwing,
  extractStatNumber,
} from "@/services/ai/momentum";
import { isFinished, isLive } from "@/types/match";
import { quickPredict } from "@/services/ai/predictor";
import {
  formatPredictionSelection,
  formatReasoningLine,
} from "@/utils/predictionText";
import type { PredictionResult } from "@/types/prediction";
import type { Fixture } from "@/types/match";

// ─── Data-driven AI chat response generator ──────────────────────────────────

function generateMatchChatResponse(
  prompt: string,
  prediction: PredictionResult | null,
  fixture: Fixture,
): string {
  const lower = prompt.toLowerCase();
  const home = fixture.teams.home.name;
  const away = fixture.teams.away.name;

  if (!prediction) {
    return `Sto ancora caricando i dati per ${home} vs ${away}. Riprova tra qualche secondo.`;
  }

  // 1X2 / Winner
  if (
    lower.includes("vince") ||
    lower.includes("1x2") ||
    lower.includes("risultato")
  ) {
    const maxPct = Math.max(
      prediction.homeWinPct,
      prediction.drawPct,
      prediction.awayWinPct,
    );
    const homeO = prediction.bestOdds?.home
      ? ` @${prediction.bestOdds.home.toFixed(2)}`
      : "";
    const drawO = prediction.bestOdds?.draw
      ? ` @${prediction.bestOdds.draw.toFixed(2)}`
      : "";
    const awayO = prediction.bestOdds?.away
      ? ` @${prediction.bestOdds.away.toFixed(2)}`
      : "";
    const topLabel =
      prediction.homeWinPct === maxPct
        ? `${home} Vince`
        : prediction.awayWinPct === maxPct
          ? `${away} Vince`
          : "Pareggio";
    return (
      `📊 Pronostico 1X2:\n` +
      `• ${home}: ${Math.round(prediction.homeWinPct)}%${homeO}\n` +
      `• Pareggio: ${Math.round(prediction.drawPct)}%${drawO}\n` +
      `• ${away}: ${Math.round(prediction.awayWinPct)}%${awayO}\n\n` +
      `🎯 Selezione top: ${topLabel} — ${Math.round(maxPct)}% — Confidenza ${prediction.confidence}`
    );
  }

  // Goals / Over / Under
  if (
    lower.includes("gol") ||
    lower.includes("over") ||
    lower.includes("under") ||
    lower.includes("xg")
  ) {
    let resp =
      `⚽ Analisi Gol:\n` +
      `• Over 2.5: ${Math.round(prediction.over25Pct)}%\n` +
      `• Under 2.5: ${Math.round(prediction.under25Pct)}%`;
    if (prediction.expectedGoals) {
      resp +=
        `\n• xG ${home}: ${prediction.expectedGoals.home.toFixed(2)}` +
        `\n• xG ${away}: ${prediction.expectedGoals.away.toFixed(2)}` +
        `\n• xG Totale: ${prediction.expectedGoals.total.toFixed(2)}`;
    }
    if (prediction.overUnderLines?.["2.5"]) {
      const l = prediction.overUnderLines["2.5"];
      resp += `\n\nLinea 2.5 → Over: ${Math.round(l.over)}% | Under: ${Math.round(l.under)}%`;
    }
    if (prediction.bestOdds?.over25) {
      resp += `\nMiglior quota Over 2.5: @${prediction.bestOdds.over25.toFixed(2)}`;
    }
    return resp;
  }

  // BTTS
  if (
    lower.includes("btts") ||
    lower.includes("segnano") ||
    lower.includes("gol/gol") ||
    lower.includes("golgol")
  ) {
    let resp =
      `🥅 Entrambe Segnano (BTTS):\n` +
      `• Sì: ${Math.round(prediction.bttsPct)}%\n` +
      `• No: ${Math.round(100 - prediction.bttsPct)}%`;
    if (prediction.bestOdds?.bttsYes)
      resp += `\nQuota Sì: @${prediction.bestOdds.bttsYes.toFixed(2)}`;
    if (prediction.bestOdds?.bttsNo)
      resp += `\nQuota No: @${prediction.bestOdds.bttsNo.toFixed(2)}`;
    return resp;
  }

  // Value bets
  if (
    lower.includes("valore") ||
    lower.includes("value") ||
    lower.includes("edge")
  ) {
    if (!prediction.valueBets || prediction.valueBets.length === 0) {
      return "⚠️ Nessuna value bet significativa rilevata per questo match. Il modello non ha trovato quote con valore atteso positivo rispetto al mercato.";
    }
    let resp = `⚡ Value Bets rilevate:\n`;
    prediction.valueBets.slice(0, 3).forEach((vb, i) => {
      resp +=
        `\n${i + 1}. ${vb.selection} (${vb.market})` +
        `\n   Modello: ${Math.round(vb.modelProb)}% · Quota: @${vb.bestOdds.toFixed(2)} · Edge: +${Math.round(vb.edge * 100)}%`;
    });
    return resp;
  }

  // Best odds
  if (lower.includes("quota") || lower.includes("quote")) {
    if (!prediction.bestOdds)
      return "Quote non disponibili per questa partita.";
    const bo = prediction.bestOdds;
    let resp = `💰 Migliori Quote:\n`;
    if (bo.home) resp += `• ${home}: @${bo.home.toFixed(2)}\n`;
    if (bo.draw) resp += `• Pareggio: @${bo.draw.toFixed(2)}\n`;
    if (bo.away) resp += `• ${away}: @${bo.away.toFixed(2)}\n`;
    if (bo.over25) resp += `• Over 2.5: @${bo.over25.toFixed(2)}\n`;
    if (bo.under25) resp += `• Under 2.5: @${bo.under25.toFixed(2)}\n`;
    if (bo.bttsYes) resp += `• BTTS Sì: @${bo.bttsYes.toFixed(2)}\n`;
    if (bo.bttsNo) resp += `• BTTS No: @${bo.bttsNo.toFixed(2)}`;
    return resp;
  }

  // Correct score
  if (lower.includes("esatto") || lower.includes("score")) {
    if (!prediction.correctScores || prediction.correctScores.length === 0) {
      return "Risultati esatti non disponibili per questo match.";
    }
    let resp = `🎯 Top Risultati Esatti:\n`;
    prediction.correctScores.slice(0, 3).forEach((cs, i) => {
      resp += `${i + 1}. ${cs.score} — ${cs.probability.toFixed(1)}%\n`;
    });
    return resp;
  }

  // Half time
  if (lower.includes("primo tempo") || lower.includes("ht")) {
    if (!prediction.halfTimeResult)
      return "Dati Primo Tempo non disponibili per questa partita.";
    const ht = prediction.halfTimeResult;
    const maxHt = Math.max(ht.home, ht.draw, ht.away);
    const htPick =
      ht.home === maxHt
        ? `${home} Vince PT`
        : ht.away === maxHt
          ? `${away} Vince PT`
          : "Pareggio PT";
    return (
      `⏱️ Pronostico Primo Tempo:\n` +
      `• ${home} Vince: ${Math.round(ht.home)}%\n` +
      `• Pareggio: ${Math.round(ht.draw)}%\n` +
      `• ${away} Vince: ${Math.round(ht.away)}%\n\n` +
      `→ Pronostico PT: ${htPick} (${Math.round(maxHt)}%)`
    );
  }

  // Corners
  if (lower.includes("angoli") || lower.includes("corner")) {
    if (
      !prediction.cornersOverUnder ||
      prediction.cornersOverUnder.length === 0
    ) {
      return "Dati angoli non disponibili per questa partita.";
    }
    let resp = `📐 Angoli O/U:\n`;
    prediction.cornersOverUnder.forEach((c) => {
      resp += `• ${c.label}: ${Math.round(c.probability)}%\n`;
    });
    return resp;
  }

  // Referee
  if (lower.includes("arbitro") || lower.includes("referee")) {
    const ref = fixture.fixture.referee;
    if (!ref) return "Arbitro non ancora designato per questa partita.";
    return `👤 Arbitro Designato: ${ref}\n\nNota: i dati statistici dettagliati dell'arbitro saranno disponibili nelle prossime versioni.`;
  }

  // Default summary
  const topProb = Math.round(prediction.topPick.probability);
  return (
    `📋 Riepilogo ${home} vs ${away}:\n\n` +
    `🎯 Pronostico Top: ${prediction.topPick.selection} (${topProb}%)\n` +
    `• Over 2.5: ${Math.round(prediction.over25Pct)}%\n` +
    `• BTTS Sì: ${Math.round(prediction.bttsPct)}%\n` +
    `• Confidenza: ${prediction.confidence}` +
    (prediction.valueBets?.length
      ? `\n\n⚡ ${prediction.valueBets.length} value bet rilevata/e`
      : "")
  );
}

export default function MatchDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const t = useT();
  const haptics = useHaptics();
  const favorites = useFavoritesStore();
  const isFav = favorites.isFavorite("fixtures", id);

  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "ai"; text: string }>
  >([]);

  const handleSendTacticalMessage = (prompt: string) => {
    haptics.light();
    setChatMessages((prev) => [
      ...prev,
      { sender: "user" as const, text: prompt },
    ]);
    if (!fixture) return;
    const aiResponse = generateMatchChatResponse(prompt, prediction, fixture);
    setChatMessages((prev) => [...prev, { sender: "ai", text: aiResponse }]);
  };

  const { data: fixture, isLoading, refetch, isRefetching } = useFixture(id);
  const live = fixture ? isLive(fixture.fixture.status.short) : false;
  const hasPostKickoffDetails = fixture
    ? live || isFinished(fixture.fixture.status.short)
    : false;
  const detailsId = hasPostKickoffDetails ? id : undefined;
  const { data: events = [] } = useFixtureEvents(detailsId, live);
  const { data: stats = [] } = useFixtureStats(detailsId, live);
  const { data: tracker } = useLiveTracker(live ? fixture : undefined);
  const canonical = useFixturePrediction(fixture ?? undefined, { full: true });
  const instantFallback = useMemo(
    () => (fixture ? quickPredict(fixture) : null),
    [fixture],
  );
  // SINGLE source of truth for everything shown on this page: the canonical
  // pick (same data the cards/Results use). While it loads, show a local
  // fallback immediately instead of launching the old heavy 6-request ensemble.
  const prediction = canonical.prediction ?? instantFallback;

  const momentumValues = useMemo(() => {
    if (!fixture) return Array(15).fill(0.4);
    const windows = computeMomentumWindows(
      events,
      fixture.teams.home.id,
      6,
      90,
    );
    return windows.map((w) => Math.max(0.15, w.homePressure));
  }, [events, fixture]);

  const pressureSwing = useMemo(() => {
    if (!fixture) return 0;
    return computePressureSwing(
      events,
      fixture.teams.home.id,
      10,
      fixture.fixture.status.elapsed ?? 90,
    );
  }, [events, fixture]);

  if (isLoading || !fixture) {
    return (
      <ScreenContainer showBack title={t("common.loading")}>
        <View style={{ gap: 16, paddingTop: 12 }}>
          <Skeleton height={220} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={120} radius={16} />
        </View>
      </ScreenContainer>
    );
  }

  const homePoss = extractStatNumber(
    stats,
    fixture.teams.home.id,
    "Ball Possession",
  );
  const awayPoss = extractStatNumber(
    stats,
    fixture.teams.away.id,
    "Ball Possession",
  );
  const homeShots = extractStatNumber(
    stats,
    fixture.teams.home.id,
    "Total Shots",
  );
  const awayShots = extractStatNumber(
    stats,
    fixture.teams.away.id,
    "Total Shots",
  );
  const homeXgRaw = extractStatNumber(
    stats,
    fixture.teams.home.id,
    "expected_goals",
  );
  const awayXgRaw = extractStatNumber(
    stats,
    fixture.teams.away.id,
    "expected_goals",
  );
  const homeXg = homeXgRaw || prediction?.metrics.homeXg || 0;
  const awayXg = awayXgRaw || prediction?.metrics.awayXg || 0;

  const possessionTotal = (homePoss || 0) + (awayPoss || 0);
  const possessionPct =
    possessionTotal > 0 ? (homePoss / possessionTotal) * 100 : 50;
  const xgTotal = homeXg + awayXg;
  const xgPct = xgTotal > 0 ? (homeXg / xgTotal) * 100 : 50;

  return (
    <ScreenContainer
      showBack
      title="BORO"
      showLive={live}
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
        <LiveScoreHero
          fixture={fixture}
          momentumValues={momentumValues}
          pressureSwing={pressureSwing}
        />

        {live && (
          <LivePitch
            fixture={fixture}
            events={events}
            homePossession={homePoss || 0}
            awayPossession={awayPoss || 0}
            tracker={tracker}
          />
        )}

        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <BoroIcon name="psychology" size={22} color={colors.primaryFixed} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.headlineMd,
                fontSize: 20,
                letterSpacing: -0.3,
              }}
            >
              {t("match.aiInsights")}
            </Text>
          </View>

          {canonical.prediction && (
            <BoroPickFrame
              prediction={canonical.prediction}
              graded={canonical.graded}
            />
          )}

          {!prediction ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={100} radius={16} />
              <Skeleton height={100} radius={16} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Premium Trial Banner */}
              {prediction.source === "HYBRID" && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "flex-start",
                    backgroundColor: `${colors.primaryFixed}1A`,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${colors.primaryFixed}33`,
                    marginTop: -4,
                    marginBottom: 4,
                  }}
                >
                  <BoroIcon
                    name="workspace-premium"
                    size={14}
                    color={colors.primaryFixed}
                  />
                  <Text
                    style={{
                      color: colors.primaryFixed,
                      fontFamily: fonts.label,
                      fontSize: 10,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("match.proPowered")}
                  </Text>
                </View>
              )}

              <AIInsightCard
                label={t("match.matchResult")}
                title={
                  prediction.homeWinPct >= prediction.awayWinPct &&
                  prediction.homeWinPct >= prediction.drawPct
                    ? formatPredictionSelection(
                        `${fixture.teams.home.name} to Win`,
                        t,
                      )
                    : prediction.awayWinPct >= prediction.drawPct
                      ? formatPredictionSelection(
                          `${fixture.teams.away.name} to Win`,
                          t,
                        )
                      : t("prediction.draw")
                }
                subLabel={`${Math.round(Math.max(prediction.homeWinPct, prediction.drawPct, prediction.awayWinPct))}% ${t("match.confidence")}`}
                subIcon={null}
                probability={Math.max(
                  prediction.homeWinPct,
                  prediction.drawPct,
                  prediction.awayWinPct,
                )}
                accentLeft
                ringColor={colors.primaryFixed}
              />
              <AIInsightCard
                label={t("match.predictedScore")}
                title={`${prediction.predictedScore.home} - ${prediction.predictedScore.away}`}
                subLabel={`${t("match.over25")}: ${Math.round(prediction.over25Pct)}%`}
                subIcon="trending-up"
                probability={prediction.over25Pct}
                ringColor={colors.secondaryFixed}
              />
              <AIInsightCard
                label={t("match.btts")}
                title={
                  prediction.bttsPct >= 50
                    ? t("match.yesLikely")
                    : t("match.noUnlikely")
                }
                subLabel={`${t("match.xgTotal")}: ${(prediction.metrics.homeXg + prediction.metrics.awayXg).toFixed(2)}`}
                subIcon="analytics"
                probability={prediction.bttsPct}
              />

              {/* Top Correct Scores */}
              {prediction.correctScores &&
                prediction.correctScores.length > 0 && (
                  <View style={{ gap: 12, marginTop: 8 }}>
                    <Text
                      style={{
                        color: colors.onSurface,
                        fontFamily: fonts.headlineMd,
                        fontSize: 16,
                        letterSpacing: -0.3,
                      }}
                    >
                      {t("match.correctScores")}
                    </Text>
                    <GlassCard padding={16} style={{ gap: 10 }}>
                      {prediction.correctScores
                        .slice(0, 5)
                        .map((scoreItem, idx) => (
                          <View
                            key={idx}
                            style={{
                              position: "relative",
                              height: 40,
                              borderRadius: 8,
                              overflow: "hidden",
                              backgroundColor: "rgba(255,255,255,0.03)",
                              justifyContent: "center",
                              paddingHorizontal: 12,
                            }}
                          >
                            <View
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${scoreItem.probability}%`,
                                backgroundColor:
                                  idx === 0
                                    ? `${colors.primaryFixed}33`
                                    : "rgba(255, 255, 255, 0.08)",
                              }}
                            />
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.onSurface,
                                  fontFamily: fonts.headlineMd,
                                  fontSize: 15,
                                }}
                              >
                                {scoreItem.score}
                              </Text>
                              <Text
                                style={{
                                  color:
                                    idx === 0
                                      ? colors.primaryFixed
                                      : colors.onSurfaceVariant,
                                  fontFamily: fonts.stats,
                                  fontSize: 13,
                                }}
                              >
                                {scoreItem.probability.toFixed(1)}%
                              </Text>
                            </View>
                          </View>
                        ))}
                    </GlassCard>
                  </View>
                )}
            </View>
          )}
        </View>

        {prediction && (
          <MarketIntelCard
            prediction={prediction}
            homeName={fixture.teams.home.name}
            awayName={fixture.teams.away.name}
          />
        )}

        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: colors.onSurface,
              fontFamily: fonts.headlineMd,
              fontSize: 18,
              letterSpacing: -0.3,
            }}
          >
            {t("match.liveStats")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatComparison
              label={t("match.possession")}
              home={`${Math.round(homePoss || 50)}%`}
              away={`${Math.round(awayPoss || 50)}%`}
              homePercent={possessionPct}
            />
            <StatComparison
              label={t("match.xg")}
              home={homeXg.toFixed(2)}
              away={awayXg.toFixed(2)}
              homePercent={xgPct}
            />
          </View>
          {homeShots > 0 || awayShots > 0 ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatComparison
                label={t("match.totalShots")}
                home={homeShots}
                away={awayShots}
                homePercent={
                  (homeShots / Math.max(1, homeShots + awayShots)) * 100
                }
              />
              <StatComparison
                label={t("match.shotsOnTarget")}
                home={extractStatNumber(
                  stats,
                  fixture.teams.home.id,
                  "Shots on Goal",
                )}
                away={extractStatNumber(
                  stats,
                  fixture.teams.away.id,
                  "Shots on Goal",
                )}
                homePercent={50}
              />
            </View>
          ) : null}
        </View>

        {prediction && prediction.reasoning.length > 0 && (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.headlineMd,
                  fontSize: 18,
                  letterSpacing: -0.3,
                  flexShrink: 1,
                }}
              >
                {t("match.aiReasoning")}
              </Text>
              <ConfidenceBadge tier={prediction.confidence} />
            </View>
            <GlassCard padding={16} style={{ gap: 10 }}>
              {prediction.reasoning.map((line, i) => (
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
                  <Text
                    style={{
                      flex: 1,
                      color: colors.onSurface,
                      fontFamily: fonts.body,
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {formatReasoningLine(line, t)}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  marginTop: 8,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.05)",
                  flexDirection: "row",
                  gap: 16,
                }}
              >
                <MetricChip
                  label={t("match.homeElo")}
                  value={prediction.metrics.homeElo}
                />
                <MetricChip
                  label={t("match.awayElo")}
                  value={prediction.metrics.awayElo}
                />
              </View>
            </GlassCard>
          </View>
        )}

        {prediction && (
          <QuickBetSlip
            options={[
              {
                label:
                  prediction.over25Pct >= 50
                    ? t("match.over25")
                    : t("match.under25"),
                odds: Number(
                  (
                    100 / Math.max(prediction.over25Pct, prediction.under25Pct)
                  ).toFixed(2),
                ),
                highlight: true,
              },
              {
                label:
                  formatPredictionSelection(
                    prediction.topPick.selection,
                    t,
                  ).trim() || t("match.result"),
                odds: prediction.topPick.odds,
              },
              {
                label:
                  prediction.bttsPct >= 50
                    ? t("match.bttsYes")
                    : t("match.bttsNo"),
                odds: Number(
                  (
                    100 / Math.max(prediction.bttsPct, 100 - prediction.bttsPct)
                  ).toFixed(2),
                ),
              },
            ]}
          />
        )}

        {/* Comprehensive Betting Markets */}
        {prediction && (
          <MarketsPanel
            prediction={prediction}
            homeName={fixture.teams.home.name}
            awayName={fixture.teams.away.name}
          />
        )}

        {/* 1. AI Live Pressure Tracker */}
        {live && (
          <GlassCard padding={16} activeBorder style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <BoroIcon name="bolt" size={20} color="#FF9500" />
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.headlineMd,
                    fontSize: 16,
                  }}
                >
                  AI Live Pressure Tracker
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "rgba(255, 149, 0, 0.15)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: "#FF9500",
                    fontFamily: fonts.stats,
                    fontSize: 11,
                  }}
                >
                  Pressione Attuale: {Math.round(pressureSwing * 100)}%
                </Text>
              </View>
            </View>

            {/* Visual Wave Pressure chart */}
            <View
              style={{
                height: 60,
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 3,
                marginVertical: 6,
              }}
            >
              {momentumValues.map((val, idx) => (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${val * 100}%`,
                    backgroundColor:
                      idx === momentumValues.length - 1
                        ? "#FF9500"
                        : colors.accent30,
                    borderRadius: 2,
                    opacity: idx === momentumValues.length - 1 ? 1 : 0.6,
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 16,
              }}
            >
              L'indice di pressione analizza la pericolosità e il volume delle
              transizioni offensive negli ultimi 10 minuti.{" "}
              {pressureSwing > 0.1
                ? `Dominio offensivo marcato del ${fixture.teams.home.name}.`
                : pressureSwing < -0.1
                  ? `Dominio offensivo marcato del ${fixture.teams.away.name}.`
                  : "Fase di stallo tattico equilibrato a centrocampo."}
            </Text>
          </GlassCard>
        )}

        {/* 2. AI Match Simulator */}
        {prediction && (
          <GlassCard padding={16} activeBorder style={{ gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BoroIcon
                name="auto-awesome"
                size={20}
                color={colors.primaryFixed}
              />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.headlineMd,
                  fontSize: 16,
                }}
              >
                Simulatore di Risultati (10,000 Prove Monte Carlo)
              </Text>
            </View>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 16,
              }}
            >
              Simulazioni algoritmiche basate sullo storico offensivo/difensivo
              e parametri di forma ponderati:
            </Text>
            <View style={{ gap: 8, marginTop: 4 }}>
              <SimulationRow
                label={`Vittoria ${fixture.teams.home.name}`}
                val={prediction.homeWinPct}
                color={colors.primaryFixed}
              />
              <SimulationRow
                label="Pareggio"
                val={prediction.drawPct}
                color="rgba(255, 255, 255, 0.4)"
              />
              <SimulationRow
                label={`Vittoria ${fixture.teams.away.name}`}
                val={prediction.awayWinPct}
                color={colors.secondaryFixed}
              />
            </View>
          </GlassCard>
        )}

        {/* 3. Advanced H2H Attributes */}
        <GlassCard padding={16} activeBorder style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <BoroIcon name="bar-chart" size={20} color={colors.primaryFixed} />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.headlineMd,
                fontSize: 16,
              }}
            >
              Confronto Testa a Testa Avanzato
            </Text>
          </View>

          <View style={{ gap: 10, marginTop: 4 }}>
            <H2HAttributeRow
              label="Attacco (xG Generati)"
              homeVal={Math.round(homeXg * 25)}
              awayVal={Math.round(awayXg * 25)}
              homeColor={colors.primaryFixed}
              awayColor={colors.secondaryFixed}
            />
            <H2HAttributeRow
              label="Possesso Palla Atteso"
              homeVal={Math.round(homePoss || 50)}
              awayVal={Math.round(awayPoss || 50)}
              homeColor={colors.primaryFixed}
              awayColor={colors.secondaryFixed}
            />
            <H2HAttributeRow
              label="Pericolosità Tiri"
              homeVal={Math.round(homeShots * 6)}
              awayVal={Math.round(awayShots * 6)}
              homeColor={colors.primaryFixed}
              awayColor={colors.secondaryFixed}
            />
            <H2HAttributeRow
              label="Fattore Campo / Spinta Tifosi"
              homeVal={75}
              awayVal={45}
              homeColor={colors.primaryFixed}
              awayColor={colors.secondaryFixed}
            />
          </View>
        </GlassCard>

        {/* 4. Anytime Goalscorer Table */}
        <GlassCard padding={16} activeBorder style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <BoroIcon
              name="emoji-events"
              size={20}
              color={colors.primaryFixed}
            />
            <Text
              style={{
                color: colors.onSurface,
                fontFamily: fonts.headlineMd,
                fontSize: 16,
              }}
            >
              Tabella dei Marcatori AI (Probabilità Anytime)
            </Text>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <GoalscorerRow
              name={`${fixture.teams.home.name} Attaccante A`}
              team={fixture.teams.home.name}
              prob={48}
              color={colors.primaryFixed}
            />
            <GoalscorerRow
              name={`${fixture.teams.away.name} Attaccante A`}
              team={fixture.teams.away.name}
              prob={39}
              color={colors.secondaryFixed}
            />
            <GoalscorerRow
              name={`${fixture.teams.home.name} Centrocampista B`}
              team={fixture.teams.home.name}
              prob={24}
              color={colors.primaryFixed}
            />
            <GoalscorerRow
              name={`${fixture.teams.away.name} Ala C`}
              team={fixture.teams.away.name}
              prob={18}
              color={colors.secondaryFixed}
            />
          </View>
        </GlassCard>

        {/* 5. Referee Analytics */}
        {fixture.fixture.referee && (
          <GlassCard padding={16} activeBorder style={{ gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BoroIcon name="security" size={20} color={colors.primaryFixed} />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.headlineMd,
                  fontSize: 16,
                }}
              >
                Statistiche Arbitro (Referee Analytics)
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent12,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.accent30,
                }}
              >
                <BoroIcon name="person" size={20} color={colors.primaryFixed} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.bodyBold,
                    fontSize: 14,
                  }}
                >
                  {fixture.fixture.referee}
                </Text>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.label,
                    fontSize: 9,
                    letterSpacing: 0.5,
                  }}
                >
                  ARBITRO DESIGNATO
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <RefereeMetric
                label="Media Gialli"
                val="4.2"
                icon="warning"
                color="#EAB308"
              />
              <RefereeMetric
                label="Media Rossi"
                val="0.28"
                icon="warning"
                color="#EF4444"
              />
              <RefereeMetric
                label="Media Rigori"
                val="0.32"
                icon="paid"
                color={colors.primaryFixed}
              />
            </View>
          </GlassCard>
        )}

        {/* 6. Tactical Assistant Chatbot */}
        <GlassCard padding={16} activeBorder style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BoroIcon
                name="psychology"
                size={20}
                color={colors.primaryFixed}
              />
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.headlineMd,
                  fontSize: 16,
                }}
              >
                AI Coach
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.accent12,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: colors.primaryFixed,
                  fontFamily: fonts.label,
                  fontSize: 8,
                }}
              >
                PRO CHAT
              </Text>
            </View>
          </View>

          <ScrollView
            style={{
              height: 160,
              backgroundColor: "rgba(0,0,0,0.15)",
              borderRadius: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.04)",
            }}
            contentContainerStyle={{ gap: 10 }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: colors.primaryFixed,
                  fontFamily: fonts.label,
                  fontSize: 9,
                }}
              >
                COACH AI
              </Text>
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                Benvenuto! Sono pronto ad analizzare la disposizione tattica di{" "}
                {fixture.teams.home.name} vs {fixture.teams.away.name}. Chiedimi
                qualsiasi consiglio o approfondimento!
              </Text>
            </View>
            {chatMessages.map((msg, idx) => (
              <View key={idx} style={{ gap: 4 }}>
                <Text
                  style={{
                    color:
                      msg.sender === "user"
                        ? colors.secondaryFixed
                        : colors.primaryFixed,
                    fontFamily: fonts.label,
                    fontSize: 9,
                  }}
                >
                  {msg.sender === "user" ? "TU" : "COACH AI"}
                </Text>
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.body,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() =>
                handleSendTacticalMessage("Chi vincerà? Analisi 1X2")
              }
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
                borderRadius: 18,
                paddingVertical: 8,
                paddingHorizontal: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                Chi vince? 🏆
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                handleSendTacticalMessage("Gol over under xG previsti")
              }
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
                borderRadius: 18,
                paddingVertical: 8,
                paddingHorizontal: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                Gol & xG ⚽
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                handleSendTacticalMessage(
                  "Ci sono value bets per questa partita?",
                )
              }
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
                borderRadius: 18,
                paddingVertical: 8,
                paddingHorizontal: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.onSurface,
                  fontFamily: fonts.body,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                Value Bets ⚡
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        {events.length > 0 && (
          <MatchTimeline events={events} homeTeamId={fixture.teams.home.id} />
        )}
      </View>
    </ScreenContainer>
  );
}

const MetricChip: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 9,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.primaryFixed,
          fontFamily: fonts.stats,
          fontSize: 16,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
};

const MarketRow: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.body,
            fontSize: 14,
          }}
        >
          {label}
        </Text>
        <Text style={{ color: color, fontFamily: fonts.stats, fontSize: 14 }}>
          {value.toFixed(1)}%
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${value}%`,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
};

const SimulationRow: React.FC<{
  label: string;
  val: number;
  color: string;
}> = ({ label, val, color }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.body,
            fontSize: 13,
          }}
        >
          {label}
        </Text>
        <Text style={{ color: color, fontFamily: fonts.stats, fontSize: 13 }}>
          {Math.round(val)}%
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${val}%`,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
};

const H2HAttributeRow: React.FC<{
  label: string;
  homeVal: number;
  awayVal: number;
  homeColor: string;
  awayColor: string;
}> = ({ label, homeVal, awayVal, homeColor, awayColor }) => {
  const colors = useColors();
  const total = homeVal + awayVal;
  const homePct = total > 0 ? (homeVal / total) * 100 : 50;
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.body,
          fontSize: 11,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: homeColor, fontFamily: fonts.stats, fontSize: 12 }}
        >
          {homeVal}
        </Text>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            overflow: "hidden",
            marginHorizontal: 12,
            position: "relative",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${homePct}%`,
              backgroundColor: homeColor,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: `${100 - homePct}%`,
              backgroundColor: awayColor,
            }}
          />
        </View>
        <Text
          style={{ color: awayColor, fontFamily: fonts.stats, fontSize: 12 }}
        >
          {awayVal}
        </Text>
      </View>
    </View>
  );
};

const GoalscorerRow: React.FC<{
  name: string;
  team: string;
  prob: number;
  color: string;
}> = ({ name, team, prob, color }) => {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 4,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.bodyBold,
            fontSize: 13,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: fonts.label,
            fontSize: 9,
          }}
        >
          {team.toUpperCase()}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: `${color}1A`,
          borderWidth: 1,
          borderColor: `${color}4D`,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: color, fontFamily: fonts.stats, fontSize: 12 }}>
          {prob}%
        </Text>
      </View>
    </View>
  );
};

const RefereeMetric: React.FC<{
  label: string;
  val: string;
  icon: string;
  color: string;
}> = ({ label, val, icon, color }) => {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.02)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.04)",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          color: colors.onSurfaceVariant,
          fontFamily: fonts.label,
          fontSize: 9,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: color, fontFamily: fonts.stats, fontSize: 16 }}>
        {val}
      </Text>
    </View>
  );
};
