// Value lists shared by the database schema, the API and the app.
// This file has no dependencies so that drizzle-kit can load it directly.

export const GOALS = ['calm', 'sleep', 'focus', 'confidence', 'connection'] as const;
export type Goal = (typeof GOALS)[number];

export const MOOD_MIN = 1;
export const MOOD_MAX = 5;
export const CHECKIN_NOTE_MAX = 280;

export const CHECKIN_SOURCES = ['home', 'post_breathe', 'chat'] as const;
export type CheckinSource = (typeof CHECKIN_SOURCES)[number];

export const ASSESSMENT_BANDS = ['steady', 'stretched', 'strained'] as const;
export type AssessmentBand = (typeof ASSESSMENT_BANDS)[number];

export const ASSESSMENT_KINDS = ['mood', 'anxiety', 'self_talk'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

/** Reflect: four questions, each answered 0-3. */
export const ASSESSMENT_QUESTIONS = 4;
export const ASSESSMENT_ANSWER_MAX = 3;

/** Activities a Reflect move can open. */
export const MOVE_ACTIONS = ['breathe', 'chat', 'checkin', 'affirmation', 'reflect'] as const;
export type MoveAction = (typeof MOVE_ACTIONS)[number];

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const SUGGESTED_ACTIONS = ['breathe', 'reflect', 'affirmation', 'checkin', 'none'] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

export const ACTIVITY_KINDS = ['breathe', 'checkin', 'assessment', 'reflection'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** XP the server awards per activity. The client never chooses an amount. */
export const ACTIVITY_XP = {
  checkin: 10,
  breathe: 15,
  reflection: 10,
  assessment: 20,
} as const satisfies Record<ActivityKind, number>;

/** Check-ins earn XP only for the first few of each local day; later ones still count for streaks. */
export const CHECKIN_XP_DAILY_LIMIT = 3;

/** Reflect results that earn XP per local day; later ones are logged with 0 XP. */
export const ASSESSMENT_XP_DAILY_LIMIT = 3;

/** Kinds the app may log through POST /activities. Check-ins and assessments have their own routes. */
export const LOGGABLE_ACTIVITY_KINDS = ['breathe', 'reflection'] as const;
export type LoggableActivityKind = (typeof LOGGABLE_ACTIVITY_KINDS)[number];

/** Sessions per local day that earn XP, per kind; later ones are logged with 0 XP. */
export const ACTIVITY_XP_DAILY_LIMIT = {
  breathe: 5,
  reflection: 3,
} as const satisfies Record<LoggableActivityKind, number>;

export const MESSAGE_TEXT_MAX = 2000;

/** India's national tele mental health line, shown in the crisis flow. */
export const HELPLINE = {
  name: 'Tele-MANAS',
  number: '14416',
  hours: '24x7, free',
  emergencyNumber: '112',
} as const;

export const NOTIFICATION_CHANNELS = ['checkin', 'affirmation', 'breathe', 'custom'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
