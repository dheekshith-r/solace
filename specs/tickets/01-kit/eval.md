# 01 Eval

## Automated
- Every shared check that applies (README).
- Unit tests (RNTL):
  - `Button` calls `onPress` once and not while loading or disabled.
  - `TextField` shows its error, and the secure toggle flips visibility.
  - `Toast` shows one message at a time and hides after its duration.
  - `Header` renders the title.
  - `useTheme` returns the dark palette when overridden.
- A search for hex colors in `src/components` finds nothing.

## On the phone (release build)
- Open `solace://kit`. Take screenshots of the full page, scrolled top, middle and bottom, in light and dark.
- The header's large title collapses smoothly when scrolling: the frame timer reads at least 110 fps, with no gap over 34 ms.
- Each pressable scales on press. The primary button gives a light haptic, and chips give a selection tick.
- `TextField`: focus, error, and the secure toggle work. The keyboard doesn't cover the focused field.
- Toast appears, auto-hides and is announced by TalkBack.
- Skeleton pulses, and is still with reduce motion on.
- Font scale 1.3×: nothing clips.
- Back from the kit returns to the previous screen.

## Design review
Compare against `design/refs` and Today:
- Spacing follows the 4/8 grid.
- Radii follow the hierarchy.
- Only the tab bar and sheets have shadows.
- One accent color.
- It feels as calm and premium as Today.
