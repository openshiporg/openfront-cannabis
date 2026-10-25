---
name: Openfront Cannabis Storefront
description: One ink on resin. The dispensary's menu as a rolling-paper booklet.
colors:
  resin-ground: "hsl(152 22% 7.5%)"
  booklet-stock: "hsl(152 16% 11.5%)"
  gate-well: "hsl(152 20% 5.5%)"
  cover-stock: "hsl(152 30% 13%)"
  smoke-paper-ink: "#ebe5d3"
  ink-faded: "#c4bfae"
  ink-ghost: "#9a9686"
  hue-accent: "hsl(152 42% 70%)"
  leaf-paper: "rgb(235 229 211 / 0.07)"
  gum-strip: "rgb(214 186 120 / 0.2)"
  open-green: "#8fd6a6"
  sample-amber: "#e9bf6d"
typography:
  display:
    fontFamily: "Besley, ui-serif, Georgia, serif"
    fontSize: "88px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Besley, ui-serif, Georgia, serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Besley, ui-serif, Georgia, serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "25px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  label:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
  figure:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0"
    fontFeature: "\"tnum\""
rounded:
  paper: "2px"
  dot: "999px"
spacing:
  track: "4px"
  gutter-phone: "16px"
  gutter: "24px"
  tile-gap: "16px"
  tile-row: "32px"
  column-gap: "48px"
  section-end: "80px"
components:
  pill:
    backgroundColor: "{colors.leaf-paper}"
    textColor: "{colors.ink-faded}"
    typography: "{typography.label}"
    rounded: "{rounded.paper}"
    padding: "0 14px"
    height: "40px"
  pill-active:
    backgroundColor: "{colors.smoke-paper-ink}"
    textColor: "{colors.resin-ground}"
    rounded: "{rounded.paper}"
  pill-phone:
    padding: "0 16px"
    height: "44px"
  leaf:
    backgroundColor: "{colors.leaf-paper}"
    textColor: "{colors.smoke-paper-ink}"
    rounded: "{rounded.paper}"
    padding: "28px 16px 16px"
  cover:
    backgroundColor: "{colors.cover-stock}"
    textColor: "{colors.smoke-paper-ink}"
    rounded: "{rounded.paper}"
    padding: "48px 36px 28px"
  search-field:
    backgroundColor: "{colors.booklet-stock}"
    textColor: "{colors.smoke-paper-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.paper}"
    padding: "0 16px"
    height: "48px"
  record-sheet:
    backgroundColor: "{colors.cover-stock}"
    textColor: "{colors.smoke-paper-ink}"
    rounded: "{rounded.paper}"
    padding: "20px"
  ink-strip:
    backgroundColor: "{colors.smoke-paper-ink}"
    textColor: "{colors.resin-ground}"
    padding: "8px 24px"
  nav-link:
    textColor: "{colors.ink-faded}"
    rounded: "{rounded.paper}"
    padding: "8px 12px"
  nav-link-hover:
    backgroundColor: "{colors.booklet-stock}"
    textColor: "{colors.smoke-paper-ink}"
---

# Design System: Openfront Cannabis Storefront

Scope: the customer storefront only (`features/storefront`, the `.storefront-theme` wrapper and the `cn-*` tokens in `app/globals.css`). The merchant dashboard keeps the shared shadcn tokens and is not described here.

## Overview

**Creative North Star: "The Rolling-Paper Booklet"**

The storefront is printed in one ink on resin. A near-black ground tinted with the store's own accent hue carries a single smoke-paper ink (#ebe5d3) that does every job: text, the big printed initials, figures, and the solid block of a chosen control. The booklet's cover, a deeper hue-tinted stock, holds the age rule, the store name, the open state and the address still beside the menu, and each menu item is a thin translucent leaf with a gummed fold along its top edge.

Everything is set in two faces. Besley, a Clarendon, prints what would be stamped on a booklet: the age, the store name, item names, prices and section names. Libre Franklin sets everything that is read or operated. Corners are square to 2px; surfaces are separated by value steps, never by drawn lines. The page is dense and quiet, and the leaves are the only thing that moves: they deal in once on load and lift when pointed at.

