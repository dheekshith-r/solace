# 07 Chat API (backend only)

## Must do
Spec sections 2.1, 4 and 5:
- **Conversation routes:** `GET /conversations`, `POST /conversations`, `GET /conversations/:id/messages`, `DELETE /conversations/:id`, and `DELETE /conversations` (deletes all, for Privacy).
- **`POST /conversations/:id/messages`** streams SSE: `delta`, `meta`, `crisis`, `done`, `error`.
- **Safety pre-check** in `src/ai/safety.ts`:
  - A curated list of self-harm and suicide phrases, including common Hinglish ones.
  - On a hit: a fixed caring reply, a `crisis` event with Tele-MANAS 14416, and the message flagged. Gemini is never called.
- **Context:** system prompt, profile, last 3 moods, latest assessment, summary and last 12 messages. History only when `personalize` is true.
- **Models:**
  - `gemini-3.8-flash` streams the reply. On a 429 or 5xx it retries once on Flash-Lite, then sends an `error` event. The user message is never lost.
  - Flash-Lite classifies `{mood, suggested_action, title}` after the reply.
  - A summary is generated every 10 messages, in the background.
  - All model calls go through `src/ai/client.ts`.
- The prompt follows spec 5.1. It's written in `src/ai/prompts.ts`.
- Rate limit: 20 messages per minute per user.

## Files
`apps/api/**` and `packages/shared/**` only.

## Must not touch
`apps/mobile`.

## Decisions
- Check the exact model IDs against the Gemini models list using the server key, without printing the key. If the spec's names differ, use the closest current Flash and Flash-Lite and tell Ddk.
- `@google/genai` is listed in the spec.
- SSE heartbeats every 15 s keep Render's proxy from closing the stream.
