/**
 * Smooth ball playback from real SportMonks ballCoordinates.
 *
 * The coordinate feed is sparse and irregular (a point every few seconds). To
 * make the ball glide naturally we keep an animated position and, whenever new
 * coordinates arrive, tween to the LATEST point (and replay the most recent few
 * steps in sequence so a burst of new data plays out as motion rather than a
 * jump). When no real coordinates exist we fall back to the event/possession
 * simulation. The ball never teleports.
 *
 * Output position is in 0-100 space (x = length, y = width) to match the
 * pitch projection used by LivePitch.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { Fixture, FixtureEvent } from '@/types/match';
import type { BallPoint } from '@/services/api/smTracker';
import { useMatchSimulation, type PitchAction } from './useMatchSimulation';

export type AttackZone = 'none' | 'attack' | 'dangerous' | 'shot' | 'goal';

export interface BallPlayback {
  ball: Animated.ValueXY; // 0-100 space
  pulse: Animated.Value;
  possession: 'home' | 'away' | null;
  action: PitchAction | null;
  zone: AttackZone; // derived from latest ball x/y (home-attack normalized)
  zoneSide: 'home' | 'away' | null; // which team is attacking
  waiting: boolean;
  usingReal: boolean;
}

const classifyZone = (x: number, y: number): AttackZone => {
  // x,y in 0-100; x>... toward the goal being attacked.
  if (x > 96) return 'goal';
  if (x > 90 && y > 25 && y < 75) return 'shot';
  if (x > 85) return 'dangerous';
  if (x > 70) return 'attack';
  return 'none';
};

export const useBallPlayback = (
  fixture: Fixture | null | undefined,
  events: FixtureEvent[],
  ballPoints: BallPoint[],
  homePossession: number,
  awayPossession: number,
): BallPlayback => {
  // Simulation is always running as the fallback layer.
  const sim = useMatchSimulation(fixture, events, homePossession, awayPossession);

  const realBall = useRef(new Animated.ValueXY({ x: 50, y: 50 })).current;
  const [usingReal, setUsingReal] = useState(false);
  const [zone, setZone] = useState<AttackZone>('none');
  const [zoneSide, setZoneSide] = useState<'home' | 'away' | null>(null);
  const lastCount = useRef(0);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!ballPoints || ballPoints.length === 0) {
      setUsingReal(false);
      return;
    }
    setUsingReal(true);

    // Determine which new points arrived since last update.
    const start = Math.max(0, Math.min(lastCount.current, ballPoints.length - 1));
    const fresh = lastCount.current === 0 ? ballPoints.slice(-1) : ballPoints.slice(start);
    lastCount.current = ballPoints.length;

    // Build a sequence of tweens through the fresh points (cap to last 8).
    // Each step is spread so the motion flows continuously across the polling
    // interval rather than snapping then sitting idle.
    const seq = fresh.slice(-8);
    const stepDur = seq.length > 1 ? Math.max(450, Math.min(1400, 5600 / seq.length)) : 1000;
    const steps = seq.map((p) =>
      Animated.timing(realBall, {
        toValue: { x: p.x * 100, y: p.y * 100 },
        duration: stepDur,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    );
    anim.current?.stop();
    anim.current = Animated.sequence(steps);
    anim.current.start();

    // Zone classification from the latest point.
    const latest = seq[seq.length - 1];
    if (latest) {
      // The ball x is absolute pitch length (0=home goal,1=away goal). For zone
      // we consider whichever side is being attacked: nearer to 1 = home attack.
      const homeAttack = latest.x >= 0.5;
      const nx = (homeAttack ? latest.x : 1 - latest.x) * 100;
      const ny = latest.y * 100;
      setZone(classifyZone(nx, ny));
      setZoneSide(homeAttack ? 'home' : 'away');
    }
  }, [ballPoints, realBall]);

  if (usingReal) {
    return {
      ball: realBall,
      pulse: sim.pulse, // reuse sim pulse for event flashes
      possession: zoneSide ?? sim.possession,
      action: sim.action,
      zone,
      zoneSide,
      waiting: false,
      usingReal: true,
    };
  }

  // Fallback: simulation. Derive a coarse zone from sim possession.
  return {
    ball: sim.ball,
    pulse: sim.pulse,
    possession: sim.possession,
    action: sim.action,
    zone: sim.action?.type === 'goal' ? 'goal' : sim.action?.type === 'shot' ? 'shot' : 'none',
    zoneSide: sim.possession,
    waiting: sim.waiting,
    usingReal: false,
  };
};
