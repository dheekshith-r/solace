# DESIGN: Solace website (`/docs`)

Written from the built page on 2026-11-24. The app's own design system (spec section 7.2) is the authority; this file records only what the website adds.

## World

One night, 11:48 pm to 9:30 am. Each section is one hour and continues the sky of the section above: night navy, then pre-dawn blue, a drawn horizon where the sun comes up, then peach morning and the app's `#F2F2F7` paper at the end.

## Tokens used

| Role | Night sections | Morning sections |
|---|---|---|
| Text | `#FFFFFF` | `#000000` |
| Secondary text | `#C7CBE0` | `#4F3F3A` |
| Hour in the heading | `#8FA3E8` | `#9A4A1F` |
| Main button | `#5CB8FF` on `#000` text (app dark accent) | `#1E6EF4` with `#FFF` text (app light accent) |
| Focus ring | `#5CB8FF` | `#1E6EF4` |

Band gradients: `#0C122E → #101A40 → #15214F → #1B2B62 → #2E3F7C`, horizon `#2E3F7C → #F2C7B0`, then `#F2C7B0 → #F8DCC6 → #FBEADB → #FDF4EC → #F2F2F7`.

Type: Plus Jakarta Sans 400/600/700 (self-hosted woff2, Latin subset, OFL). Headings `clamp(30px, 7vw, 52px)`, hero `clamp(34px, 9.4vw, 72px)`, -0.02em. Body 17px / 1.5. Radii from the app: buttons 18, chips 16, petal cards 34/34/34/12.

## Made art

All drawn in code: seeded stars, the moon, a snow-capped peak and three hill layers (hero); the horizon with the rising sun; Sola (SVG, same shape as the app's mascot), whose mouth follows the mood picker. Real screens: Today, Sola, Breathe (from `docs/images`, re-encoded as AVIF + JPEG). The certificate is rendered from the original PDF.

## Motion

One system, all off with reduced motion: hero phone rises once, Sola floats, a few stars twinkle, the moon sets with scroll and the sun rises into view (scroll-driven, where supported), section phones and chat chips arrive once. The breathing orb follows the app's patterns (Calm 4-4-6, Box 4-4-4-4, Sleep 4-7-8, 4 rounds) and pauses when off screen.

## Rules

- No inline styles or scripts: the CSP allows only `'self'`.
- Every claim on the page must be true in the app (see `README.md`). The demo video section is missing until a video with picture exists.
