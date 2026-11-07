import { DEFAULT_REMINDERS, settingsResponseSchema, type Reminders, type TodayResponse } from '@solace/shared';
import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { queryClient } from '../../lib/queryClient';
import { zustandStorage } from '../../lib/storage';
import { authed } from '../auth/session';
import { TODAY_KEY } from '../today/data';
import { CHANNELS, planReminders, type Channel } from './plan';

type ReminderState = { reminders: Reminders; setReminders: (reminders: Reminders) => void };

/** The user's reminder settings, kept on the phone (MMKV) and synced to the API. */
export const useReminders = create<ReminderState>()(
  persist(
    (set) => ({
      reminders: DEFAULT_REMINDERS,
      setReminders: (reminders) => set({ reminders }),
    }),
    { name: 'reminders', storage: createJSONStorage(() => zustandStorage) },
  ),
);

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  const importance: Record<Channel, AndroidImportance> = {
    checkin: AndroidImportance.DEFAULT,
    affirmation: AndroidImportance.DEFAULT,
    breathe: AndroidImportance.DEFAULT,
    custom: AndroidImportance.HIGH,
  };
  await Promise.all((Object.keys(CHANNELS) as Channel[]).map((id) => setNotificationChannelAsync(id, { name: CHANNELS[id], importance: importance[id] })));
}

export async function notificationsAllowed(): Promise<boolean> {
  return (await getPermissionsAsync()).granted;
}

export async function askForNotifications(): Promise<boolean> {
  await ensureChannels();
  return (await requestPermissionsAsync()).granted;
}

/** Cancels everything, then schedules what is on (spec 2.3). Daily, inexact; no exact-alarm permission. */
export async function reschedule(reminders: Reminders = useReminders.getState().reminders): Promise<number> {
  await cancelAllScheduledNotificationsAsync();
  if (!(await notificationsAllowed())) return 0;
  await ensureChannels();
  const affirmation = queryClient.getQueryData<TodayResponse>(TODAY_KEY)?.affirmation;
  const plan = planReminders(reminders, { affirmation, day: new Date().getDate() });
  await Promise.all(
    plan.flatMap((r) => {
      const content = { title: r.title, body: r.body, data: { url: r.url } };
      if (!r.days) {
        return [scheduleNotificationAsync({ identifier: r.identifier, content, trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: r.channel } })];
      }
      // Android repeats per weekday, so specific days are one weekly trigger each.
      return r.days.map((weekday) =>
        scheduleNotificationAsync({
          identifier: `${r.identifier}-d${weekday}`,
          content,
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday, hour: r.hour, minute: r.minute, channelId: r.channel },
        }),
      );
    }),
  );
  return plan.length;
}

/** Saves settings: on the phone at once, then the schedule, then the API (retried later if offline). */
export async function saveReminders(reminders: Reminders): Promise<void> {
  useReminders.getState().setReminders(reminders);
  await reschedule(reminders);
  await authed('/me/settings', { method: 'PUT', body: { reminders }, schema: settingsResponseSchema }).catch(() => undefined);
}

/** Pulls settings from the account (another phone may have changed them) and reschedules. */
export async function syncReminders(): Promise<void> {
  try {
    const remote = await authed('/me/settings', { schema: settingsResponseSchema });
    useReminders.getState().setReminders(remote.reminders);
    await reschedule(remote.reminders);
  } catch {
    await reschedule();
  }
}

export async function sendTestNotification(): Promise<void> {
  await ensureChannels();
  await scheduleNotificationAsync({
    content: { title: 'Sola', body: 'This is how Sola will check in. Tap to open your mood check-in.', data: { url: 'solace://checkin' } },
    trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: 'checkin' },
  });
}
