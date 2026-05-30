/**
 * Premium Bet365 / Sofascore-style live match tracker.
 *
 * Renders a perspective (pseudo-3D) stadium pitch with:
 *  - real player markers placed from SportMonks lineups + formations
 *    (home / away team colours, smooth live repositioning)
 *  - a ball driven by REAL SportMonks ballCoordinates (interpolated, never
 *    teleports) — falling back to event/possession simulation when absent
 *  - attack-zone glow (attack / dangerous / shot / goal) + a subtle camera
 *    zoom toward the active third
 *  - event ripple flashes, possession banner and live minute
 *
 * Built on SVG + Animated (works on web AND native, stays lightweight and
 * 60fps) rather than WebGL/Three so it runs everywhere the app does.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Rect, Circle, Ellipse, Line, Path, Polygon, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import type { Fixture, FixtureEvent } from '@/types/match';
import { isLive } from '@/types/match';
import { useBallPlayback, type AttackZone } from '@/hooks/useBallPlayback';
import type { LiveTrackerData } from '@/services/api/smTracker';
import { type ActionType } from '@/hooks/useMatchSimulation';

interface LivePitchProps {
  fixture: Fixture;
  events: FixtureEvent[];
  homePossession: number;
  awayPossession: number;
  tracker?: LiveTrackerData | null;
}

const ACTION_COLORS: Record<ActionType, string> = {
  goal: '#22c55e', shot: '#FF9500', corner: '#3b82f6', foul: '#eab308', throwin: '#a78bfa',
  sub: '#14b8a6', card: '#ef4444', pass: '#cbd5e1', kickoff: '#ffffff', idle: '#cbd5e1',
};
const ACTION_LABEL: Record<ActionType, string> = {
  goal: 'GOAL', shot: 'SHOT', corner: 'CORNER', foul: 'FOUL', throwin: 'THROW-IN',
  sub: 'SUBSTITUTION', card: 'CARD', pass: 'IN PLAY', kickoff: 'KICK-OFF', idle: 'IN PLAY',
};
const ZONE_LABEL: Record<AttackZone, string> = {
  none: '', attack: 'ATTACK', dangerous: 'DANGEROUS ATTACK', shot: 'SHOT', goal: 'GOAL!',
};

const VB_W = 100;
const VB_H = 64;
const PITCH = { topY: 20, botY: 60, topLeftX: 26, topRightX: 74, botLeftX: 4, botRightX: 96 };

const project = (fx: number, fy: number): { x: number; y: number } => {
  const y = PITCH.topY + (PITCH.botY - PITCH.topY) * fy;
  const leftX = PITCH.topLeftX + (PITCH.botLeftX - PITCH.topLeftX) * fy;
  const rightX = PITCH.topRightX + (PITCH.botRightX - PITCH.topRightX) * fy;
  return { x: leftX + (rightX - leftX) * fx, y };
};
const corners = { tl: project(0, 0), tr: project(1, 0), br: project(1, 1), bl: project(0, 1) };
const polyStr = (pts: Array<{ x: number; y: number }>) => pts.map((p) => `${p.x},${p.y}`).join(' ');
const ASPECT = VB_H / VB_W;

const HOME_COLOR = '#3b82f6';
const AWAY_COLOR = '#ef4444';

export const LivePitch: React.FC<LivePitchProps> = ({ fixture, events, homePossession, awayPossession, tracker }) => {
  const colors = useColors();
  const t = useT();
  const [width, setWidth] = useState(0);
  const height = width * ASPECT;
  const scale = width > 0 ? width / VB_W : 0;
  const live = isLive(fixture.fixture.status.short);

  const ballPoints = tracker?.ball ?? [];
  const players = tracker?.players ?? [];

  const { ball, pulse, possession, action, zone, zoneSide, waiting, usingReal } = useBallPlayback(
    fixture,
    events,
    ballPoints,
    homePossession,
    awayPossession,
  );

  // Gentle ball bob.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Project sim ball (0-100 length x, 0-100 width y) → screen px.
  const leftAtDepth = ball.y.interpolate({ inputRange: [0, 100], outputRange: [PITCH.topLeftX, PITCH.botLeftX] });
  const spanAtDepth = ball.y.interpolate({
    inputRange: [0, 100],
    outputRange: [PITCH.topRightX - PITCH.topLeftX, PITCH.botRightX - PITCH.botLeftX],
  });
  const projX = Animated.add(leftAtDepth, Animated.multiply(ball.x.interpolate({ inputRange: [0, 100], outputRange: [0, 1] }), spanAtDepth));
  const projY = ball.y.interpolate({ inputRange: [0, 100], outputRange: [PITCH.topY, PITCH.botY] });
  const ballLeft = Animated.multiply(projX, scale);
  const ballTop = Animated.multiply(projY, scale);
  const depthScale = ball.y.interpolate({ inputRange: [0, 100], outputRange: [0.8, 1.2] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });

  const rippleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.6] });
  const rippleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });
  const actionColor = action ? ACTION_COLORS[action.type] : colors.primaryFixed;

  const totalPoss = homePossession + awayPossession;
  const homePossPct = totalPoss > 0 ? (homePossession / totalPoss) * 100 : 50;
  const possName = possession === 'home' ? fixture.teams.home.name : possession === 'away' ? fixture.teams.away.name : null;

  const line = 'rgba(255,255,255,0.45)';

  // Pre-projected static markings.
  const leftBox = [project(0, 0.22), project(0.16, 0.22), project(0.16, 0.78), project(0, 0.78)];
  const rightBox = [project(1, 0.22), project(0.84, 0.22), project(0.84, 0.78), project(1, 0.78)];
  const leftSix = [project(0, 0.36), project(0.06, 0.36), project(0.06, 0.64), project(0, 0.64)];
  const rightSix = [project(1, 0.36), project(0.94, 0.36), project(0.94, 0.64), project(1, 0.64)];
  const halfTop = project(0.5, 0);
  const halfBot = project(0.5, 1);

  // Attack-zone glow polygon (the attacked third).
  const zoneGlow = useMemo(() => {
    if (zone === 'none' || !zoneSide) return null;
    // Home attacks toward x=1, away toward x=0.
    const near1 = zoneSide === 'home';
    const a = near1 ? 0.66 : 0.0;
    const b = near1 ? 1.0 : 0.34;
    return [project(a, 0), project(b, 0), project(b, 1), project(a, 1)];
  }, [zone, zoneSide]);
  const zoneColor = zone === 'goal' ? '#22c55e' : zone === 'shot' ? '#FF9500' : zone === 'dangerous' ? '#ef4444' : '#eab308';

  // Camera zoom toward the active third (subtle).
  const camScale = useRef(new Animated.Value(1)).current;
  const camTransX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const intense = zone === 'shot' || zone === 'goal' || zone === 'dangerous';
    const targetScale = zone === 'goal' ? 1.14 : zone === 'shot' ? 1.1 : zone === 'dangerous' ? 1.06 : 1;
    const dir = zoneSide === 'home' ? -1 : zoneSide === 'away' ? 1 : 0;
    Animated.parallel([
      Animated.timing(camScale, { toValue: targetScale, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(camTransX, { toValue: intense ? dir * 8 : 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [zone, zoneSide, camScale, camTransX]);

  return (
    <GlassCard padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? '#FF9500' : colors.onSurfaceVariant }} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 }}>
            {t('tracker.title')}
          </Text>
          {usingReal && (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ color: '#4ade80', fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>{t('tracker.realData')}</Text>
            </View>
          )}
        </View>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: '#4ade80', fontFamily: fonts.stats, fontSize: 13 }}>
            {live ? (fixture.fixture.status.elapsed != null ? `${fixture.fixture.status.elapsed}'` : 'LIVE') : 'FT'}
          </Text>
        </View>
      </View>

      {/* Stadium + pitch */}
      <View onLayout={onLayout} style={{ width: '100%', aspectRatio: VB_W / VB_H }}>
        {width > 0 && (
          <>
            <Animated.View style={{ transform: [{ scale: camScale }, { translateX: camTransX }] }}>
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
                  <RadialGradient id="spot" cx="0.5" cy="0.3" r="0.75">
                    <Stop offset="0" stopColor="#37945f" stopOpacity="0.55" />
                    <Stop offset="1" stopColor="#0f3b25" stopOpacity="0" />
                  </RadialGradient>
                </Defs>

                {/* Stadium backdrop */}
                <Rect x="0" y="0" width={VB_W} height={PITCH.topY + 6} fill="url(#sky)" />
                {Array.from({ length: 90 }).map((_, i) => {
                  const cx = (i * 13.7) % 100;
                  const cy = 3 + ((i * 7.3) % 14);
                  const tint = i % 3 === 0 ? '#3a3550' : i % 3 === 1 ? '#4a2f4a' : '#2c3550';
                  return <Circle key={`c${i}`} cx={cx} cy={cy} r={0.5} fill={tint} opacity={0.7} />;
                })}
                {/* Sponsor boards */}
                <Polygon points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${PITCH.topRightX + 3},${PITCH.topY - 3} ${PITCH.topLeftX - 3},${PITCH.topY - 3}`} fill="#0c2a1b" />
                {Array.from({ length: 9 }).map((_, i) => {
                  const t0 = i / 9, t1 = (i + 0.6) / 9;
                  const xa = PITCH.topLeftX - 3 + (PITCH.topRightX + 3 - (PITCH.topLeftX - 3)) * t0;
                  const xb = PITCH.topLeftX - 3 + (PITCH.topRightX + 3 - (PITCH.topLeftX - 3)) * t1;
                  return <Polygon key={`b${i}`} points={`${xa},${PITCH.topY - 3} ${xb},${PITCH.topY - 3} ${xb},${PITCH.topY - 0.6} ${xa},${PITCH.topY - 0.6}`} fill={i % 2 === 0 ? '#0f5132' : '#0b3a24'} />;
                })}

                {/* Pitch */}
                <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} fill="url(#grass3d)" />
                <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} fill="url(#spot)" />
                {/* Mowing stripes */}
                {Array.from({ length: 8 }).map((_, i) => {
                  if (i % 2 !== 0) return null;
                  return <Polygon key={`s${i}`} points={polyStr([project(i / 8, 0), project((i + 1) / 8, 0), project((i + 1) / 8, 1), project(i / 8, 1)])} fill="rgba(255,255,255,0.035)" />;
                })}

                {/* Attack-zone glow */}
                {zoneGlow && (
                  <Polygon points={polyStr(zoneGlow)} fill={zoneColor} opacity={zone === 'goal' ? 0.28 : zone === 'shot' ? 0.22 : 0.15} />
                )}

                {/* Markings */}
                <Polygon points={polyStr([corners.tl, corners.tr, corners.br, corners.bl])} stroke={line} strokeWidth="0.4" fill="none" />
                <Line x1={halfTop.x} y1={halfTop.y} x2={halfBot.x} y2={halfBot.y} stroke={line} strokeWidth="0.4" />
                {(() => {
                  const c = project(0.5, 0.5);
                  const top = project(0.5, 0.32), bot = project(0.5, 0.68);
                  const rx = (project(0.62, 0.5).x - project(0.38, 0.5).x) / 2;
                  const ry = (bot.y - top.y) / 2;
                  return <Path d={`M ${c.x - rx} ${c.y} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`} stroke={line} strokeWidth="0.4" fill="none" />;
                })()}
                <Polygon points={polyStr(leftBox)} stroke={line} strokeWidth="0.4" fill="none" />
                <Polygon points={polyStr(rightBox)} stroke={line} strokeWidth="0.4" fill="none" />
                <Polygon points={polyStr(leftSix)} stroke={line} strokeWidth="0.35" fill="none" />
                <Polygon points={polyStr(rightSix)} stroke={line} strokeWidth="0.35" fill="none" />

                {/* Real player markers */}
                {players.map((p) => {
                  const pos = project(p.fx, p.fy);
                  const col = p.side === 'home' ? HOME_COLOR : AWAY_COLOR;
                  const r = 1.5 - p.fy * 0.3; // slightly smaller far away
                  return (
                    <React.Fragment key={`${p.side}-${p.id}`}>
                      <Ellipse cx={pos.x} cy={pos.y + 0.6} rx={r} ry={r * 0.6} fill="rgba(0,0,0,0.3)" />
                      <Circle cx={pos.x} cy={pos.y} r={r} fill={col} stroke="#0d1f14" strokeWidth="0.25" />
                    </React.Fragment>
                  );
                })}
              </Svg>
            </Animated.View>

            {/* Ripple flash */}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, left: ballLeft as any, top: ballTop as any, borderRadius: 11, backgroundColor: actionColor, opacity: rippleOpacity as any, transform: [{ scale: rippleScale as any }] }} />

            {/* Ball */}
            {!waiting && (
              <>
                <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 9, height: 4, marginLeft: -4.5, marginTop: -1, left: ballLeft as any, top: ballTop as any, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)', transform: [{ scaleX: depthScale as any }] }} />
                <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5, left: ballLeft as any, top: ballTop as any, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 1.2, borderColor: '#0d1f14', transform: [{ scale: depthScale as any }, { translateY: bobY as any }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 5 }} />
              </>
            )}

            {/* Zone banner */}
            {zone !== 'none' && !waiting && (
              <View style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' }}>
                <View style={{ backgroundColor: `${zoneColor}E6`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ color: '#0b0b0b', fontFamily: fonts.label, fontSize: 9, letterSpacing: 1 }}>{ZONE_LABEL[zone]}</Text>
                </View>
              </View>
            )}

            {/* Waiting */}
            {waiting && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#ffffff', fontFamily: fonts.label, fontSize: 12, letterSpacing: 0.5, opacity: 0.9 }}>{t('tracker.waiting')}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Possession banner */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: 'rgba(0,0,0,0.25)' }}>
        {possName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: possession === 'home' ? HOME_COLOR : AWAY_COLOR }} />
            <View>
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>{possName}</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 12 }}>
                {action ? ACTION_LABEL[action.type] : t('tracker.possession')}{action?.minute != null ? ` · ${action.minute}'` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.body, fontSize: 13 }}>
            {waiting ? t('tracker.waiting') : t('tracker.possession')}
          </Text>
        )}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: HOME_COLOR, fontFamily: fonts.stats, fontSize: 10 }}>{Math.round(homePossPct)}%</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>{t('tracker.possession')}</Text>
            <Text style={{ color: AWAY_COLOR, fontFamily: fonts.stats, fontSize: 10 }}>{Math.round(100 - homePossPct)}%</Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ width: `${homePossPct}%`, backgroundColor: HOME_COLOR }} />
            <View style={{ flex: 1, backgroundColor: AWAY_COLOR }} />
          </View>
        </View>
      </View>
    </GlassCard>
  );
};
