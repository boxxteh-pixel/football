/**
 * Match simulation engine for the Bet365-style live pitch tracker.
 *
 * SportMonks (this plan) does not expose real-time player/ball coordinates, so
 * we SIMULATE plausible ball movement driven by the real live signals we DO
 * have: the event feed (goals, shots, corners, fouls, throw-ins, subs, cards)
 * and possession %. The ball tweens smoothly between targets; discrete events
 * snap it to a meaningful location and emit an "action" used to flash the pitch
 * and highlight the timeline.
 *
 * Coordinate space: x,y in [0,100]. Home attacks left→right (x toward 100),
 * away attacks right→left (x toward 0). y: 0 top touchline, 100 bottom.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { Fixture, FixtureEvent } from '@/types/match';
import { isLive } from '@/types/match';

export type ActionType =
  | 'kickoff'
  | 'pass'
  | 'shot'
  | 'goal'
  | 'corner'
  | 'foul'
  | 'throwin'
  | 'sub'
  | 'card'
  | 'idle';

export interface PitchAction {
  type: ActionType;
  team: 'home' | 'away' | null;
  label: string;
  minute: number | null;
  id: string;
}

const seeded = (seed: number) => {
  let t = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (v: number, min = 4, max = 96) => Math.min(max, Math.max(min, v));

const eventToAction = (e: FixtureEvent, homeId: number): ActionType => {
  const t = e.type;
  const d = (e.detail || '').toLowerCase();
  if (t === 'Goal') return 'goal';
  if (t === 'subst') return 'sub';
  if (t === 'Card') return 'card';
  if (d.includes('corner')) return 'corner';
  if (d.includes('foul') || d.includes('free')) return 'foul';
  if (d.includes('throw')) return 'throwin';
  if (d.includes('shot') || d.includes('saved') || d.includes('miss') || d.includes('post')) return 'shot';
  return 'pass';
};

/** Compute a ball target (0-100) for an action by the given team. */
const targetFor = (
  action: ActionType,
  team: 'home' | 'away' | null,
  rnd: () => number,
): { x: number; y: number } => {
  // Home attacks toward x=100, away toward x=0.
  const attackX = team === 'home' ? 88 + rnd() * 8 : team === 'away' ? 4 + rnd() * 8 : 50;
  switch (action) {
    case 'goal':
      return { x: team === 'home' ? 99 : 1, y: 50 };
    case 'shot':
      return { x: attackX, y: 38 + rnd() * 24 };
    case 'corner':
      return { x: team === 'home' ? 98 : 2, y: rnd() > 0.5 ? 4 : 96 };
    case 'throwin':
      return { x: 25 + rnd() * 50, y: rnd() > 0.5 ? 3 : 97 };
    case 'foul':
      return { x: 30 + rnd() * 40, y: 20 + rnd() * 60 };
    case 'kickoff':
      return { x: 50, y: 50 };
    default: {
      // pass / idle: wander in the possessing team's favoured half.
      const base = team === 'home' ? 55 : team === 'away' ? 45 : 50;
      return { x: clamp(base + (rnd() - 0.5) * 60), y: clamp(20 + rnd() * 60) };
    }
  }
};

export interface MatchSimulation {
  /** Animated ball position in 0-100 space. */
  ball: Animated.ValueXY;
  /** Pulse value 0→1 used for ripple/flash effects on actions. */
  pulse: Animated.Value;
  possession: 'home' | 'away' | null;
  action: PitchAction | null;
  waiting: boolean; // live but no usable signal yet
  live: boolean;
}

export const useMatchSimulation = (
  fixture: Fixture | null | undefined,
  events: FixtureEvent[],
  homePossession: number,
  awayPossession: number,
): MatchSimulation => {
  const live = fixture ? isLive(fixture.fixture.status.short) : false;
  const homeId = fixture?.teams.home.id ?? 0;

  const ball = useRef(new Animated.ValueXY({ x: 50, y: 50 })).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const rnd = useMemo(() => seeded((fixture?.fixture.id ?? 1) * 2654435761), [fixture?.fixture.id]);

  const [possession, setPossession] = useState<'home' | 'away' | null>(null);
  const [action, setAction] = useState<PitchAction | null>(null);

  const processedCount = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAnim = useRef<Animated.CompositeAnimation | null>(null);

  const animateTo = (x: number, y: number, duration: number) => {
    currentAnim.current?.stop();
    currentAnim.current = Animated.timing(ball, {
      toValue: { x, y },
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false, // x/y feed layout (left/top), not transform-only
    });
    currentAnim.current.start();
  };

  const flash = () => {
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
  };

  // Possession from stats (fallback: alternate randomly).
  useEffect(() => {
    const total = homePossession + awayPossession;
    if (total > 0) {
      setPossession(homePossession >= awayPossession ? 'home' : 'away');
    }
  }, [homePossession, awayPossession]);

  // Idle wandering loop while live.
  useEffect(() => {
    if (!live) {
      if (idleTimer.current) clearInterval(idleTimer.current);
      return;
    }
    const tick = () => {
      const total = homePossession + awayPossession;
      // Weighted random possession each tick.
      let side: 'home' | 'away' | null = possession;
      if (total > 0) {
        side = rnd() * total < homePossession ? 'home' : 'away';
      } else {
        side = rnd() > 0.5 ? 'home' : 'away';
      }
      setPossession(side);
      const tgt = targetFor('pass', side, rnd);
      animateTo(tgt.x, tgt.y, 2000 + rnd() * 1200);
    };
    tick();
    idleTimer.current = setInterval(tick, 2600);
    return () => {
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, homePossession, awayPossession]);

  // React to new live events.
  useEffect(() => {
    if (!live || events.length === 0) return;
    // Sort chronologically.
    const sorted = [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);
    if (processedCount.current === 0) {
      // First load: don't replay history, just sync the pointer.
      processedCount.current = sorted.length;
      return;
    }
    if (sorted.length <= processedCount.current) return;

    const fresh = sorted.slice(processedCount.current);
    processedCount.current = sorted.length;

    const latest = fresh[fresh.length - 1];
    const team: 'home' | 'away' | null = latest.team?.id ? (latest.team.id === homeId ? 'home' : 'away') : null;
    const type = eventToAction(latest, homeId);
    setPossession(team);

    const tgt = targetFor(type, team, rnd);
    animateTo(tgt.x, tgt.y, type === 'goal' || type === 'shot' ? 700 : 1100);
    flash();

    setAction({
      type,
      team,
      label: latest.detail || latest.type,
      minute: latest.time?.elapsed ?? null,
      id: `${latest.time?.elapsed}-${latest.player?.name}-${type}`,
    });

    // After a goal, reset to centre for kickoff.
    if (type === 'goal') {
      setTimeout(() => {
        animateTo(50, 50, 900);
        setAction({ type: 'kickoff', team: null, label: 'Kick-off', minute: latest.time?.elapsed ?? null, id: `ko-${Date.now()}` });
      }, 1800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, live, homeId]);

  const waiting = live && events.length === 0 && homePossession + awayPossession === 0;

  return { ball, pulse, possession, action, waiting, live };
};
