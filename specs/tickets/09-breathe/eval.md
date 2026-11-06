# 09 Eval

## Automated
- Shared checks.
- Unit tests:
  - Phase timeline for each pattern (durations and order); the total is 4 rounds.
  - XP is requested only once per session.

## On the phone (release build)
- Time a full Calm session: phase changes land within 100 ms of 4/4/6 s, and a haptic fires on each.
- Frame timer through a full session: at least 110 fps, no gap over 34 ms. Memory is flat.
- Background mid-session and return: it resumes or pauses cleanly, without jumping.
- Finish: before and after are shown. `GET /checkins` includes a `post_breathe` row, and XP rose by 15 exactly once.
- Opens from Today's Breathe button and from a chat suggestion card. Back closes it.
- Screenshots of the mood before, each pattern mid-phase, and the result, light and dark. Reduce motion recorded too.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
