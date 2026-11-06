# 01 Component kit and preview page

## Must do
Build the shared kit in `apps/mobile/src/components`, at Today's quality, using only the tokens in `src/theme`:

| Component | What it does |
|---|---|
| `ThemeProvider` / `useTheme()` | Returns the current palette (light or dark). Follows the system scheme for now; ticket 12 adds the Appearance setting. |
| `Text` | Type variants from spec 7.2: largeTitle, title, heading, body, callout, footnote, caption. Optional `muted`. Allows font scaling. |
| `Screen` | Safe areas, background token, optional scroll with a collapsing `Header`, keyboard-aware variant, status bar matched to the scheme. |
| `Header` | Large title (34) that collapses into a centered 17 pt title as you scroll, plus an optional back button and trailing action. Animates only transform and opacity. |
| `Card` | Surface, radius 22, padding from tokens; pressable variant. A `hero` variant uses the petal shape (32–36 with one tighter corner). |
| `ListRow` | Leading icon, title, optional subtitle, and a trailing chevron, value, switch or destructive style. Inset separator, 44 pt minimum height, press feedback. |
| `Button` | Primary, secondary and text variants; loading and disabled states. Light haptic on primary. Radius 18. |
| `Chip` | Selectable; radius 16; selection haptic. |
| `Sheet` | Content container for expo-router `formSheet`/`modal` routes: grabber, title, safe bottom padding. No `@gorhom/bottom-sheet`. |
| `TextField` | Label, inline error, helper text, secure toggle (eye icon), focus state shown with an opacity overlay. |
| `Toast` | Provider plus `useToast()`. One at a time, slides in at the top, auto-dismisses after about 2.5 s, announced to the screen reader. |
| `Skeleton` | Blocks that gently pulse in opacity; still when reduce motion is on. |
| `EmptyState` | Icon, title, body and one action, with inviting copy. |
| `PressScale` | The shared press animation: scale 0.95 with the shared spring. Every pressable in the kit uses it. |
| `Entrance` | The shared page transition: content rises 18 px and fades in, staggered 80 ms per block, once per mount. Fade only with reduce motion, none in lite mode. |
| `haptics.ts` | The haptics map from spec 7.5, the only place haptics are called. |

Add a preview page at `app/kit.tsx`, reached by `solace://kit`. It shows every component and state in light and dark, with an in-page toggle to switch between them.

## Files
- **New:** `src/components/*`, `src/theme/haptics.ts`, `app/kit.tsx`
- **May edit:** `src/theme/tokens.ts` and `motion.ts`, to add missing tokens built from the existing scale only (no new colors). Also `app/_layout.tsx`, to add the providers.

## Must not touch
`app/today.tsx`, `src/features/sky/*`, `src/features/today/*`, and the API.

## Decisions
- Icons come from `lucide-react-native`, imported one at a time.
- A dark scheme can't be forced on the system, so the preview toggles its own `ThemeProvider` override.
- No new colors. Destructive actions use the HIG red only if it's already a token; otherwise ask Ddk.
