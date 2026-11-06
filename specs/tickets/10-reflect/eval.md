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
