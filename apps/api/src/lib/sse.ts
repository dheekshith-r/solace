import type { SseEventData, SseEventType } from '@solace/shared';
import type { FastifyReply } from 'fastify';

export const HEARTBEAT_MS = 15_000;

/**
 * Takes over the response and opens a Server-Sent Events stream. A comment line is written every
 * `heartbeatMs` so Render's proxy keeps the connection open while the model thinks.
 * `signal` aborts when the client goes away before the stream ends.
 */
export function openSse(reply: FastifyReply, { heartbeatMs = HEARTBEAT_MS } = {}) {
  reply.hijack();
  const raw = reply.raw;
  const controller = new AbortController();
  let ended = false;

  raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    // Disables proxy buffering (nginx-style proxies honour it).
    'x-accel-buffering': 'no',
    'x-content-type-options': 'nosniff',
  });
  // Send the headers and a first byte now, so Render and Cloudflare start streaming at once
  // instead of waiting for the first model token.
  raw.flushHeaders();
  raw.write(': open\n\n');

  const write = (chunk: string) => {
    if (ended || raw.destroyed || raw.writableEnded) return;
    raw.write(chunk);
  };

  const heartbeat = setInterval(() => write(': ping\n\n'), heartbeatMs);
  heartbeat.unref();

  raw.on('close', () => {
    clearInterval(heartbeat);
    if (!ended) {
      ended = true;
      controller.abort();
    }
  });

  return {
    signal: controller.signal,
    get closed() {
      return ended;
    },
    send<K extends SseEventType>(event: K, data: SseEventData[K]) {
      write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      clearInterval(heartbeat);
      if (ended) return;
      ended = true;
      if (!raw.writableEnded) raw.end();
    },
  };
}

export type SseStream = ReturnType<typeof openSse>;
