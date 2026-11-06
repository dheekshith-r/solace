# 12 You tab and remaining pages

## Must do
- **You tab:**
  - Constellation: one star per active day, last 5 weeks (decision 7).
  - Mood trend: a simple SVG line over the last 14 days.
  - Streak, level and XP.
  - Cards to Breathe, Reflect, Resources and Settings.
- **Settings:** Reminders, Privacy and data, Appearance and Log out.
- **Resources:**
  - 5 guides: Mindfulness 101; Anxiety toolkit, with 5-4-3-2-1 grounding; Beating the blues; Self-esteem reset; Sleep wind-down.
  - Get help now: Tele-MANAS 14416 with a call button.
  - The "not a substitute for professional care" note.
  - Content comes from `GET /resources`, cached.
- **Guide detail:** readable long text with the large-title header.
- **Privacy and data:**
  - Personalize toggle (`PATCH /me`).
  - Delete all chats (`DELETE /conversations`), with confirm.
  - Delete account (`DELETE /me`), with a typed confirm.
  - The Gemini data notice and the "not a substitute" note.
- **Appearance:** Sky (default: time of day drives light or dark), Follow system, Always light or Always dark. Applies to every screen except Today, which always follows the sky.

## Files
- **App:** `app/(tabs)/you.tsx`, `app/resources/*`, `app/settings/*`, `src/features/you/*`, plus kit additions.
- **API:** `GET /resources` with static JSON.

## Must not touch
Today.
