# Openfront Cannabis: schema map (2026-10-23)

Source: `features/keystone/models/*.ts`, `features/keystone/access.ts`, `features/keystone/mutations/*.ts`, `features/keystone/domain/*.ts`.

## How writes work here
Every list uses `immutable*Access`: the generic GraphQL create/update/delete operations are denied, and every list hides Create/Delete in the model views (`models/index.ts`). All writes go through domain mutations in `features/keystone/mutations/`. Most run through `runControlledOperation`, which requires:
- a current role permission and a current staff credential covering the activity
- a current license for the premises
- an idempotency key (`IdempotencyKey` receipt)
- an `AuditEvent`, plus an `OutboxEvent` for state-reported actions

Reads for the platform pages go through one resolver, `cannabisOperationsWorkspace(section, options)`, validated client-side by `features/platform/workspaces/lib/contract.ts`.

Sixteen runtime capabilities (`domain/runtimeCapabilities.ts`) stay off until their verified workflow exists. Only `storefront.public-live-menu` is on. "Gated" below means the mutation exists but refuses to run.

## Lists

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| User | Staff login and (unused) customer login | name, email, password, status, onboardingStatus | organization, premises, role, staffCredential, customerProfile | first-run init; `provisionStaffAuthority` | active ↔ disabled; onboarding not_started → in_progress → completed / dismissed |
| Role | Permission bundle | 11 `can*` flags | organization, assignedTo | onboarding (Owner); `provisionStaffAuthority` (one role per staff member) | immutable after create |
| Organization | Licensed business | name, legalName, jurisdictionCode, status | premises, users, storefrontSettings | `runCannabisOnboarding` | pending_authority → active (→ suspended / closed: no mutation) |
| Premises | The licensed store | name, premisesCode, addressSnapshot (address + phone), timezone, currencyCode, status | organization, users, storefrontSettings | onboarding; `amendCannabisPremisesDetails` edits address and phone | pending_authority → active |
| StorefrontSettings | Public identity | businessName, tagline, description, brandHue, logoIcon, logoColor, publicationStatus, storefrontMode, demoCatalog | organization, premises (unique pair) | onboarding; `configureCannabisStorefrontSettings` | draft → published |
| CannabisLicense | State license | licenseNumber, licenseType, regulatorName, authorizedActivities, effective/expires | org, premises | onboarding; `renewCannabisAuthority` | active, conditioned, expired → renewed active |
| StaffCredential | Per-person authority | credentialType/Reference, allowedActivities, approvalLimitCents, effective/expires | user, org, premises | onboarding (owner); `provisionStaffAuthority` | active → suspended / terminated (`revokeStaffCredential`); renew (`renewCannabisAuthority`) |
| Customer | Buyer identity | reference, capacity (adult_use / patient / caregiver), status, contact (restricted), marketingConsent | user, org, premises | `submitCannabisCustomerIntake` (gated) | pending_verification → eligible / ineligible (`recordEligibilityDecision`, gated) |
| EligibilityEvidence | ID and registry check record | identityMethod, hashes, dateOfBirth, registry fields, result, verifiedAt | customer | intake; eligibility decision (both gated) | pending → eligible / ineligible / expired / revoked |
| JurisdictionRulePack | Sales rules | version, ages, hours, purchaseLimits, taxRules, discountRules, allowedTenderTypes, policies, flags | approvedBy | onboarding; `amendCannabisRulePack` | effective → superseded (amend) |
| Product | Menu item | sku, name, brand, form, categoryCode, taxCategoryCode, unit, increment, equivalency, price, channels, status, publicDescription, publicImageUrl | packages | `configureCannabisProduct`; `amendCannabisProduct` | draft / active ↔ inactive |
| InventoryPackage | Tracked package (the unit of custody) | packageUid, batch, lot, quantities (received / on hand / reserved, microunits), status (12), testStatus, lab and COA, expiresAt, labelVersion | product, holds, events | `receiveCannabisPackage` | receiving_hold → saleable needs release (gated); depleted / destroyed via events (gated) |
| PackageHold | Restriction on a package | type (quarantine, test_hold, recall, discrepancy, authority, expiry), status, reason, placedBy/At | package | receiving (none today); **no place-hold mutation** | active → released (`releasePackageHold`, gated) |
| RegulatedManifest | Transfer or receipt manifest | manifestNumber, type, status, licenses, transporter, regulatorManifestId | packageEvents | `receiveCannabisPackage` | receiving_hold → accepted / partial / rejected |
| InventoryEvent | Custody ledger line | eventType (14), quantity delta / before / after, reason, stateReportStatus | package, manifest, actor | receive; generic events (gated) | append-only |
| RecallCase | Recall | reference, status (7), authorityReference, packageUids, batchNumbers, reason | — | **no mutation** | suspected → hold → … → regulator_closed |
| Register | Till | code, name, status | — | `configureRegister`; `amendRegister` | active ↔ maintenance ↔ inactive |
| RegisterShift | Drawer session | status (7), float, expected / actual / variance | register, operator, cashEvents, sales | `openRegisterShift` | open → count (close gated) → variance_review → `approveCashVariance` |
| CashEvent | Drawer ledger line | type (8), amount, reason | shift | open shift (float); others via sale and close (gated) | append-only |
| TenderConfiguration | Accepted payment type | code, type, displayName, enabled, authorityReference | — | onboarding; kept in step by `amendCannabisRulePack` | enabled ↔ disabled |
| Cart | POS or pickup reservation | reference, source, status (10), expiresAt, totals, version | customer, shift, rulePack, eligibilityEvidence, lines | `createPosCannabisCart` / `createCustomerPickupCart` (gated) | draft → reserved → picking ↔ staged (`transitionCannabisCartPreparation`) → final_verification → completed |
| CartLine | Reserved quantity on a package | quantity, equivalency, snapshots, prices | cart, package, product | `addCannabisCartLine` (gated) | — |
| Sale | Finalized receipt | receiptNumber, status (9), capacity and rule snapshots, totals, refunded, receipt and label snapshots | shift, customer, cart, lines, tenders, refunds | `finalizeCannabisSale` (gated) | finalized → state_queued → accepted / rejected → reconciled; partially_refunded / refunded |
| SaleLine | Receipt line | snapshots, quantity, prices, tax | sale, package | finalize | — |
| Tender | Payment on a sale | typeSnapshot, amount, change, status | sale, configuration | finalize | received → captured / reversed |
| Refund | Refund | amount, reason, inventoryDisposition, status | sale | `refundCannabisSale` (gated) | pending → completed |
| AuditEvent | Who did what | action, resourceType/Id, actor, reasonCode, evidence | actor | every controlled command | append-only |
| IdempotencyKey | Command receipts | scope, status, responseSnapshot | actor | every controlled command | processing → succeeded / failed |
| OutboxEvent | State-reporting queue | topic, aggregate, status (7), attempts, errors | — | controlled commands | queued → … → accepted / dead_letter; `retryStateOutboxEvent` |
| StateEventInbox | Inbound regulator events | providerCode, providerEventId, status | — | `recordStateInboxEvent` (gated) | received → verified → processed / rejected |
| IntegrationInstallation | Traceability or other provider | providerCode, providerType, status, capabilities | — | onboarding (traceability) | unconfigured → active (`activateIntegrationInstallation`, gated) |
| ReconciliationRun | Inventory, sales, cash or outbox reconciliation | type, status, discrepancies | owner, approvedBy | `recordReconciliationRun` (gated) | pending → … → approved (gated) |
| ComplianceIncident | Incident register | reference, type (14), severity, status (6), occurred / detected / notification due / reported | actor, owner | `recordComplianceIncident` | open → contained → investigating → reported → resolved → closed (`transitionComplianceIncident`) |

