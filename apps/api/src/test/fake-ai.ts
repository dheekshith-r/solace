import { AiError, type AiClient, type AiPurpose, type JsonRequest, type StreamRequest } from '../ai/client';

type StreamHandler = (request: StreamRequest, attempt: number) => AsyncIterable<string>;
type JsonHandler = (request: JsonRequest) => unknown;

export const DEFAULT_REPLY = ['It sounds like ', 'the exam is sitting ', 'heavy on you tonight.'];

const DEFAULT_JSON: Record<AiPurpose, unknown> = {
  reply: null,
  classify: { mood: 2, suggested_action: 'breathe', title: 'Exam night nerves' },
  summary: { summary: 'They are anxious about an exam on Friday and slept badly.' },
  daily: {
    greeting: 'Asha, the exam worry from Tuesday evening sounded heavy. Go gently today.',
    affirmation: 'I can prepare one page at a time.',
    suggestion: { text: 'A slow minute of breathing could loosen that pre-exam tension.', action: 'breathe' },
  },
  suggestion: { text: 'A low evening again, so a slow exhale might help you settle.', action: 'breathe' },
  moves: {
    moves: [
      { text: 'Your evenings sound heaviest, so try two minutes of slow breathing after dinner.', action: 'breathe' },
      { text: 'Tell Sola about the exam worry that keeps coming back at night.', action: 'chat' },
      { text: 'Log a quick mood check-in tomorrow morning to see how the day starts.', action: 'checkin' },
    ],
  },
};

export async function* chunks(parts: string[], delayMs = 0): AsyncGenerator<string> {
  for (const part of parts) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield part;
  }
}

// eslint-disable-next-line require-yield
export async function* failing(error: AiError): AsyncGenerator<string> {
  throw error;
}

/** A stream that never produces anything (a stalled model). Stops when aborted. */
// eslint-disable-next-line require-yield
export async function* stalled(signal?: AbortSignal): AsyncGenerator<string> {
  await new Promise<void>((resolve) => {
    if (signal?.aborted) resolve();
    signal?.addEventListener('abort', () => resolve(), { once: true });
  });
  throw new AiError('aborted');
}

/**
 * A recording stand-in for the model provider. Tests assert on `calls` to see exactly what
 * would have been sent (prompts, models) and that nothing was sent at all.
 */
export function fakeAi(
  options: { stream?: StreamHandler; json?: Partial<Record<AiPurpose, JsonHandler>> } = {},
) {
  const calls = { stream: [] as StreamRequest[], json: [] as JsonRequest[] };

  const client: AiClient = {
    stream(request) {
      calls.stream.push(request);
      const attempt = calls.stream.length;
      return options.stream ? options.stream(request, attempt) : chunks(DEFAULT_REPLY);
    },
    async json(request) {
      calls.json.push(request);
      const handler = options.json?.[request.purpose];
      return handler ? handler(request) : DEFAULT_JSON[request.purpose];
    },
  };

  return {
    client,
    calls,
    jsonCalls: (purpose: AiPurpose) => calls.json.filter((call) => call.purpose === purpose),
    get callCount() {
      return calls.stream.length + calls.json.length;
    },
  };
}

export const unavailable = () => {
  throw new AiError('unavailable', 503);
};
