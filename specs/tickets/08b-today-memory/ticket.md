# 08b Today canvas memory (Saturday, after 07 and 08; time-box: one hour, then report)

## Problem (measured Nov 6)
On the release build, switching tabs raises PSS from about 357 MB to about 425 MB over the first 60 switches. It then stays flat, even after 45 s idle. Native heap grows by about 27 MB. gfxinfo shows five retained full-screen render targets (1220×2712, about 63 MB in total). Turning off the tab fade made no difference, so the fade is not the cause.

## Must do
- Keep Today's Skia canvas alive but paused while its tab is hidden, instead of recreating it.
  - **Likely cause:** react-native-screens detaches inactive tab screens, so the canvas surface is destroyed and recreated on return.
  - **Options:** keep Today's screen attached (`detachInactiveScreens` / `freezeOnBlur` for that tab only), or keep the canvas mounted and stop its drawing while blurred. The frame callback is already paused on blur.
- Find what the five full-screen render targets are, and release any that aren't needed.
- Keep the tab cross-fade (Ddk, Nov 6: tab switches must animate).

## Files
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/today.tsx`, only to wire in the pause; no visual change.
- `src/features/sky/SkyCanvas.tsx`, only for pause support; no visual change.

## Must not touch
Today's look, the scene's art and the API.

## Decisions
If an hour isn't enough, stop and report the measurements, the cause found so far and the remaining options.