## Merchant workflows

1. **Set up:** init → onboarding (Organization, Premises, CannabisLicense, Role, StaffCredential, JurisdictionRulePack, TenderConfiguration, IntegrationInstallation, StorefrontSettings).
2. **Keep authority current:** CannabisLicense, StaffCredential, JurisdictionRulePack, Premises (renew, amend rules, edit address and phone).
3. **Staff:** User, Role, StaffCredential (add, temporary password, suspend / terminate, review permissions).
4. **Catalog:** Product (add, edit, categories tied to the rules) → public menu.
5. **Receive:** RegulatedManifest, InventoryPackage, InventoryEvent (receive into hold).
6. **Custody:** InventoryPackage, PackageHold, InventoryEvent (readiness, place a hold, release (gated), history).
7. **Recall:** RecallCase, PackageHold (open a case, hold the affected packages, track status).
8. **Verify customers:** Customer, EligibilityEvidence (gated).
9. **Sell:** Cart, CartLine, Sale, SaleLine, Tender (carts and finalize gated; preparation steps live).
10. **Refunds:** Refund (gated) and review.
11. **Cash:** Register, RegisterShift, CashEvent, TenderConfiguration (open shift, variance approval; close gated).
12. **Report and reconcile:** OutboxEvent, StateEventInbox, IntegrationInstallation, ReconciliationRun.
13. **Incidents:** ComplianceIncident.
14. **Audit:** AuditEvent (inspection trail).
15. **Storefront:** StorefrontSettings, Product, InventoryPackage (public menu, product, visit details).

