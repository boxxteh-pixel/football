/**
 * Bet365-style 3D live match tracker.
 *
 * Renders a perspective (pseudo-3D) football pitch with a stadium crowd
 * backdrop, sponsor boards and perspective grass stripes, plus an animated ball
 * whose position is driven by useMatchSimulation (real live events + possession
 * → smooth tweened movement). Discrete events flash a coloured ripple and a
 * possession banner shows the team in control (like the reference image).
 *
 * Field space: fx in [0,1] along the length (0 = left/home goal, 1 = right/away
 * goal), fy in [0,1] across the width (0 = far touchline, 1 = near touchline).
 * A trapezoid projection maps field → screen to create depth.
 *
 * When there is no usable live data it shows the empty pitch with an
 * "In attesa dati" (waiting) state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line, Path, Polygon, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
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
  pass: '#cbd5e1',
  kickoff: '#ffffff',
  idle: '#cbd5e1',
};

const ACTION_LABEL: Record<ActionType, string> = {
  goal: 'GOAL', shot: 'SHOT', corner: 'CORNER', foul: 'FOUL', throwin: 'THROW-IN',
  sub: 'SUBSTITUTION', card: 'CARD', pass: 'IN PLAY', kickoff: 'KICK-OFF', idle: 'IN PLAY',
};

// ViewBox dimensions (logical units).
const VB_W = 100;
const VB_H = 64;

// Perspective trapezoid corners of the pitch within the viewBox.
// Narrower at the top (far), wider at the bottom (near) — like the reference.
const PITCH = {
  topY: 20,
  botY: 60,
  topLeftX: 26,
  topRightX: 74,
  botLeftX: 4,
  botRightX: 96,
};

/**
 * Project field coords (fx along length 0..1, fy across width 0..1 where 1=near)
 * into screen x,y inside the viewBox trapezoid.
 */
const project = (fx: number, fy: number): { x: number; y: number } => {
  // depth = fy: 0 (far, top) → 1 (near, bottom)
  const y = PITCH.topY + (PITCH.botY - PITCH.topY) * fy;
  const leftX = PITCH.topLeftX + (PITCH.botLeftX - PITCH.topLeftX) * fy;
  const rightX = PITCH.topRightX + (PITCH.botRightX - PITCH.topRightX) * fy;
  const x = leftX + (rightX - leftX) * fx;
  return { x, y };
};

const corners = {
  tl: project(0, 0),
  tr: project(1, 0),
  br: project(1, 1),
  bl: project(0, 1),
};

