/**
 * Local-only authentication service.
 * Stores users in AsyncStorage with SHA-256 + per-user salt.
 * No backend required.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { UserAccount, UserCredentials, UserSession, UserSignUpPayload } from '@/types/user';

const USERS_KEY = 'boro_users';
const SESSION_KEY = 'boro_session';
const PASSWORD_KEY_PREFIX = 'boro_pwd_';

/**
 * Store the plaintext password in SecureStore (Keystore on Android,
 * Keychain on iOS) so the user can reveal it on their profile page.
 * SecureStore is hardware-encrypted; AsyncStorage would NOT be safe for this.
 *
 * Web has no SecureStore — fall back to silent no-op.
 */
const storePlainPassword = async (userId: string, password: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(`${PASSWORD_KEY_PREFIX}${userId}`, password);
  } catch {
    // best-effort; password reveal will fail gracefully if blocked
  }
};

export const getPlainPassword = async (userId: string): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(`${PASSWORD_KEY_PREFIX}${userId}`);
  } catch {
    return null;
  }
};

const removePlainPassword = async (userId: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(`${PASSWORD_KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
};

interface StoredUser extends UserAccount {
  salt: string;
  hash: string;
}

const readUsers = async (): Promise<StoredUser[]> => {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
};

const writeUsers = async (users: StoredUser[]): Promise<void> => {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const randomSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const hashPassword = async (password: string, salt: string): Promise<string> => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}::${password}`);
};

const stripSecrets = (user: StoredUser): UserAccount => ({
  id: user.id,
  name: user.name,
  createdAt: user.createdAt,
  avatarUrl: user.avatarUrl ?? null,
});

const generateId = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(8);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const signUp = async (payload: UserSignUpPayload): Promise<UserSession> => {
  const name = payload.name.trim();
  if (!name || !payload.password) {
    throw new Error('Name and password are required.');
  }
  if (payload.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const users = await readUsers();
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('An account with this username already exists.');
  }
  const salt = await randomSalt();
  const hash = await hashPassword(payload.password, salt);
  const newUser: StoredUser = {
    id: await generateId(),
    name,
    salt,
    hash,
    createdAt: Date.now(),
    avatarUrl: null,
  };
  await writeUsers([...users, newUser]);
  await storePlainPassword(newUser.id, payload.password);
  const session: UserSession = {
    user: stripSecrets(newUser),
    token: await generateId(),
    issuedAt: Date.now(),
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const logIn = async (creds: UserCredentials): Promise<UserSession> => {
  const name = creds.name.trim();
  const users = await readUsers();
  const user = users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!user) throw new Error('No account found with this username.');
  const hash = await hashPassword(creds.password, user.salt);
  if (hash !== user.hash) throw new Error('Incorrect password.');
  await storePlainPassword(user.id, creds.password);
  const session: UserSession = {
    user: stripSecrets(user),
    token: await generateId(),
    issuedAt: Date.now(),
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const deleteAccount = async (userId: string): Promise<void> => {
  const users = await readUsers();
  await writeUsers(users.filter((u) => u.id !== userId));
  await removePlainPassword(userId);
  await AsyncStorage.removeItem(SESSION_KEY);
};

export const logOut = async (): Promise<void> => {
  await AsyncStorage.removeItem(SESSION_KEY);
};

export const getSession = async (): Promise<UserSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
};

export const updateProfile = async (
  userId: string,
  patch: Partial<Pick<UserAccount, 'name' | 'avatarUrl'>>,
): Promise<UserAccount> => {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error('User not found.');
  const updated: StoredUser = { ...users[idx], ...patch };
  users[idx] = updated;
  await writeUsers(users);
  const session = await getSession();
  if (session?.user.id === userId) {
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...session, user: stripSecrets(updated) }),
    );
  }
  return stripSecrets(updated);
};
