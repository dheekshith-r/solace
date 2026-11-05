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

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const SUGGESTED_ACTIONS = ['breathe', 'reflect', 'affirmation', 'checkin', 'none'] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

export const ACTIVITY_KINDS = ['breathe', 'checkin', 'assessment', 'reflection'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const NOTIFICATION_CHANNELS = ['checkin', 'affirmation', 'breathe', 'custom'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