## Coverage before this pass

| Workflow / list | Platform page | State |
|---|---|---|
| Set up | onboarding dialog, setup launcher | OK |
| Licenses, credentials, rules, premises | `/platform/authority` (operations) | OK |
| Rule-pack history (superseded versions) | none | **MISSING** |
| Staff: User, Role, StaffCredential | credential rows inside Authority | **THIN**: no staff list with roles, permissions and activities per person |
| Catalog: Product | `/platform/menu` | **THIN**: no product detail (packages, sales history) |
| Receiving | `/platform/receiving` | OK |
| Custody: InventoryPackage, InventoryEvent | `/platform/inventory` | **THIN**: no way to place a hold |
| PackageHold | listed in Compliance and Inventory | **THIN**: cannot place one |
| RecallCase | count and list in Compliance | **MISSING**: no page, no way to open a case |
| Customer, EligibilityEvidence | pending list in Compliance | **MISSING**: no customer directory or detail |
| Cart, CartLine | `/platform/pos` | OK for what is enabled |
| Sale, SaleLine, Tender, Refund | latest receipts in POS | **MISSING**: no sales history with filters or detail page |
| Register, RegisterShift, CashEvent | `/platform/cash` | **THIN**: no shift detail (cash events) |
| TenderConfiguration | none | **MISSING** (parent: Cash) |
| OutboxEvent, ReconciliationRun | `/platform/reconciliation` | OK |
| IntegrationInstallation, StateEventInbox | count only | **MISSING** (parent: Reconciliation) |
| ComplianceIncident | `/platform/incidents` | OK |
| AuditEvent | none | **MISSING** |
| StorefrontSettings | `/platform/store-settings` | OK |
| IdempotencyKey | none needed (system; command receipts) | n/a |

Lists with no page of their own, by parent:
- CartLine: POS cart detail
- SaleLine and Tender: sale detail
- CashEvent: shift detail
- InventoryEvent: package detail
- EligibilityEvidence: customer detail
- Role: staff detail
- IdempotencyKey: system list, no page needed

## Coverage after this pass

| Workflow / list | Platform page | State |
|---|---|---|
| Rule-pack history | Authority → Sales rule versions | OK |
| Staff: User, Role, StaffCredential | `/platform/staff` (`features/platform/staff`): people, roles, permission and activity chips, add staff, temporary password, suspend / terminate | OK |
| Product | `/platform/menu/[id]` (`features/platform/products`): facts, edit with rule-pack categories, packages with readiness, recent sales | OK |
| PackageHold | Inventory package detail → "Place a hold" (new `placePackageHold`) | OK (release still gated) |
| RecallCase | `/platform/recalls` (`features/platform/recalls`): open / closed / all, held-package counts, "Open a recall" (new `openRecallCase` holds every matching package) | OK (later stages are the regulator's workflow) |
| Customer, EligibilityEvidence | `/platform/customers` and `/[id]` (`features/platform/customers`): status tabs, search, evidence, carts, purchases | OK as a read view (intake and decisions gated) |
| Sale, SaleLine, Tender, Refund | `/platform/sales` and `/[id]` (`features/platform/sales`): status tabs, search, refunds, receipt detail | OK as a read view (finalize and refund gated) |
| RegisterShift, CashEvent | Cash → per-shift drawer ledger | OK |
| TenderConfiguration | Cash → Payment types (changed in the sales-rules amendment) | OK |
| IntegrationInstallation, StateEventInbox | Reconciliation → Integrations, Inbound state events | OK (activation gated) |
| AuditEvent | `/platform/audit` (`features/platform/audit`): record-type track, action search | OK |

## Storefront flows
- Browse: menu with form filter, adult-use / medical filter, search, sort.
- Detail: `/menu/[id]`.
- Visit: `/visit` (address, directions, hours with open now, phone, ages, payment).
- Buy, confirmation and account history: none. Online ordering, customer intake and pickup carts are capability-gated (`commerce.customer-cart`, `privacy.approved-intake`), so there is no customer account to show history for. Purchase is in store.