const ASPECT = VB_H / VB_W;

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

  // Bob the ball gently for a subtle 3D feel.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const scale = width > 0 ? width / VB_W : 0;

  // sim ball.x (0..100 length), ball.y (0..100 across) → field fractions → projected screen px.
  // Map sim.y so 0=far(top),100=near(bottom): use full range.
  const projX = Animated.add(
    // left edge at this depth
    ball.y.interpolate({
      inputRange: [0, 100],
      outputRange: [PITCH.topLeftX, PITCH.botLeftX],
    }),
    Animated.multiply(
      ball.x.interpolate({ inputRange: [0, 100], outputRange: [0, 1] }),
      ball.y.interpolate({
        inputRange: [0, 100],
        outputRange: [PITCH.topRightX - PITCH.topLeftX, PITCH.botRightX - PITCH.botLeftX],
      }),
    ),
  );
  const projY = ball.y.interpolate({ inputRange: [0, 100], outputRange: [PITCH.topY, PITCH.botY] });

  const ballLeft = Animated.multiply(projX, scale);
  const ballTop = Animated.multiply(projY, scale);
  // Ball gets a touch smaller far away (near top).
  const depthScale = ball.y.interpolate({ inputRange: [0, 100], outputRange: [0.78, 1.18] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  const rippleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.4] });
  const rippleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });
  const actionColor = action ? ACTION_COLORS[action.type] : colors.primaryFixed;

  const totalPoss = homePossession + awayPossession;
  const homePossPct = totalPoss > 0 ? (homePossession / totalPoss) * 100 : 50;

  const line = 'rgba(255,255,255,0.45)';
  const possName = possession === 'home' ? fixture.teams.home.name : possession === 'away' ? fixture.teams.away.name : null;

  // Penalty box (left & right) projected polygons.
  const leftBox = [project(0, 0.22), project(0.16, 0.22), project(0.16, 0.78), project(0, 0.78)];
  const rightBox = [project(1, 0.22), project(0.84, 0.22), project(0.84, 0.78), project(1, 0.78)];
  const leftSix = [project(0, 0.36), project(0.06, 0.36), project(0.06, 0.64), project(0, 0.64)];
  const rightSix = [project(1, 0.36), project(0.94, 0.36), project(0.94, 0.64), project(1, 0.64)];
  const halfTop = project(0.5, 0);
  const halfBot = project(0.5, 1);
  const polyStr = (pts: Array<{ x: number; y: number }>) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <GlassCard padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? '#FF9500' : colors.onSurfaceVariant }} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 }}>
            {t('tracker.title')}
          </Text>
        </View>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: '#4ade80', fontFamily: fonts.stats, fontSize: 13 }}>
            {live ? (fixture.fixture.status.elapsed != null ? `${fixture.fixture.status.elapsed}'` : 'LIVE') : 'FT'}
          </Text>
        </View>
      </View>

      {/* The 3D stadium + pitch */}
      <View onLayout={onLayout} style={{ width: '100%', aspectRatio: VB_W / VB_H }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <Defs>
                <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#1a1430" />
                  <Stop offset="1" stopColor="#0e0a1c" />
                </LinearGradient>
                <LinearGradient id="grass3d" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0f3b25" />
                  <Stop offset="1" stopColor="#1c5436" />
                </LinearGradient>
                <RadialGradient id="spot" cx="0.5" cy="0.35" r="0.7">
                  <Stop offset="0" stopColor="#2e7d52" stopOpacity="0.55" />
                  <Stop offset="1" stopColor="#0f3b25" stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Stadium backdrop */}
              <Rect x="0" y="0" width={VB_W} height={PITCH.topY + 6} fill="url(#sky)" />
              {/* Crowd speckle (two tiers) */}
              {Array.from({ length: 90 }).map((_, i) => {
                const cx = (i * 13.7) % 100;
                const cy = 3 + ((i * 7.3) % 14);
                const tint = i % 3 === 0 ? '#3a3550' : i % 3 === 1 ? '#4a2f4a' : '#2c3550';
                return <Circle key={`c${i}`} cx={cx} cy={cy} r={0.5} fill={tint} opacity={0.7} />;
              })}
              {/* Sponsor boards (perspective strip just above pitch) */}
              <Polygon points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${PITCH.topRightX + 3},${PITCH.topY - 3} ${PITCH.topLeftX - 3},${PITCH.topY - 3}`} fill="#0c2a1b" />
              {Array.from({ length: 9 }).map((_, i) => {
                const t0 = i / 9;
                const t1 = (i + 0.6) / 9;
                const xa = PITCH.topLeftX - 3 + (PITCH.topRightX + 3 - (PITCH.topLeftX - 3)) * t0;
                const xb = PITCH.topLeftX - 3 + (PITCH.topRightX + 3 - (PITCH.topLeftX - 3)) * t1;
                return (
                  <Polygon
                    key={`b${i}`}
                    points={`${xa},${PITCH.topY - 3} ${xb},${PITCH.topY - 3} ${xb},${PITCH.topY - 0.6} ${xa},${PITCH.topY - 0.6}`}
                    fill={i % 2 === 0 ? '#0f5132' : '#0b3a24'}
                  />
                );
              })}

              {/* Pitch base */}
              <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} fill="url(#grass3d)" />
              {/* Spotlight sheen */}
              <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} fill="url(#spot)" />

              {/* Mowing stripes (vertical bands along the length) */}
              {Array.from({ length: 8 }).map((_, i) => {
                if (i % 2 !== 0) return null;
                const a = project(i / 8, 0);
                const b = project((i + 1) / 8, 0);
                const c = project((i + 1) / 8, 1);
                const d = project(i / 8, 1);
                return <Polygon key={`s${i}`} points={polyStr([a, b, c, d])} fill="rgba(255,255,255,0.035)" />;
              })}

              {/* Outline */}
              <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} stroke={line} strokeWidth="0.4" fill="none" />
              {/* Halfway line */}
              <Line x1={halfTop.x} y1={halfTop.y} x2={halfBot.x} y2={halfBot.y} stroke={line} strokeWidth="0.4" />
              {/* Centre circle (ellipse approximation in perspective) */}
              {(() => {
                const c = project(0.5, 0.5);
                const top = project(0.5, 0.32);
                const bot = project(0.5, 0.68);
                const rx = (project(0.62, 0.5).x - project(0.38, 0.5).x) / 2;
                const ry = (bot.y - top.y) / 2;
                return <Path d={`M ${c.x - rx} ${c.y} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`} stroke={line} strokeWidth="0.4" fill="none" />;
              })()}
              {/* Penalty boxes */}
              <Polygon points={polyStr(leftBox)} stroke={line} strokeWidth="0.4" fill="none" />
              <Polygon points={polyStr(rightBox)} stroke={line} strokeWidth="0.4" fill="none" />
              <Polygon points={polyStr(leftSix)} stroke={line} strokeWidth="0.35" fill="none" />
              <Polygon points={polyStr(rightSix)} stroke={line} strokeWidth="0.35" fill="none" />
              {/* Goals */}
              {(() => {
                const gTop = project(0, 0.43);
                const gBot = project(0, 0.57);
                const gTop2 = project(1, 0.43);
                const gBot2 = project(1, 0.57);
                return (
                  <>
                    <Polygon points={`${gTop.x},${gTop.y} ${gTop.x - 2.5},${gTop.y - 1.5} ${gBot.x - 2.5},${gBot.y - 1.5} ${gBot.x},${gBot.y}`} fill="rgba(255,255,255,0.18)" stroke={line} strokeWidth="0.3" />
                    <Polygon points={`${gTop2.x},${gTop2.y} ${gTop2.x + 2.5},${gTop2.y - 1.5} ${gBot2.x + 2.5},${gBot2.y - 1.5} ${gBot2.x},${gBot2.y}`} fill="rgba(255,255,255,0.18)" stroke={line} strokeWidth="0.3" />
                  </>
                );
              })()}
            </Svg>

            {/* Ripple flash */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11,
                left: ballLeft as any, top: ballTop as any, borderRadius: 11,
                backgroundColor: actionColor, opacity: rippleOpacity as any,
                transform: [{ scale: rippleScale as any }],
              }}
            />

            {/* Ball with shadow */}
            {!waiting && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute', width: 10, height: 4, marginLeft: -5, marginTop: -1,
                    left: ballLeft as any, top: ballTop as any, borderRadius: 5,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    transform: [{ scaleX: depthScale as any }],
                  }}
                />
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute', width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5,
                    left: ballLeft as any, top: ballTop as any, borderRadius: 6,
                    backgroundColor: '#ffffff', borderWidth: 1.2, borderColor: '#0d1f14',
                    transform: [{ scale: depthScale as any }, { translateY: bobY as any }],
                    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
                    elevation: 5,
                  }}
                />
              </>
            )}

            {/* Waiting overlay */}
            {waiting && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={{ color: '#ffffff', fontFamily: fonts.label, fontSize: 12, letterSpacing: 0.5, opacity: 0.9 }}>
                  {t('tracker.waiting')}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Possession banner (like the reference image) */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: 'rgba(0,0,0,0.25)' }}>
        {possName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: actionColor }} />
            <View>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
                {possName}
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
                {action ? ACTION_LABEL[action.type] : t('tracker.possession')}
                {action?.minute != null ? ` · ${action.minute}'` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {waiting ? t('tracker.waiting') : t('tracker.possession')}
          </Text>
        )}

        {/* Possession bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.primaryFixed, fontFamily: fonts.stats, fontSize: 10 }}>{Math.round(homePossPct)}%</Text>
            <Text style={{ color: colors.secondaryFixed, fontFamily: fonts.stats, fontSize: 10 }}>{Math.round(100 - homePossPct)}%</Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ width: `${homePossPct}%`, backgroundColor: colors.primaryFixed }} />
            <View style={{ flex: 1, backgroundColor: colors.secondaryFixed }} />
          </View>
        </View>
      </View>
    </GlassCard>
  );
};
