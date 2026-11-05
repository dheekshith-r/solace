import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ACTIVITY_KINDS,
  ASSESSMENT_BANDS,
  CHECKIN_NOTE_MAX,
  CHECKIN_SOURCES,
  GOALS,
  MESSAGE_ROLES,
  MOOD_MAX,
  MOOD_MIN,
  SUGGESTED_ACTIONS,
} from '@solace/shared/types';

export const goalEnum = pgEnum('goal', GOALS);
export const checkinSourceEnum = pgEnum('checkin_source', CHECKIN_SOURCES);
export const assessmentBandEnum = pgEnum('assessment_band', ASSESSMENT_BANDS);
export const messageRoleEnum = pgEnum('message_role', MESSAGE_ROLES);
export const suggestedActionEnum = pgEnum('suggested_action', SUGGESTED_ACTIONS);
export const activityKindEnum = pgEnum('activity_kind', ACTIVITY_KINDS);

const id = () => uuid('id').primaryKey().defaultRandom();
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();

export type ReminderSetting = { on: boolean; time: string };
export type CustomReminder = ReminderSetting & { id: string; label: string };
export type Reminders = {
  checkin: ReminderSetting;
  affirmation: ReminderSetting;
  breathe: ReminderSetting;
  custom: CustomReminder[];
};

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    // Nullable: signup does not collect a goal, it is set afterwards with PATCH /me.
    goal: goalEnum('goal'),
    isAdult: boolean('is_adult').notNull(),
    personalize: boolean('personalize').notNull().default(true),
    xp: integer('xp').notNull().default(0),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_token_hash_idx').on(t.tokenHash)],
);

export const moodCheckins = pgTable(
  'mood_checkins',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mood: smallint('mood').notNull(),
    note: text('note'),
    source: checkinSourceEnum('source').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('mood_checkins_user_created_idx').on(t.userId, t.createdAt.desc()),
    check(
      'mood_checkins_mood_range',
      sql`${t.mood} between ${sql.raw(String(MOOD_MIN))} and ${sql.raw(String(MOOD_MAX))}`,
    ),
    check(
      'mood_checkins_note_length',
      sql`char_length(${t.note}) <= ${sql.raw(String(CHECKIN_NOTE_MAX))}`,
    ),
  ],
);

export const assessments = pgTable('assessments', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull(),
  score: smallint('score').notNull(),
  band: assessmentBandEnum('band').notNull(),
  createdAt: createdAt(),
});

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    summary: text('summary'),
    lastMessageAt: timestamptz('last_message_at').notNull().defaultNow(),
    messageCount: integer('message_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('conversations_user_last_message_idx').on(t.userId, t.lastMessageAt.desc())],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    mood: smallint('mood'),
    suggestedAction: suggestedActionEnum('suggested_action'),
    flaggedCrisis: boolean('flagged_crisis').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: activityKindEnum('kind').notNull(),
    meta: jsonb('meta'),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: createdAt(),
  },
  // Not in the spec's list: streaks are computed from this table on every /today call.
  (t) => [index('activity_log_user_created_idx').on(t.userId, t.createdAt.desc())],
);

export const dailyAffirmations = pgTable(
  'daily_affirmations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    text: text('text').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  reminders: jsonb('reminders').$type<Reminders>().notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
