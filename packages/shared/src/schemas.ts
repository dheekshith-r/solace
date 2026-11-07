import { z } from 'zod';
import {
  ASSESSMENT_ANSWER_MAX,
  ASSESSMENT_BANDS,
  ASSESSMENT_KINDS,
  ASSESSMENT_QUESTIONS,
  type AssessmentBand,
  type AssessmentKind,
  CHECKIN_NOTE_MAX,
  CHECKIN_SOURCES,
  GOALS,
  LOGGABLE_ACTIVITY_KINDS,
  MESSAGE_ROLES,
  MESSAGE_TEXT_MAX,
  MOOD_MAX,
  MOOD_MIN,
  MOVE_ACTIONS,
  SUGGESTED_ACTIONS,
} from './types';

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

/** Weekdays a reminder repeats on, 1 = Sunday … 7 = Saturday (Android's numbering). Absent = every day. */
export const reminderDaysSchema = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export const reminderSettingSchema = z.strictObject({
  on: z.boolean(),
  time: reminderTimeSchema,
  // Optional so settings saved before weekdays existed stay valid.
  days: reminderDaysSchema.optional(),
});
export type ReminderSetting = z.infer<typeof reminderSettingSchema>;

export const customReminderSchema = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(REMINDER_LABEL_MAX),
  time: reminderTimeSchema,
  on: z.boolean(),
  days: reminderDaysSchema.optional(),
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

// ---------------------------------------------------------------------------
// Check-ins, activities and Today (ticket 06)
// ---------------------------------------------------------------------------

export const moodSchema = z.number().int().min(MOOD_MIN).max(MOOD_MAX);

/** Actions a suggestion card can open. "checkin" is left out: it is offered right after one. */
export const SUGGESTION_ACTIONS = ['breathe', 'reflect', 'affirmation', 'none'] as const;
export type SuggestionAction = (typeof SUGGESTION_ACTIONS)[number];

export const suggestionSchema = z.object({
  /** One sentence in Sola's voice. */
  text: z.string(),
  action: z.enum(SUGGESTION_ACTIONS),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export const helplineSchema = z.object({
  name: z.string(),
  number: z.string(),
  hours: z.string(),
  emergencyNumber: z.string(),
});
export type Helpline = z.infer<typeof helplineSchema>;

export const checkinRequestSchema = z.strictObject({
  mood: moodSchema,
  note: z
    .string()
    .trim()
    .max(CHECKIN_NOTE_MAX, { message: `Note must be at most ${CHECKIN_NOTE_MAX} characters.` })
    .optional(),
  source: z.enum(CHECKIN_SOURCES),
});
export type CheckinRequest = z.input<typeof checkinRequestSchema>;

export const checkinSchema = z.object({
  id: z.string(),
  mood: z.number().int(),
  note: z.string().nullable(),
  source: z.enum(CHECKIN_SOURCES),
  /** ISO 8601. */
  createdAt: z.string(),
});
export type Checkin = z.infer<typeof checkinSchema>;

export const checkinResponseSchema = z.object({
  checkin: checkinSchema,
  xpAwarded: z.number().int(),
  stats: statsSchema,
  suggestion: suggestionSchema,
  /** Present only when the note contained crisis language: show the helpline card. */
  crisis: z.object({ helpline: helplineSchema }).optional(),
});
export type CheckinResponse = z.infer<typeof checkinResponseSchema>;

export const CHECKIN_DAYS_MAX = 366;

export const listCheckinsQuerySchema = z.strictObject({
  /** Local calendar days to include, counting today. */
  days: z.coerce.number().int().min(1).max(CHECKIN_DAYS_MAX).default(30),
});
export type ListCheckinsQuery = z.input<typeof listCheckinsQuerySchema>;

export const listCheckinsResponseSchema = z.object({
  /** Newest first. */
  items: z.array(checkinSchema),
});
export type ListCheckinsResponse = z.infer<typeof listCheckinsResponseSchema>;

export const ACTIVITY_META_KEYS_MAX = 12;

const activityMetaValue = z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]);

