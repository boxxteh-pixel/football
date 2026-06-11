/**
 * Notification Service — expo-notifications wrapper.
 * Handles push notification permissions, scheduling pre-match alerts,
 * live goal alerts, and favourite match reminders.
 *
 * NOTE: Push notifications only work on physical iOS/Android devices.
 * They are silently disabled on web/simulators.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Fixture } from '@/types/match';

// Configure how notifications are presented when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const isSupported = Platform.OS !== 'web';

/** Request notification permissions. Returns true if granted. */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!isSupported) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

/** Schedule a local notification N minutes before a fixture kicks off.
 *  Returns the notification identifier (use to cancel later). */
export const schedulePreMatchAlert = async (
  fixture: Fixture,
  minutesBefore = 10,
): Promise<string | null> => {
  if (!isSupported) return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    const kickoffMs = fixture.fixture.timestamp * 1000;
    const triggerMs = kickoffMs - minutesBefore * 60 * 1000;
    if (triggerMs <= Date.now()) return null; // already past

    const home = fixture.teams.home.name;
    const away = fixture.teams.away.name;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚽ Tra ${minutesBefore} minuti — ${home} vs ${away}`,
        body: `Il match sta per iniziare! Apri BORO per le predizioni.`,
        data: { fixtureId: fixture.fixture.id },
        sound: true,
      },
      trigger: {
        date: new Date(triggerMs),
      },
    });
    return id;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule pre-match alert:', err);
    return null;
  }
};

/** Cancel a previously scheduled notification by its identifier. */
export const cancelScheduledAlert = async (notificationId: string): Promise<void> => {
  if (!isSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // silently ignore
  }
};

/** Send an immediate local notification (e.g. when a goal is scored). */
export const sendGoalAlert = async (
  fixture: Fixture,
  scorerTeam: 'home' | 'away',
): Promise<void> => {
  if (!isSupported) return;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const scorer = scorerTeam === 'home'
      ? fixture.teams.home.name
      : fixture.teams.away.name;
    const score = `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚽ GOL — ${scorer}!`,
        body: `${fixture.teams.home.name} ${score} ${fixture.teams.away.name}`,
        data: { fixtureId: fixture.fixture.id },
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (err) {
    console.warn('[Notifications] Failed to send goal alert:', err);
  }
};

/** Send a favourite match notification (immediate). */
export const sendFavouriteAlert = async (
  fixture: Fixture,
  message: string,
): Promise<void> => {
  if (!isSupported) return;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 BORO — ${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
        body: message,
        data: { fixtureId: fixture.fixture.id },
        sound: true,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notifications] Failed to send favourite alert:', err);
  }
};

/** Storage key prefix for scheduled notification IDs. */
export const NOTIF_KEY_PREFIX = 'boro_notif_';
