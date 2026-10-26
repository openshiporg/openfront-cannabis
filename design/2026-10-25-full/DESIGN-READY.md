# Cannabis: full redesign of platform pages and storefront (2026-10-25/26)

Brief: `~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. Owner addition mid-run: a new storefront mark from the Untitled UI registry (no circle-based mark, white-to-grey gradient, no tile behind it) and a better type pairing.

Live: https://openfront-cannabis-production.up.railway.app
Commits on master, each auto-deployed: `bc6ce7a` (redesign), `96bcdd2` (rail and phone fixes), `0eab876` (finish-review fixes), `dcc2e85` (scroller fix and after screenshots), plus the commit carrying this report.

## Critique of the previous UI (before screenshots in `before/`)
- **Platform.** Every control was a raised pill in a recessed rounded track, and every surface was a 12px recessed band. Metric strips in mono figures topped every page. The control room was a 12-row stock list plus a 15-row "Your workspaces" list that repeated the sidebar, with nothing ordered by what needs doing. The menu page put SKUs in mono noise under each name, and the add-product form took half the page.
- **Storefront.** The rolling-paper booklet gave every item an identical monogram tile (a giant initial on streaky SVG noise), so the menu read as twelve letters, not products. The cover spent the first viewport on a 88px "21+" and the store name. Filters were pill chips. The logo was a circle tile with a leaf on it. Besley with Libre Franklin.

## Platform (`features/platform/**`), Operate mode inside the shared shell
- **Kit (`cannabis-ui.tsx`).** Underline `Tabs`/`TabLink` on a ruled baseline replace pill tracks. Buttons are flat 5px blocks, with solid foreground only for the one primary action. `Table`, `RecordList` and `RecordRow` give dense bordered tables with a header row and labelled cells on a phone. `StatusText` puts the coloured status in its own column. Radii are pinned at 6px or less: the dashboard radius token renders `rounded-md` at 8px, so explicit values are used. Table scrollers are positioned, so sr-only header cells can't widen the phone page. The old pill names remain as aliases only for the onboarding dialog, which the brief puts out of scope.
- **Control room.** Opens on a "Needs attention" queue ordered by regulatory urgency: overdue notifications, open incidents, held packages, receiving holds. Then a "Ready to sell, soonest expiry" table, open incidents, and a compact grouped workspace index (Sell, Stock, Compliance, Store) that stays permission-filtered.
- **Authority.** Licenses and staff credentials are status-first tables with renew, temporary-password and revoke actions on each row. Validity shows as dates. Sales rules and premises are ruled definition lists, and purchase limits name their limit equivalency.
- **Compliance, Reconciliation, Sales, Customers, Audit.** Underline status tabs with counts, plus real tables with a status column. Failed state reports come first, with retry.
- **Menu.** A status-first product table: name, then SKU and rules on one line. Edit opens the product page's edit panel. "Add a product" sits behind a disclosure.
- **Inventory and Receiving.** The package list leads with compliance state, next to a custody detail panel. Receiving is receive-first: the form sits beside the manifests and their detail.
- **POS and Cash.** New sale and open carts sit beside cart preparation, with receipts as a table. Shifts are a status-first record list with close and approve actions; registers and payment types are tables.
- **Store Settings.** The preview shows the new catalog storefront in miniature. The logo picker is a flat grid.

## Storefront (`features/storefront/**`, `app/site.css`)
- **World.** The store's house catalog, printed like a 1990s seed-bank catalog (direction contract in `.impeccable/surfaces/features-storefront.md`, `seed:2c0cbe4c775bac1d`). Warm catalog black ground. One real plant photograph on the cover: "Silver star haze in bloom", Cannabis Pictures, CC BY 2.0, credited in the footer, with provenance embedded in the JPEG. The menu runs as chapters by form, each opened by a solid process-ink band that stays pinned while its entries scroll. A pinned chapter rail marks the chapter in view.
- **First viewport.** The cover photo runs the fold, with the store name and tagline on its lower edge. Beside it sit the open state, address, hours, age and payment, Directions, and the chapter index with honest counts. On a phone the photo comes first at 4:3, then the name.
- **Menu entries.** Name and price share one baseline, with one price column through every chapter. A spec line gives form, channel and "In store", followed by the description. Search, sort and channel filters are underline text tabs, and every query-string filter still works.
- **Item page.** The chapter-ink plate carries the item's record (form, price, sold for, buy in store) instead of repeating its name. SKU, purchase rule and store state come next, then the description, Directions, and more items in the same form.
- **Visit page, age gate, 404.** All in the same world. The age gate is opaque.
- **Mark.** Untitled UI "Luminous" (three leaf-like blades, no circle), filled with a white-to-grey gradient, no tile behind it. It is the new default in `lib/brand.ts`, and the live store's saved logo was switched to it through Store Settings.
- **Type.** Bricolage Grotesque, condensed and heavy, for names, prices and chapter titles; Albert Sans for reading text.

## Skills used, and on what
- **impeccable** (every screen):
  - `context` loaded PRODUCT.md, DESIGN.md and the surface brief.
  - `concept-seed --scope direction --mode persuade` rolled the storefront direction against my ranked list of seven. It assigned #3, the seed-bank catalog, and each declined challenger's discipline was raised into the contract.
  - `surface-brief write` recorded the contract, and `reference/craft-floor.md` and `operate.md` set the build floor and the platform's Operate rules.
  - `embed-prompt` recorded the cover photo's provenance, and `detect` ran over storefront and platform: advisory findings only, all measured against the previous world's DESIGN.md.
  - The shipped **impeccable-finish-reviewer** returned **fix** with 8 material items. Items 1–7 were applied in `0eab876`: warm ground, full-height cover, item record plate, status-first tables, menu density, inventory and Authority fixes. Item 8 (radii inside onboarding components) was declined, because the brief forbids touching onboarding files.
- **Memory traps from earlier redesigns:** the 8px dashboard radius, sr-only scroller overflow, the stale CSS compile (the root stylesheet was renamed `site.css`), and next/font variable scope.
- Not loaded this run: design-taste-frontend, high-end-visual-design, minimalist-ui, industrial-brutalist-ui, gpt-taste, frontend-design, emil-design-eng, creative-director, brand-extract, brandkit, color-expert, apple-design and hallmark. The impeccable roll and contract carried the direction.

## Gates
- **Typecheck:** `tsc --noEmit -p .` through heavy-exec, exit 0 with 0 errors after the last type-relevant change. `dcc2e85` changed only className strings.
- **Unit tests:** `node --test tests/family-security.test.cjs` passed 14/14 (exit 0); `tests/shared-dashboard.test.cjs` passed 8/8 (exit 0).
- **Parity:** `parity-check.py` drift 0, missing 0, sidebar branding and structure ok. The shared shell is untouched.
- **Live CSS:** new-only selectors (`cn-band`, `cn-entry`) were confirmed in the served stylesheet after each deploy.

## Open items
- **Logo can revert.** The onboarding seed (`features/platform/onboarding/lib/seed.json`) still holds the old circle-tile logo; the brief forbids editing seed files. A re-onboarded demo would bring that logo back until the seed is changed.
- **Unreviewed fixes.** The finish reviewer's verdict pass on the applied fixes hasn't run.
- **DESIGN.md is stale.** It still documents the previous world and hasn't been regenerated for this one (the impeccable-documenter step).
- **Empty platform states.** The demo store has no carts, incidents or holds, so several platform tables show their empty states in the after screenshots.

## Screenshots
`before/` holds the live site before the redesign; `after/` holds it after, at 1440 desktop and 390 phone (2x), full page. Captures use Playwright WebKit, because Chromium navigation hangs on this machine.
