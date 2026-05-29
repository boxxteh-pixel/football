/**
 * MarketIntelCard — surfaces the REAL-data edge of the predictor:
 *  - Model vs devigged bookmaker 1X2 side by side
 *  - Detected value bets (model prob > market implied) with edge + best odds
 *  - Market margin (overround) as a sharpness indicator
 *  - Which independent data signals backed the prediction
 *
 * Renders nothing unless the prediction actually carries market data, so it
 * never shows fabricated numbers.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import type { PredictionResult } from '@/types/prediction';

interface Props {
  prediction: PredictionResult;
  homeName: string;
  awayName: string;
}

export const MarketIntelCard: React.FC<Props> = ({ prediction, homeName, awayName }) => {
  const colors = useColors();
  const t = useT();

  const hasMarket = Boolean(prediction.marketProbabilities);
  const hasValue = Boolean(prediction.valueBets && prediction.valueBets.length > 0);
  if (!hasMarket && !hasValue) return null;

  const mp = prediction.marketProbabilities;
  const marginPct =
    prediction.marketOverround != null ? Math.round((prediction.marketOverround - 1) * 1000) / 10 : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BoroIcon name="insights" size={20} color={colors.primaryFixed} />
        <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }}>
          {t('match.marketIntel')}
        </Text>
      </View>

      {/* Model vs Market 1X2 */}
      {mp && (
        <GlassCard padding={16} style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
              {t('match.modelVsMarket')}
            </Text>
            {marginPct != null && (
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 10 }}>
                {t('match.marketEff')}: {marginPct}%
              </Text>
            )}
          </View>

          <CompareRow
            label={homeName}
            model={prediction.homeWinPct}
            market={mp.home}
            colors={colors}
          />
          <CompareRow label={t('prediction.draw')} model={prediction.drawPct} market={mp.draw} colors={colors} />
          <CompareRow label={awayName} model={prediction.awayWinPct} market={mp.away} colors={colors} />

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <LegendDot color={colors.primaryFixed} label={t('match.modelCol')} colors={colors} />
            <LegendDot color={colors.onSurfaceVariant} label={t('match.marketCol')} colors={colors} />
          </View>
        </GlassCard>
      )}

      {/* Value bets */}
      <GlassCard padding={16} style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }}>
            {t('match.valueBets')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 11 }}>
            {t('match.valueBetsSub')}
          </Text>
        </View>

        {hasValue ? (
          prediction.valueBets!.slice(0, 4).map((v, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 13 }} numberOfLines={1}>
                  {v.selection}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>
                  {v.market} · {t('match.bestOdds')} {v.bestOdds.toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View
                  style={{
                    backgroundColor: `${colors.primaryFixed}1F`,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: `${colors.primaryFixed}40`,
                  }}
                >
                  <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 13 }}>
                    +{Math.round(v.edge * 100)}%
                  </Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 9, marginTop: 2 }}>
                  {Math.round(v.modelProb)}% {t('insights.probabilityShort')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
            {t('match.noValue')}
          </Text>
        )}
      </GlassCard>

      {/* Data signals */}
      <DataSignals prediction={prediction} colors={colors} t={t} />
    </View>
  );
};

const CompareRow: React.FC<{ label: string; model: number; market: number; colors: any }> = ({
  label,
  model,
  market,
  colors,
}) => (
  <View style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.onSurface, fontFamily: fonts.body, fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 13, width: 42, textAlign: 'right' }}>
          {Math.round(model)}%
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 13, width: 42, textAlign: 'right' }}>
          {Math.round(market)}%
        </Text>
      </View>
    </View>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, model)}%`, backgroundColor: colors.primaryFixed, borderRadius: 3, opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, market)}%`, borderColor: colors.onSurfaceVariant, borderBottomWidth: 2 }} />
    </View>
  </View>
);

const LegendDot: React.FC<{ color: string; label: string; colors: any }> = ({ color, label, colors }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>{label}</Text>
  </View>
);

const DataSignals: React.FC<{ prediction: PredictionResult; colors: any; t: (k: string) => string }> = ({
  prediction,
  colors,
  t,
}) => {
  const signals: Array<{ key: string; active: boolean }> = [
    { key: 'match.signalModel', active: true },
    { key: 'match.signalProvider', active: Boolean(prediction.halfTimeResult || prediction.teamToScoreFirst || prediction.cornersOverUnder || (prediction.source === 'HYBRID')) },
    { key: 'match.signalMarket', active: Boolean(prediction.marketProbabilities) },
  ];
  return (
    <GlassCard padding={14} style={{ gap: 10 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10, letterSpacing: 0.5 }}>
        {t('match.dataSignals')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {signals.map((s) => (
          <View
            key={s.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 14,
              backgroundColor: s.active ? `${colors.primaryFixed}14` : 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: s.active ? `${colors.primaryFixed}33` : 'rgba(255,255,255,0.06)',
              opacity: s.active ? 1 : 0.5,
            }}
          >
            <BoroIcon name={s.active ? 'check-circle' : 'radio-button-unchecked'} size={12} color={s.active ? colors.primaryFixed : colors.onSurfaceVariant} />
            <Text style={{ color: s.active ? colors.onSurface : colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 10 }}>
              {t(s.key)}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
};
