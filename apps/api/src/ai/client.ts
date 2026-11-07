/**
 * The only file that talks to a model provider. Everything else uses the provider-neutral
 * `AiClient` interface, so swapping Gemini for another provider means rewriting this file only.
 * The API key stays here, on the server: it is never logged, returned or sent to the app.
 */
import { ApiError as GeminiApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';

/**
 * Model IDs, checked against the Gemini models list with the server key on Nov 6 2026.
 * `reply` streams Sola's chat replies; `lite` does classification, titles, summaries,
 * the daily line, affirmations and suggestions, and is the fallback for `reply`.
 */
export const MODELS = {
  reply: 'gemini-3.8-flash',
  lite: 'gemini-3.5-flash-lite',
} as const;

export type ModelRole = keyof typeof MODELS;

/**
 * Reply model policy (Ddk, Nov 6): when the primary answers 503 (overloaded) before the first
 * delta, try it again after each of these waits, then fall back to `lite`. A 429, other 5xx
 * errors and timeouts go to the fallback straight away.
 */
export const PRIMARY_503_BACKOFF_MS: readonly number[] = [400, 1_000];

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

/** What a call is for. Used in logs (never the content) and by tests to tell calls apart. */
export type AiPurpose = 'reply' | 'classify' | 'summary' | 'daily' | 'suggestion' | 'moves';

export type StreamRequest = {
  model: ModelRole;
  purpose: AiPurpose;
  system: string;
  turns: ChatTurn[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
};

export type JsonRequest = {
  model: ModelRole;
  purpose: AiPurpose;
  system: string;
  prompt: string;
  /** JSON Schema of the expected object. The result is still validated by the caller. */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  maxOutputTokens?: number;
};

export interface AiClient {
  /** Text chunks as the model generates them. Throws AiError. */
  stream(request: StreamRequest): AsyncIterable<string>;
  /** One JSON value (unvalidated). Throws AiError. */
  json(request: JsonRequest): Promise<unknown>;
}

/** A provider failure with the content stripped out: safe to log. */
export class AiError extends Error {
  constructor(
    readonly kind:
      | 'rate_limited'
      | 'unavailable'
      | 'timeout'
      | 'aborted'
      | 'rejected'
      | 'invalid_output'
      /** The provider's own safety filter blocked the prompt or the reply. */
      | 'blocked',
    readonly status?: number,
  ) {
    super(`AI call failed: ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'AiError';
  }

  /** 429, 5xx, timeouts and network failures are worth one more try on another model. */
  get retryable() {
    return this.kind === 'rate_limited' || this.kind === 'unavailable' || this.kind === 'timeout';
  }
}

export function toAiError(error: unknown, signal?: AbortSignal): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof GeminiApiError) {
    if (error.status === 429) return new AiError('rate_limited', 429);
    if (error.status >= 500) return new AiError('unavailable', error.status);
    return new AiError('rejected', error.status);
  }
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError') return new AiError('timeout');
  if (name === 'AbortError') {
    // AbortSignal.timeout() rejects with TimeoutError, but some fetch stacks rewrap it.
    const reason = signal?.reason as { name?: string } | undefined;
    return reason?.name === 'TimeoutError' ? new AiError('timeout') : new AiError('aborted');
  }
  // fetch network failures (DNS, reset) surface as TypeError.
  return new AiError('unavailable');
}

/** Finish reasons that mean the provider's safety filters stopped the output. */
const SAFETY_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

type ResponseLike = {
  text?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string }[];
};

/** True when Gemini refused: a blocked prompt, or a candidate stopped for safety. */
export function isSafetyBlock(response: ResponseLike): boolean {
  if (response.promptFeedback?.blockReason) return true;
  const reason = response.candidates?.[0]?.finishReason;
  return reason !== undefined && SAFETY_FINISH.has(reason);
}

const toContents = (turns: ChatTurn[]) =>
  turns.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.text }],
  }));

/**
 * Thinking kept as low as each model allows: replies must start fast (first delta under 1.5 s).
 * Flash-Lite accepts MINIMAL; 3.8 Flash rejects MINIMAL with a 400, so it gets LOW.
 */
const THINKING: Record<ModelRole, ThinkingLevel> = {
  reply: ThinkingLevel.LOW,
  lite: ThinkingLevel.MINIMAL,
};

export function createGeminiClient(apiKey: string): AiClient {
  // The SDK retries 5 times by default; the API has its own policy (one retry on Flash-Lite).
  const genai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });

  return {
    async *stream({ model, system, turns, signal, maxOutputTokens = 800 }) {
      let stream: AsyncGenerator<ResponseLike>;
      try {
        stream = await genai.models.generateContentStream({
          model: MODELS[model],
          contents: toContents(turns),
          config: {
            systemInstruction: system,
            maxOutputTokens,
            temperature: 0.8,
            thinkingConfig: { thinkingLevel: THINKING[model] },
            abortSignal: signal,
          },
        });
      } catch (error) {
        throw toAiError(error, signal);
      }
      try {
        for await (const chunk of stream) {
          if (isSafetyBlock(chunk)) throw new AiError('blocked');
          const text = chunk.text;
          if (text) yield text;
        }
      } catch (error) {
        throw toAiError(error, signal);
      }
    },

    async json({ model, system, prompt, schema, signal, maxOutputTokens = 400 }) {
      let text: string | undefined;
      try {
        const response = await genai.models.generateContent({
          model: MODELS[model],
          contents: prompt,
          config: {
            systemInstruction: system,
            maxOutputTokens,
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            thinkingConfig: { thinkingLevel: THINKING[model] },
            abortSignal: signal,
          },
        });
        if (isSafetyBlock(response)) throw new AiError('blocked');
        text = response.text;
      } catch (error) {
        throw toAiError(error, signal);
      }
      if (!text) throw new AiError('invalid_output');
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AiError('invalid_output');
      }
    },
  };
}

/** Used when no client is configured: every call fails, so every caller takes its fallback. */
export const unavailableAi: AiClient = {
  // eslint-disable-next-line require-yield
  async *stream() {
    throw new AiError('unavailable');
  },
  async json() {
    throw new AiError('unavailable');
  },
};
