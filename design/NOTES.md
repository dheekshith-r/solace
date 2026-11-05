# Design reference notes

What makes each image in `design/refs` feel premium. Borrow principles only: never copy a layout, illustration or asset. Every value still comes from `src/theme/`.

Not used as references: `130921`, `132223`, `133717`, `134234` (terminal screenshots) and `140151` (blank, 136 bytes).

## Per image

| Image | Subject | What makes it feel premium | Watch out for |
|---|---|---|---|
| `113420` | App Store Today | Quiet eyebrow, large title and a hairline set the hierarchy before any colour. Big rounded cards with one clear subject and generous gutters. | Depends on commissioned art. |
| `134922` | Guitar app | Two-tone headlines. Small controls grouped into floating pills. One colour family per screen. A little grain stops gradients looking cheap. | Busy once every chip is coloured. |
| `135207` | Moon app | One luminous object in a dark field. One hue from background to controls, so rich detail still reads calm. Lists fade out instead of being cut off. | Photo-real assets. |
| `135218` | Moon app | Repetition as beauty: one object drawn many times shows data. A single orange exception gets all the attention. Small glassy pills float over the content. | Tiny type. |
| `140137` | Restaurant ops | Character illustration gives personality. Stacked colour blocks with nested radii. A dark tab bar with one lit tile makes the active state obvious. Hatching marks future or empty data. | Too loud for a calm app. Borrow structure, not volume. |
| `140146` | Restaurant ops | A dark sheet rises over a coloured hero, giving one strong split per screen. Numbers paired with small labels. Connected day circles read as a week at a glance. | Same. |
| `140156` | Restaurant ops desktop | The AI panel: a reply bubble, then suggested prompts as chips directly above the input. | Dashboard density has no place on a phone. |
| `140237` | Neobank | Restraint: white cards on soft grey, one accent, one black button. One very large number leads each screen. | Risks feeling generic without a signature element. |
| `140248` | Neobank | Consistent list rows and a settings screen that stays calm. A sheet over content with one clear action. | None. |
| `140346` | BanKo | Colour bleeding softly through a card, like light through glass. Luminous depth from gradients instead of shadows. A glow inside the primary button. | Stock fintech look if overdone. |
| `140820` | Blue Nile | Confidence: one huge subject, strong type, nothing competing. | Editorial and cold. Not our tone. |
| `140843` | Green chair | Background colour taken from the subject. The object breaks out of its card, which adds depth with no shadow. Muted words inside a headline give it rhythm. | None. |
| `140913` | Chairs, light | Tonal tinted background instead of grey. Staggered grid. One word emphasised by hand. | Small square-ish buttons look dated next to the soft shapes. |
| `140948` | Heatmap | Almost all black with one glowing area, so the eye knows where to go. A status dot plus one word is enough. | Technical mood. |
| `141510` | Widgets | Very soft shape language. Chart lines fade out at both ends. Tooltip as a soft pill. Value first, context muted. A progress thumb with a gentle glow. | Relies on large shadows, which spec 7.2 limits. |
| `141528` | Astranova onboarding | One illustration language across steps, on a soft arch backdrop. Two colours only. Segmented progress dashes. | Small type and heavy buttons make it feel like a template. |
| `141634` | SunSeek | A sky gradient makes the whole screen feel like a place. One thin line glyph is the only logo. One question per screen in a large light heading. Selection inverts fully, so it is unmistakable. | Monospace captions: spec 7.2 allows one family, so not borrowed. |
| `141658` | Nutrition | A warm colour melts into white toward the actions. One tactile 3D hero object. Connected timeline for steps. A ruler picker feels physical. | Paywall patterns do not apply. |

## What repeats across the strongest references

1. **One hero per screen, drawn in light.** Moon, heatmap and BanKo all lead with a single luminous focus. For us that is Sola, with a Skia glow.
2. **A background with a mood.** A tinted or gradient ground rather than flat grey. Colour fades into the base toward the actions.
3. **Quiet surroundings.** Muted secondary text, one accent, one strong action per screen.
4. **Full inversion for selection,** rather than a thin outline.
5. **Depth without shadows:** overlapping shapes, objects that break out of their card, sheets rising over a hero, colour bleed.
6. **Soft edges on data:** lines and lists fade rather than stop.
7. **Size contrast:** one big number or title, then small muted labels.

## How this applies to Solace

All of this fits the existing spec, with no new packages:

- **Today:** a soft colour wash behind Sola fading into the background, then a surface rising over it.
- **Tab bar:** floating pill where the active tab is a lit tile that slides with the shared spring.
- **Mood picker and options:** selection fully inverts to accent or ink.
- **Mood trend:** line fades at both ends, tooltip as a pill, hatching for days with no data.
- **Week and streak:** connected day circles.
- **Chat:** suggested replies as chips directly above the input.
- **Onboarding:** one question per screen, segmented progress dashes, Sola as the single illustration language.
- **Headlines:** key words in ink, the rest in muted.
- **Breathe:** one glowing orb in a nearly empty, tinted field.

Not borrowing: saturated colour blocks, character illustration sets, photo-real or 3D assets, monospace captions, hard square buttons, large shadows on cards.
