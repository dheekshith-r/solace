import type { Helpline, Message } from '@solace/shared';
import type { SuggestedAction } from '@solace/shared/types';

export type ThreadItem = {
  key: string;
  /** Server id once saved. The user message's id is needed to retry after an error. */
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'sending' | 'streaming' | 'done' | 'error';
  suggestedAction?: SuggestedAction | null;
  helpline?: Helpline;
  error?: string;
};

export type ThreadAction =
  | { type: 'load'; messages: Message[] }
  | { type: 'send'; key: string; text: string }
  | { type: 'delta'; text: string }
  | { type: 'meta'; suggestedAction: SuggestedAction }
  | { type: 'crisis'; helpline: Helpline; replace: boolean }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string; userMessageId?: string }
  | { type: 'retry' };

const REPLY_KEY = 'reply';

/** The conversation as shown: saved messages, then the live exchange. Pure, so it is unit-tested. */
export function threadReducer(items: ThreadItem[], action: ThreadAction): ThreadItem[] {
  switch (action.type) {
    case 'load': {
      // Keep any live exchange; replace the saved part.
      const live = items.filter((i) => i.status !== 'done');
      const saved: ThreadItem[] = action.messages.map((m) => ({
        key: m.id,
        id: m.id,
        role: m.role,
        text: m.content,
        status: 'done',
        suggestedAction: m.suggestedAction,
      }));
      return live.length ? [...saved, ...live] : saved;
    }
    case 'send':
      return [
        ...items.filter((i) => i.status === 'done'),
        { key: action.key, role: 'user', text: action.text, status: 'sending' },
        { key: REPLY_KEY, role: 'assistant', text: '', status: 'streaming' },
      ];
    case 'delta':
      return items.map((i) => (i.key === REPLY_KEY ? { ...i, text: i.text + action.text } : i));
    case 'meta':
      return items.map((i) => (i.key === REPLY_KEY ? { ...i, suggestedAction: action.suggestedAction } : i));
    case 'crisis':
      // The model's safety filter stopped a reply mid-stream: the caring reply replaces what was shown.
      return items.map((i) => (i.key === REPLY_KEY ? { ...i, helpline: action.helpline, text: action.replace ? '' : i.text } : i));
    case 'done':
      return items.map((i) =>
        i.key === REPLY_KEY ? { ...i, key: action.messageId, id: action.messageId, status: 'done' } : i.status === 'sending' ? { ...i, status: 'done' } : i,
      );
    case 'error':
      // The user message is kept (it is saved on the server); the empty reply is dropped.
      return items
        .filter((i) => !(i.key === REPLY_KEY && !i.text))
        .map((i) => (i.status === 'sending' ? { ...i, id: action.userMessageId ?? i.id, status: 'error', error: action.message } : i.key === REPLY_KEY ? { ...i, status: 'error' } : i));
    case 'retry':
      return [
        ...items.filter((i) => i.key !== REPLY_KEY).map((i) => (i.status === 'error' ? { ...i, status: 'sending' as const, error: undefined } : i)),
        { key: REPLY_KEY, role: 'assistant', text: '', status: 'streaming' },
      ];
  }
}
