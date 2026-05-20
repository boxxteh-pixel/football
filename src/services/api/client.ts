import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config, hasApiKey } from '@/constants/config';

const QUOTA_KEY = 'boro_api_quota';

interface QuotaState {
  date: string;
  used: number;
}

const todayStr = (): string => new Date().toISOString().split('T')[0];

const readQuota = async (): Promise<QuotaState> => {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    if (!raw) return { date: todayStr(), used: 0 };
    const parsed = JSON.parse(raw) as QuotaState;
    if (parsed.date !== todayStr()) return { date: todayStr(), used: 0 };
    return parsed;
  } catch {
    return { date: todayStr(), used: 0 };
  }
};

const writeQuota = async (state: QuotaState): Promise<void> => {
  try {
    await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
};

export const getQuota = readQuota;

export const resetQuota = async (): Promise<void> => {
  await writeQuota({ date: todayStr(), used: 0 });
};

export class QuotaExceededError extends Error {
  constructor() {
    super('API-Football daily quota exceeded. Please try again tomorrow or upgrade your plan.');
    this.name = 'QuotaExceededError';
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('Missing API-Football key. Set EXPO_PUBLIC_API_FOOTBALL_KEY in your .env file.');
    this.name = 'MissingApiKeyError';
  }
}

const createClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.apiFootball.baseUrl,
    timeout: 15000,
  });

  instance.interceptors.request.use(async (req) => {
    if (!hasApiKey()) throw new MissingApiKeyError();
    const quota = await readQuota();
    if (quota.used >= config.app.dailyQuota) throw new QuotaExceededError();
    req.headers = req.headers ?? {};
    req.headers['x-apisports-key'] = config.apiFootball.key;
    return req;
  });

  instance.interceptors.response.use(
    async (res) => {
      const data = res.data;
      if (data && data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
        const errorMsg = typeof data.errors === 'object' ? Object.values(data.errors).join(', ') : String(data.errors);
        if (errorMsg.toLowerCase().includes('limit') || errorMsg.toLowerCase().includes('quota')) {
          await writeQuota({ date: todayStr(), used: config.app.dailyQuota });
          return Promise.reject(new QuotaExceededError());
        }
        return Promise.reject(new Error(errorMsg));
      }

      const quota = await readQuota();
      await writeQuota({ date: quota.date, used: quota.used + 1 });
      // Surface quota headers if present (RapidAPI exposes them)
      const remaining = res.headers['x-ratelimit-requests-remaining'];
      if (remaining !== undefined) {
        const used = config.app.dailyQuota - Number(remaining);
        if (Number.isFinite(used) && used >= 0) {
          await writeQuota({ date: quota.date, used });
        }
      }
      return res;
    },
    (error: AxiosError) => {
      if (error.response?.status === 429) {
        writeQuota({ date: todayStr(), used: config.app.dailyQuota }).catch(() => {});
        return Promise.reject(new QuotaExceededError());
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

export const apiClient = createClient();
