# 12 Eval

## Automated
- Shared checks.
- Unit tests: constellation day mapping in the user's timezone; trend line points from check-ins; the Appearance resolver for each option and time.

## API
`GET /resources` returns 5 guides plus help. It's cached in the app and works offline after the first load.

## On the phone (release build)
- You tab with real data after a few check-ins and a breathing session: stars and trend match `GET /checkins`, and the streak matches `/me`.
- Each card opens its page. Back returns.
- Personalize off: the next chat request has no history, per the API log flag.
- Delete all chats: the Sola tab is empty, even after a restart.
- Delete account on a throwaway account: lands on onboarding, and logging in again fails.
- Appearance: each option changes the other screens immediately and survives a restart. Today is unaffected.
- Screenshots of You, Resources, a guide, Get help now, Privacy and Appearance, light and dark. The You tab is also shown empty for a brand-new user.
- Maestro full flow (spec section 10) passes on the phone.
