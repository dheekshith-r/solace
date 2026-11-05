# Solace AI: build spec

The single source of truth for building Solace. CLAUDE.md holds the working rules; this file holds what to build and how.
Verified against vendor pages on Nov 5, 2026. Anything marked **verify** must be checked with the real tool (`npx expo-doctor`, the package's README) before relying on it.

---

## 0. Final decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| Mobile framework | Expo SDK 58 (React Native 0.88, New Architecture, Hermes V1) | Required by the brief. SDK 58 went stable Oct 15, 2026, and RN 0.88 includes the Hermes fix for the Reanimated memory regression in SDK 56/57. R8 is on by default in release builds, which shrinks the APK. |
| Dev loop | Development build (`expo-dev-client`) on a real Android phone | The SDK 58 Expo Go app is not in the stores yet, and native modules (MMKV, notifications) need a dev build anyway. Android Studio is already installed on the laptop. |
| Language | TypeScript strict everywhere | One type system from DB to screen. |
| Repo shape | One repo, three parts: `apps/mobile`, `apps/api`, `packages/shared` (npm workspaces) | Zod schemas in `shared` validate API input on the server and type responses in the app, so the contract can't drift. |
| Backend | Node 22 LTS + Fastify 5 + TypeScript | Fast, schema-first, first-class streaming. |
| Database | PostgreSQL on Supabase (free tier), Drizzle ORM, `postgres` (postgres.js) driver | Real relational data (users, chats, check-ins). Drizzle is light and typed. Supabase is used only as hosted Postgres, not for its auth. |
| Auth | Own email/password auth: argon2id hashes, short JWT access token + rotating refresh token | Shows real backend skill, which the brief scores. No vendor lock-in. |
| AI | Gemini API from the backend only: `gemini-3.8-flash` for replies, `gemini-3.5-flash-lite` for classification, titles, summaries, affirmations | Free tier, fast. The key never ships in the APK. |
| Streaming | Server-Sent Events from Fastify, read in the app with `expo/fetch` streaming | Words appear as they're generated, which matters more for perceived speed than raw latency. **Verify** `expo/fetch` `ReadableStream` support in SDK 58; fallback is `react-native-sse`. |
| Hosting | Render free web service + free UptimeRobot (or cron-job.org) ping every 10 minutes | Render free sleeps after 15 min idle and takes about a minute to wake. One always-on service fits in the 750 free hours a month. If budget allows, the $7 plan removes the sleep entirely. |
| Bottom sheets | expo-router `presentation: "formSheet"` or `"modal"` (native) first; small custom Reanimated sheet only if needed | `@gorhom/bottom-sheet` support for RN 0.88 is unconfirmed. Native screens are lighter anyway. |
| Graphics | `@shopify/react-native-skia` for hero visuals (the living sky, Sola, breathing orb); `react-native-svg` for simple icons and glyphs | Size is no longer a constraint; Skia draws on the GPU, so it looks premium without hurting smoothness. **Verify** RN 0.88 support in Phase 0. |
| Not used | expo-blur (Skia blur replaces it), Lottie (no designer-made files), UI kits, Sentry, Firebase, Google/Apple sign-in, push server | Risk or no payoff in 4 days. |

---

## 0.1 Product concept

**Must-have:**
- **Sola speaks on the Today screen.** A specific line based on the user's recent mood and chats, not a static greeting.
- **One connected loop.** Chat, the mood check-in and breathing connect through Sola's suggestion cards, so each activity leads naturally to the next.
- **Before and after mood.** After an activity, show the mood before and after it.
- **Notifications in Sola's voice.** Written using the user's context, not generic reminders.

**Stretch:**
- **"What Sola remembers" screen.** Users can view and delete memories.
- **Weekly letter from Sola.**

---

## 1. Full stack

### 1.1 Mobile (`apps/mobile`)

| Package | Purpose |
|---|---|
| `expo` 58, `react-native` 0.88, `react` 19.x | Core (versions pinned by `npx expo install`) |
| `expo-router` | File-based navigation, typed routes, deep links (`solace://`) |
| `react-native-screens`, `react-native-safe-area-context` | Native stack screens, safe areas (edge-to-edge is mandatory on Android) |
| `react-native-reanimated` 4 + `react-native-worklets` | All animation on the UI thread. Worklets Bundle Mode stays off: it is marked unstable, and RN 0.88 already includes the Hermes memory fix. |
| `react-native-gesture-handler` | Swipe-to-delete on chat history, press gestures |
| `@shopify/react-native-skia` | The living sky and Sola on Today, breathing orb (GPU) |
| `react-native-svg` | Progress ring, mood glyphs, simple icons |
| `@shopify/flash-list` (v2) | Chat thread, chat history, resources |
| `expo-image` | Images (WebP only) |
| `@tanstack/react-query` + persister | Server state, caching, optimistic updates |
| `zustand` | Small client state (session, onboarding progress, UI flags) |
| `react-native-mmkv` | Fast storage: query cache persistence, prefs, notification settings |
| `expo-secure-store` | Refresh token only |
| `expo-notifications` | Local scheduled reminders, channels, tap handling |
| `expo-haptics` | Haptic feedback map (section 7.5) |
| `expo-font` + `@expo-google-fonts/plus-jakarta-sans` | One family: 400, 600, 700 |
| `expo-splash-screen`, `expo-system-ui`, `expo-status-bar` | Native splash handoff, background color, status bar |
| `expo-linear-gradient` | Soft background washes only |
| `expo-device`, `expo-constants` | Lite-mode detection (RAM), app version |
| `expo-build-properties` | `buildArchs: ["arm64-v8a"]`, release tuning |
| `react-native-keyboard-controller` | Chat input that rides the keyboard smoothly |
| `zod` (via `packages/shared`) | Response validation |
| `lucide-react-native` | Icons (import individual icons only) |
| `expo-dev-client` | Dev builds |

Dev tooling: `typescript`, `eslint` (expo config), `prettier`, `jest-expo` + `@testing-library/react-native` (unit), Maestro (end-to-end flows on the phone).

### 1.2 Backend (`apps/api`)

| Package | Purpose |
|---|---|
| `fastify` 5 | HTTP server, SSE streaming |
| `fastify-type-provider-zod` | Request/response validation from shared Zod schemas |
| `@fastify/rate-limit` | Per-IP and per-user limits (protects the Gemini quota) |
| `@fastify/helmet`, `@fastify/sensible` | Safe headers, HTTP errors |
| `drizzle-orm` + `drizzle-kit` + `postgres` | Typed queries, migrations |
| `@node-rs/argon2` | Password hashing (prebuilt binaries, no compile step on Render) |
| `jose` | JWT sign and verify |
| `@google/genai` | Gemini SDK |
| `pino` (built into Fastify) | Structured logs |
| `vitest` + Fastify `inject` | API tests against a test database |
| `tsx`, `tsup` | Dev runner, production bundle |

### 1.3 Shared (`packages/shared`)

Zod schemas and inferred types for every request and response, the mood scale, suggested-action enum, notification types, and deep-link route map. Both apps import from here.

### 1.4 Infrastructure and accounts (owner: Ddk)

| Service | Used for | Free-tier note |
|---|---|---|
| GitHub (private repo) | Code, Render deploys from it | — |
| Supabase | Postgres | Use the pooler URL in transaction mode (port 6543) with `prepare: false` in postgres.js. **Verify** current inactivity-pause policy and keep the project active. |
| Render | API hosting | Sleeps after 15 min idle; keep warm with a pinger hitting `GET /health` every 10 min |
| UptimeRobot or cron-job.org | Keep-warm ping | Free |
| Google AI Studio | Gemini API key | Free tier: prompts may be used by Google and read by reviewers. Billing on = not used. |
| Expo (EAS) | APK builds | Free tier has a build queue; local `./gradlew assembleRelease` is the fallback |

---

## 2. Architecture

```
Android app (Expo)
  ├─ UI: expo-router screens, Reanimated, SVG
  ├─ Data: TanStack Query  ──►  MMKV cache (instant cold start)
  ├─ Auth: access token in memory, refresh token in SecureStore
  └─ Notifications: scheduled locally on the phone (no server)
        │  HTTPS (JSON + SSE)
        ▼
Fastify API on Render  ──►  Postgres on Supabase
        │
        └──►  Gemini API (3.8 Flash replies, 3.5 Flash-Lite helpers)
```

### 2.1 Chat message flow

1. App sends `POST /conversations/:id/messages` with `{ text }`. Optimistic user bubble appears instantly; mascot switches to "listening", then "thinking".
2. Server saves the user message.
3. **Safety pre-check** (sync, under 5 ms): regex over a curated list of self-harm and suicide phrases. On a hit, the server skips normal generation, streams a fixed caring reply, and sends a `crisis` event; the app shows the helpline card (Tele-MANAS 14416). The message is flagged in the DB.
4. Context assembly: system prompt + user profile (name, goal) + last 3 mood check-ins + latest check-in score + rolling conversation summary + last 12 messages. Personal history is included only if `personalize = true`.
5. Stream `gemini-3.8-flash` tokens to the app as SSE `delta` events.
6. On finish: save the assistant message, then call `gemini-3.5-flash-lite` with structured output `{ mood, suggested_action, title? }`. Send an SSE `meta` event; the app animates in the suggestion card and updates the mascot's expression.
7. Every 10 messages, regenerate the conversation summary with Flash-Lite (background, non-blocking).
8. On a 429 or 5xx from 3.8 Flash: retry once on 3.5 Flash-Lite. If both fail, send an `error` event and show a calm retry row. The user message is never lost.

SSE event types: `delta {text}`, `meta {mood, suggestedAction, title}`, `crisis {helpline}`, `done {messageId}`, `error {code, message}`.

### 2.2 Auth flow

- Sign up: email, password (min 8), name, `isAdult` checkbox (required; Gemini's terms forbid apps aimed at under-18s). Password hashed with argon2id.
- Tokens: access JWT (15 min, HS256, `sub` = user id), refresh token (random 32 bytes, stored hashed in `refresh_tokens`, 30 days, rotated on every refresh; reuse of an old one revokes the whole family).
- App: access token lives in memory (Zustand), refresh token in SecureStore. A single-flight refresh runs on any 401, then the original request is retried once.
- Launch: if a refresh token exists, refresh silently behind the splash, then route to Today; otherwise onboarding.
- Logout revokes the refresh token server-side and clears MMKV.

### 2.3 Notification flow

- Permission asked in onboarding on the reminders step, with a pre-prompt explaining why (Android 13+ needs `POST_NOTIFICATIONS`).
- Android channels: `checkin`, `affirmation`, `breathe`, `custom`, each with its own importance.
- Scheduling: daily repeating triggers at the user's chosen times. These are inexact on Android, which is fine for reminders; do not request the exact-alarm permission.
- Each notification carries `data.url` (for example `solace://checkin`). Tap handling uses `addNotificationResponseReceivedListener` while running and `getLastNotificationResponseAsync()` on cold start, then routes with expo-router after auth is ready.
- Settings changes reschedule everything (cancel all, schedule enabled ones). Settings are stored in MMKV and synced to `PUT /me/settings`.
- Copy is gentle and varied, and uses the product names consistently: "mood check-in" for the quick one on Today, "Reflect" for the hub. The daily affirmation notification uses the day's cached affirmation text.

---

## 3. Data model (Postgres, Drizzle)

All ids are `uuid` (default `gen_random_uuid()`), all timestamps `timestamptz` default `now()`.

**users**: id, email (unique, lowercased), password_hash, name, goal (`calm` \| `sleep` \| `focus` \| `confidence` \| `connection`), is_adult (bool), personalize (bool, default true), xp (int, default 0), timezone (text), created_at.

**refresh_tokens**: id, user_id → users (cascade), token_hash, family_id, expires_at, revoked_at (nullable), created_at. Index on token_hash.

**mood_checkins**: id, user_id → users (cascade), mood (smallint 1–5), note (text, nullable, max 280), source (`home` \| `post_breathe` \| `chat`), created_at. Index on (user_id, created_at desc).

**assessments**: id, user_id → users (cascade), kind (`mood` \| `anxiety` \| `self_talk`), answers (jsonb), score (smallint), band (`steady` \| `stretched` \| `strained`), moves (jsonb), created_at. Stores results from Reflect. The `kind` and `moves` columns arrive with a migration in Phase 5.

**conversations**: id, user_id → users (cascade), title (text, nullable), summary (text, nullable), last_message_at, message_count (int), created_at. Index on (user_id, last_message_at desc).

**messages**: id, conversation_id → conversations (cascade), role (`user` \| `assistant`), content (text), mood (smallint, nullable), suggested_action (`breathe` \| `reflect` \| `affirmation` \| `checkin` \| `none`, nullable), flagged_crisis (bool, default false), created_at. Index on (conversation_id, created_at).

**activity_log**: id, user_id → users (cascade), kind (`breathe` \| `checkin` \| `assessment` \| `reflection`), meta (jsonb), xp_awarded (int), created_at. Feeds streaks and XP.

**daily_affirmations**: user_id, date (date), text, primary key (user_id, date). One generated per user per day.

**user_settings**: user_id (pk) → users, reminders (jsonb: `{ checkin: {on, time}, affirmation: {...}, breathe: {...}, custom: [{id, label, time, on}] }`), updated_at.

Derived (computed in queries, not stored): current streak = consecutive local days with any activity_log row; level = floor(xp / 100) + 1.

Deleting a conversation is a real `DELETE` (messages cascade). Deleting the account cascades everything.

---

## 4. API contract

Base URL from `EXPO_PUBLIC_API_URL`. JSON everywhere except the SSE stream. Errors: `{ error: { code, message } }` with proper status codes. All routes except auth and health require `Authorization: Bearer <access>`.

| Method and path | Body | Returns |
|---|---|---|
| `GET /health` | — | `{ ok: true }` (pinger target) |
| `POST /auth/signup` | `{ email, password, name, isAdult }` | `{ user, accessToken, refreshToken }` |
| `POST /auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST /auth/logout` | `{ refreshToken }` | `204` |
| `GET /me` | — | `{ user, stats: { xp, level, streak, xpToNext } }` |
| `PATCH /me` | `{ name?, goal?, personalize?, timezone? }` | `{ user }` |
| `DELETE /me` | — | `204` |
| `GET /me/settings` / `PUT /me/settings` | `{ reminders }` | `{ reminders }` |
| `GET /today` | — | `{ greeting, affirmation, lastMood, suggestion, stats }` (one call powers Today) |
| `POST /checkins` | `{ mood, note?, source }` | `{ checkin, xpAwarded, stats, suggestion }` |
| `GET /checkins?days=30` | — | `{ items: [...] }` |
| `POST /assessments` | `{ kind, answers }` | `{ assessment, moves }` (three AI-written moves, each with an action) |
| `POST /activities` | `{ kind, meta }` | `{ xpAwarded, stats }` |
| `GET /conversations?cursor=` | — | `{ items: [{ id, title, preview, lastMessageAt }], nextCursor }` |
| `POST /conversations` | `{}` | `{ conversation }` |
| `GET /conversations/:id/messages?cursor=` | — | `{ items, nextCursor }` |
| `POST /conversations/:id/messages` | `{ text }` (1–2000 chars) | SSE stream (section 2.1) |
| `DELETE /conversations/:id` | — | `204` |
| `GET /resources` | — | static JSON bundled in the API (and cached in the app) |

Rate limits: auth 10/min per IP; messages 20/min per user; everything else 120/min per user.

---

## 5. AI design

### 5.1 Companion: Sola

Personality: warm, unhurried, curious, a little playful when the user is light, never preachy. Talks like a kind friend who listens well, not a therapist and not a cheerleader.

System prompt rules (Opus writes the final prompt in `apps/api/src/ai/prompts.ts`):
- Reflect the specific thing the user said before offering anything. No generic motivation ("You've got this!").
- Two to four short sentences by default; longer only if the user writes long.
- Ask at most one question per reply.
- Suggest an activity only when it fits, and name why ("your chest feels tight, so a slow exhale could help").
- Use remembered context lightly and naturally; never recite it.
- Never diagnose, never give medical advice, never claim to be human.
- Crisis language: drop the casual tone, respond with care, encourage reaching out to Tele-MANAS (14416) or someone they trust, and stay with them.
- Language: reply in the user's language.

### 5.2 Structured classification (Flash-Lite, JSON schema)

```json
{ "mood": 1-5, "suggested_action": "breathe|reflect|affirmation|checkin|none", "title": "max 5 words, only on first exchange" }
```

### 5.3 Other AI uses (all Flash-Lite, all cached)

- Daily affirmation: generated once per user per day from goal + recent mood; fallback list of 30 handwritten ones.
- Check-in suggestion: after a mood check-in, one sentence suggestion + action.
- Reflect moves: three wellness moves for this user from their result, recent moods and chats, each mapped to an activity.
- Conversation summary: max 80 words, facts and feelings only.

### 5.4 Evaluation before demo

A fixed set of 12 test messages (anxious about exams, can't sleep, fought with a friend, had a good day, lonely, angry, numb, a vague "idk", a long rant, Hinglish, one crisis phrase, one jailbreak attempt). Run them, read every reply, tune the prompt until none are generic.

---

## 6. App structure

```
apps/mobile/
  app/
    _layout.tsx               root: fonts, query client, auth gate, notification router
    index.tsx                 redirect based on session
    (onboarding)/             welcome, how-it-works, meet-sola, goal, reminders
    (auth)/                   sign-up, log-in
    (tabs)/_layout.tsx        custom floating tab bar
    (tabs)/today.tsx
    (tabs)/sola/index.tsx     chat history list
    (tabs)/sola/[id].tsx      conversation
    (tabs)/you.tsx            progress, streak calendar, settings entry
    breathe.tsx               full-screen modal
    checkin.tsx               form-sheet modal (mood + note)
    reflect/                  hub, one question at a time in the sky, results
    resources/index.tsx, resources/[slug].tsx
    settings/reminders.tsx, settings/privacy.tsx
  src/
    theme/ tokens.ts, typography.ts, motion.ts, haptics.ts
    components/ Screen, Text, Card, Button, Pill, Mascot, MoodPicker, ProgressRing, TabBar, Skeleton, Toast
    features/ auth/, today/, chat/, breathe/, checkin/, notifications/
    lib/ api.ts (fetch wrapper + refresh), sse.ts, storage.ts (MMKV), queryClient.ts, device.ts (lite mode)
apps/api/
  src/ server.ts, env.ts, db/ (schema.ts, migrations/), auth/, routes/, ai/ (client.ts, prompts.ts, safety.ts), lib/
packages/shared/
  src/ schemas.ts, types.ts, routes.ts
```

### 6.1 Navigation

- Three tabs in a floating pill bar: **Today**, **Sola** (chat), **You** (progress and settings). The pill slides between tabs with a spring.
- Breathe and the mood check-in open as modals over the tabs from anywhere (Today, a chat suggestion card, a notification).
- Deep links: `solace://today`, `solace://checkin`, `solace://breathe`, `solace://sola/new`, `solace://sola/:id`.
- Android back button: closes modals first, then pops stacks, then exits from Today. Never traps the user.

---

## 7. Design system

### 7.1 Direction

Calm, soft, airy, a little playful because of Sola. Today sits in front of a living scene that follows the real time of day. Apple HIG system colors, one accent, generous space.

### 7.2 Tokens (match the approved web preview)

Colors come from Apple's HIG Color page (values updated June 2025) and its iOS system grays. The HIG gives no numbers for label or background colors, so those map onto the gray ramp plus pure black and white. All text meets WCAG AA (4.5:1); key graphics meet 3:1.

| Token | Light | Dark | HIG source |
|---|---|---|---|
| background | `#F2F2F7` | `#000000` | Gray 6 / black |
| surface | `#FFFFFF` | `#1C1C1E` | White / Gray 6 |
| tint | `#F2F2F7` | `#2C2C2E` | Gray 6 / Gray 5 |
| ink | `#000000` | `#FFFFFF` | Black / white |
| muted | `#6C6C70` | `#AEAEB2` | Gray, increased contrast |
| separator | `#D1D1D6` | `#3A3A3C` | Gray 4 |
| accent | `#1E6EF4` | `#5CB8FF` | Blue, increased contrast |
| onAccent | `#FFFFFF` | `#000000` | White / black |

Sky colors are derived from HIG blue, cyan, teal, indigo and orange (section 7.7). Text on the sky is pure black or white, whichever passes AA across the sky behind it.

**Appearance setting** (in settings): Sky (default, the time of day drives light or dark), Follow system, Always light, Always dark.
- Type scale: 34 (large title) / 26 / 20 / 17 / 15 / 13 / 11.5. Weights 400, 600, 700 only. Letter-spacing −0.02em on titles.
- Spacing on a 4/8 grid: 4, 8, 12, 16, 20, 24, 32, 40. Screen side padding 22.
- Radii vary by hierarchy, not one radius for everything: hero cards 32–36 with one tighter corner (the "petal" shape), cards 22, buttons 18, chips 16, tab bar fully rounded.
- Shadows: only the tab bar and floating sheets get elevation.

### 7.3 Motion

- One shared spring (`damping 18, stiffness 180, mass 1`) for presses and the tab pill; one easing (`Easing.bezier(0.22, 1, 0.36, 1)`, 500–800 ms) for entrances.
- Screen entrance: content rises 18 px and fades in, staggered 80 ms per block, once per mount.
- Press: scale to 0.95 with the spring.
- Only `transform` and `opacity` animate. Never width, height or margins (use layout animations sparingly and only for list insert/remove).
- Chat: bubbles rise in; streamed text appends word by word; the suggestion card expands in after the reply.
- Reduce-motion: respect `AccessibilityInfo.isReduceMotionEnabled` (Reanimated `ReduceMotion.System`).
- Lite mode (device RAM under ~4 GB): disable stagger, the mascot's idle float and the sky's moving parts.

### 7.4 Sola the mascot

A round, glowing orange character with blush. States: `idle` (blink every ~5 s), `happy`, `concerned`, `listening` (leans, eyes widen while the user types), `thinking` (eyes drift while streaming), `sleepy` (after 10 pm). The mouth curve is driven by the current mood value, so a mood check-in visibly changes Sola's face. This is the signature element; keep everything else quiet around it.

### 7.5 Haptics map

Selection tick on mood choice and tab change; light impact on primary buttons; soft impact at each breathing phase change; success notification at the end of a breathing session or check-in. Nothing else vibrates.

### 7.6 Copy

Sentence case, plain verbs, warm but not syrupy. Errors say what happened and what to do ("Couldn't reach Sola. Check your connection and try again."). Empty states invite an action.

### 7.7 The scene behind Today

Everything is slow and few, so it stays calm. No buildings.

- **Time of day:** day, dusk and night blend over about 30 minutes.
- **Landscape:** a distant snow-capped mountain in the center, softly hazy, with a small stream winding toward it and a gentle shimmer. Slim tree branches reach in from the left and right screen edges. Pink petals drift down slowly, a few at a time.
- **Day:** a small sun in the top corner and slowly drifting clouds.
- **Night:** the moon in the top corner shows tonight's real phase, calculated on-device. 30 to 40 stars twinkle slowly and out of sync. A shooting star only every 10 to 20 seconds.
- **Owl:** night only, once per visit, after a random 20 to 90 seconds. It glides in, lands on a branch, slowly turns to look at the user, blinks, and flies off toward the mountain. If the flight looks clumsy, fall back to a perched owl that only blinks and turns its head.
- **Performance:** one Skia canvas. Static layers are drawn once into a cached picture. Only petals, water, stars, clouds, the rare shooting star and the owl animate. It pauses when Today isn't focused. Moving parts turn off with reduce-motion.
- **Demo control:** a hidden long-press on the sky cycles dawn, day, dusk and night for recording.

---

## 8. Screens and states

Every screen needs loading (skeleton, never a spinner on a blank page), empty, error and offline states.

Offline and timeout errors show within a few seconds, never after a long wait. Render's free tier can take about a minute to wake, so after showing the error the app keeps retrying quietly in the background and recovers by itself when the API answers.

1. **Splash**: native splash in the background color, handing off to an animated Sola fade-in with the tagline; runs auth refresh and wakes the API in parallel. Max 2.5 s.
2. **Onboarding** (4 steps, skippable after step 1): what Solace is → meet Sola (Sola waves, says hi) → pick a goal → choose reminder times (with the notification pre-prompt). Progress dots, swipe or tap Next.
3. **Sign up / Log in**: one screen each, inline validation, password visibility toggle, 18+ checkbox, privacy notice line ("Sola's replies are generated by Google Gemini. Please avoid sharing sensitive personal details in this demo.").
4. **Today**: the scene (section 7.7) fills the screen behind the date, Sola and Sola's specific line as the headline, in one color.
   - **Pull-up sheet:** so the scene isn't hidden. Resting, it shows only the mood check-in ("How are you arriving?" with five mood faces) and the suggestion card with its Breathe button. Pulled up, it also shows the streak and affirmation cards.
   - The tab bar never overlaps content.
5. **Mood check-in** (sheet): mood, optional note, save → +10 XP toast, Sola reacts.
6. **Sola tab**: history list (title, preview, time; swipe left to delete with confirm; "New conversation" button) → conversation screen (streamed replies, suggestion cards that deep-link, quick-reply chips when empty, keyboard-aware input).
7. **Breathe** (full-screen): pick a pattern (Calm 4-4-6, Box 4-4-4-4, Sleep 4-7-8), 4 rounds, orb scales on the UI thread, phase label and countdown, haptic per phase, finish → "How do you feel now?" quick mood → +15 XP.
8. **Reflect**: three short screenings of 4 questions each, labelled "friendly check-ins, not diagnoses": Mood (PHQ-4 style), Anxiety (GAD style) and Self-talk. Keeps the sky design, not a saturated card stack.
   - **Questions:** Sola asks each one at a time in the sky, conversationally, with soft tappable answers on a 0–3 scale. Not a form. Before shipping, verify PHQ-4 and GAD wording and usage terms from official sources, and phrase questions in our own words where needed.
   - **Results:** a gentle score band with a kind name, a "not a diagnosis" note, a Tele-MANAS 14416 call button, and three wellness moves written by the AI for this user from their recent moods and chats (only when `personalize` is on). Each move is tappable and opens the matching activity.
   - **Safety:** all typed text in Reflect goes through the crisis pre-check. The lowest band shows a prominent, warm prompt, "Want to talk to someone right now?", with the Tele-MANAS 14416 call button and an option to talk to Sola.
   - **Streak:** counts as activity for the day. One streak day per day, whatever the user does that day.
   - **Colors:** Apple HIG tokens only (section 7.2).
9. **You**: streak calendar (last 5 weeks), mood trend (simple SVG line, last 14 days), level and XP, links to reminders, privacy (personalize toggle, delete all chats, delete account), resources, appearance (section 7.2), log out.
10. **Reminders**: toggles and time pickers per reminder type, custom reminders (add, edit, delete), "send a test notification" button.
11. **Resources**: 5 short guides (Mindfulness 101, Anxiety toolkit with 5-4-3-2-1 grounding, Beating the blues, Self-esteem reset, Sleep wind-down) + a Get help now page (Tele-MANAS 14416, call button) + "not a substitute for professional care" note.

---

## 9. Performance budget (measured on the release build, real mid-range Android)

| Metric | Target |
|---|---|
| Release APK size (arm64) | up to ~120 MB is fine if the extra size buys visible quality |
| App memory (PSS in `dumpsys meminfo`) | under ~350 MB during normal use, no growth trend |
| Cold start to interactive Today (logged in, cached) | under 2 s |
| Animations | 60 fps, no dropped frames visible in the perf monitor during tab switch, breathing, chat streaming |
| Time to first streamed word (API warm) | under 1.5 s |
| JS heap after 5 minutes of use | stable, no growth trend |
| Touch response | immediate visual feedback on every tap (press scale or haptic) |

**Refresh rate.** The app runs at each device's highest refresh rate, never a fixed one.
- Android: at app start, request the highest refresh rate the display supports. Read it from the display's supported modes; do not hard-code 120.
- iOS: set `CADisableMinimumFrameDurationOnPhone` to `true`.
- All animations stay time-based, so they run at the same speed at any refresh rate.
- Verify in a release build on the Poco X7 Pro (120 Hz), and also check a 60 Hz emulator.

Tools: React Native DevTools (Hermes profiler), the in-app perf monitor, `adb shell dumpsys meminfo <package>`, the APK analyzer in Android Studio.

---

## 10. Testing

- `tsc --noEmit` and ESLint pass in all three packages before any commit.
- API (vitest + Fastify `inject`, separate test database): signup/login/refresh rotation and reuse detection, protected routes reject bad tokens, check-in XP and streak math (including timezone day boundaries), conversation CRUD and cascade delete, SSE stream sends `delta` then `meta` then `done`, crisis pre-check short-circuits, Gemini failure falls back then errors cleanly (Gemini mocked).
- App unit tests (jest-expo + RNTL): api wrapper refresh-and-retry, SSE parser, streak/level helpers, notification scheduling builds the right triggers.
- End-to-end on the phone (Maestro): fresh install → onboarding → sign up → mood check-in → chat reply streams → open suggestion → breathing completes → chat history shows the conversation → delete it → log out → log in.
- Manual on the phone: notification arrives with the app killed and opens the right screen; back button behavior; dark mode; font scale at 1.3×; airplane mode.
- Rule: a failing test is fixed at the cause. Tests are never weakened, skipped or commented out to get green.

---

## 11. Build and release

- `app.config.ts`: name Solace, slug `solace`, scheme `solace`, Android package `com.ddk.solace`, adaptive icon, splash background `#EEF0F8`, `userInterfaceStyle: "automatic"`, notification icon and color, `expo-build-properties` with `buildArchs: ["arm64-v8a"]`.
- Env: `EXPO_PUBLIC_API_URL` (app). API: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `NODE_ENV`, `PORT`. Secrets never committed; `.env.example` checked in.
- `eas.json` `preview` profile: `android.buildType: "apk"`. Fallback: `npx expo prebuild` then `cd android && ./gradlew assembleRelease` locally.
- The signing keystore is generated by EAS (or locally) and backed up outside the repo.
- Final APK is installed fresh on a phone that has never had the app, and the full Maestro flow plus the killed-app notification test pass before submission.

---

## 12. Phase plan

Each phase ends with its acceptance check passing on the phone. No phase starts until the previous one is accepted.

| Phase | When | Delivers | Accepted when |
|---|---|---|---|
| 0. Setup | Thu | Repo, workspaces, Expo SDK 58 app, dev build on phone, API with `/health` on Render, Supabase DB, migrations, pinger | Dev build opens on the phone; `GET /health` works from the phone over mobile data |
| 1. Foundation | Thu–Fri | Tokens, typography, motion, haptics, base components, Mascot with states, floating tab bar | Approved by Ddk on the phone, light and dark |
| 2. Auth + onboarding | Fri | Splash, onboarding, sign up, log in, refresh, logout | Full auth tests pass; kill and reopen stays logged in |
| 3. Today + check-ins + XP | Fri–Sat | `/today`, check-ins, suggestion card, streak/level ring, affirmation | Check-in updates Sola, ring, streak, and survives restart |
| 4. Sola chat | Sat | Conversations, streaming, safety, classification, cards, history, delete, summaries | 12-message AI eval reads well; delete is real; crisis path shows the helpline |
| 5. Breathe + Reflect | Sun | Breathing patterns, post-session mood, Reflect's three check-ins with AI moves, `assessments` migration (`kind`, `moves`) | 60 fps on the orb; XP awarded once per session; each move opens its activity; crisis pre-check and lowest-band prompt work; question wording and usage terms verified |
| 6. Notifications + settings | Sun | Channels, schedules, custom reminders, deep links, privacy controls | Notification fires with the app killed and opens the right screen |
| 7. Polish + perf | Mon morning | Empty/error states, budget check, accessibility pass, copy pass | Performance budget met; Maestro flow green |
| 8. Ship | Mon | Release APK, fresh-install test, demo video | Submitted Monday night; Tuesday morning is buffer only |

Cut order if time runs short (last cut first): Reflect → custom reminders → mood trend chart → resources detail pages. Never cut: auth, chat + history, breathing, notifications, Today.

---

## 13. Demo video (3–4 min)

Splash → onboarding → sign up → Today and a mood check-in (Sola's face changes) → talk to Sola about something real; the reply streams and suggests breathing → tap the card into Breathe → finish and re-rate mood → chat history: continue, then delete one → You tab: streak and trend → kill the app, show a reminder arriving, tap it, land on Check-in → 20 seconds on the architecture diagram (Excalidraw) and the design and safety choices.

---

## 14. Known risks

| Risk | Mitigation |
|---|---|
| A library isn't ready for RN 0.88 | Check each README and `expo-doctor` in phase 0; replace, don't patch |
| Gemini free-tier limits hit during the demo | Flash-Lite fallback; rate limit per user; record the demo with a fresh quota |
| Render cold start when judges open the app | Pinger every 10 min, kept running after submission |
| Supabase project paused for inactivity | Pinger also touches the DB (`/health` runs `select 1`) |
| EAS build queue slow on the last day | Local Gradle release build tested by Saturday |
| Notifications unreliable on aggressive battery savers (Xiaomi, Oppo, etc.) | Test on the demo phone; note battery-optimization exemption in settings help text |
