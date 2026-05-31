/**
 * "BORO PICK" — the single canonical recommendation for a match, shown between
 * the model-analysis header and the score.
 *
 * Features a modern animated rotating rainbow outline (conic gradient on web,
 * an animated multi-colour ring on native). Displays the pick to play and, once
 * the match is finished, a stable green/red verdict (✓ correct / ✗ missed) that
 * never changes — it is derived from the same provider/odds data the Results
 * tab grades, so it always matches.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import { formatPredictionSelection } from '@/utils/predictionText';
import type { PredictionResult } from '@/types/prediction';
import type { GradedPrediction } from '@/services/ai/evaluate';

interface Props {
  prediction: PredictionResult;
  graded: GradedPrediction | null;
}

const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff3b30'];

export const BoroPickFrame: React.FC<Props> = ({ prediction, graded }) => {
  const colors = useColors();
  const t = useT();

  const decided = graded && graded.grade !== 'pending';
  const correct = graded?.grade === 'correct';
  const verdictColor = decided ? (correct ? '#22c55e' : '#ef4444') : null;

  // Rotation driver for the animated border.
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const pickText = formatPredictionSelection(prediction.topPick.selection, t);
  const conic = `conic-gradient(from var(--a,0deg), ${RAINBOW.join(', ')})`;

  return (
    <View style={{ borderRadius: 20, padding: 2, overflow: 'hidden', position: 'relative' }}>
      {/* Animated border layer */}
      {decided ? (
        // Settled: solid verdict-coloured glow border (no rotation — locked in).
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, backgroundColor: verdictColor!, opacity: 0.9 }} />
      ) : Platform.OS === 'web' ? (
        <WebConicBorder />
      ) : (
        <Animated.View
          style={{
            position: 'absolute',
            top: '-50%', left: '-50%', width: '200%', height: '200%',
            transform: [{ rotate }],
          }}
        >
          {/* Four quadrant rainbow sweep approximating a rotating gradient ring. */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, backgroundColor: '#ff3b30' }} />
            <View style={{ flex: 1, backgroundColor: '#ffcc00' }} />
          </View>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, backgroundColor: '#0a84ff' }} />
            <View style={{ flex: 1, backgroundColor: '#bf5af2' }} />
          </View>
        </Animated.View>
      )}

      {/* Inner content card */}
      <View
        style={{
          borderRadius: 18,
          backgroundColor: '#16151b',
          paddingVertical: 16,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 46, height: 46, borderRadius: 23,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: decided ? `${verdictColor}22` : `${colors.primaryFixed}1A`,
            borderWidth: 1.5,
            borderColor: decided ? `${verdictColor}` : `${colors.primaryFixed}55`,
          }}
        >
          <BoroIcon
            name={decided ? (correct ? 'check-circle' : 'close') : 'bolt'}
            size={24}
            color={decided ? verdictColor! : colors.primaryFixed}
          />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 1.5 }}>
            {t('pick.boroPick')}
          </Text>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 18, letterSpacing: -0.3 }} numberOfLines={1}>
            {pickText}
          </Text>
          <Text style={{ color: decided ? verdictColor! : colors.primaryFixed, fontFamily: fonts.body, fontSize: 11 }}>
            {decided
              ? `${correct ? t('pick.won') : t('pick.lost')} · ${graded!.actual}`
              : `${Math.round(prediction.topPick.probability)}% · ${t('pick.toPlay')}`}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>
            {t('match.odds')}
          </Text>
          <Text style={{ color: decided ? verdictColor! : colors.primaryFixed, fontFamily: fonts.stats, fontSize: 20 }}>
            {prediction.topPick.odds.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Web-only rotating conic-gradient border via a CSS keyframe animation injected
 * once. Uses a real conic gradient for a true rainbow ring.
 */
const WebConicBorder: React.FC = () => {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'boro-pick-spin-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @property --boroAngle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
      @keyframes boroSpin { to { --boroAngle: 360deg; } }
      .boro-pick-rainbow {
        background: conic-gradient(from var(--boroAngle), #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #0a84ff, #5e5ce6, #bf5af2, #ff3b30);
        animation: boroSpin 4s linear infinite;
      }
      @keyframes boroSpinFallback { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <View
      // @ts-ignore web-only className
      className="boro-pick-rainbow"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 }}
    />
  );
};
