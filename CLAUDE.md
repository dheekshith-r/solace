# Solace AI: project rules

AI-powered wellness companion, built with Expo / React Native, shipped as an Android APK.
Judged on the demo video and the APK. Target: submit Mon Nov 9 night (hard deadline Tue Nov 10, about noon IST).

**What to build and how lives in `SOLACE_BUILD_SPEC.md` (stack, architecture, schema, API, AI, design system, screens, tests, phases). Read it fully at the start of every session. This file holds the rules for working.**

## Three things we never trade off
1. **Premium, calm, lovely look and feel.**
2. **Blazing fast.** Instant taps, 60fps, no jank on mid-range Android.
3. **Lean on memory, generous on size.** APK size can grow (up to about 120 MB) when it buys a visibly more premium look. Memory stays low, because on Android high memory use causes stutters and background kills.

If they conflict, cut a visual effect or a feature. Never cut responsiveness.
Fewer screens, done extremely well, beat many screens done badly.

## Stack guardrails
- Expo SDK 58 (React Native 0.88). Install every Expo-managed package with `npx expo install`, never plain `npm install`, so versions match the SDK. Run `npx expo-doctor` after every dependency change and fix what it reports.
- Do not enable Worklets Bundle Mode. It is marked unstable and is not needed: RN 0.88 already includes the Hermes memory fix.
- Before adding any package not listed in the spec: check its README for New Architecture and RN 0.88 support, check its size, and ask Ddk first.
- No `@gorhom/bottom-sheet` (RN 0.88 support unconfirmed): use expo-router `formSheet`/`modal` presentation.
- Skia (`@shopify/react-native-skia`) is allowed for hero visuals: Sola's glow, the breathing orb, soft blurred backgrounds. Check its README for RN 0.88 support in Phase 0. Pause Skia canvases on unfocused screens.
- No expo-blur (use Skia blur instead), UI kits, Sentry or Firebase.
- Gemini is called only from the API. The key never goes in the app. All model calls go through `apps/api/src/ai/client.ts` so the provider can be swapped in one file.

## Design and motion rules
- Every color, size, radius, spacing value and spring config comes from `src/theme/`. Never hardcode them in components.
- The Apple HIG palette (spec section 7.2) is locked as the design system. Use only its tokens for every new screen and component. Don't introduce new colors; if something needs one, ask Ddk first.
- Animate only `transform` and `opacity`, on the UI thread. One shared spring, one shared easing.
- One hero moment per screen. Sola the mascot is the signature element; keep everything around it quiet.
- Every screen has loading (skeleton), empty, error and offline states.
- Respect reduce-motion and lite mode (RAM under ~4 GB).
- Today is locked as the main page. Don't add features or clutter to it. New features go on other pages, reached from the tabs (Today, Sola, You) or from cards on those pages.
- Every new screen uses only the component kit in `src/components` and the theme tokens. No one-off styles. If a screen needs something new, add it to the kit first.
- Quality bar for all illustration and motion: Apple-level realistic 2D, like the animated backgrounds in Apple's Weather app. No outlines; soft gradients and light; one consistent light source (sun by day, moon at night) with rim light on edges facing it; atmospheric depth (far = lighter, bluer, softer; near = sharper, richer). For every visual element, study real photos and Apple Weather first, then compare the result side by side on Ddk's phone and fix it until it holds up.
- Before designing any screen, look at every image in `design/refs` and note what makes each one feel premium. Borrow principles, never copy a layout, illustration or asset.
- After building a screen, screenshot Ddk's phone with adb, compare against the refs and spec tokens, fix what is off, then show him.

## AI and safety rules
- Sola reflects what the user actually said. No generic motivation.
- Crisis language triggers the server-side pre-check and the helpline card (Tele-MANAS 14416). Never give method details. All typed text in Reflect goes through the same pre-check.
- Names: "mood check-in" is the quick one on Today; "Reflect" is the hub. Use them consistently in the UI, spec and notification copy.
- 18+ confirmation at signup. Gemini data notice at signup. "Not a substitute for professional help" in the crisis flow, resources and settings.
- Personal history is used only when the user's personalize toggle is on.

## Working rules (follow strictly)
- Work phase by phase from the spec's phase plan. Do not start a phase until the previous one is accepted by Ddk on the phone.
- Before coding a feature, state the plan in a few lines.
- Verify, never trust a single pass: after each feature run `tsc`, lint and the relevant tests, then tell Ddk exactly how to check it on the phone.
- When something breaks: diagnose first. List the problems and likely causes, then propose fixes. Do not patch around a failure.
- Never weaken, skip, delete or comment out a test or assertion to make something pass. Fix the real bug.
- Commit after each accepted step with a clear message, so any step can be rolled back.
- At the start of every session, summarize what is done and what is next.
- Do not add features, packages or screens that are not in the spec without asking.
- Never log in to accounts, enter secrets or accept terms on Ddk's behalf. Ask him to do those steps.
- Judge speed and smoothness only on a release build. Tell Ddk when something he's seeing is caused by the dev build or Expo's dev menu (the gear button).
- Never fake progress: don't call something done without a phone screenshot or measurement that shows it.
- Unfinished work goes on a branch, never on main. Commit and push after each accepted item.

## Definition of done
A flow is done when it works end to end on a real Android phone in a release build: UI, API, database, and (where relevant) notification and deep link.

---

## Kickoff prompt (paste into Claude Code, Opus 5.5, in the empty project folder that contains this file and SOLACE_BUILD_SPEC.md)

Read CLAUDE.md and SOLACE_BUILD_SPEC.md fully. We are starting Phase 0.

1. Check my machine first: Node version, Java/JDK, Android SDK and `adb`, Git. Report anything missing and how to fix it before going on.
2. Set up the npm workspaces repo (`apps/mobile`, `apps/api`, `packages/shared`) and `git init`.
3. Create the Expo SDK 58 app with expo-router and TypeScript, add `expo-dev-client`, then install the mobile packages from spec section 1.1 with `npx expo install`. Run `npx expo-doctor` and fix every issue.
4. Create the Fastify API with `GET /health` (runs `select 1` on the DB), Drizzle schema from spec section 3, and the first migration. Tell me exactly which values I need to create in Supabase, Render, Google AI Studio and Expo, and where to paste them. Wait for me to do that.
5. Build a development build and install it on my Android phone over USB. Show that the app calls `/health` on Render and displays the result.
6. Stop, summarize what was done and what to check, and wait for my approval before Phase 1.
