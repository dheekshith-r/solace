import type { Reminders } from '@solace/shared';

export type Channel = 'checkin' | 'affirmation' | 'breathe' | 'custom';

export type PlannedReminder = {
  identifier: string;
  channel: Channel;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** Where a tap opens (spec 2.3). */
  url: string;
};

export const CHANNELS: Record<Channel, string> = {
  checkin: 'Mood check-in',
  affirmation: 'Daily affirmation',
  breathe: 'Breathing break',
  custom: 'Your reminders',
};

// Sola's voice: short, warm, specific, and the product names used consistently ("mood check-in", "Reflect").
const CHECKIN_LINES = ['How are you arriving tonight? A ten-second mood check-in helps Sola help you.', 'One tap, one feeling. Sola saved you a spot for your mood check-in.'];
const BREATHE_LINES = ['A slow breath or two could reset the afternoon. Two minutes with Sola?', 'Shoulders up near your ears? A short breathing break is ready when you are.'];

const split = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
};

/**
 * Every daily reminder to schedule, from the user's settings. Pure: the same settings always give the
 * same plan. `affirmation` is today's cached affirmation text, when known; `day` picks the line variant.
 */
export function planReminders(reminders: Reminders, { affirmation, day = 0 }: { affirmation?: string; day?: number } = {}): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  if (reminders.checkin.on) {
    plan.push({ identifier: 'checkin', channel: 'checkin', ...split(reminders.checkin.time), title: 'Sola', body: CHECKIN_LINES[day % CHECKIN_LINES.length] ?? '', url: 'solace://checkin' });
  }
  if (reminders.affirmation.on) {
    plan.push({
      identifier: 'affirmation',
      channel: 'affirmation',
      ...split(reminders.affirmation.time),
      title: "Today's affirmation",
      body: affirmation ?? 'Sola has a few kind words waiting for you today.',
      url: 'solace://today',
    });
  }
  if (reminders.breathe.on) {
    plan.push({ identifier: 'breathe', channel: 'breathe', ...split(reminders.breathe.time), title: 'Breathe with Sola', body: BREATHE_LINES[day % BREATHE_LINES.length] ?? '', url: 'solace://breathe' });
  }
  for (const custom of reminders.custom) {
    if (custom.on) plan.push({ identifier: `custom-${custom.id}`, channel: 'custom', ...split(custom.time), title: custom.label, body: 'Sola is reminding you, as you asked.', url: 'solace://today' });
  }
  return plan;
}

/** solace://breathe → /breathe. Only known in-app routes are opened from a notification. */
export function routeForUrl(url: unknown): '/today' | '/breathe' | '/sola' | null {
  if (typeof url !== 'string') return null;
  const path = url.replace(/^solace:\/\//, '/').split('?')[0];
  if (path === '/checkin' || path === '/today') return '/today';
  if (path === '/breathe') return '/breathe';
  if (path === '/sola' || path === '/sola/new') return '/sola';
  return null;
}
