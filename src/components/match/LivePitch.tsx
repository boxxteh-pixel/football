/**
 * Bet365-style 2D live match tracker.
 *
 * Renders a dark-theme SVG football pitch with an animated ball whose position
 * is driven by useMatchSimulation (real live events + possession → smooth
 * tweened movement). Discrete events flash a coloured ripple at the ball and
 * surface an action label. Shows a possession indicator per team and the live
 * score/minute. When there is no usable live data it shows an empty pitch with
 * an "In attesa dati" (waiting) state.
 *
 * Responsive: the pitch scales to container width keeping a 5:3 aspect ratio.
 */
import React, { useState } from 'react';
import { Animated, LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import type { Fixture, FixtureEvent } from '@/types/match';
import { isLive } from '@/types/match';
import { useMatchSimulation, type ActionType } from '@/hooks/useMatchSimulation';

interface LivePitchProps {
  fixture: Fixture;
  events: FixtureEvent[];
  homePossession: number;
  awayPossession: number;
}

const ACTION_COLORS: Record<ActionType, string> = {
  goal: '#22c55e',
  shot: '#FF9500',
  corner: '#3b82f6',
  foul: '#eab308',
  throwin: '#a78bfa',
  sub: '#14b8a6',
  card: '#ef4444',
  pass: '#94a3b8',
  kickoff: '#ffffff',
  idle: '#94a3b8',
};

const ACTION_LABEL: Record<ActionType, string> = {
  goal: 'GOAL',
  shot: 'SHOT',
  corner: 'CORNER',
  foul: 'FOUL',
  throwin: 'THROW-IN',
  sub: 'SUBSTITUTION',
  card: 'CARD',
  pass: 'IN PLAY',
  kickoff: 'KICK-OFF',
  idle: 'IN PLAY',
};

const ASPECT = 0.62; // height / width

export const LivePitch: React.FC<LivePitchProps> = ({ fixture, events, homePossession, awayPossession }) => {
  const colors = useColors();
  const t = useT();
  const [width, setWidth] = useState(0);
  const height = width * ASPECT;

  const live = isLive(fixture.fixture.status.short);
  const { ball, pulse, possession, action, waiting } = useMatchSimulation(
    fixture,
    events,
    homePossession,
    awayPossession,
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Map 0-100 sim coords → pixel positions for the absolutely-placed ball.
  const ballLeft = ball.x.interpolate({ inputRange: [0, 100], outputRange: [0, width || 1] });
  const ballTop = ball.y.interpolate({ inputRange: [0, 100], outputRange: [0, height || 1] });
  const rippleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.2] });
  const rippleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const actionColor = action ? ACTION_COLORS[action.type] : colors.primaryFixed;

  const totalPoss = homePossession + awayPossession;
  const homePossPct = totalPoss > 0 ? (homePossession / totalPoss) * 100 : 50;

  // Pitch line colour (subtle on dark).
  const lineCol = 'rgba(255,255,255,0.18)';
  const grassDark = '#0d1f14';
  const grassMid = '#103021';

  return (
    <GlassCard padding={14} style={{ gap: 12 }}>
      {/* Header: title + live status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? '#FF9500' : colors.onSurfaceVariant }} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 }}>
            {t('tracker.title')}
          </Text>
        </View>
        {live && (
          <Text style={{ color: '#FF9500', fontFamily: fonts.stats, fontSize: 12 }}>
            {fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : 'LIVE'}
          </Text>
        )}
      </View>

      {/* Score row with possession-highlighted team names */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TeamName name={fixture.teams.home.name} active={possession === 'home'} align="left" />
        <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, paddingHorizontal: 10 }}>
          {fixture.goals.home ?? 0} - {fixture.goals.away ?? 0}
        </Text>
        <TeamName name={fixture.teams.away.name} active={possession === 'away'} align="right" />
      </View>

      {/* The pitch */}
      <View onLayout={onLayout} style={{ width: '100%', aspectRatio: 1 / ASPECT, borderRadius: 12, overflow: 'hidden' }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height} viewBox="0 0 100 62">
              <Defs>
                <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={grassMid} />
                  <Stop offset="1" stopColor={grassDark} />
                </LinearGradient>
              </Defs>
              {/* Grass + mowing stripes */}
              <Rect x="0" y="0" width="100" height="62" fill="url(#grass)" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Rect
                  key={i}
                  x={(i * 100) / 6}
                  y="0"
                  width={100 / 6}
                  height="62"
                  fill={i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent'}
                />
              ))}
              {/* Outer boundary */}
              <Rect x="3" y="3" width="94" height="56" stroke={lineCol} strokeWidth="0.4" fill="none" rx="1" />
              {/* Halfway line + centre circle */}
              <Line x1="50" y1="3" x2="50" y2="59" stroke={lineCol} strokeWidth="0.4" />
              <Circle cx="50" cy="31" r="8" stroke={lineCol} strokeWidth="0.4" fill="none" />
              <Circle cx="50" cy="31" r="0.8" fill={lineCol} />
              {/* Left penalty area */}
              <Rect x="3" y="17" width="14" height="28" stroke={lineCol} strokeWidth="0.4" fill="none" />
              <Rect x="3" y="24" width="5" height="14" stroke={lineCol} strokeWidth="0.4" fill="none" />
              <Circle cx="11" cy="31" r="0.7" fill={lineCol} />
              {/* Right penalty area */}
              <Rect x="83" y="17" width="14" height="28" stroke={lineCol} strokeWidth="0.4" fill="none" />
              <Rect x="89" y="24" width="5" height="14" stroke={lineCol} strokeWidth="0.4" fill="none" />
              <Circle cx="89" cy="31" r="0.7" fill={lineCol} />
              {/* Goals */}
              <Rect x="1.6" y="27" width="1.4" height="8" stroke={lineCol} strokeWidth="0.3" fill="rgba(255,255,255,0.04)" />
              <Rect x="97" y="27" width="1.4" height="8" stroke={lineCol} strokeWidth="0.3" fill="rgba(255,255,255,0.04)" />
            </Svg>

            {/* Ripple flash on actions */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 24,
                height: 24,
                marginLeft: -12,
                marginTop: -12,
                left: ballLeft as any,
                top: ballTop as any,
                borderRadius: 12,
                backgroundColor: actionColor,
                opacity: rippleOpacity as any,
                transform: [{ scale: rippleScale as any }],
              }}
            />

            {/* The ball */}
            {!waiting && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  marginTop: -6,
                  left: ballLeft as any,
                  top: ballTop as any,
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                  borderWidth: 1.5,
                  borderColor: '#0d1f14',
                  shadowColor: '#000',
                  shadowOpacity: 0.5,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 4,
                }}
              />
            )}

            {/* Waiting state overlay */}
            {waiting && (
              <View
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[0, 1, 2].map((i) => (
                    <WaitingDot key={i} pulse={pulse} index={i} />
                  ))}
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.5 }}>
                  {t('tracker.waiting')}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Action label + possession bar */}
      {!waiting && (
        <View style={{ gap: 10 }}>
          {action && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: actionColor }} />
              <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.5 }}>
                {ACTION_LABEL[action.type]}
                {action.minute != null ? ` · ${action.minute}'` : ''}
                {action.team ? ` · ${action.team === 'home' ? fixture.teams.home.name : fixture.teams.away.name}` : ''}
              </Text>
            </View>
          )}
          {/* Possession bar */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 10 }}>
                {Math.round(homePossPct)}%
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>
                {t('tracker.possession')}
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 10 }}>
                {Math.round(100 - homePossPct)}%
              </Text>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${homePossPct}%`, backgroundColor: colors.primaryFixed }} />
              <View style={{ flex: 1, backgroundColor: colors.secondaryFixed }} />
            </View>
          </View>
        </View>
      )}
    </GlassCard>
  );
};

const TeamName: React.FC<{ name: string; active: boolean; align: 'left' | 'right' }> = ({ name, active, align }) => {
  const colors = useColors();
  return (
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: align === 'left' ? 'flex-start' : 'flex-end', alignItems: 'center', gap: 6 }}>
      {align === 'right' && active && <Dot />}
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.onSurface : colors.onSurfaceVariant,
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: 12,
          maxWidth: '80%',
          textAlign: align,
        }}
      >
        {name}
      </Text>
      {align === 'left' && active && <Dot />}
    </View>
  );
};

const Dot: React.FC = () => <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9500' }} />;

const WaitingDot: React.FC<{ pulse: Animated.Value; index: number }> = ({ pulse }) => {
  const colors = useColors();
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onSurfaceVariant, opacity: 0.5 }} />;
};
