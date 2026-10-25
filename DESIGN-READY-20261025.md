# Rolling-paper booklet, one ink on resin: cannabis storefront redesign, 2026-10-25

Live: https://openfront-cannabis-production.up.railway.app  
Commits (master, auto-deployed on Railway): 29cacf1, 6ce2388, 0fd1296, 4f323c5, 9c77e39  
Brief: `~/Code/Euler/state/briefs/design-skills-redesign-2026-10-25.md` (Openfront Batch 3, storefront only)

## The world
The storefront is the store's rolling-paper booklet printed in one ink on resin: a resin-black ground in the store's accent hue, one smoke-paper ink for text, figures and solid button blocks, the booklet's cover held still beside the menu, and every item a thin leaf with a warm gum strip. Besley (Clarendon) prints names, ages and prices; Libre Franklin sets the rest.

Owner bar applied: dark, considered and premium; no grey washed-out ground; no generic SaaS cards; no gradient or glow; UI copy is labels, states and errors only; phone width works. Tessier (dark editorial poster, objects floating on near-black, one display voice used sparingly) was the reference.

## What changed (presentation only; every route, state and workflow kept)
- Menu (home): desktop 5:7 with the sticky cover (age rule, store name, open state, tagline, description, address, hours, directions) and the menu column (search, form, channel and sort tracks, leaves that deal in once and lift on hover).
- Age gate: an opaque cover-stock dialog; nothing behind it is legible before confirmation.
- Visit: the cover beside one record of where, when, phone, age, payment and ordering. Item page: one spec record on the cover stock; the no-photo art is shorter on phone so the name and price land in the first screen.
- Header: Menu and Visit mark the current page; every form shortcut shows on every route. The channel prints only when the store sells both adult-use and medical.

Routes captured: / (menu, with filters), /menu/[id], /visit, the 404, and the age gate.

## Skills used, and how
- **Impeccable** (pbakaus): `impeccable context` loaded project state; `init` wrote `PRODUCT.md` (facts inferred from the repo and the brief, marked as inferred, because the brief ordered no approval stage); `concept-seed --scope direction --mode persuade` rolled the direction against my own ranked list of seven grounded candidates (the roll picked which one to build; challengers were weighed and their disciplines raised into the contract); the direction contract lives in `.impeccable/surfaces/features-storefront.md`; `reference/craft-floor.md` set the build floor; the shipped **impeccable-finish-reviewer** ran a full review, then a verdict pass on the fixes; the **impeccable-documenter** wrote `DESIGN.md` and `.impeccable/design.json` from the shipped code. No image generation was available, so the build was code-led (no comps) and the decision page was skipped (the brief said not to stop for approval).
- **design-taste-frontend** (Leon, tasteskill v2): `draw.mjs` dealt three directions and the full sheet of the chosen one (composition, type system, section blueprints), with slots redrawn only for stated reasons (listed below); the house rules (no eyebrows above headings, no monospace, no tracked tiny capitals, no gradients or glass, no index numbers, two faces at most, 13px type floor) and `lint.mjs` as a gate (0 FAIL on the storefront; deliberate world rules are marked `taste-skill-ignore` with the reason).
- **emil-design-eng**: custom ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, press feedback on every control, hover gated to `(hover: hover) and (pointer: fine)`, entrances from an already-visible default, motion under `prefers-reduced-motion`.
- **frontend-design**: the anti-default calibration (no cream plus serif, no neon on black, no SaaS card kit) and the rule of one bold move per page.
- **high-end-visual-design** and **minimalist-ui** were read; both are opt-in light styles that conflict with the owner's pinned dark direction, so only their restraint on copy and components was used.
- Not used: gpt-taste, creative-director, brand-extract, brandkit, color-expert, animate, prototype, break-ui, mobile-native, pick-ui-library, hallmark, apple-design, taste-design.

Taste-skill direction for this repo: split-stage (the cover stays still while the menu scrolls); type redrawn once because the dealt face is Fontshare-only (not loadable through next/font/google), giving Besley and Libre Franklin; the dealt one-ink palette discipline was kept and translated to dark.

## Gates (final state)
- Typecheck: `tsc --noEmit -p .` through `heavy-exec.py`, child exit 0, 0 errors, after every batch.
- Parity: `python3 -I platform-parity-audit-2026-10-20/parity-check.py` exit 0, drift 0, missing 0, sidebar-branding ok, sidebar-structure ok, after every batch. Only storefront files changed; the shared dashboard shell and platform pages are untouched.
- Live CSS checked for selectors that exist only in the new stylesheet after each deploy (guards against the Railway stale-compile issue).
- Every route below returned 200 (or the intended 404) on the live site with no horizontal overflow at 1440 and 390.

## Finish review
- Round 1 (fresh impeccable-finish-reviewer): disposition **fix**, with a material-fix list. Every item was applied in one batch, typechecked, parity-checked, pushed and recaptured.
- Round 2 (verdict pass on the recaptures): the remaining partials and small regressions it named were fixed in a final batch. The Impeccable documenter then wrote `DESIGN.md` and `.impeccable/design.json` from the shipped code, and the drift it flagged was cleaned up in the last commit. Two rounds is Impeccable's budget for an unattended run, so no third review ran. The final state hasn't been reviewer-certified as **ship**.

## Open items
- The leaf paper fibre is an inline SVG noise field rather than a produced raster texture (no image generation here); the reviewer scored the leaf material partial for that reason.
- The leaf texture still reads as fine vertical streaks (brushed rather than laid paper). A produced paper raster would settle it.

## Before and after
Before: the live site at the start of this work. These shots are on the demo data that existed then; a separate session reset and re-seeded every demo store the same afternoon, so the store name and catalog differ from the after shots.

![before-home-desktop.png](design/redesign-20261025/before-home-desktop.png)
![before-home-phone.png](design/redesign-20261025/before-home-phone.png)
![before-shop-desktop.png](design/redesign-20261025/before-shop-desktop.png)
![before-shop-phone.png](design/redesign-20261025/before-shop-phone.png)

After (live, 1440 desktop and 390 phone, full page):

- [after-form_flower_menu-desktop.png](design/redesign-20261025/after-form_flower_menu-desktop.png)
- [after-form_flower_menu-phone.png](design/redesign-20261025/after-form_flower_menu-phone.png)
- [after-home-desktop.png](design/redesign-20261025/after-home-desktop.png)
- [after-home-phone.png](design/redesign-20261025/after-home-phone.png)
- [after-menu_cmvobtcnc000hlk01s4eewo1l-desktop.png](design/redesign-20261025/after-menu_cmvobtcnc000hlk01s4eewo1l-desktop.png)
- [after-menu_cmvobtcnc000hlk01s4eewo1l-phone.png](design/redesign-20261025/after-menu_cmvobtcnc000hlk01s4eewo1l-phone.png)
- [after-nope-desktop.png](design/redesign-20261025/after-nope-desktop.png)
- [after-nope-phone.png](design/redesign-20261025/after-nope-phone.png)
- [after-visit-desktop.png](design/redesign-20261025/after-visit-desktop.png)
- [after-visit-phone.png](design/redesign-20261025/after-visit-phone.png)
- [gate-home-desktop.png](design/redesign-20261025/gate-home-desktop.png)
- [gate-home-phone.png](design/redesign-20261025/gate-home-phone.png)

Product facts are in `PRODUCT.md`, the direction contract is in `.impeccable/surfaces/features-storefront.md`, and the recorded system is in `DESIGN.md`.
