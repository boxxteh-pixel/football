import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

interface LearningState {
  poissonBias: number;
  eloBias: number;
  formBias: number;
  correctPredictionsCount: number;
  totalPredictionsAnalyzed: number;
  hydrated: boolean;
  
  hydrate: () => Promise<void>;
  recordOutcome: (fixture: Fixture, prediction: PredictionResult) => Promise<void>;
  resetLearning: () => Promise<void>;
}

const STORAGE_KEY = 'boro_ai_learning_store';

export const useLearningStore = create<LearningState>((set, get) => ({
  poissonBias: 0.0,
  eloBias: 0.0,
  formBias: 0.0,
  correctPredictionsCount: 0,
  totalPredictionsAnalyzed: 0,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          poissonBias: parsed.poissonBias ?? 0.0,
          eloBias: parsed.eloBias ?? 0.0,
          formBias: parsed.formBias ?? 0.0,
          correctPredictionsCount: parsed.correctPredictionsCount ?? 0,
          totalPredictionsAnalyzed: parsed.totalPredictionsAnalyzed ?? 0,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch (err) {
      console.warn('Failed to hydrate learning store:', err);
      set({ hydrated: true });
    }
  },

  recordOutcome: async (fixture: Fixture, prediction: PredictionResult) => {
    if (!fixture.goals || fixture.goals.home === null || fixture.goals.away === null) return;
    
    const actualHome = fixture.goals.home;
    const actualAway = fixture.goals.away;
    const isDraw = actualHome === actualAway;
    const actualWinner = actualHome > actualAway ? 'home' : (actualAway > actualHome ? 'away' : 'draw');

    // 1. Evaluate prediction accuracy
    // Find the predicted winner
    const predWinner = prediction.homeWinPct > prediction.awayWinPct && prediction.homeWinPct > prediction.drawPct
      ? 'home'
      : (prediction.awayWinPct > prediction.homeWinPct && prediction.awayWinPct > prediction.drawPct ? 'away' : 'draw');
    
    const isPredictionCorrect = predWinner === actualWinner;

    // 2. Measure individual component accuracy to adjust bias
    // Compute ELO bias (whether ELO win probability pointed in the right direction)
    const homeElo = prediction.metrics?.homeElo ?? 1000;
    const awayElo = prediction.metrics?.awayElo ?? 1000;
    const eloFavors = homeElo > awayElo ? 'home' : (awayElo > homeElo ? 'away' : 'draw');
    const eloError = eloFavors === actualWinner ? 0 : 1;

    // Compute Poisson goal-based winner bias
    const expectedHome = prediction.metrics?.homeXg ?? 1.5;
    const expectedAway = prediction.metrics?.awayXg ?? 1.2;
    const poissonFavors = expectedHome > expectedAway ? 'home' : (expectedAway > expectedHome ? 'away' : 'draw');
    const poissonError = poissonFavors === actualWinner ? 0 : 1;

    // Compute Form bias
    const homeForm = prediction.metrics?.homeForm ?? 0.5;
    const awayForm = prediction.metrics?.awayForm ?? 0.5;
    const formFavors = homeForm > awayForm ? 'home' : (awayForm > homeForm ? 'away' : 'draw');
    const formError = formFavors === actualWinner ? 0 : 1;

    // 3. Apply gradient reinforcement updates (Learning rate η = 0.02)
    const lr = 0.02;
    let newEloBias = get().eloBias;
    let newPoissonBias = get().poissonBias;
    let newFormBias = get().formBias;

    // Reinforce accurate components, penalize inaccurate ones
    if (eloError === 0) newEloBias += lr; else newEloBias -= lr * 0.5;
    if (poissonError === 0) newPoissonBias += lr; else newPoissonBias -= lr * 0.5;
    if (formError === 0) newFormBias += lr; else newFormBias -= lr * 0.5;

    // Keep biases within reasonable operational boundaries ([-0.15, 0.15]) to prevent instability
    newEloBias = Math.max(-0.15, Math.min(0.15, newEloBias));
    newPoissonBias = Math.max(-0.15, Math.min(0.15, newPoissonBias));
    newFormBias = Math.max(-0.15, Math.min(0.15, newFormBias));

    const nextState = {
      eloBias: newEloBias,
      poissonBias: newPoissonBias,
      formBias: newFormBias,
      correctPredictionsCount: get().correctPredictionsCount + (isPredictionCorrect ? 1 : 0),
      totalPredictionsAnalyzed: get().totalPredictionsAnalyzed + 1,
    };

    set(nextState);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...nextState,
      }));
      console.log(`[BORO AI Learning Feedback] Match ID ${fixture.fixture.id} processed. Accurate components reinforced. Biases: ELO: ${newEloBias.toFixed(3)}, Poisson: ${newPoissonBias.toFixed(3)}, Form: ${newFormBias.toFixed(3)}`);
    } catch (err) {
      console.warn('Failed to save learning state:', err);
    }
  },

  resetLearning: async () => {
    const nextState = {
      poissonBias: 0.0,
      eloBias: 0.0,
      formBias: 0.0,
      correctPredictionsCount: 0,
      totalPredictionsAnalyzed: 0,
    };
    set(nextState);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to reset learning state:', err);
    }
  },
}));
