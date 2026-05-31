/**
 * Live match tracker — clean top-down 2D pitch (Sofascore-style).
 *
 * Design goals: be INSTANTLY readable. A clean horizontal green pitch, big
 * player dots with real face photos and a team-coloured ring, and a white ball
 * that glides between REAL SportMonks ball coordinates (interpolated, never
 * teleports). The team attacking is glowed, the player on the ball is ringed,
 * and a simple banner tells you exactly what's happening in words.
 *
 * Player avatars and the ball are real React Native <Image>/<View> layers on
 * top of an SVG pitch, so the photos render reliably on web and native.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { GlassCard } from '@/components/ui/GlassCard';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { useT } from '@/theme/i18n';
import { USE_NATIVE_DRIVER } from '@/utils/anim';
import type { Fixture, FixtureEvent } from '@/types/match';
import { isLive } from '@/types/match';
import { useBallPlayback, type AttackZone } from '@/hooks/useBallPlayback';
import type { LiveTrackerData, TrackerPlayer } from '@/services/api/smTracker';
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

// Pitch padding inside the card (in % of the pitch box).
const PADX = 4; // % left/right
const PADY = 7; // % top/bottom
const ASPECT = 0.64; // height / width of the pitch box

const HOME_COLOR = '#2f81f7';
const AWAY_COLOR = '#f7536a';

export const LivePitch: React.FC<LivePitchProps> = ({ fixture, events, homePossession, awayPossession, tracker }) => {
  const colors = useColors();
  const t = useT();
  const [width, setWidth] = useState(0);
  const height = width * ASPECT;
  const live = isLive(fixture.fixture.status.short);

  const ballPoints = tracker?.ball ?? [];
  const players = tracker?.players ?? [];

  const { ball, pulse, possession, action, zone, zoneSide, latest, waiting, usingReal } = useBallPlayback(
    fixture,
    events,
    ballPoints,
    homePossession,
    awayPossession,
  );

  const trackerPoss = tracker?.possessionHome;
  const passedTotal = homePossession + awayPossession;
  const homePossPct = trackerPoss != null ? trackerPoss : passedTotal > 0 ? (homePossession / passedTotal) * 100 : 50;

  // Player on the ball = nearest player to the real ball coordinate.
  const ballCarrier = useMemo<TrackerPlayer | null>(() => {
    if (!latest || players.length === 0) return null;
    let best: TrackerPlayer | null = null;
    let bestD = Infinity;
    for (const p of players) {
      const d = (p.fx - latest.x) ** 2 + (p.fy - latest.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return bestD < 0.025 ? best : null;
  }, [latest, players]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Map field fraction (0-1) → pixel inside the padded pitch box.
  const fxToPx = (fx: number) => ((PADX + fx * (100 - 2 * PADX)) / 100) * width;
  const fyToPx = (fy: number) => ((PADY + fy * (100 - 2 * PADY)) / 100) * height;

  // Ball pixel position (sim space is 0-100; /100 → fraction).
  const ballLeft = ball.x.interpolate({ inputRange: [0, 100], outputRange: [fxToPx(0), fxToPx(1)] });
  const ballTop = ball.y.interpolate({ inputRange: [0, 100], outputRange: [fyToPx(0), fyToPx(1)] });

  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(bob, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const bobScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  const rippleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.4] });
  const rippleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });
  const actionColor = action ? ACTION_COLORS[action.type] : colors.primaryFixed;

  // Plain-language status line.
  const statusLine = useMemo(() => {
    if (waiting) return t('tracker.waiting');
    if (zone === 'goal') return t('tracker.zoneGoal');
    if (zone === 'shot') return t('tracker.zoneShot');
    if (zone === 'dangerous') return t('tracker.zoneDanger');
    if (zone === 'attack') return t('tracker.zoneAttack');
    return t('tracker.inPlay');
  }, [zone, waiting, t]);

  const playerR = Math.max(9, width * 0.032); // avatar radius in px

  return (
    <GlassCard padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {/* Header: teams + score + minute */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: HOME_COLOR }} />
          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 12 }} numberOfLines={1}>{fixture.teams.home.name}</Text>
        </View>
        <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.display, fontSize: 20 }}>
            {fixture.goals.home ?? 0} - {fixture.goals.away ?? 0}
          </Text>
          <Text style={{ color: live ? '#FF9500' : colors.onSurfaceVariant, fontFamily: fonts.stats, fontSize: 11 }}>
            {live ? (fixture.fixture.status.elapsed != null ? `${fixture.fixture.status.elapsed}'` : 'LIVE') : 'FT'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 12 }} numberOfLines={1}>{fixture.teams.away.name}</Text>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: AWAY_COLOR }} />
        </View>
      </View>

      {/* Pitch */}
      <View onLayout={onLayout} style={{ width: '100%', aspectRatio: 1 / ASPECT, position: 'relative' }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <Defs>
                <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#177a45" />
                  <Stop offset="1" stopColor="#0f5c33" />
                </LinearGradient>
              </Defs>
              {/* Grass */}
              <Rect x="0" y="0" width={width} height={height} fill="url(#grass)" />
              {/* Mowing stripes (vertical) */}
              {Array.from({ length: 10 }).map((_, i) => (
                <Rect key={i} x={(i * width) / 10} y={0} width={width / 10} height={height} fill={i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'} />
              ))}
              {(() => {
                const x0 = fxToPx(0), x1 = fxToPx(1), y0 = fyToPx(0), y1 = fyToPx(1);
                const w = x1 - x0, h = y1 - y0, cy = (y0 + y1) / 2;
                const lw = Math.max(1, width * 0.004);
                const L = 'rgba(255,255,255,0.55)';
                const boxH = h * 0.55, boxY = cy - boxH / 2, boxW = w * 0.16;
                const sixH = h * 0.3, sixY = cy - sixH / 2, sixW = w * 0.06;
                return (
                  <>
                    {/* Attack glow */}
                    {zone !== 'none' && zoneSide && (
                      <Rect
                        x={zoneSide === 'home' ? x0 + w * 0.6 : x0}
                        y={y0}
                        width={w * 0.4}
                        height={h}
                        fill={zone === 'goal' ? '#22c55e' : zone === 'shot' ? '#FF9500' : zone === 'dangerous' ? '#ef4444' : '#eab308'}
                        opacity={zone === 'goal' ? 0.25 : zone === 'shot' ? 0.18 : 0.12}
                      />
                    )}
                    {/* Outer box */}
                    <Rect x={x0} y={y0} width={w} height={h} fill="none" stroke={L} strokeWidth={lw} rx={2} />
                    {/* Halfway line + circle */}
                    <Line x1={(x0 + x1) / 2} y1={y0} x2={(x0 + x1) / 2} y2={y1} stroke={L} strokeWidth={lw} />
                    <Circle cx={(x0 + x1) / 2} cy={cy} r={h * 0.16} fill="none" stroke={L} strokeWidth={lw} />
                    <Circle cx={(x0 + x1) / 2} cy={cy} r={lw * 1.2} fill={L} />
                    {/* Penalty boxes */}
                    <Rect x={x0} y={boxY} width={boxW} height={boxH} fill="none" stroke={L} strokeWidth={lw} />
                    <Rect x={x1 - boxW} y={boxY} width={boxW} height={boxH} fill="none" stroke={L} strokeWidth={lw} />
                    <Rect x={x0} y={sixY} width={sixW} height={sixH} fill="none" stroke={L} strokeWidth={lw} />
                    <Rect x={x1 - sixW} y={sixY} width={sixW} height={sixH} fill="none" stroke={L} strokeWidth={lw} />
                    {/* Goals */}
                    <Rect x={x0 - lw * 2} y={cy - h * 0.08} width={lw * 2} height={h * 0.16} fill="rgba(255,255,255,0.3)" />
                    <Rect x={x1} y={cy - h * 0.08} width={lw * 2} height={h * 0.16} fill="rgba(255,255,255,0.3)" />
                  </>
                );
              })()}
            </Svg>

            {/* Player avatars (real photos) */}
            {players.map((p) => {
              const left = fxToPx(p.fx);
              const top = fyToPx(p.fy);
              const col = p.side === 'home' ? HOME_COLOR : AWAY_COLOR;
              const isCarrier = ballCarrier?.id === p.id;
              const size = playerR * 2;
              return (
                <View
                  key={`${p.side}-${p.id}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: left - playerR,
                    top: top - playerR,
                    width: size,
                    height: size,
                    borderRadius: playerR,
                    backgroundColor: col,
                    borderWidth: isCarrier ? 2.5 : 1.5,
                    borderColor: isCarrier ? '#ffffff' : col,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.4,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: isCarrier ? 6 : 3,
                  }}
                >
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={{ width: size, height: size }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: '#fff', fontFamily: fonts.stats, fontSize: playerR * 0.9 }}>{p.jersey || ''}</Text>
                  )}
                </View>
              );
            })}

            {/* Ripple flash */}
            {!waiting && (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 20, height: 20, marginLeft: -10, marginTop: -10, left: ballLeft as any, top: ballTop as any, borderRadius: 10, backgroundColor: actionColor, opacity: rippleOpacity as any, transform: [{ scale: rippleScale as any }] }} />
            )}

            {/* Ball */}
            {!waiting && (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 14, height: 14, marginLeft: -7, marginTop: -7, left: ballLeft as any, top: ballTop as any, borderRadius: 7, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#111', transform: [{ scale: bobScale as any }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 7, zIndex: 20 }} />
            )}

            {/* Waiting overlay */}
            {waiting && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: fonts.label, fontSize: 12, opacity: 0.9 }}>{t('tracker.waiting')}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Plain-language status banner */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: 'rgba(0,0,0,0.28)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: possession === 'home' ? HOME_COLOR : possession === 'away' ? AWAY_COLOR : colors.onSurfaceVariant }} />
          <View style={{ flex: 1 }}>
            {ballCarrier ? (
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
                {ballCarrier.jersey ? `#${ballCarrier.jersey} ` : ''}{ballCarrier.name}
              </Text>
            ) : (
              <Text style={{ color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 }} numberOfLines={1}>
                {possession === 'home' ? fixture.teams.home.name : possession === 'away' ? fixture.teams.away.name : t('tracker.inPlay')}
              </Text>
            )}
            <Text style={{ color: actionColor, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>
              {statusLine}
              {ballCarrier ? ` · ${ballCarrier.side === 'home' ? fixture.teams.home.name : fixture.teams.away.name}` : ''}
            </Text>
          </View>
          {usingReal && (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#4ade80', fontFamily: fonts.label, fontSize: 8, letterSpacing: 0.5 }}>{t('tracker.realData')}</Text>
            </View>
          )}
        </View>

        {/* Possession bar */}
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
