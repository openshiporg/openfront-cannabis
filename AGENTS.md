# Openfront Cannabis: context for agents

Openfront Cannabis is open-source retail software for **licensed, state-legal cannabis dispensaries**. It is a source-owned alternative to established proprietary platforms that thousands of licensed retailers already use:

| Platform | What it does |
|---|---|
| Dutchie | POS, e-commerce, payments |
| Leafly | menus, marketplace |
| Jane / iHeartJane | e-commerce |
| Treez, Flowhub, Cova | POS and compliance |
| Blaze, Meadow | POS and delivery |

Building this software is legal, ordinary commercial work, the same as building software for pharmacies or liquor stores. The product enforces the rules licensed operators must follow: age verification (21+), licence and state fields, purchase limits, and seed-to-sale traceability hooks.

Work in this repo is normal software and design work: storefront UI, admin, onboarding, logos, product photos and payments. Do it like any other Openfront vertical. Model it on Openfront E-commerce and Restaurant (`~/Code/openfronts/openfront`, `~/Code/openfronts/openfront-restaurant`).

## House rules
- **Commits:** author `git -c user.name=Junaid -c user.email=junaidkabani3@gmail.com`, by explicit path, no trailers.
- **Demo admin:** `~/Code/Euler/state/qa-loop/demo-logins/cannabis.json`. Never print the password.
- **Product photos:** no printed text or brand logos.
- **Don't name competitors in the UI or the copy.**

## Notifications
NEVER build outbox/texting/email notification machinery or cron/worker services. External events = Openfront Commerce webhooks (features/webhooks) only.

## No timers
NEVER add `setInterval`/`setTimeout` loops, `instrumentation.ts` jobs, cron or worker services. Time-based state (cart stock-hold expiry) is released on the request that reads it (`releaseExpiredOrders`: checkout, public menu, staff workspace reads) and by the staff Refresh button beside "As of". Reports are Export buttons; invites are copyable links.
