# 08 Sola tab and conversation (app)

## Must do
- **Sola tab:**
  - Sola's daily line at the top (the `/today` greeting), with a small Sola beside it.
  - A "New conversation" button.
  - History list (FlashList): title, preview and time.
  - Swipe left to delete, with a confirm (gesture handler).
  - Skeleton, empty ("Tell Sola what's on your mind"), error and offline states.
- **Conversation screen:**
  - Streamed replies append word by word. Bubbles rise in.
  - Sola's state changes to listening while typing and thinking while streaming.
  - Keyboard-aware input (`react-native-keyboard-controller`).
  - Quick-reply chips when the conversation is empty.
  - Suggestion card after a reply. It deep-links to Breathe, Reflect, the mood check-in (Today) or the affirmation.
  - Crisis: a helpline card with a Tele-MANAS 14416 call button (`tel:` link), the note "Not a substitute for professional help", and a calm tone.
  - Error row with retry; the user message is never lost.
  - Continue old conversations, start new ones, delete from inside the conversation too.
- Deep links: `solace://sola/new`, `solace://sola/:id`.

## Files
`app/(tabs)/sola/*`, `src/features/chat/*`, `src/lib/sse.ts`. Kit additions go in `src/components` first.

## Must not touch
Today and the API.

## Decisions
- Streaming uses `expo/fetch` `ReadableStream`, verified on SDK 58 first. If it fails, ask Ddk before adding `react-native-sse`.
- The chat Sola uses the shared Sola component from ticket 04.
