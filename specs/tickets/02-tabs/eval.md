# 02 Eval

## Automated
- Shared checks.
- Unit test: the pill's target position for each tab index.

## On the phone (release build)
- Screenshots of Today by day and by night: pixel layout matches before (`e-day.png`, `e-night.png`), apart from the clock.
- Tap Sola and then You: the pill slides with a spring, and a selection tick fires.
  - Frame timer during the switch: at least 110 fps, no gap over 34 ms.
- Back from Sola and from You returns to Today; back on Today exits. Check gesture and 3-button navigation.
- Leaving Today pauses the scene, so the frame callback stops, then it resumes on return.
- Memory: switch tabs 20 times. PSS returns to within 10 MB of the start.
- `solace://today?m=1380` still opens night.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