export const activityRequestSchema = z.strictObject({
  kind: z.enum(LOGGABLE_ACTIVITY_KINDS),
  /**
   * Flat details, for example `{ sessionId, pattern, seconds, moodBefore, moodAfter }`.
   * A `sessionId` makes the call idempotent: the same session is never awarded XP twice.
   */
  meta: z
    .record(z.string().min(1).max(40), activityMetaValue)
    .refine((meta) => Object.keys(meta).length <= ACTIVITY_META_KEYS_MAX, {
      message: `meta may have at most ${ACTIVITY_META_KEYS_MAX} keys.`,
    })
    .refine((meta) => meta.sessionId === undefined || typeof meta.sessionId === 'string', {
      message: 'meta.sessionId must be a string.',
    })
    .default({}),
});
export type ActivityRequest = z.input<typeof activityRequestSchema>;

export const activityResponseSchema = z.object({
  xpAwarded: z.number().int(),
  stats: statsSchema,
});
export type ActivityResponse = z.infer<typeof activityResponseSchema>;

export const todayResponseSchema = z.object({
  /** Sola's personal line for the day (shown on the Sola tab). Cached once per local day. */
  greeting: z.string(),
  /** The day's affirmation. Cached once per local day. */
  affirmation: z.string(),
  lastMood: z.object({ mood: z.number().int(), createdAt: z.string() }).nullable(),
  suggestion: suggestionSchema,
  stats: statsSchema,
});
export type TodayResponse = z.infer<typeof todayResponseSchema>;

// ---------------------------------------------------------------------------
// Conversations and messages (ticket 07)
// ---------------------------------------------------------------------------

export const PAGE_LIMIT_MAX = 50;
export const CONVERSATIONS_PAGE_DEFAULT = 20;
export const MESSAGES_PAGE_DEFAULT = 30;

/** Opaque: pass back the nextCursor of the previous page. */
const cursorSchema = z.string().min(1).max(64);

export const conversationIdParamsSchema = z.object({ id: z.string().max(64) });

export const listConversationsQuerySchema = z.strictObject({
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(CONVERSATIONS_PAGE_DEFAULT),
});
export type ListConversationsQuery = z.input<typeof listConversationsQuerySchema>;

export const conversationListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  /** Start of the latest message, or null for an empty conversation. */
  preview: z.string().nullable(),
  lastMessageAt: z.string(),
});
export type ConversationListItem = z.infer<typeof conversationListItemSchema>;

export const listConversationsResponseSchema = z.object({
  /** Most recently active first. */
  items: z.array(conversationListItemSchema),
  nextCursor: z.string().nullable(),
});
export type ListConversationsResponse = z.infer<typeof listConversationsResponseSchema>;