The whole palette re-tints per store. Every ground and the accent are `hsl(var(--cn-h) ...)`, with `--cn-h` set from the store's saved accent hue on the `.storefront-theme` wrapper (default 152). The ink, its two fades and the two status colours stay fixed so the text never shifts with the store's hue. The frontmatter values are the default hue resolved.

**Key Characteristics:**
- One ink (#ebe5d3) on a hue-tinted resin ground; the chosen control is an ink block with ground-coloured type.
- A still cover on deeper stock beside a grid of translucent paper leaves.
- Besley prints names, ages and prices; Libre Franklin sets everything read; figures are tabular.
- Square 2px corners and no rule lines; depth is value steps.
- The paper texture is an inline SVG noise field, not a raster asset.
- Motion is one deal-in on load and a lift on hover, eased `cubic-bezier(0.23, 1, 0.32, 1)`, and off under reduced motion.

## Colors

A resin-black ground and three deeper or lighter stocks in the store's hue, one warm paper ink with two fades, and two status colours that never decorate.

### Primary
- **Smoke-Paper Ink** (`smoke-paper-ink`): the only ink. Headings, body copy on the cover, the printed initial on a leaf, prices, the age strip ground, the chosen pill, the selection highlight and the focus outline. The ink at 30% is the resting underline on inline links (Directions, phone).

### Secondary
- **Hue Accent** (`hue-accent`): the store's hue lifted to a pale tint. Used sparingly: the footer Directions link and the cover's state dot when hours aren't published. It never fills a block.

### Neutral
- **Resin Ground** (`resin-ground`): the page, the sticky header and the type on ink blocks.
- **Booklet Stock** (`booklet-stock`): the search field, the phone menu panel, the phone menu button and the hover ground behind header links.
- **Cover Stock** (`cover-stock`): the booklet cover on the menu and visit pages, the item's record sheet, the age gate card and the footer.
- **Gate Well** (`gate-well`): the opaque ground behind the age gate, deeper than the page so nothing past the gate shows.
- **Ink Faded** (`ink-faded`): secondary text, resting pills, nav links, definition terms.
- **Ink Ghost** (`ink-ghost`): counts beside labels, placeholders, the 404 numeral, the closed-state dot.
- **Leaf Paper** (`leaf-paper`): the translucent paper of leaves, resting pills and the phone menu rows. It is the ink at 7%, so a leaf is the ink thinned, not a new colour. Hover raises it to 10% on leaves and 12% on pills; a status band (`cn-band`) uses 6%.
- **Gum Strip** (`gum-strip`): the 12px warm band along the top of every leaf.

### Status
- **Open Green** (`open-green`): the "Open now" and "In stock" dot.
- **Sample Amber** (`sample-amber`): the "Sample · not for sale" and "unavailable" dots and the Sample tag on demo leaves.

Status colours appear only as 8px round dots or a short tag beside a written label; the label always carries the meaning.

### Named Rules
**The One Ink Rule.** Text, figures, drawings and solid controls all use the smoke-paper ink or one of its two fades. There is no second text colour and no coloured button.

**The Store's Hue Rule.** Grounds and the accent come from `--cn-h`, never from a fixed hex, so every store prints the booklet in its own hue. Only the ink and the status colours are fixed.

## Typography

**Display Font:** Besley (with ui-serif, Georgia, serif), loaded via next/font as `--font-cn-besley`
**Body Font:** Libre Franklin (with ui-sans-serif, system-ui, sans-serif), loaded as `--font-cn-franklin`
**Figures:** Libre Franklin with tabular numerals (`.cn-num`)

**Character:** A heavy Clarendon stamped like the name on a booklet cover, against a plain American gothic that does the reading. Display type is always weight 700 at -0.02em.

### Hierarchy
- **Display** (700, 48px phone / 72px / 88px wide, 0.95): the store name on the cover; the cover's age rule at 64px/88px and the age gate's at 96px.
- **Headline** (700, 40px / 52px, 1): "Menu" and other page heads; item names on the item page (40px/60px), the item price (44px), the 404 title (44px/64px), related-items head (32px).
- **Title** (700, 18px/23px phone, 20px/25px, -0.02em): item names under leaves; footer section heads at 17px; visit-page terms at 20px; empty-state lines at 24px; the cover tagline at 22–24px.
- **Body** (400, 16px/26px, max 46ch on the cover; 17px/28px max-prose for item descriptions): description and read text.
- **Label** (600, 14px; 15px in the age gate; 13px in the age strip): pills, nav links (15px, 600 when current), status lines.
- **Figure** (400–600, 13–15px, tabular): counts, prices under leaves (14px, 600), hours, SKU.

### Named Rules
**The Stamp and Read Rule.** Besley prints names, ages, prices and section names; anything a visitor reads in sentences or operates is Libre Franklin. A leaf's printed initial (96–240px) is the largest Besley on the page.

**The Tabular Figure Rule.** Every count, price, hour and SKU uses tabular numerals in the text face so columns of figures hold.

## Layout

A 1440px maximum container with 16px gutters on phones and 24px from 640px. On the menu and visit pages the desktop (1024px and up) splits 5:7 with a 48px gap: the cover on the left, sticky at 80px from the top and at least the viewport height less 112px; the menu on the right, starting 24px lower. Below 1024px the cover stacks first, then the menu.

The menu grid is two columns on phones and tablets and three from 1280px, with 12px (phone) / 16px column gaps and 32px between rows. Filter tracks sit in a column with 8px between rows and 4px between pills; tracks scroll sideways without a scrollbar instead of wrapping. The item page splits 1:1 with a 56px gap and a sticky leaf; related items run four across from 1024px. Pages end with 80px of space before the footer. The footer is a 1.2:1:1:1 grid on desktop.

Above the header runs a full-width ink strip (age label left, open state right); the 64px header below it is sticky on the resin ground.

Phone widths (below 640px) raise every storefront control to at least 44×44px and pills to 44px tall.

## Elevation & Depth

Flat and tonal. Surfaces separate by value: gate well under resin ground under booklet stock under cover stock, with leaf paper as a translucent layer of ink over whatever it sits on. Nothing at rest has a drop shadow except the two floating layers below.

### Shadow Vocabulary
- **Floating panel** (`box-shadow: 0 24px 48px -12px rgb(0 0 0 / 0.7)`): the open phone menu.
- **Gate card** (`box-shadow: 0 32px 80px -20px rgb(0 0 0 / 0.8)`): the age gate card over the well.

### Named Rules
**The Value Step Rule.** Depth is a step in lightness within the store's hue. Shadows belong only to layers that float over the page (the phone menu and the age gate).

**The No Hairline Rule.** No borders or rule lines separate surfaces, rows or sections. Inline-link underlines (the ink at 30%, 2px on the cover) are type, not dividers, and are allowed.

## Shapes

Every rectangle is cut at a 2px corner: leaves, the cover, pills, fields, the record sheet, the age gate card, photos inside leaves, and the phone menu. The only round form is the 8px status dot. The leaf is a 4:5 portrait (3:2 on the item page below 1024px); its gum strip takes the top 12px and keeps the 2px top corners.

## Components

### Pills and Tracks
Plain paper tabs that become a solid ink block when chosen.
- **Shape:** 2px corners, 40px tall (44px on phones), 14px side padding (16px on phones), 4px apart in a track that scrolls sideways.
- **Resting:** leaf paper ground, faded ink, Libre Franklin 14px 600. A count rides inside in ghost ink, tabular, 13px.
- **Hover (fine pointers only):** paper rises to 12%, text to full ink, 160ms.
- **Chosen** (`aria-current="page"` or `data-active`): a solid ink block with resin-ground type; the count drops to a dark hue tint. `data-tone="ink"` gives the same block to a primary action (the gate's Yes, Directions on the visit cover).
- **Press:** scale 0.97. **Focus:** 2px ink outline, 2px offset.
- Pills are the only buttons. Search, Clear filters, Try again, Back to menu and the age answers are all pills.

### Leaves (product tiles)
The signature component: a thin, translucent page pulled from the booklet.
- **Paper:** leaf paper at 2px corners, overlaid with an inline SVG `feTurbulence` noise field (fractalNoise, base frequency 0.9 × 0.05, two octaves, printed in the ink at about 22% strength) that reads as long paper fibre. It is a data-URI SVG in the stylesheet; there is no raster texture asset.
- **Gum strip:** the top 12px in gum strip colour.
- **Content:** with a photo, the photo sits inset (8% sides, 12% top) at 2px corners. Without one, the leaf prints the item's form (13px faded) top-left, an optional Sample tag in amber top-right, the item's initial in Besley at 96–120px (240px on the item page), and the channel (Adult-use · Medical) bottom-left, all from real fields.
- **Under the leaf:** the item name in Besley title, the price right-aligned in tabular 14px 600, or "Not for sale" in ghost ink.
- **Motion:** leaves deal in once (560ms, 18px rise, 50ms stagger capped at 300ms); on hover the leaf lifts 6px and its paper rises to 10%; press scales the tile to 0.98. Focus is a 2px ink outline at 4px offset.

### The Cover
The booklet's cover, held still beside the menu.
- **Stock:** cover stock, 2px corners, 48px top / 28px bottom, 24px sides (36px from 640px).
- **Contents, top to bottom:** the age rule in display Besley, then pushed to the foot, the store name in display, the open state with its dot, the tagline in Besley, the description, and a line of address, hours and an underlined Directions link. The visit page cover carries the age, the name and two pill actions.

### Inputs / Fields
- **Style:** booklet stock, no border, 2px corners, 48px tall, 16px text, ghost-ink placeholder.
- **Focus:** a 2px ink ring.

### Record Sheet
The item's facts as a definition list on cover stock, 20px padding, 12px between rows: faded term left, ink value right. The visit page uses the same term/value pairing without the sheet, terms in Besley 20px faded.

### Navigation
- **Ink strip:** full-width ink band above the header, resin type at 13px 600: the age label left, the open state with a dot right.
- **Header:** sticky, 64px, resin ground. The store logo SVG and name (Besley 19px, 500) left; text links at 15px faded ink, full ink and 600 when current, booklet-stock ground on hover; Staff sign in at the right.
- **Phone:** a 44px booklet-stock button opens a panel of leaf-paper rows (48px tall, 16px text, counts in ghost ink).
- **Footer:** cover stock; Besley 17px section heads (Visit, Hours, Payment), 14px text, then the age rule in Besley and plain links.

### Age Gate
A cover-stock card (max 440px, 2px corners, the gate card shadow) over the opaque gate well, bottom-anchored on phones and centred from 640px. Store name in Besley 20px, the age at 96px with its rule beside it, the question at 28px, then a two-up track: No as a resting pill, Yes as an ink block, and a patient pill when a medical age exists.

### Status Bands
Unavailable, no-match and empty states sit in a 6% ink band at 2px corners with a dot, a Besley line and, when there is a way out, one chosen pill.

## Do's and Don'ts

### Do:
- **Do** draw every ground and the accent from `hsl(var(--cn-h) ...)` so the store's hue re-tints the booklet.
- **Do** use the smoke-paper ink (#ebe5d3) and its two fades for all text, and make the chosen control a solid ink block with resin-ground type.
- **Do** cut every rectangle at 2px and separate surfaces by value steps.
- **Do** set names, ages, prices and section names in Besley 700 at -0.02em, and everything read in Libre Franklin.
- **Do** use tabular figures for counts, prices, hours and SKUs.
- **Do** build an item's art only from real fields (form, initial, channel, Sample) when there is no photo.
- **Do** pair every status dot with a written label.
- **Do** keep controls at least 44px on phones and gate motion behind `prefers-reduced-motion`.

### Don't:
- **Don't** draw borders, hairlines or divider rules between surfaces or rows.
- **Don't** use rounded cards, pill-shaped buttons or any radius other than 2px (the 8px dot excepted).
- **Don't** add a second text colour or fill a block with the accent or a status colour.
- **Don't** shadow anything that sits on the page; shadows are for the phone menu and the age gate only.
- **Don't** return to the cream "cure label" page or the neon-green dispensary template.
- **Don't** replace the leaf's SVG noise field with a raster texture or a stock photo.
