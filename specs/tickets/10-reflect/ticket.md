# 10 Reflect

## Must do
- **API:**
  - Migration adds `kind` and `moves` to `assessments`.
  - `POST /assessments` scores answers 0–3, assigns the band (steady, stretched or strained), and logs activity.
  - It returns three AI-written moves from Flash-Lite, each mapped to an activity, using recent moods and chats only if `personalize` is on. Handwritten fallback moves cover failures.
  - Typed text goes through the crisis pre-check.
- **App:**
  - **Hub:** Mood, Anxiety relief and Self-talk, labelled "friendly check-ins, not diagnoses". Reached from the You tab and from chat cards.
  - **Questions:** Sola asks one at a time over a static sky gradient, conversationally, with soft tappable 0–3 answers.
  - **Results:**
    - The band, with a kind name.
    - A "not a diagnosis" note.
    - A Tele-MANAS 14416 call button.
    - Three tappable moves that open their activity.
  - The lowest band shows a prominent, warm "Want to talk to someone right now?" with the call button and "Talk to Sola".

## Files
`apps/api` (routes, migration, prompts), `app/reflect/*`, `src/features/reflect/*`, plus kit additions.

## Must not touch
Today.

## Decisions
- Questions in our own words (decision 10). Sources to check: PHQ-4 (Kroenke et al. 2009) and GAD-7 (Spitzer et al. 2006, freely usable without permission per its publisher's notice). The self-talk set is original.
- **Ddk approves the 12 questions before this ticket is marked done.**
