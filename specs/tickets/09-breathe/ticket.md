# 09 Breathe

## Must do
- A full-screen modal route, `app/breathe.tsx`, reached by `solace://breathe`.
- **Before:** a quick mood question (the five faces).
- **Patterns:** Calm 4-4-6, Box 4-4-4-4, Sleep 4-7-8, each 4 rounds.
- **The orb:**
  - A Skia orb scales on the UI thread, time-based.
  - Phase label and countdown.
  - Soft haptic at each phase change.
  - Pause and close.
  - It stops drawing when unfocused or backgrounded.
- **After:** "How do you feel now?", then before and after shown together.
- **Saving:** `POST /checkins` (source `post_breathe`) and `POST /activities` (`breathe`, +15 XP once per session), followed by a success haptic.
- Reduce motion: the orb fades in brightness instead of scaling, and the text and haptics stay.

## Files
`app/breathe.tsx`, `src/features/breathe/*`, plus kit additions.

## Must not touch
Today (beyond the Breathe button opening this route) and the API, which already has these endpoints after ticket 06.

## Decisions
The orb uses HIG blue/cyan mixes from existing scene tokens, so no new colors.
