# Generation Feed: design

The visual design for M2–M4. Build the UI to match these boards pixel for pixel.

| What | Where |
| --- | --- |
| Figma frame (header + 3 cards) | _Add the link here after the steps in "Figma" below_ |
| Tokens for code | [app/tokens.css](../../app/tokens.css), imported by `app/globals.css` |
| Tokens for Figma | [tokens.figma.json](tokens.figma.json), same values in the W3C design-tokens format |

## Boards on the canvas

| Board | Shows |
| --- | --- |
| Foundations | Colors with contrast, type scale, lanes, radii, motion, focus ring |
| Header (Figma frame) | Desktop default and filtered, tablet, phone, phone with search open |
| Cards (Figma frame) | Image card, video card, focused/hovered video card, at desktop and phone size, plus anatomy |
| Feed · desktop | 1440 px, 5 lanes, 8 px gaps, every aspect ratio, one focused card |
| Feed · phone | 390 px, 2 lanes, 4 px gaps |
| Detail overlay · desktop | Video with browser controls, side panel, prev/next, close (focused on open) |
| Detail · phone | Image detail, stacked layout |
| States | Skeletons, page error + Retry, no results + Clear filters, failed media + retry icon, offline banner, play icon, card load sequence, control states |

All placeholder media is CSS gradients, no real images.

## Key choices

**Accent: "Ember" `#FF7A45`.** A warm orange, picked on its own and not taken from any
other product. Warm color stands out against neutral dark grey without tinting the
media, and it is used sparingly: the selected chip, primary buttons, the logo mark and the
focus ring. It scores 7.6:1 on the page, so it is strong enough to be the focus ring too,
and dark text on it scores 7.5:1.

**Neutral greys.** The greys have almost no color in them, so the media's own colors look
true. Text levels are 17.6:1 (fg), 8.3:1 (fg-muted) and 5.8:1 (fg-subtle) on the page.
All pass WCAG AA (4.5:1).

**Font: Instrument Sans.** A Google Font, so `next/font/google` self-hosts it and adds a
size-matched fallback (no layout shift). It is one variable file for all weights
(we use 400, 500 and 600), which keeps the download small. It stays clear at 11–13 px,
which matters because badges and chips are small. It also differs from Geist, the font
create-next-app ships with, so the project has its own look.

**Badges on media.** Badges sit on a solid 72 % dark scrim. Even on pure white media the
text scores 7.3:1. There is no `backdrop-filter` blur: blurring behind up to 150 cards
while videos play costs a lot of GPU time.

**Motion only explains state.** Two durations and one easing. Fades only (placeholder →
poster → video, overlay open/close), nothing slides or bounces. Reduced motion sets both
durations to 0 ms in one place.

**Focus ring.** 2 px focus color with a 2 px gap (`outline-offset`). The gap shows the page
color, so the ring is visible even around white media. A focused card gets `z-index: 1`
so its ring sits above neighbors in the 4 px phone gap.

### Small calls to note when building

1. **Offline banner floats.** It is fixed near the bottom of the screen instead of
   pushing the page down from the top. Same text as the spec; it just can't cause layout
   shift.
