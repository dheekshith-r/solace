import { SSE_EVENT_TYPES, sseEventDataSchemas, type SseEvent } from '@solace/shared';

/**
 * Splits a growing SSE text buffer into complete events and the unfinished remainder.
 * Heartbeats and comments (lines starting with ":") are skipped; unknown or malformed events are dropped.
 * Pure, so streaming edge cases are testable: chunks can split anywhere, even inside a line.
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let type = '';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') type = value;
      else if (field === 'data') data.push(value);
    }
    if (!(SSE_EVENT_TYPES as readonly string[]).includes(type)) continue;
    try {
      const schema = sseEventDataSchemas[type as SseEvent['event']];
      const parsed = schema.safeParse(JSON.parse(data.join('\n')));
      if (parsed.success) events.push({ event: type, data: parsed.data } as SseEvent);
    } catch {
      // Malformed JSON: skip this event, keep the stream going.
    }
  }
  return { events, rest };
}

/** UTF-8 decoding that survives multi-byte characters split across chunks (Hindi, emoji). */
export function createUtf8Decoder(): (chunk: Uint8Array, final?: boolean) => string {
  if (typeof TextDecoder !== 'undefined') {
    const decoder = new TextDecoder('utf-8');
    return (chunk, final = false) => decoder.decode(chunk, { stream: !final });
  }
  let pending: number[] = [];
  return (chunk, final = false) => {
    const bytes = [...pending, ...chunk];
    pending = [];
    // Hold back an incomplete trailing sequence until the next chunk.
    let end = bytes.length;
    for (let back = 1; back <= Math.min(3, bytes.length); back += 1) {
      const b = bytes[bytes.length - back] as number;
      if ((b & 0xc0) !== 0x80) {
        const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
        if (need > back && !final) end = bytes.length - back;
        break;
      }
    }
    pending = bytes.slice(end);
    return decodeURIComponent(
      bytes
        .slice(0, end)
        .map((b) => `%${b.toString(16).padStart(2, '0')}`)
        .join(''),
    );
  };
}
