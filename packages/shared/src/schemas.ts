import { z } from 'zod';
import { GOALS } from './types';

export const healthResponseSchema = z.object({ ok: z.literal(true) });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ---------------------------------------------------------------------------
// Field rules (spec sections 2.2 and 3)
// ---------------------------------------------------------------------------

export const PASSWORD_MIN = 8;
// Upper bound keeps argon2 hashing cheap enough that long inputs cannot be used to burn CPU.
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const CUSTOM_REMINDERS_MAX = 20;
export const REMINDER_LABEL_MAX = 60;
export const XP_PER_LEVEL = 100;

// Input shape: "UTC" or an IANA Area/Location name. Offsets ("+05:30"), abbreviations ("IST")
// and the Etc/ pseudo-zones are rejected.
const IANA_NAME = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/i;

// ICU (and so Intl in Node) still resolves some zones to their old CLDR names.
// Map those back to the current IANA names.
const LEGACY_TO_IANA: Record<string, string> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Coral_Harbour': 'America/Atikokan',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

/**
 * The canonical IANA name for a time zone ("asia/calcutta" -> "Asia/Kolkata",
 * "US/Pacific" -> "America/Los_Angeles", "Etc/UTC" -> "UTC"), or null when it isn't one.
 */
export function canonicalTimeZone(value: string): string | null {
  if (!IANA_NAME.test(value) || /^(Etc|SystemV)\//i.test(value)) {
    return value.toLowerCase() === 'etc/utc' ? 'UTC' : null;
  }
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  const canonical = LEGACY_TO_IANA[resolved] ?? resolved;
  if (canonical === 'UTC' || canonical === 'Etc/UTC') return 'UTC';
  return /^[A-Za-z]+\//.test(canonical) && !canonical.startsWith('Etc/') ? canonical : null;
}

export function isValidTimeZone(value: string): boolean {
  return canonicalTimeZone(value) !== null;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX)
  .pipe(z.email({ message: 'Enter a valid email address.' }));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters.` })
  .max(PASSWORD_MAX, { message: `Password must be at most ${PASSWORD_MAX} characters.` });

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Name is required.' })
  .max(NAME_MAX, { message: `Name must be at most ${NAME_MAX} characters.` });

export const goalSchema = z.enum(GOALS);

/** IANA name, canonicalized. The database stores and the streak math uses only this form. */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .transform((value, ctx) => {
    const canonical = canonicalTimeZone(value);
    if (canonical) return canonical;
    ctx.addIssue({ code: 'custom', message: 'Use an IANA time zone name such as Asia/Kolkata.' });
    return z.NEVER;
  });

/** 24-hour local time, "HH:MM". */
export const reminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be HH:MM (24-hour).' });

export const reminderSettingSchema = z.strictObject({
  on: z.boolean(),
  time: reminderTimeSchema,
});
export type ReminderSetting = z.infer<typeof reminderSettingSchema>;

export const customReminderSchema = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(REMINDER_LABEL_MAX),
  time: reminderTimeSchema,
  on: z.boolean(),
});
export type CustomReminder = z.infer<typeof customReminderSchema>;

export const remindersSchema = z.strictObject({
  checkin: reminderSettingSchema,
  affirmation: reminderSettingSchema,
  breathe: reminderSettingSchema,
  custom: z.array(customReminderSchema).max(CUSTOM_REMINDERS_MAX),
});
export type Reminders = z.infer<typeof remindersSchema>;

/** Returned by GET /me/settings until the user saves their own. */
export const DEFAULT_REMINDERS: Reminders = {
  checkin: { on: true, time: '20:00' },
  affirmation: { on: true, time: '09:00' },
  breathe: { on: false, time: '13:00' },
  custom: [],
};

// ---------------------------------------------------------------------------
// Shared response pieces
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  goal: goalSchema.nullable(),
  personalize: z.boolean(),
  timezone: z.string(),
  /** ISO 8601. */
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const statsSchema = z.object({
  xp: z.number().int(),
  level: z.number().int(),
  /** Consecutive local days (user's timezone) with any activity, counting today or ending yesterday. */
  streak: z.number().int(),
  /** XP still needed to reach the next level. */
  xpToNext: z.number().int(),
});
export type Stats = z.infer<typeof statsSchema>;

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

export const signupRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  isAdult: z.literal(true, { message: 'You must be 18 or older to use Solace.' }),
  goal: goalSchema.optional(),
  timezone: timezoneSchema.optional(),
  reminders: remindersSchema.optional(),
});
export type SignupRequest = z.input<typeof signupRequestSchema>;

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  // Only bounded here: the minimum length is a signup rule, not a login one.
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512),
});
export type RefreshRequest = z.input<typeof refreshRequestSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const logoutRequestSchema = refreshRequestSchema;
export type LogoutRequest = RefreshRequest;

// ---------------------------------------------------------------------------
// /me routes
// ---------------------------------------------------------------------------

export const meResponseSchema = z.object({
  user: userSchema,
  stats: statsSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const updateMeRequestSchema = z.strictObject({
  name: nameSchema.optional(),
  goal: goalSchema.optional(),
  personalize: z.boolean().optional(),
  timezone: timezoneSchema.optional(),
});
export type UpdateMeRequest = z.input<typeof updateMeRequestSchema>;

export const updateMeResponseSchema = z.object({ user: userSchema });
export type UpdateMeResponse = z.infer<typeof updateMeResponseSchema>;

export const settingsRequestSchema = z.strictObject({ reminders: remindersSchema });
export type SettingsRequest = z.input<typeof settingsRequestSchema>;

export const settingsResponseSchema = z.object({ reminders: remindersSchema });
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