2. **Phone search collapses.** Below 640 px the search box is an icon button in the
   header. Tapping it turns the first header row into the search field (16 px text so iOS
   doesn't zoom), with the result count inside the field and a Cancel button.
3. **Card structure.** A `<button>` can't be inside an `<a>`. So a card is a wrapper with a
   full-size `<a href>` and the retry or play `<button>` placed above it as a sibling.
4. **Video controls in the detail view** are the browser's own (`controls`). The bar on the
   board only shows where they appear.

## Tokens

All values are in [app/tokens.css](../../app/tokens.css). Contrast is measured on `bg`.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#0B0B0C` | Page and sticky header |
| `surface` | `#141416` | Detail panel, inline error row |
| `surface-raised` | `#1D1D20` | Inputs, chips on hover, menus, toasts |
| `skeleton` | `#18181B` | Loading cards |
| `line` | `#2A2A2F` | Dividers (decorative) |
| `line-strong` | `#62626B` | Input and select borders, 3.1:1 |
| `fg` | `#F2F2F3` | Main text and icons, 17.6:1 |
| `fg-muted` | `#A8A8B0` | Secondary text, result count, 8.3:1 |
| `fg-subtle` | `#8B8B94` | Placeholders, key hints, 5.8:1 |
| `accent` | `#FF7A45` | Selected chip, primary button, logo, 7.6:1 |
| `accent-hover` | `#FF9466` | Primary button hover |
| `on-accent` | `#1A0A03` | Text on accent, 7.5:1 |
| `focus` | `#FF7A45` | Focus ring |
| `danger` | `#FF6B81` | Error icons (error text stays `fg`), 7.2:1 |
| `scrim` | `#0B0B0C` at 72 % | Badges and icon buttons on media |
| `backdrop` | `#060607` at 94 % | Behind the detail overlay |

### Type (Instrument Sans)

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-2xs` | 11 / 16 | Badges (“AI” is 600, uppercase, `tracking-label` +0.04em) |
| `text-xs` | 12 / 16 | Labels, key hints |
| `text-sm` | 13 / 18 | Chips, inputs, buttons, result count (500) |
| `text-base` | 14 / 20 | Body text |
| `text-md` | 16 / 24 | Prompt in the detail view, phone search input, wordmark (600) |
| `text-lg` | 20 / 28, −0.01em | State headings (600) |
| `text-xl` | 28 / 34, −0.02em | Big numbers on `/stats` (600) |

### Spacing, grid, radii, motion

| Token | Value | Use |
| --- | --- | --- |
| `spacing-lane-sm` | 4 px | Grid gap and padding below 640 px (2 lanes) |
| `spacing-lane-md` | 6 px | 640–1023 px (3 lanes) |
| `spacing-lane-lg` | 8 px | 1024 px and up (4 lanes, 5 from 1440 px) |
| `container-lanes-3/4/5` | 640 / 1024 / 1440 px | Grid width breakpoints for `@lanes-3:` etc. |
| `spacing-control` | 36 px | Chips, inputs, buttons (44 px tap area on touch) |
| `spacing-header` | 56 px | Desktop header, from 1280 px (below that: 52 + 44 px rows) |
| `spacing-panel` | 380 px | Detail side panel |
| `radius-badge` | 4 px | Badges, key hints |
| `radius-card` | 6 px | Cards, skeletons, detail media |
| `radius-control` | 8 px | Inputs, buttons |
| `radius-panel` | 12 px | Error row, larger boxes |
| `radius-pill` | 9999 px | Chips, offline banner |
| `shadow-popover` | soft shadow + 1 px light edge | Only for things that float |
| `--dur-fast` | 120 ms | Hover/press colors, video fading in over its poster |
| `--dur-base` | 220 ms | Poster fading in, overlay open/close |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | All transitions |

Grid padding equals the gap, so: lane width = (grid width − (lanes + 1) × gap) ÷ lanes.
`LANE_STEPS` in `lib/masonry-layout.ts` (from the Genframe Kit) uses the same numbers (4 / 6 / 8 px,
640 / 1024 / 1440 px).

## Using the tokens in code

This is already wired up:

1. `app/globals.css` imports `app/tokens.css` right after `@import "tailwindcss";`.
2. `app/layout.tsx` loads the font and puts it on the page:

   ```tsx
   import { Instrument_Sans } from "next/font/google";

   const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
   // <html className={instrumentSans.variable}> ... <body className="bg-bg font-sans text-base text-fg">
   ```

3. Class examples: `bg-surface text-fg-muted rounded-card text-sm`,
   `h-control px-3.5 rounded-pill`, `@container` on the grid wrapper plus
   `gap-lane-sm @lanes-3:gap-lane-md @lanes-4:gap-lane-lg`, transitions with
   `transition-opacity duration-(--dur-base) ease-out`, focus with
   `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`.

Notes:
- `@theme static` keeps every token in the CSS output, so `var(--color-accent)` also works
  in plain CSS and in JS.
- The color, type and radius resets (`--color-*: initial` etc.) remove Tailwind's default
  palette, so only these tokens exist. Add `--color-white` if you ever need it.
- With reduced motion the durations are 0 ms, and a 0 ms transition fires no
  `transitionend` event. Don't wait for that event; the poster → video swap already uses
  `requestVideoFrameCallback`.

## Figma

No tool in this setup can write to Figma, so the frame is rebuilt by hand (about 1–2
hours).

1. In Figma, create a design file called "Generation Feed".
2. Add the tokens as variables. Fast way: install the Tokens Studio plugin, load
   `tokens.figma.json`, and export the tokens to Figma variables. Manual way: open
   Local variables, make a collection "Generation Feed", and add the 16 colors and the
   spacing and radius numbers from the tables above.
3. Make text styles 2xs to xl with Instrument Sans (built into Figma's Google Fonts).
4. Frame "Header / Desktop", 1440 × 57: horizontal auto layout, padding 0 16, gap 12,
   items centered, fill `bg`, 1 px bottom stroke `line`. Add the wordmark, three chips
   (36 tall, padding 0 14, pill radius), the model and collection selects, the search field (280 × 36),
   and the result count pushed right. Add "Header / Phone", 390 × 97, the same way: its
   second row holds the chips and a Filters button (funnel icon, a count badge when a model or
   collection is set) that opens a bottom sheet with both selects and a "Show N results"
   button. Copy sizes from the Header board.
5. Components "Card / Image", "Card / Video", "Card / Video focused", 278 × 348: radius 6,
   clip content, a gradient fill as placeholder media. Badges are auto-layout frames,
   20 tall, padding 0 6, radius 4, fill `scrim`, placed 8 px from the edges (see the
   Anatomy list on the Cards board). Figma has no outline offset, so for the focused
   card add a frame 8 px bigger than the card with a 2 px inside stroke `focus`,
   radius 10, and center the card in it.
6. Share the file as "Anyone with the link can view" and paste the link into the table
   at the top of this file and into the project README.
