# 11 Eval

## Automated
- Shared checks.
- Unit tests: scheduling builds the right triggers for each enabled type and skips disabled ones. Editing cancels the old ones first. Each type gets the right `data.url`.

## On the phone (release build)
- Set the check-in reminder to 2 minutes from now, then kill the app. The notification arrives. Tapping it opens the app at the check-in on Today, after the session restores.
- With the app in the background: the tap routes correctly.
- The test notification arrives at once and opens the right screen.
- Custom reminder: add, edit time, delete. The schedule list (`getAllScheduledNotificationsAsync`, logged in perf mode) matches.
- Permission denied: the page explains it and links to system settings.
- Settings survive a restart, and `GET /me/settings` matches.
- Screenshots of the Reminders page (default, editing a time, a custom reminder) and the notification in the shade, light and dark.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
