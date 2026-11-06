# 06 Eval

## API tests
- A check-in saves, awards XP once, and updates the streak.
- A mood outside 1–5 returns 400. A note over 280 characters returns 400.
- `/today` generates the line once per day: a second call doesn't call Gemini (mocked).
- When Gemini fails, the suggestion falls back to the handwritten list.
- With `personalize` off, no history goes into the prompt (asserted on the mocked call).

## On the phone (release build)
- Tap three moods quickly: one `mood_checkins` row with the last mood (`GET /checkins`). Sola's face follows each tap.
- The suggestion text updates after the save.
- Airplane mode: the tap still changes Sola, and it saves once the network returns.
- Day and night screenshots match the look from before this ticket.
- Mood-tap frame timer matches the latest numbers: at least 110 fps by day, no gap over 34 ms.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
