/**
 * MarketsPanel — comprehensive sectioned betting markets panel.
 * Renders only sections for which the prediction carries real data.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { PredictionResult } from '@/types/prediction';

interface Props {
  prediction: PredictionResult;
  homeName: string;
  awayName: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

type ColorsType = ReturnType<typeof useColors>;

const SectionTitle: React.FC<{ title: string; colors: ColorsType }> = ({ title, colors }) => (
  <Text
    style={{
      color: colors.onSurface,
      fontFamily: fonts.headlineMd,
      fontSize: 14,
      letterSpacing: -0.2,
      marginBottom: 2,
    }}
  >
    {title}
  </Text>
);

interface ProbBarProps {
  label: string;
  pct: number;
  color: string;
  odds?: number;
  highlight?: boolean;
  colors: ColorsType;
}

const ProbBar: React.FC<ProbBarProps> = ({ label, pct, color, odds, highlight, colors }) => (
  <View style={{ gap: 4 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text
        style={{
          color: highlight ? color : colors.onSurface,
          fontFamily: highlight ? fonts.bodyBold : fonts.body,
          fontSize: 13,
          flex: 1,
          marginRight: 8,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {odds !== undefined && (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 11 }}>
            @{odds.toFixed(2)}
          </Text>
        )}
        <Text
          style={{
            color: highlight ? color : colors.onSurface,
            fontFamily: fonts.stats,
            fontSize: 13,
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {Math.round(pct)}%
        </Text>
      </View>
    </View>
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.min(100, Math.max(0, pct))}%` as `${number}%`,
          backgroundColor: color,
          borderRadius: 3,
          opacity: highlight ? 1 : 0.6,
        }}
      />
    </View>
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const MarketsPanel: React.FC<Props> = ({ prediction, homeName, awayName }) => {
  const colors = useColors();

  const probToOdds = (p: number) => (p > 0 ? parseFloat((100 / p).toFixed(2)) : 99.0);

  const homeWinOdds = prediction.bestOdds?.home ?? probToOdds(prediction.homeWinPct);
  const drawOdds = prediction.bestOdds?.draw ?? probToOdds(prediction.drawPct);
  const awayWinOdds = prediction.bestOdds?.away ?? probToOdds(prediction.awayWinPct);
  const maxPct1x2 = Math.max(prediction.homeWinPct, prediction.drawPct, prediction.awayWinPct);

  const ouLines = prediction.overUnderLines;
  const hasOverUnderLines = ouLines != null && Object.keys(ouLines).length > 0;
  const hasDoubleChance = Boolean(prediction.doubleChance);
  const hasHalfTime = Boolean(prediction.halfTimeResult);
  const hasFirstScorer = Boolean(prediction.teamToScoreFirst);
  const hasCorners =
    prediction.cornersOverUnder != null && prediction.cornersOverUnder.length > 0;
  const hasCorrectScores =
    prediction.correctScores != null && prediction.correctScores.length > 0;
  const hasValueBets = prediction.valueBets != null && prediction.valueBets.length > 0;

  return (
    <View style={{ gap: 14 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BoroIcon name="bar-chart" size={20} color={colors.primaryFixed} />
        <Text
          style={{
            color: colors.onSurface,
            fontFamily: fonts.headlineMd,
            fontSize: 18,
            letterSpacing: -0.3,
          }}
        >
          Mercati di Scommessa
        </Text>
      </View>

      {/* 1. 1X2 + Quote */}
      <GlassCard padding={16} style={{ gap: 12 }}>
        <SectionTitle title="1X2 + Quote" colors={colors} />
        <ProbBar
          label={homeName}
          pct={prediction.homeWinPct}
          color={colors.primaryFixed}
          odds={homeWinOdds}
          highlight={prediction.homeWinPct === maxPct1x2}
          colors={colors}
        />
        <ProbBar
          label="Pareggio"
          pct={prediction.drawPct}
          color="rgba(255,255,255,0.5)"
          odds={drawOdds}
          highlight={prediction.drawPct === maxPct1x2}
          colors={colors}
        />
        <ProbBar
          label={awayName}
          pct={prediction.awayWinPct}
          color={colors.secondaryFixed}
          odds={awayWinOdds}
          highlight={prediction.awayWinPct === maxPct1x2}
          colors={colors}
        />
      </GlassCard>

      {/* 2. Gol (Over/Under) — all available lines */}
      {hasOverUnderLines && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <SectionTitle title="Gol (Over/Under)" colors={colors} />
            {prediction.expectedGoals && (
              <Text
                style={{
                  color: colors.onSurfaceVariant,
                  fontFamily: fonts.body,
                  fontSize: 11,
                }}
              >
                xG Totale Atteso: {prediction.expectedGoals.total.toFixed(2)} gol
              </Text>
            )}
          </View>
          {Object.entries(ouLines!)
            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
            .map(([line, { over, under }]) => (
              <View key={line} style={{ gap: 6 }}>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.label,
                    fontSize: 10,
                    letterSpacing: 0.4,
                  }}
                >
                  LINEA {line}
                </Text>
                <ProbBar
                  label={`Over ${line}`}
                  pct={over}
                  color={colors.primaryFixed}
                  highlight={over >= 55}
                  colors={colors}
                />
                <ProbBar
                  label={`Under ${line}`}
                  pct={under}
                  color={colors.secondaryFixed}
                  highlight={under >= 55}
                  colors={colors}
                />
              </View>
            ))}
        </GlassCard>
      )}

      {/* 3. Entrambe Segnano (BTTS) */}
      <GlassCard padding={16} style={{ gap: 12 }}>
        <SectionTitle title="Entrambe Segnano (BTTS)" colors={colors} />
        <ProbBar
          label="Sì — Gol/Gol"
          pct={prediction.bttsPct}
          color={colors.primaryFixed}
          odds={prediction.bestOdds?.bttsYes}
          highlight={prediction.bttsPct >= 50}
          colors={colors}
        />
        <ProbBar
          label="No — Gol/Gol"
          pct={100 - prediction.bttsPct}
          color={colors.secondaryFixed}
          odds={prediction.bestOdds?.bttsNo}
          highlight={prediction.bttsPct < 50}
          colors={colors}
        />
      </GlassCard>

      {/* 4. Doppia Chance */}
      {hasDoubleChance && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <SectionTitle title="Doppia Chance" colors={colors} />
          <ProbBar
            label={`${homeName} o Pareggio (1X)`}
            pct={prediction.doubleChance!.homeDraw}
            color={colors.primaryFixed}
            highlight={
              prediction.doubleChance!.homeDraw ===
              Math.max(
                prediction.doubleChance!.homeDraw,
                prediction.doubleChance!.awayDraw,
                prediction.doubleChance!.homeAway,
              )
            }
            colors={colors}
          />
          <ProbBar
            label={`${awayName} o Pareggio (X2)`}
            pct={prediction.doubleChance!.awayDraw}
            color={colors.secondaryFixed}
            highlight={
              prediction.doubleChance!.awayDraw ===
              Math.max(
                prediction.doubleChance!.homeDraw,
                prediction.doubleChance!.awayDraw,
                prediction.doubleChance!.homeAway,
              )
            }
            colors={colors}
          />
          <ProbBar
            label={`${homeName} o ${awayName} (12)`}
            pct={prediction.doubleChance!.homeAway}
            color="rgba(255,200,0,0.85)"
            highlight={
              prediction.doubleChance!.homeAway ===
              Math.max(
                prediction.doubleChance!.homeDraw,
                prediction.doubleChance!.awayDraw,
                prediction.doubleChance!.homeAway,
              )
            }
            colors={colors}
          />
        </GlassCard>
      )}

      {/* 5. Primo Tempo */}
      {hasHalfTime && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <SectionTitle title="Primo Tempo" colors={colors} />
          {(() => {
            const ht = prediction.halfTimeResult!;
            const maxHt = Math.max(ht.home, ht.draw, ht.away);
            return (
              <>
                <ProbBar
                  label={`${homeName} Vince PT`}
                  pct={ht.home}
                  color={colors.primaryFixed}
                  highlight={ht.home === maxHt}
                  colors={colors}
                />
                <ProbBar
                  label="Pareggio PT"
                  pct={ht.draw}
                  color="rgba(255,255,255,0.45)"
                  highlight={ht.draw === maxHt}
                  colors={colors}
                />
                <ProbBar
                  label={`${awayName} Vince PT`}
                  pct={ht.away}
                  color={colors.secondaryFixed}
                  highlight={ht.away === maxHt}
                  colors={colors}
                />
              </>
            );
          })()}
        </GlassCard>
      )}

      {/* 6. Primo Marcatore */}
      {hasFirstScorer && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <SectionTitle title="Primo Marcatore" colors={colors} />
          <ProbBar
            label={`${homeName} Segna Prima`}
            pct={prediction.teamToScoreFirst!.home}
            color={colors.primaryFixed}
            highlight={
              prediction.teamToScoreFirst!.home >= prediction.teamToScoreFirst!.away
            }
            colors={colors}
          />
          <ProbBar
            label={`${awayName} Segna Prima`}
            pct={prediction.teamToScoreFirst!.away}
            color={colors.secondaryFixed}
            highlight={
              prediction.teamToScoreFirst!.away > prediction.teamToScoreFirst!.home
            }
            colors={colors}
          />
          {prediction.teamToScoreFirst!.draw > 0 && (
            <ProbBar
              label="Nessun Gol"
              pct={prediction.teamToScoreFirst!.draw}
              color="rgba(255,255,255,0.35)"
              colors={colors}
            />
          )}
        </GlassCard>
      )}

      {/* 7. Angoli O/U */}
      {hasCorners && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <SectionTitle title="Angoli O/U" colors={colors} />
          {prediction.cornersOverUnder!.map((c, idx) => (
            <ProbBar
              key={idx}
              label={c.label}
              pct={c.probability}
              color={idx % 2 === 0 ? colors.primaryFixed : colors.secondaryFixed}
              colors={colors}
            />
          ))}
        </GlassCard>
      )}

      {/* 8. Risultati Esatti */}
      {hasCorrectScores && (
        <GlassCard padding={16} style={{ gap: 10 }}>
          <SectionTitle title="Risultati Esatti" colors={colors} />
          {prediction.correctScores!.slice(0, 6).map((cs, idx) => (
            <View
              key={idx}
              style={{
                position: 'relative',
                height: 38,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.03)',
                justifyContent: 'center',
                paddingHorizontal: 12,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, cs.probability)}%` as `${number}%`,
                  backgroundColor:
                    idx === 0
                      ? `${colors.primaryFixed}33`
                      : 'rgba(255,255,255,0.07)',
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.headlineMd,
                    fontSize: 14,
                  }}
                >
                  {cs.score}
                </Text>
                <Text
                  style={{
                    color: idx === 0 ? colors.primaryFixed : colors.onSurfaceVariant,
                    fontFamily: fonts.stats,
                    fontSize: 12,
                  }}
                >
                  {cs.probability.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      )}

      {/* 9. Value Bets */}
      {hasValueBets && (
        <GlassCard padding={16} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SectionTitle title="Value Bets" colors={colors} />
            <View
              style={{
                backgroundColor: `${colors.primaryFixed}25`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: `${colors.primaryFixed}55`,
              }}
            >
              <Text
                style={{ color: colors.primaryFixed, fontFamily: fonts.label, fontSize: 10 }}
              >
                ⚡ EDGE
              </Text>
            </View>
          </View>
          {prediction.valueBets!.map((vb, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 6,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{
                    color: colors.onSurface,
                    fontFamily: fonts.bodyBold,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {vb.selection}
                </Text>
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    fontFamily: fonts.body,
                    fontSize: 10,
                  }}
                >
                  {vb.market} · Modello {Math.round(vb.modelProb)}% · Quota @{vb.bestOdds.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${colors.primaryFixed}20`,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: `${colors.primaryFixed}44`,
                }}
              >
                <Text
                  style={{
                    color: colors.primaryFixed,
                    fontFamily: fonts.stats,
                    fontSize: 13,
                  }}
                >
                  +{Math.round(vb.edge * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      )}
    </View>
  );
};
