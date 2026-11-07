import {
  conversationIdParamsSchema,
  conversationResponseSchema,
  createConversationRequestSchema,
  listConversationsQuerySchema,
  listConversationsResponseSchema,
  listMessagesQuerySchema,
  listMessagesResponseSchema,
  type Message,
} from '@solace/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Database } from '../db/client';
import { conversations, messages } from '../db/schema';
import { ApiError } from '../lib/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);
const PREVIEW_CHARS = 120;

export const conversationNotFound = () =>
  new ApiError(404, 'not_found', 'That conversation doesn’t exist.');
const invalidCursor = () => new ApiError(400, 'invalid_cursor', 'That page is no longer available.');

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export const toConversation = (row: ConversationRow) => ({
  id: row.id,
  title: row.title,
  messageCount: row.messageCount,
  lastMessageAt: row.lastMessageAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

export const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  role: row.role,
  content: row.content,
  mood: row.mood,
  suggestedAction: row.suggestedAction,
  flaggedCrisis: row.flaggedCrisis,
  createdAt: row.createdAt.toISOString(),
});

/** The user's conversation, or a 404 for a bad id or someone else's conversation. */
export async function findConversation(db: Database, userId: string, id: string) {
  if (!UUID_RE.test(id)) throw conversationNotFound();
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!row) throw conversationNotFound();
  return row;
}

/**
 * Cursors are the id of the last item on the previous page. Rows are compared by their full
 * (timestamp, id) position in SQL, so microsecond timestamps never lose precision in transit.
 */
function checkCursor(cursor: string | undefined) {
  if (cursor !== undefined && !UUID_RE.test(cursor)) throw invalidCursor();
  return cursor;
}

/** Conversation routes (ticket 07). Inside the auth-guarded scope. */
export function registerConversationRoutes(scope: FastifyInstance, { db }: { db: Database }) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/conversations',
    {
      schema: {
        querystring: listConversationsQuerySchema,
        response: { 200: listConversationsResponseSchema },
      },
    },
    async (request) => {
      const { limit } = request.query;
      const cursor = checkCursor(request.query.cursor);
      const userId = request.userId;

      if (cursor) {
        const [anchor] = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.id, cursor), eq(conversations.userId, userId)))
          .limit(1);
        if (!anchor) throw invalidCursor();
      }

      // Written out with explicit table names: in a single-table select Drizzle leaves column
      // names unqualified, which would bind "id" to the inner messages table.
      const preview = sql<string | null>`(
        select left(m.content, ${PREVIEW_CHARS})
        from messages m
        where m.conversation_id = "conversations"."id"
        order by m.created_at desc, m.id desc
        limit 1
      )`;
      const rows = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          lastMessageAt: conversations.lastMessageAt,
          preview,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            cursor
              ? sql`(${conversations.lastMessageAt}, ${conversations.id}) < (
                  select c2.last_message_at, c2.id from conversations c2 where c2.id = ${cursor}
                )`
              : undefined,
          ),
        )
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      return {
        items: page.map((row) => ({
          id: row.id,
          title: row.title,
          preview: row.preview,
          lastMessageAt: row.lastMessageAt.toISOString(),
        })),
        nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
      };
    },
  );

  app.post(
    '/conversations',
    {
      schema: {
        body: createConversationRequestSchema.optional(),
        response: { 201: conversationResponseSchema },
      },
    },
    async (request, reply) => {
      const [row] = await db
        .insert(conversations)
        .values({ userId: request.userId, lastMessageAt: sql`clock_timestamp()` })
        .returning();
      if (!row) throw new Error('conversation insert returned no row');
      return reply.code(201).send({ conversation: toConversation(row) });
    },
  );

  app.get(
    '/conversations/:id/messages',
    {
      schema: {
        params: conversationIdParamsSchema,
        querystring: listMessagesQuerySchema,
        response: { 200: listMessagesResponseSchema },
      },
    },
    async (request) => {
      const conversation = await findConversation(db, request.userId, request.params.id);
      const { limit } = request.query;
      const cursor = checkCursor(request.query.cursor);

      if (cursor) {
        const [anchor] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.id, cursor), eq(messages.conversationId, conversation.id)))
          .limit(1);
        if (!anchor) throw invalidCursor();
      }

      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            cursor
              ? sql`(${messages.createdAt}, ${messages.id}) < (
                  select m2.created_at, m2.id from messages m2 where m2.id = ${cursor}
                )`
              : undefined,
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      return {
        items: page.map(toMessage),
        nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
      };
    },
  );

  app.delete(
    '/conversations/:id',
    { schema: { params: conversationIdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw conversationNotFound();
      // Messages go with it (ON DELETE CASCADE).
      const deleted = await db
        .delete(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, request.userId)))
        .returning({ id: conversations.id });
      if (deleted.length === 0) throw conversationNotFound();
      return reply.code(204).send();
    },
  );

  /** Deletes every conversation of this user (Privacy settings). */
  app.delete('/conversations', async (request, reply) => {
    await db.delete(conversations).where(eq(conversations.userId, request.userId));
    return reply.code(204).send();
  });
}