export const createConversationRequestSchema = z.strictObject({});
export type CreateConversationRequest = z.input<typeof createConversationRequestSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  messageCount: z.number().int(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationResponseSchema = z.object({ conversation: conversationSchema });
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  content: z.string(),
  mood: z.number().int().nullable(),
  suggestedAction: z.enum(SUGGESTED_ACTIONS).nullable(),
  flaggedCrisis: z.boolean(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export const listMessagesQuerySchema = z.strictObject({
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(MESSAGES_PAGE_DEFAULT),
});
export type ListMessagesQuery = z.input<typeof listMessagesQuerySchema>;

export const listMessagesResponseSchema = z.object({
  /** Newest first; nextCursor pages back to older messages. */
  items: z.array(messageSchema),
  nextCursor: z.string().nullable(),
});
export type ListMessagesResponse = z.infer<typeof listMessagesResponseSchema>;

export const sendMessageRequestSchema = z.strictObject({
  text: z
    .string()
    .trim()
    .min(1, { message: 'Write something first.' })
    .max(MESSAGE_TEXT_MAX, { message: `Messages can be at most ${MESSAGE_TEXT_MAX} characters.` }),
  /**
   * Retrying after an `error` event: the id of the saved user message that got no reply.
   * It must be the conversation's latest message. It is not saved again; Sola answers it.
   */
  retryOf: z.uuid().optional(),
});
export type SendMessageRequest = z.input<typeof sendMessageRequestSchema>;

// SSE events of POST /conversations/:id/messages (spec 2.1). Each arrives as
// `event: <type>\ndata: <json>\n\n`. Lines starting with ":" are heartbeats (every 15 s).
// Order: `delta`+ then `meta` then `done`; a crisis reply sends `delta`, `crisis`, `done` (or, when a
// reply is stopped mid-stream, `crisis` with `replace: true`, `delta`, `done`);
// a failure sends `error` (the user message is already saved).
export const sseDeltaSchema = z.object({ text: z.string() });
export const sseMetaSchema = z.object({
  mood: z.number().int().nullable(),
  suggestedAction: z.enum(SUGGESTED_ACTIONS),
  title: z.string().nullable(),
});
export const sseCrisisSchema = z.object({
  helpline: helplineSchema,
  /**
   * True when the model's own safety filter stopped a reply mid-stream: clear the text
   * streamed so far. The caring reply follows as a `delta`, then `done`.
   */
  replace: z.boolean().optional(),
});
export const sseDoneSchema = z.object({ messageId: z.string() });
export const sseErrorSchema = z.object({ code: z.string(), message: z.string() });

export const SSE_EVENT_TYPES = ['delta', 'meta', 'crisis', 'done', 'error'] as const;
export type SseEventType = (typeof SSE_EVENT_TYPES)[number];

export const sseEventDataSchemas = {
  delta: sseDeltaSchema,
  meta: sseMetaSchema,
  crisis: sseCrisisSchema,
  done: sseDoneSchema,
  error: sseErrorSchema,
} as const;

export type SseEventData = { [K in SseEventType]: z.infer<(typeof sseEventDataSchemas)[K]> };
export type SseEvent = { [K in SseEventType]: { event: K; data: SseEventData[K] } }[SseEventType];

// ---------------------------------------------------------------------------
// Reflect (ticket 10)
// ---------------------------------------------------------------------------

/** Score bands: 0-4 steady, 5-8 stretched, 9-12 strained. */
export function assessmentBand(score: number): AssessmentBand {
  if (score <= 4) return 'steady';
  if (score <= 8) return 'stretched';
  return 'strained';
}

/**
 * Whether to show the support card (Tele-MANAS, talking to someone): a strained result, or a
 * 3 on the second mood question (Ddk's safety rule).
 */
export function needsSupport(kind: AssessmentKind, answers: readonly number[], band: AssessmentBand) {
  return band === 'strained' || (kind === 'mood' && answers[1] === ASSESSMENT_ANSWER_MAX);
}

export const assessmentRequestSchema = z.strictObject({
  kind: z.enum(ASSESSMENT_KINDS),
  answers: z
    .array(z.number().int().min(0).max(ASSESSMENT_ANSWER_MAX))
    .length(ASSESSMENT_QUESTIONS, { message: `Answer all ${ASSESSMENT_QUESTIONS} questions.` }),
});
export type AssessmentRequest = z.input<typeof assessmentRequestSchema>;

export const moveSchema = z.object({
  /** One short, kind sentence. */
  text: z.string(),
  action: z.enum(MOVE_ACTIONS),
});
export type Move = z.infer<typeof moveSchema>;

export const assessmentSchema = z.object({
  id: z.string(),
  kind: z.enum(ASSESSMENT_KINDS),
  score: z.number().int(),
  band: z.enum(ASSESSMENT_BANDS),
  createdAt: z.string(),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export const assessmentResponseSchema = z.object({
  assessment: assessmentSchema,
  /** Exactly three. */
  moves: z.array(moveSchema).length(3),
  /** Show the support card (helpline and "talk to someone"). */
  support: z.boolean(),
});
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;

// ---------------------------------------------------------------------------
// Resources (ticket 12)
// ---------------------------------------------------------------------------

export const guideSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  /** Reading time. */
  minutes: z.number().int().positive(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(3).max(5),
});
export type Guide = z.infer<typeof guideSchema>;

export const resourcesResponseSchema = z.object({
  guides: z.array(guideSchema),
  getHelp: z.object({
    helpline: helplineSchema,
    emergencyNumber: z.string(),
    /** "Solace is not a substitute for professional care." */
    note: z.string(),
  }),
});
export type ResourcesResponse = z.infer<typeof resourcesResponseSchema>;
