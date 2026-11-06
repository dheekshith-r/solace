# 08b Eval

## On the phone (release build)
- 60 tab switches (Today, Sola, You). PSS ends within 10 MB of the start, measured after 45 s idle on Today. Report native, graphics and java separately.
- gfxinfo lists no extra full-screen render targets after switching, beyond what a cold start shows.
- Today resumes instantly when its tab is shown again, with no blank frame and the scene not re-baked. The frame timer reads at least 110 fps within 1 s.
- The tab cross-fade still animates. gfxinfo over 20 switches shows no frame over 34 ms.
- Today day and night screenshots are unchanged.

## Memory (every ticket)
On the release build, using `dumpsys meminfo com.ddk.solace`:
- Record PSS (and its native, graphics and java parts) right before opening each new screen.
- Record it again after 2 minutes of normal use on that screen, and once more after leaving it.
- Report the screen's cost (the change in PSS) and whether it is released on leaving.
- Repeat the screen's main interaction 20 times: PSS must reach a plateau with no upward trend.
