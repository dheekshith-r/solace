# Brief: Today screen polish, screen map and quality rules

From Ddk, Thu Nov 5 evening. Read this fully, then work through it in order. Quality over speed: take the time each item needs. After each item, show screenshots (and numbers where relevant) on my phone before moving on. Commit and push after each accepted item. Unfinished work goes on a branch, never on main.

---

## A. Standing rules (add these to CLAUDE.md)

1. **Today is locked as the main page.** Don't add features or clutter to it. New features go on other pages, reached from the tabs (Today, Sola, You) or from cards on those pages.
2. **The Apple HIG palette is the design system.** Use only its tokens on every screen and component. No new colors without asking me.
3. **Quality bar for all illustration and motion:** Apple-level realistic 2D, like the animated backgrounds in Apple's Weather app. No outlines; soft gradients and light; one consistent light source (sun by day, moon at night) with rim light on edges facing it; atmospheric depth (far = lighter, bluer, softer; near = sharper, richer). For every visual element, study real photos and Apple Weather first, then compare your result side by side on my phone and fix it until it holds up.
4. **Judge speed and smoothness only on a release build.** Tell me when something I'm seeing is caused by the dev build or Expo's dev menu (the gear button).
5. **Never fake progress:** don't call something done without a phone screenshot or measurement that shows it.

---

## B. Today screen fixes (in this order)

1. **Day/night preview switch.** Build the hidden demo control now: long-press on the sky cycles dawn, day, dusk, night. I'm stuck on night and need to review day.
2. **Remove the big headline** ("The exam's been loud in your head…") from Today completely. Sola's daily personal line moves to the top of the Sola tab.
3. **Move Sola slightly down** so its glow no longer overlaps the date.
4. **Mood changes animate.** When the mood changes (e.g. happy to sad), Sola's mouth morphs smoothly into the new shape over about 400–600 ms with spring easing; eyes and blush ease too. The selected mood button animates as well. No instant snaps anywhere.
5. **Seamless loops.** Every looping animation (stars, water, clouds, petals, Sola's float) runs continuously with no jump or stutter when it repeats. Drive them from continuous time, not by restarting animations.
6. **Branches.** Lower them so they frame the scene below Mount Fuji's peak, not level with it. Natural forks and tapering, belonging to trees at the screen edges.
7. **Wind and petals.** Mostly still. Every 15–30 s a gentle wind gust sways the branches slightly and releases 1–3 soft pink sakura petals from the branches (never from the sky). They drift down with sideways sway, rotation and flutter, then fade near the ground. Long quiet gaps between gusts.
8. **Stream.** No dashes, squares, circles or lines. A real flowing stream: wide in the foreground, narrowing with perspective toward the mountain, soft banks, reflections of the sky, moon and mountain. Use a Skia runtime shader with flowing noise to distort the water surface and reflections, with soft highlights moving away from the viewer toward the mountain.
9. **Mount Fuji.** More detail: snow streaks and ridges on the cap, subtle slope texture, haze at the base, and its reflection in the water.
10. **Grassland.** A real foreground: layered rolling meadow with subtle texture, darker near the viewer, a few grass tufts at the bottom edge moving gently with the wind.
11. **Moon.** A full moon with subtle surface detail and a soft glow halo. It lights cloud edges and the water. Never behind the gear or any UI. Sun only in daytime, moon only at night, never both, no sun glow at night.
12. **Stars.** Spread naturally across the whole sky, not clumped: many faint, few bright, denser toward the top, fading near the horizon, an optional very faint Milky Way band. Each twinkles at its own pace. A rare shooting star with a fading tail.
13. **Clouds.** A few soft clouds, every one a unique shape (several random overlapping soft lobes), varied size, opacity and speed by depth, shaded brighter on top and darker underneath; at night dimmer with moonlit edges.
14. **Day scene.** Apply the same standard to dawn, day and dusk: sky gradients, sun on an arc with the real time of day, sunlit clouds, warm light on Fuji and the water at dusk.
15. **Owl.** Keep it, but rare: at most once per night session, only after 3–5 minutes on Today. Realistic behaviour: flies in low from the side with a few wingbeats then a glide, lands on a branch, settles, slowly turns its head to look at the user, blinks, flies off to the side. Use a licensed Lottie owl if one fits (ask me before adding the package); otherwise tell me.
16. **Tilt parallax (optional, if smooth).** Subtle: near branches and grass shift most, the stream less, the mountain barely, the sky not at all. A few pixels, smoothed, paused when unfocused, off with reduce-motion.

---

## C. Navigation and interaction

1. **Tabs must work.** Tapping Today, Sola or You switches pages with a smooth transition; the tab pill slides with a spring and a light haptic tick.
2. Build **Sola** and **You** as real designed screens in the same style (placeholder data is fine for now). You becomes the hub with cards to Breathe, Reflect, Resources and settings.
3. **Every tap gives instant feedback:** a press animation and, where meaningful, a haptic. Nothing should feel dead.
4. **Android back button:** closes sheets first, then goes back, then exits from Today. Never traps the user.

---

## D. Performance (release build)

1. Build a release APK, install it, and measure:
   - Cold start to a usable Today screen (target under 2 s).
   - Frame times during the scene loop, a tab switch and a mood change (target: no visible stutter at 120 Hz).
   - Memory over 5 minutes on Today (within budget, no growth trend).
2. Profile and fix anything over budget, then report the numbers.
3. Static scene layers are drawn once and cached; only petals, water, stars, clouds, Sola and the owl animate. Pause everything when Today isn't focused or the app is in the background (saves battery).
4. Also check a 60 Hz emulator and lite mode (low-RAM phones) so weaker phones stay smooth.

---

## E. Quality extras

1. **Accessibility:** all text WCAG AA contrast; screen-reader labels on Sola, mood buttons and tabs; layout survives system font size at 1.3×; reduce-motion turns off non-essential motion.
2. **Safe areas:** works with punch-hole cameras, gesture navigation and 3-button navigation bars.
3. **Consistency:** same spring, easing and haptics everywhere, all from `src/theme/`.

---

## F. Final screen map (write into the spec; build per the phase plan, not all at once)

- **Before sign-in:** Splash; Onboarding (4 steps: what Solace is, meet Sola, pick goal, reminder times); Sign up; Log in.
- **Tabs:** Today (locked: sky, Sola, mood check-in, suggestion); Sola (Sola's daily personal line, conversation history, New conversation); Conversation; You (constellation, mood trend, streak and level, cards to everything below).
- **From cards:** Breathe; Reflect (Mood, Anxiety relief, Self-talk); Reflect questions; Reflect results; Resources; Guide detail including Get help now (Tele-MANAS 14416); Reminders; Privacy and data; Appearance (Sky, Follow system, Light, Dark).
- **Stretch:** What Sola remembers; Weekly letter.

Order of work after this brief: finish B, C and D, get my approval, then Phase 2 (splash, onboarding, sign up, log in) and onward per the phase plan.
