# Product

<!-- impeccable:product-schema 1 -->

Inferred on 2026-10-25 from the repository (storefront source, `docs/design/cannabis-redesign-2026-10-23.md`, QA audits) and the owner's redesign brief (`~/Code/Euler/state/briefs/design-skills-redesign-2026-10-25.md`). The owner ordered the work without an approval stage, so no interview took place. Every line below is inferred, not confirmed.

## Platform

web

## Users
- **Customer (storefront):** an adult (or a registered patient where the store sells medical) deciding what to buy before walking into one licensed dispensary. They check that it's open, where it is, what forms are on the menu (flower, pre-rolls, edibles and so on), prices, and whether an item is adult-use or medical.
- **Merchant (platform):** dispensary staff running intake, compliance, inventory and the in-store sale. The platform shell is shared with Openfront E-commerce and isn't in scope for storefront work.

## Product Purpose
A public menu for one dispensary. All purchases happen in store after staff verify age and eligibility; there is no online ordering. Success is a customer who knows what they want and walks in.

## Positioning
The menu is a live projection of the store's compliant catalog and sales rules: the age gate and age strip use the store's own adult and medical ages, channel eligibility per item, open state and tenders.

## Operating Context
Routes: `/` (menu, with search, form filter, channel filter and sort), `/menu/[id]` (item), `/visit` (address, hours, phone, ages, payment, ordering), the not-found pages, and the age gate on first visit. Staff sign in links to the dashboard.

## Capabilities and Constraints
- In-store purchase only. The storefront must never imply delivery, online ordering or payment.
- In demo mode the store shows a sample menu marked "Not for sale".
- Product photos are optional. The no-photo tile is built only from real fields.
- Age-gated: nothing is shown past the gate until the visitor confirms their age.

## Brand Commitments
- The store's own name, logo SVG and accent hue (from store settings) are the brand. The default mark is Untitled UI Flora&Fauna.
- Owner direction for this redesign (2026-10-24): dark, considered and premium; no grey, washed-out grounds; no generic SaaS cards; UI copy is labels, states and errors only; phone width must work. Tessier (`~/Code/shops/tessier`) is the reference the owner likes.

## Evidence on Hand
Live menu data and store settings. No health claims, effects claims, reviews or press, and none may be invented.

## Product Principles
1. Compliance first: the age gate, eligibility and "in store only" stay clear and truthful.
2. Show only the store's real fields; no effect or potency claims the record doesn't hold.
3. Every route, state and workflow stays. Presentation changes; behaviour doesn't.
