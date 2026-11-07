# Monday polish list

Pure polish found by reviewers or measurements. Nothing here breaks a flow, the design rules, accessibility or the brief. Those are fixed straight away.

## Performance and memory
- Startup: the full scene shows at 2.3–2.6 s; the target is under 2 s. Try baking on a background thread (CPU raster in a worklet runtime). That should also save about 70 MB of GPU memory.
- Today memory is about 366 MB against a target of about 350 MB. (The tab-switch growth moved to ticket 08b, Saturday.)
- One 75 ms frame was seen once during the sky-tap control run.
- Check on a 60 Hz emulator and in lite mode, then reduce motion and pausing in the background.

## Today scene
- The Fuji reflection looks funnel-shaped where it meets the stream.
- The moon is a little blotchy, with faint lines near its base.
- Night clouds are a bit smudgy.
- Check the dawn and dusk light.
- The owl, if there's time.

## Kit (from the review of tickets 01 and 02)
- TabBar: the press scale has no visible effect (it scales an invisible touch layer). Tapping the current Sola tab could pop its stack back to the list.
- Today calls expo-haptics directly (demo cycle, MoodButton) and keeps raw layout constants (DATE_LINE_HEIGHT, ESTIMATED_REST_HEIGHT, LONG_PRESS_MS). Today is locked, so move these into haptics.ts and the tokens only when Ddk okays touching it.

- Onboarding: Sola sits about 60 px higher on step 1 than step 2 (step 1 has the extra 'I already have an account' button), so Sola jumps when paging. Reserve the same action-area height on every step. (Phone run 1, Nov 7.)

- Check-in suggestion quoted the score ('a good mood of four out of five'); add 'never quote numbers' to SUGGESTION_SYSTEM and a digit/number-word check. (Live check, Nov 7.)

- Chat reply added a detail the user never said ('staring at the ceiling' for 'I can't sleep'). Tighten the reply prompt's grounding. (Run 2, Nov 7.)

- Release builds: remove or disable the /kit, /kit-sheet and /kit-sola preview routes (keep them in dev builds only). The auth gate currently leaves /kit* open for screenshot links. (Ddk, Nov 7.)
