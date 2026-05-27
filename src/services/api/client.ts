import AsyncStorage from '@react-native-async-storage/async-storage';
import { config, hasApiKey } from '@/constants/config';

const QUOTA_KEY = 'boro_api_quota';

interface QuotaState {
  date: string;
  used: number;
}

const todayStr = (): string => new Date().toISOString().split('T')[0];

const readQuota = async (): Promise<QuotaState> => {
  return { date: todayStr(), used: 0 };
};

const writeQuota = async (state: QuotaState): Promise<void> => {};

export const getQuota = readQuota;
export const resetQuota = async (): Promise<void> => {};

export class QuotaExceededError extends Error {
  constructor() {
    super('Sportmonks daily quota exceeded. Please try again tomorrow or upgrade your plan.');
    this.name = 'QuotaExceededError';
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('Missing Sportmonks token. Set EXPO_PUBLIC_SPORTMONKS_KEY in your .env file.');
    this.name = 'MissingApiKeyError';
  }
}
