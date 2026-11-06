# 06 Today connected

## Must do
- **API:** `POST /checkins`, `GET /checkins?days=`, `GET /today`, `POST /activities`.
  - `/today` returns:
    - `greeting`: Sola's daily line, generated once per day with Flash-Lite and cached.
    - `affirmation`, `lastMood`, `suggestion` (text and action) and `stats`.
  - Check-ins write `activity_log` and award XP.
  - The suggestion comes from Flash-Lite and falls back to a handwritten list.
- **App:**
  - A mood tap on Today saves through the API, after a 1.5 s debounce in which the last tap wins (decision 4). It is optimistic and retries quietly offline.
  - The suggestion sentence comes from `/today` or the check-in response, with the current text as the fallback.
  - The Breathe button opens Breathe once ticket 09 exists.
  - Today's look is unchanged.

## Files
- **API:** routes, AI client and prompts, shared schemas, and a migration adding `sola_line` to `daily_affirmations`.
- **App:** a small data hook in `src/features/today/`, plus minimal wiring in Today.

## Must not touch
Today's layout, styles and scene.

## Decisions
- Sola's daily line is the `greeting` field of `/today`. It's shown on the Sola tab (ticket 08), not on Today.
- Personal history is used only if `personalize` is true.
