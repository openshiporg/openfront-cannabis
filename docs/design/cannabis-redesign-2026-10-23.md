# Openfront Cannabis: storefront and platform direction (2026-10-23)

## Who comes first
- **Customer:** an adult (21+) checking what is on the shelf today before walking in: which flower, pre-rolls, vapes, edibles or topicals are in stock, at what price, and whether a product is adult-use or medical. Online ordering is off by policy, so the menu is the whole job: browse by form, open a product, see the price and the in-store state.
- **Merchant:** a licensed dispensary manager whose first question every morning is "are we allowed to sell today?" (license and staff credentials current, no overdue regulator notifications), then "what can we sell?" (released, lab-passed, unexpired packages with free quantity), then receiving, the counter and the cash drawer.

## Direction: "cure label"
The look of a well-made jar label and a certificate of analysis: unbleached paper, resin-green ink, lab-label mono for every number and package UID. Calm and exact; no leaf clip art, no neon, no stock hero.

### Type (Google Fonts, OFL)
- **Fraunces** (soft optical serif) for the store name, page titles and product names: display 40/44 to 64/64 at -0.02em, product titles 18/24 to 32/36.
- **Instrument Sans** for UI words: body 15/24, labels 13/18 medium.
- **Geist Mono** for prices, sizes, counts, package UIDs and section indices, tabular figures.

### Palette (storefront, light)
| Token | Value | Use |
| --- | --- | --- |
| `cn-bg` | `#F3F0E8` | Page ground (paper) |
| `cn-surface` | `#FCFBF7` | Raised: pills, cards, inputs |
| `cn-well` | `#E6E2D6` | Recessed: tracks, art wells, list bands |
| `cn-ink` | `#18201B` | Text, primary buttons |
| `cn-ink-2` | `#545B53` | Secondary text |
| `cn-ink-3` | `#8A8F86` | Tertiary text |
| `cn-line` | `#D9D4C6` | Hairlines |
| `cn-accent` | `hsl(var(--cn-h) 38% 28%)` | Store accent (the merchant's accent hue) |
| `cn-tint` | `hsl(var(--cn-h) 28% 88%)` | Accent wash for product art and selected states |

`--cn-h` is the merchant's saved accent hue; unconfigured and the default mark use 152 (resin green). The default mark is the Untitled UI **Flora&Fauna** registry mark rotated to green (rotation 291 from the registry blue, hue 221).

### Core components
- **Segmented control:** recessed `cn-well` track with a raised paper pill on the active item. Used for the form filter, sort and every in-page button group, on the storefront and the platform.
- **Label tile:** product art when there is no photo: the accent wash, the form in mono caps, the product's initial set large in Fraunces, and the price. Only real data.
- **Status dot:** 8px, on the title line, baseline-aligned.
- **List band:** one recessed band with hairline rows instead of stacked cards.
- **Up-right arrow** for links out; no emoji.

### Layouts
- **Shell:** 21+ age gate (cookie `cn_age_21`, read on the server), 21+ strip, header with logo lockup, Menu link and operator sign-in; phone: logo and a menu sheet. Footer with the lockup and the 21+ line.
- **Menu (home):** store name set large with tagline and description, the "In-store only" state dot on the title line, form track with counts, sort track, product grid (2-up on phone, 4-up on desktop). Sample (demo) catalog as its own band, labelled not for sale.
- **Product:** label tile or photo, title with the in-store dot, mono price and sale increment, channel tags (adult-use, medical), description, "more in this form" rail.
- **404:** inside the shell.

## Platform (dashboard pages under `/dashboard/platform`)
Inside the unchanged shared shell, on the dashboard's own tokens (light and dark). The kit is `features/platform/components/cannabis-ui.tsx`.
- **Page title** with a state dot: every workspace shows "Operating" or "Authority lapsed" from the operating state; Incidents shows overdue notifications.
- **Metric strip:** one recessed band of mono figures, each linking to its filtered list.
- **Filters:** raised pill in a recessed track, counts in mono.
- **Rows:** list bands, status dot on the row's title line, mono IDs and amounts.
- **Forms:** grouped panels with uppercase section labels; every button is a raised pill in a recessed track (ink pill for the primary action).
- **Control room first:** authority state, ready-to-sell, holds, receiving, incidents and overdue notifications; soonest-expiry packages and open incidents beside it.
