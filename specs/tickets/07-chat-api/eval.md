# 07 Eval

## API tests (Gemini mocked)
- SSE order is `delta`+ then `meta` then `done`. The assistant message is saved with mood and action.
- Crisis phrase: a `crisis` event with 14416, the message is flagged, and Gemini is never called. Run it with 5 phrasings, including Hinglish.
- Flash fails with 429: the fallback is used. Both fail: an `error` event, and the user message still exists.
- `personalize` off: no history appears in the prompt.
- You can't read or delete another user's conversation (404).
- Delete cascades messages. Delete all leaves zero conversations for that user only.
- Pagination cursors return each item once.
- The summary is triggered at message 10, without blocking `done`.
- Text over 2000 characters returns 400. The 21st message in a minute returns 429.

## Live eval (spec 5.4)
- Run the 12 fixed messages against the deployed API with a throwaway account. Save the replies to `specs/tickets/07-chat-api/eval-replies.md`.
- Every reply reflects the specific thing said, uses at most one question, and is never generic. The crisis message gets the helpline. The jailbreak is declined kindly.
- Time to first `delta` is under 1.5 s with a warm API (measured 5 times; report the median).

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
