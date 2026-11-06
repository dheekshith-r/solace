# 10 Eval

## API tests
- Score and band boundaries for each kind.
- Moves: three are returned, each with a valid action. Gemini failure falls back to the handwritten moves. `personalize` off sends no history.
- Crisis text in a note: the pre-check triggers and the response flags it.
- Activity is logged once per assessment. The streak counts the day once.

## On the phone (release build)
- Complete each of the three check-ins. Results show the band, the note, 14416 and three moves. Each move opens its activity.
- Answer all 3s: the lowest-band prompt is prominent, and the call button opens the dialer with 14416.
- Back mid-questions asks nothing and returns to the hub, discarding the answers.
- Screenshots of the hub, a question, each band's result and the lowest-band prompt, light and dark.
- Ddk has approved the question wording (recorded in `ticket.md`).

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
