# 11 Notifications and Reminders

## Must do
Spec section 2.3:
- **Channels:** `checkin`, `affirmation`, `breathe`, `custom`.
- **Scheduling:** daily repeating local schedules. Inexact; no exact-alarm permission.
- **Copy:** each notification uses Sola's voice, the product names, and the user's context (the cached affirmation and recent mood).
- Each notification carries `data.url`. Tapping it routes after auth is ready, both while running and on cold start.
- **Reminders settings page:**
  - Toggle and time picker per type.
  - Custom reminders: add, edit, delete.
  - "Send a test notification".
  - Help text about battery optimization on Xiaomi phones.
- Any change cancels and reschedules everything. Settings are stored in MMKV and synced with `PUT /me/settings`.
- The onboarding reminder choices are applied after sign-up.

## Files
`src/features/notifications/*`, `app/settings/reminders.tsx`, `app/_layout.tsx` (notification router), plus kit additions.

## Must not touch
Today and the API (settings endpoints exist from ticket 03).

## Decisions
The time picker is a kit component built from Chips and a wheel of ListRows, so no new package. If that feels poor, ask Ddk about the native picker.
