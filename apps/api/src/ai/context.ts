import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import type { Database } from '../db/client';
import { assessments, conversations, moodCheckins } from '../db/schema';
import { EMPTY_HISTORY, type History } from './prompts';
import { checkSafety } from './safety';

export type HistoryUser = { id: string; personalize: boolean };

/**
 * Personal history for prompts: recent check-ins, the latest Reflect result and a conversation
 * summary. Returns nothing at all when the user's personalize toggle is off.
 * Notes that contain crisis language are dropped, so they never reach a model.
 */
export async function loadHistory(
  db: Database,
  user: HistoryUser,
  options: { moods: number; conversationId?: string; excludeCheckinId?: string },
): Promise<History> {
  if (!user.personalize) return EMPTY_HISTORY;

  const summaryQuery = options.conversationId
    ? db
        .select({ summary: conversations.summary })
        .from(conversations)
        .where(and(eq(conversations.id, options.conversationId), eq(conversations.userId, user.id)))
        .limit(1)
    : db
        .select({ summary: conversations.summary })
        .from(conversations)
        .where(and(eq(conversations.userId, user.id), isNotNull(conversations.summary)))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);

  const [moods, [assessment], [summaryRow]] = await Promise.all([
    db
      .select({ mood: moodCheckins.mood, note: moodCheckins.note, createdAt: moodCheckins.createdAt })
      .from(moodCheckins)
      .where(
        options.excludeCheckinId
          ? and(eq(moodCheckins.userId, user.id), ne(moodCheckins.id, options.excludeCheckinId))
          : eq(moodCheckins.userId, user.id),
      )
      .orderBy(desc(moodCheckins.createdAt), desc(moodCheckins.id))
      .limit(options.moods),
    db
      .select({ score: assessments.score, band: assessments.band, createdAt: assessments.createdAt })
      .from(assessments)
      .where(eq(assessments.userId, user.id))
      .orderBy(desc(assessments.createdAt))
      .limit(1),
    summaryQuery,
  ]);

  return {
    moods: moods.map((entry) => ({
      ...entry,
      note: entry.note && !checkSafety(entry.note).crisis ? entry.note : null,
    })),
    assessment: assessment ?? null,
    summary: summaryRow?.summary ?? null,
  };
}
