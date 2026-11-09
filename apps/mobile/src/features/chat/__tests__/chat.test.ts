import { HELPLINE, type Message } from '@solace/shared';
import { createUtf8Decoder, parseSse } from '../../../lib/sse';
import { threadReducer, type ThreadItem } from '../thread';

const helpline = { name: 'Tele-MANAS', number: '14416', hours: '24x7', emergencyNumber: '112' };

describe('SSE parser', () => {
  it('handles events split across chunks, several per chunk, and heartbeats', () => {
    const wire = ': open\n\nevent: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\n: ping\n\nevent: done\ndata: {"messageId":"m1"}\n\n';
    const events = [];
    let buffer = '';
    // Feed it 7 characters at a time, so chunks cut through lines and JSON.
    for (let i = 0; i < wire.length; i += 7) {
      const parsed = parseSse(buffer + wire.slice(i, i + 7));
      events.push(...parsed.events);
      buffer = parsed.rest;
    }
    expect(events).toEqual([
      { event: 'delta', data: { text: 'Hel' } },
      { event: 'delta', data: { text: 'lo' } },
      { event: 'done', data: { messageId: 'm1' } },
    ]);
    expect(buffer).toBe('');
  });

  it('skips unknown and malformed events without stopping', () => {
    const { events } = parseSse('event: party\ndata: {}\n\nevent: delta\ndata: {not json\n\nevent: delta\ndata: {"text":"ok"}\n\n');
    expect(events).toEqual([{ event: 'delta', data: { text: 'ok' } }]);
  });

  it('decodes a multi-byte character split across chunks', () => {
    const bytes = new TextEncoder().encode('मन 🙂');
    const decode = createUtf8Decoder();
    const text = decode(bytes.slice(0, 4)) + decode(bytes.slice(4, 9)) + decode(bytes.slice(9), true);
    expect(text).toBe('मन 🙂');
  });
});

describe('conversation thread', () => {
  const start: ThreadItem[] = [];
  const sent = threadReducer(start, { type: 'send', key: 'l1', text: "I can't sleep" });

  it('shows the user message at once, then streams the reply into one bubble', () => {
    expect(sent.map((i) => [i.role, i.status])).toEqual([
      ['user', 'sending'],
      ['assistant', 'streaming'],
    ]);
    const streamed = ['That sounds ', 'exhausting.'].reduce((s, text) => threadReducer(s, { type: 'delta', text }), sent);
    const done = threadReducer(threadReducer(streamed, { type: 'meta', suggestedAction: 'breathe' }), { type: 'done', messageId: 'a1' });
    expect(done[1]).toMatchObject({ id: 'a1', text: 'That sounds exhausting.', status: 'done', suggestedAction: 'breathe' });
    expect(done[0]?.status).toBe('done');
  });

  it('replaces streamed text when a reply is stopped for safety', () => {
    const partial = threadReducer(sent, { type: 'delta', text: 'Partial' });
    const crisis = threadReducer(partial, { type: 'crisis', helpline, replace: true });
    const caring = threadReducer(crisis, { type: 'delta', text: "I'm really glad you told me." });
    expect(caring[1]).toMatchObject({ text: "I'm really glad you told me.", helpline });
  });

  const server = (id: string, role: 'user' | 'assistant', content: string, flaggedCrisis = false): Message => ({
    id,
    role,
    content,
    mood: null,
    suggestedAction: null,
    flaggedCrisis,
    createdAt: '2026-11-09T10:00:00Z',
  });

  it('the crisis card stays on its reply through the refetch after done, and on reopen', () => {
    const crisisSent = threadReducer([], { type: 'send', key: 'l9', text: "I don't want to be alive" });
    const replied = threadReducer(crisisSent, { type: 'delta', text: "I'm really glad you told me." });
    const flagged = threadReducer(replied, { type: 'crisis', helpline: HELPLINE, replace: false });
    const done = threadReducer(flagged, { type: 'done', messageId: 'a9' });
    // The server saved the user message flagged; the refetch must not drop the card.
    const saved = [server('u9', 'user', "I don't want to be alive", true), server('a9', 'assistant', "I'm really glad you told me.")];
    const refetched = threadReducer(done, { type: 'load', messages: saved });
    expect(refetched.find((i) => i.id === 'a9')?.helpline).toEqual(HELPLINE);
    // Reopening the chat (or an app restart) starts from the server's messages alone.
    const reopened = threadReducer([], { type: 'load', messages: saved });
    expect(reopened.find((i) => i.id === 'a9')?.helpline).toEqual(HELPLINE);
    expect(reopened.find((i) => i.id === 'u9')?.helpline).toBeUndefined();
  });

  it('exactly one user bubble while a refetch lands mid-stream, with stable keys after done', () => {
    const live = threadReducer([], { type: 'send', key: 'l2', text: 'hi' });
    // A new chat gets its id when the first message is sent, so the fetch can return it mid-stream.
    const midStream = threadReducer(live, { type: 'load', messages: [server('u2', 'user', 'hi')] });
    expect(midStream.filter((i) => i.role === 'user')).toHaveLength(1);
    const done = threadReducer(threadReducer(midStream, { type: 'delta', text: 'Hey.' }), { type: 'done', messageId: 'a2' });
    const reconciled = threadReducer(done, { type: 'load', messages: [server('u2', 'user', 'hi'), server('a2', 'assistant', 'Hey.')] });
    expect(reconciled.filter((i) => i.role === 'user')).toHaveLength(1);
    // Same keys as on screen, so React keeps the bubbles instead of remounting (no flicker).
    expect(reconciled.map((i) => i.key)).toEqual(done.map((i) => i.key));
  });

  it('keeps the user message on error and retries without losing it', () => {
    const failed = threadReducer(sent, { type: 'error', message: "Couldn't reach Solace.", userMessageId: 'u1' });
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ id: 'u1', text: "I can't sleep", status: 'error' });
    const retried = threadReducer(failed, { type: 'retry' });
    expect(retried.map((i) => [i.role, i.status])).toEqual([
      ['user', 'sending'],
      ['assistant', 'streaming'],
    ]);
  });
});
