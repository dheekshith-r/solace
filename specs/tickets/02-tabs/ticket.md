# 02 Real tab navigation

## Must do
- Add an `app/(tabs)/` group: `today`, `sola` (a stack: index, `[id]`) and `you`.
- Today keeps its exact look. Only its tab bar starts working.
- Build `TabBar` as a kit component (`src/components/TabBar.tsx`):
  - Floating pill with the same look as Today's current bar.
  - The selected pill slides between tabs with the shared spring.
  - Selection haptic on change.
  - Takes its palette from the active screen. On Today it follows the sky's light or dark, exactly as now.
- Sola and You get simple placeholder screens built with the kit until tickets 08 and 12.
- Android back from Sola or You goes to Today; back on Today exits the app.
- The scene pauses when Today loses focus (already wired) and resumes on return.
- `app/index.tsx` stops being the Phase 0 check screen. It becomes a redirect: to Today for now, and through the auth gate after ticket 05.

## Files
- **New:** `app/(tabs)/_layout.tsx`, `app/(tabs)/today.tsx` (moved from `app/today.tsx`), `app/(tabs)/sola/_layout.tsx`, `index.tsx`, `[id].tsx`, `app/(tabs)/you.tsx`, `src/components/TabBar.tsx`.
- **Edit:** Today, only to remove its own `TabBar` and publish its scheme for the tab bar. Visuals unchanged. Also `src/features/today/parts.tsx`, to remove the old `TabBar`.

## Must not touch
The scene code and the API.

## Decisions
- Deep link `solace://today` keeps working. Its `m`, `gust`, `v`, `perf` params still apply.
- Both tab bar copies cross-fade during Today's light/dark change, exactly like the sheet.
