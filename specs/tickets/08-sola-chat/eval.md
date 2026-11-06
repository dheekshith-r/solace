# 08 Eval

## Automated
- Shared checks.
- Unit tests:
  - The SSE parser handles split chunks, multiple events per chunk and heartbeats.
  - Message list reducer: optimistic send, streaming append, done, error and retry.

## On the phone (release build, real API)
- Send "I couldn't sleep, exams tomorrow": the first words appear within about 1.5 s on a warm API, the reply streams smoothly, and a suggestion card shows. Tapping it opens Breathe.
- Frame timer while streaming and scrolling: at least 110 fps, no gap over 34 ms.
- Crisis phrase: the helpline card appears, and the call button opens the dialer with 14416.
- Airplane mode mid-send: an error row appears. Retry after reconnecting succeeds, and no message is lost.
- History: the conversation appears with its title. Continue it. Swipe delete, then confirm: it's gone after a restart too.
- The keyboard never covers the input. Back closes the keyboard, then the conversation.
- Screenshots of Sola tab (loading, empty, list) and conversation (empty with chips, streaming, suggestion, crisis, error), light and dark.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
