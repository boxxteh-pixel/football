/**
 * SharePickButton — captures the parent view as an image and shares it
 * using expo-sharing (mobile) or Web Share API (web).
 *
 * Usage: wrap the view you want to screenshot in a ref, pass it here.
 */
import React, { useCallback } from 'react';
import { Platform, Pressable, Text, View, Share } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BoroIcon } from '@/components/ui/BoroIcon';
import type { PredictionResult } from '@/types/prediction';
import type { Fixture } from '@/types/match';

interface SharePickButtonProps {
  fixture: Fixture;
  prediction: PredictionResult;
  /** ref from useRef<View>() pointing at the card to screenshot */
  viewRef?: React.RefObject<View>;
}

export const SharePickButton: React.FC<SharePickButtonProps> = ({
  fixture,
  prediction,
  viewRef,
}) => {
  const colors = useColors();
  const home = fixture.teams.home.name;
  const away = fixture.teams.away.name;

  const handleShare = useCallback(async () => {
    const pick = prediction.topPick;
    const confidence = prediction.confidence;

    // Try image share first (mobile only, requires react-native-view-shot)
    if (Platform.OS !== 'web' && viewRef?.current) {
      try {
        const { captureRef } = require('react-native-view-shot');
        const Sharing = require('expo-sharing');

        const uri = await captureRef(viewRef.current, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `BORO — ${home} vs ${away}`,
            UTI: 'public.png',
          });
          return;
        }
      } catch (e) {
        // fall through to text share
      }
    }

    // Web or fallback: text share
    const emoji = pick.probability >= 80 ? '🔥' : pick.probability >= 65 ? '✅' : '📊';
    const text =
      `${emoji} BORO AI — Pronostico\n\n` +
      `⚽ ${home} vs ${away}\n` +
      `📅 ${new Date(fixture.fixture.timestamp * 1000).toLocaleDateString('it-IT')}\n\n` +
      `🎯 Pick: ${pick.selection}\n` +
      `📈 Probabilità: ${Math.round(pick.probability)}%\n` +
      `💰 Quota: ${pick.odds.toFixed(2)}\n` +
      `🏆 Confidenza: ${confidence}\n\n` +
      `Casa: ${Math.round(prediction.homeWinPct)}%  |  X: ${Math.round(prediction.drawPct)}%  |  Ospite: ${Math.round(prediction.awayWinPct)}%\n` +
      `Over 2.5: ${Math.round(prediction.over25Pct)}%  |  BTTS: ${Math.round(prediction.bttsPct)}%\n\n` +
      `— Analisi generata da BORO AI`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({ title: `BORO — ${home} vs ${away}`, text });
        return;
      } catch { /* user cancelled */ }
    }

    await Share.share({ message: text, title: `BORO — ${home} vs ${away}` });
  }, [fixture, prediction, viewRef]);

  return (
    <Pressable
      onPress={handleShare}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: pressed ? colors.accent15 : colors.accent08,
        borderWidth: 1,
        borderColor: colors.accent20,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <BoroIcon name="share" size={16} color={colors.primaryFixed} />
      <Text style={{ color: colors.primaryFixed, fontFamily: fonts.bodyBold, fontSize: 13 }}>
        Condividi
      </Text>
    </Pressable>
  );
};
