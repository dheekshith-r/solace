import { Bell, Sparkles, Wind } from 'lucide-react-native';

export type ReminderKindName = 'checkin' | 'affirmation' | 'breathe';

/** One name per reminder, everywhere: onboarding, the Reminders page and the notification channels. */
export const REMINDER_TITLES: readonly { kind: ReminderKindName; title: string; icon: typeof Bell }[] = [
  { kind: 'checkin', title: 'Mood check-in', icon: Bell },
  { kind: 'affirmation', title: 'Daily affirmation', icon: Sparkles },
  { kind: 'breathe', title: 'Breathing break', icon: Wind },
];
