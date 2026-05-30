/**
 * "Track this pick" toggle — saves the match's top pick to the user's personal
 * tracker (bet slip), or removes it. Uses the best available bookmaker odds for
 * the pick's market when present, else the model's fair odds.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/theme/i18n';
import { useBetSlipStore } from '@/store/betSlipStore';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

const bestOddsForPick = (prediction: PredictionResult): number => {
  const b = prediction.bestOdds;
  const m = prediction.topPick.market;
  const sel = prediction.topPick.selection;
  if (b) {
    if (m === 'WIN') {
      // Home pick if selection isn't draw/away — fall back to model odds otherwise.
      if (b.home && sel.toLowerCase().includes('to win')) {
        // can't tell home/away by text alone reliably; prefer model odds for safety
      }
    }
    if (m === 'OVER_2_5' && b.over25) return b.over25;
    if (m === 'UNDER_2_5' && b.under25) return b.under25;
    if (m === 'BTTS' && b.bttsYes) return b.bttsYes;
  }
  return prediction.topPick.odds;
};

export const SavePickButton: React.FC<{ fixture: Fixture; prediction: PredictionResult }> = ({ fixture, prediction }) => {
  const colors = useColors();
  const haptics = useHaptics();
  const t = useT();
  const add = useBetSlipStore((s) => s.add);
  const remove = useBetSlipStore((s) => s.remove);
  const has = useBetSlipStore((s) => s.has);

  const id = `${fixture.fixture.id}:${prediction.topPick.market}`;
  const saved = has(id);

  const toggle = () => {
    haptics.medium();
    if (saved) {
      remove(id);
      return;
    }
    add({
      id,
      fixtureId: fixture.fixture.id,
      homeName: fixture.teams.home.name,
      awayName: fixture.teams.away.name,
      leagueName: fixture.league.name,
      kickoff: fixture.fixture.date,
      market: prediction.topPick.market,
      selection: prediction.topPick.selection,
      probability: prediction.topPick.probability,
      odds: bestOddsForPick(prediction),
    });
  };

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: saved ? `${colors.primaryFixed}1A` : 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: saved ? colors.primaryFixed : 'rgba(255,255,255,0.12)',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <BoroIcon name={saved ? 'bookmark-added' : 'add-task'} size={18} color={saved ? colors.primaryFixed : colors.onSurface} />
      <Text style={{ color: saved ? colors.primaryFixed : colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }}>
        {saved ? t('match.savedPick') : t('match.savePick')}
      </Text>
    </Pressable>
  );
};
