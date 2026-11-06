import {
  conversationResponseSchema,
  listConversationsResponseSchema,
  listMessagesResponseSchema,
  type Helpline,
  type ListMessagesResponse,
  type Message,
  type SseEvent,
} from '@solace/shared';
import { fetch as streamingFetch } from 'expo/fetch';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ApiError, OFFLINE_MESSAGE } from '../../lib/http';
import { queryClient } from '../../lib/queryClient';
import { createUtf8Decoder, parseSse } from '../../lib/sse';
import { authed, refreshSession, useSession } from '../auth/session';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const CONVERSATIONS_KEY = ['conversations'] as const;
export const messagesKey = (id: string) => ['messages', id] as const;
const FIRST_WORD_TIMEOUT_MS = 20_000; // Render may be waking; the server itself falls back after 6 s.

export function useConversations() {
  const signedIn = useSession((s) => Boolean(s.user));
  return useInfiniteQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: ({ pageParam }) => authed(`/conversations${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: listConversationsResponseSchema }),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

/** Messages oldest first, for display. The API pages newest first. */
export function useMessages(id: string) {
  return useQuery({
    queryKey: messagesKey(id),
    queryFn: async () => {
      const page = await authed(`/conversations/${id}/messages?limit=50`, { schema: listMessagesResponseSchema });
      return { ...page, items: [...page.items].reverse() } satisfies ListMessagesResponse;
    },
    enabled: Boolean(id) && id !== 'new',
  });
}

export async function createConversation(): Promise<string> {
  const { conversation } = await authed('/conversations', { method: 'POST', body: {}, schema: conversationResponseSchema });
  void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
  return conversation.id;
}

export async function deleteConversation(id: string): Promise<void> {
  await authed(`/conversations/${id}`, { method: 'DELETE' });
  queryClient.removeQueries({ queryKey: messagesKey(id) });
  await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
}

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onMeta: (meta: Extract<SseEvent, { event: 'meta' }>['data']) => void;
  onCrisis: (helpline: Helpline, replace: boolean) => void;
  onDone: (messageId: string) => void;
  onError: (message: string, code: string) => void;
};

/**
 * Sends a message and streams Sola's reply. Calls exactly one of onDone or onError at the end.
 * Returns an abort function (leaving the screen stops the stream).
 */
export function sendMessage(conversationId: string, body: { text: string; retryOf?: string }, handlers: StreamHandlers): () => void {
  const controller = new AbortController();
  let finished = false;
  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    fn();
  };

  const open = async (token: string) =>
    streamingFetch(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

  void (async () => {
    const firstWord = setTimeout(() => {
      controller.abort();
      finish(() => handlers.onError(OFFLINE_MESSAGE, 'timeout'));
    }, FIRST_WORD_TIMEOUT_MS);
    try {
      let response = await open(useSession.getState().accessToken ?? (await refreshSession()));
      if (response.status === 401) response = await open(await refreshSession());
      if (!response.ok || !response.body) {
        clearTimeout(firstWord);
        const parsed = await response.json().catch(() => null);
        const message = (parsed as { error?: { message?: string } } | null)?.error?.message ?? OFFLINE_MESSAGE;
        finish(() => handlers.onError(message, String(response.status)));
        return;
      }
      const reader = response.body.getReader();
      const decode = createUtf8Decoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decode(value);
        const { events, rest } = parseSse(buffer);
        buffer = rest;
        for (const e of events) {
          clearTimeout(firstWord);
          if (e.event === 'delta') handlers.onDelta(e.data.text);
          else if (e.event === 'meta') handlers.onMeta(e.data);
          else if (e.event === 'crisis') handlers.onCrisis(e.data.helpline, Boolean(e.data.replace));
          else if (e.event === 'done') finish(() => handlers.onDone(e.data.messageId));
          else finish(() => handlers.onError(e.data.message, e.data.code));
        }
      }
      clearTimeout(firstWord);
      finish(() => handlers.onError(OFFLINE_MESSAGE, 'closed'));
    } catch (error) {
      clearTimeout(firstWord);
      if (controller.signal.aborted && finished) return;
      finish(() => handlers.onError(error instanceof ApiError ? error.message : OFFLINE_MESSAGE, 'offline'));
    } finally {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }
  })();

  return () => {
    finished = true;
    controller.abort();
  };
}

export type { Message };
