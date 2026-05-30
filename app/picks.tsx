import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ScreenContainer } from '@/components/layouts/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { BoroIcon } from '@/components/ui/BoroIcon';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import { useHaptics } from '@/hooks/useHaptics';
import { useBetSlipStore, summarizeSlip, type SavedPick } from '@/store/betSlipStore';
import { useSettlePicks } from '@/hooks/useSettlePicks';
import { formatPredictionSelection } from '@/utils/predictionText';

const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#FF9500';

export default function PicksScreen() {
  const colors = useColors();
  const t = useT();
  const haptics = useHaptics();
  const picks = useBetSlipStore((s) => s.picks);
  const remove = useBetSlipStore((s) => s.remove);
  const clearSettled = useBetSlipStore((s) => s.clearSettled);

  // Auto-settle pending picks whose matches have finished.
  useSettlePicks();

  const summary = useMemo(() => summarizeSlip(picks), [picks]);
  const sorted = useMemo(
    () =>
      [...picks].sort((a, b) => {
        const order = (p: SavedPick) => (p.status === 'pending' ? 0 : 1);
        if (order(a) !== order(b)) return order(a) - order(b);
        return b.savedAt - a.savedAt;
      }),
    [picks],
  );

  return (
    <ScreenContainer showBack title={t('picks.title')}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 32, letterSpacing: -1 }}>
            {t('picks.title')}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {t('picks.subtitle')}
          </Text>
        </View>

        {/* Performance summary */}
        {summary.settled > 0 && (
          <GlassCard padding={18} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stat label={t('picks.hitRate')} value={`${Math.round(summary.hitRate)}%`} color={summary.hitRate >= 50 ? GREEN : colors.onSurface} />
              <Stat
                label={t('picks.roi')}
                value={`${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`}
                color={summary.roi >= 0 ? GREEN : RED}
              />
              <Stat
                label={t('picks.profit')}
                value={`${summary.profit >= 0 ? '+' : ''}${summary.profit.toFixed(2)}${t('picks.units')}`}
                color={summary.profit >= 0 ? GREEN : RED}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <MiniStat label={t('picks.won')} value={summary.won} color={GREEN} />
              <MiniStat label={t('picks.lost')} value={summary.lost} color={RED} />
              <MiniStat label={t('picks.pending')} value={summary.pending} color={AMBER} />
              <MiniStat label={t('picks.staked')} value={`${summary.staked}${t('picks.units')}`} color={colors.onSurfaceVariant} />
            </View>
          </GlassCard>
        )}

        {summary.settled > 0 && (
          <Pressable onPress={() => { haptics.light(); clearSettled(); }} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
              {t('picks.clearSettled')}
            </Text>
          </Pressable>
        )}

        {/* Picks list */}
        {sorted.length === 0 ? (
          <GlassCard padding={24} style={{ alignItems: 'center', gap: 16 }}>
            <BoroIcon name="bookmark" size={40} color={colors.onSurfaceVariant} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.headlineMd, fontSize: 16, textAlign: 'center' }}>
                {t('picks.empty.title')}
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 }}>
                {t('picks.empty.sub')}
              </Text>
            </View>
          </GlassCard>
        ) : (
          <View style={{ gap: 10 }}>
            {sorted.map((p) => (
              <PickRow key={p.id} pick={p} onOpen={() => router.push(`/match/${p.fixtureId}`)} onRemove={() => remove(p.id)} t={t} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const PickRow: React.FC<{ pick: SavedPick; onOpen: () => void; onRemove: () => void; t: (k: string) => string }> = ({ pick, onOpen, onRemove, t }) => {
  const colors = useColors();
  const accent = pick.status === 'won' ? GREEN : pick.status === 'lost' ? RED : AMBER;
  const statusKey = pick.status === 'won' ? 'picks.won' : pick.status === 'lost' ? 'picks.lost' : 'picks.pending';

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <GlassCard padding={14} style={{ borderColor: `${accent}55`, borderWidth: 1.5, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5, flex: 1 }} numberOfLines={1}>
            {pick.leagueName.toUpperCase()} · {format(parseISO(pick.kickoff), 'd MMM HH:mm')}
          </Text>
          <View style={{ backgroundColor: `${accent}1A`, borderColor: `${accent}55`, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: accent, fontFamily: fonts.label, fontSize: 9 }}>
              {t(statusKey)}{pick.result ? ` · ${pick.result}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
              {pick.homeName} vs {pick.awayName}
            </Text>
            <Text style={{ color: accent, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>
              {formatPredictionSelection(pick.selection, t)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.stats, fontSize: 18 }}>{pick.odds.toFixed(2)}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 10 }}>{Math.round(pick.probability)}%</Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 9, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color, fontFamily: fonts.stats, fontSize: 22 }}>{value}</Text>
    </View>
  );
};

const MiniStat: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => {
  const colors = useColors();
  return (
    <View style={{ gap: 2, alignItems: 'center' }}>
      <Text style={{ color, fontFamily: fonts.stats, fontSize: 15 }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
};
