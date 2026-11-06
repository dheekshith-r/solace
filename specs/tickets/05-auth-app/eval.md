# 05 Eval

## Automated
- Shared checks.
- Unit tests:
  - api wrapper: a 401 triggers one refresh, the retry succeeds, and two parallel 401s share one refresh. A failed refresh logs out.
  - A timeout yields an offline error within the configured time.
  - Form validation messages.

## On the phone (release build, real Render API)
- Fresh install: onboarding, then sign up with a new email, lands on Today. A row exists in Supabase `users` with goal and timezone, and `user_settings` holds the reminders. Ddk checks the table, or `GET /me` shows it.
- Without the 18+ checkbox: Sign up stays disabled, with a clear message.
- Wrong password: inline error. Duplicate email: a friendly error.
- Kill and reopen: goes straight to Today with no login.
- Airplane mode at launch with a session: Today opens from cache. Turn the network on and the app recovers by itself.
- Log in on a fresh install with an existing account works.
- Log out (temporary button on the You placeholder): lands on onboarding. Kill and reopen stays logged out.
- Screenshots of Sign up and Log in: empty, filled, error and loading states, light and dark.
- The keyboard never covers the focused field, and Next on the keyboard moves between fields.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
