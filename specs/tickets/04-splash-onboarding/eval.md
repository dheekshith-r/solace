# 04 Eval

## Automated
- Shared checks.
- Unit tests:
  - The onboarding store persists the goal and reminder times.
  - Skip is hidden on step 1.
  - Next on the last step routes to sign-up.

## On the phone (release build, fresh install)
- Cold start screenshots at about 0.3 s, 1 s and 2 s: no grid icon anywhere. The splash shows Sola on the HIG background, light and dark.
- The splash hands off within 2.5 s, including with airplane mode on, where it still continues to onboarding.
- Screenshots of all 4 steps, light and dark.
- Swiping and Next both move between steps. Skip appears from step 2.
- Step 4: the pre-prompt shows first, then the system dialog.
  - Deny: the flow continues and reminders stay off.
  - Allow: reminders are saved in the store.
- Kill and reopen mid-onboarding: chosen values are kept.
- Back on step 1 exits; on later steps it goes back one step.
- Font scale 1.3× and reduce motion pass. The frame timer during the step swipe reads at least 110 fps.
