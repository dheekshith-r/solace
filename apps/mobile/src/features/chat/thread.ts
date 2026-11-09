import { HELPLINE, type Helpline, type Message } from '@solace/shared';
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
      const all = action.messages;
      const shown = items.filter((i) => i.status === 'done');
      // The card goes on the reply to a flagged message, or on the flagged message itself if no reply was saved.
      // Decided on the server's full list, before anything is set aside below.
      const crisisAt = (i: number) => {
        const m = all[i];
        if (!m) return false;
        if (m.role === 'assistant') return m.flaggedCrisis || Boolean(all[i - 1]?.flaggedCrisis);
        return m.flaggedCrisis && all[i + 1]?.role !== 'assistant';
      };
      let live = items.filter((i) => i.status !== 'done');
      const skip = new Set<number>();
      // The server saves the user message before streaming, so a fetch mid-stream can return the live exchange.
      // Only messages beyond what is already on screen can be that copy, so a repeated "ok" never hides an older one.
      const liveUser = live.find((l) => l.role === 'user');
      if (liveUser) {
        // Aligned by the last on-screen id, not by count: the server returns a sliding window of the newest 50.
        const lastShown = Math.max(-1, ...shown.map((s) => (s.id ? all.findIndex((m) => m.id === s.id) : -1)));
        const from = lastShown >= 0 ? lastShown + 1 : shown.some((s) => s.id) ? all.length : shown.length;
        let at = liveUser.id ? all.findIndex((m) => m.id === liveUser.id) : -1;
        if (at < 0) at = all.findLastIndex((m, i) => i >= from && m.role === 'user' && m.content === liveUser.text);
        if (at >= 0) {
          // The server already has the reply too (the stream died after saving): its copy wins, with its crisis flag.
          if (all[at + 1]?.role === 'assistant') live = [];
          else skip.add(at);
        }
      }
      const used = new Set<string>();
      const saved: ThreadItem[] = [];
      all.forEach((m, i) => {
        if (skip.has(i)) return;
        // Reuse the key already on screen (by id, else a just-finished local bubble) so nothing remounts.
        const match = shown.find((s) => !used.has(s.key) && (s.id === m.id || (!s.id && s.role === m.role && s.text === m.content)));
        if (match) used.add(match.key);
        const helpline = crisisAt(i) || match?.helpline ? (match?.helpline ?? HELPLINE) : undefined;
        saved.push({ key: match?.key ?? m.id, id: m.id, role: m.role, text: m.content, status: 'done', suggestedAction: m.suggestedAction, ...(helpline ? { helpline } : null) });
      });
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
      // A reply that carries the crisis card is never dropped, even with no text yet.
      return items
        .filter((i) => !(i.key === REPLY_KEY && !i.text && !i.helpline))
        .map((i) => (i.status === 'sending' ? { ...i, id: action.userMessageId ?? i.id, status: 'error', error: action.message } : i.key === REPLY_KEY ? { ...i, status: 'error' } : i));
    case 'retry':
      return [
        ...items.filter((i) => i.key !== REPLY_KEY).map((i) => (i.status === 'error' ? { ...i, status: 'sending' as const, error: undefined } : i)),
        { key: REPLY_KEY, role: 'assistant', text: '', status: 'streaming' },
      ];
  }
}
