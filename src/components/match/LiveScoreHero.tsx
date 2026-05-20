import React from 'react';
import { Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { LivePulse } from '@/components/ui/LivePulse';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { MomentumBars } from '@/components/ui/MomentumBars';
import { useColors} from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { Fixture } from '@/types/match';
import { isFinished, isLive } from '@/types/match';

interface LiveScoreHeroProps {
  fixture: Fixture;
  momentumValues: number[]; // length 8-16 of 0-1 floats
  pressureSwing: number; // -100 to 100 (home positive)
}

export const LiveScoreHero: React.FC<LiveScoreHeroProps> = ({
  fixture,
  momentumValues,
  pressureSwing,
}) => {
  const colors = useColors();
  const live = isLive(fixture.fixture.status.short);
  const finished = isFinished(fixture.fixture.status.short);
  const elapsed = fixture.fixture.status.elapsed;
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;
  const homeWinning = homeGoals > awayGoals;
  const swingDirection = pressureSwing >= 0 ? '+' : '';
  const swingLabel = `${swingDirection}${Math.round(Math.abs(pressureSwing))}% ${
    pressureSwing >= 0 ? fixture.teams.home.name : fixture.teams.away.name
  }`;

  return (
    <GlassCard rounded="xl" padding={24} style={{ position: 'relative', overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: -64,
          right: -64,
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: colors.primaryFixed,
          opacity: 0.05,
        }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 8, width: '33%' }}>
          <TeamCrest uri={fixture.teams.home.logo} size={56} glow={homeWinning} />
          <Text
            numberOfLines={1}
            style={{
              color: colors.onSurface,
              fontFamily: fonts.headlineMd,
              fontSize: 14,
              textAlign: 'center',
              opacity: homeWinning ? 1 : 0.7,
            }}
          >
            {fixture.teams.home.name}
          </Text>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', width: '33%' }}>
          {live && (
            <View
              style={{
                backgroundColor: colors.accent10,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <LivePulse label={elapsed ? `LIVE ${elapsed}'` : 'LIVE'} />
            </View>
          )}
          {finished && (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11 }}>
                FT
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text
              style={{
                color: homeWinning ? colors.onSurface : colors.onSurfaceVariant,
                fontFamily: fonts.display,
                fontSize: 36,
              }}
            >
              {homeGoals}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.headline, fontSize: 24, opacity: 0.3 }}>
              :
            </Text>
            <Text
              style={{
                color: !homeWinning && awayGoals > homeGoals ? colors.onSurface : colors.onSurfaceVariant,
                fontFamily: fonts.display,
                fontSize: 36,
              }}
            >
              {awayGoals}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 8, width: '33%' }}>
          <TeamCrest uri={fixture.teams.away.logo} size={56} glow={awayGoals > homeGoals} />
          <Text
            numberOfLines={1}
            style={{
              color: colors.onSurface,
              fontFamily: fonts.headlineMd,
              fontSize: 14,
              textAlign: 'center',
              opacity: awayGoals > homeGoals ? 1 : 0.7,
            }}
          >
            {fixture.teams.away.name}
          </Text>
        </View>
      </View>

      {live && (
        <View style={{ marginTop: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontFamily: fonts.label,
                fontSize: 11,
                letterSpacing: 1,
              }}
            >
              MATCH MOMENTUM
            </Text>
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 11 }}>
              {swingLabel}
            </Text>
          </View>
          <MomentumBars values={momentumValues} height={64} />
        </View>
      )}
    </GlassCard>
  );
};
