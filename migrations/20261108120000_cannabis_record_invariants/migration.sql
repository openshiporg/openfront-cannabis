-- Record invariants the commands already keep, made unbreakable at the database.
-- Every row in production satisfied all of these before this migration (checked 2026-11-08).
-- Partial unique indexes and CHECKs live only in SQL; Prisma does not model them.

-- Capacity: stock is never negative and never reserved beyond what is on hand.
ALTER TABLE "InventoryPackage"
  ADD CONSTRAINT "InventoryPackage_quantities_check" CHECK (
    "quantityReceivedMicrounits" > 0 AND "quantityOnHandMicrounits" >= 0
    AND "reservedMicrounits" >= 0 AND "reservedMicrounits" <= "quantityOnHandMicrounits"
    AND "version" >= 1 AND "reservedMicrounits" IS NOT NULL AND "version" IS NOT NULL);

-- The inventory ledger conserves quantity on every row.
ALTER TABLE "InventoryEvent"
  ADD CONSTRAINT "InventoryEvent_conservation_check" CHECK (
    "beforeQuantityMicrounits" >= 0 AND "afterQuantityMicrounits" >= 0
    AND "afterQuantityMicrounits" = "beforeQuantityMicrounits" + "quantityDeltaMicrounits");

-- Money: no negative amounts; totals equal subtotal - discount + tax; refunds never exceed the sale.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_amounts_check" CHECK ("priceCents" >= 0 AND "unitQuantityMicrounits" > 0 AND "equivalencyMicrounits" > 0);

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_totals_check" CHECK (
    "subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "discountCents" <= "subtotalCents"
    AND "totalCents" = "subtotalCents" - "discountCents" + "taxCents" AND "version" >= 1),
  ADD CONSTRAINT "Cart_totals_present_check" CHECK ("subtotalCents" IS NOT NULL AND "discountCents" IS NOT NULL AND "taxCents" IS NOT NULL AND "totalCents" IS NOT NULL AND "version" IS NOT NULL),
  ADD CONSTRAINT "Cart_pickup_window_check" CHECK ("pickupWindowStart" IS NULL OR "pickupWindowEnd" IS NULL OR "pickupWindowEnd" > "pickupWindowStart");

ALTER TABLE "CartLine"
  ADD CONSTRAINT "CartLine_totals_check" CHECK (
    "quantityMicrounits" > 0 AND "equivalencyMicrounits" > 0 AND "unitPriceCents" >= 0 AND "subtotalCents" >= 0
    AND "discountCents" IS NOT NULL AND "discountCents" >= 0 AND "discountCents" <= "subtotalCents" AND "taxCents" >= 0
    AND "taxBasisPoints" BETWEEN 0 AND 100000
    AND "totalCents" = "subtotalCents" - "discountCents" + "taxCents");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_totals_check" CHECK (
    "subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "discountCents" <= "subtotalCents"
    AND "totalCents" = "subtotalCents" - "discountCents" + "taxCents"
    AND "refundedCents" IS NOT NULL AND "refundedCents" >= 0 AND "refundedCents" <= "totalCents");

ALTER TABLE "SaleLine"
  ADD CONSTRAINT "SaleLine_amounts_check" CHECK (
    "quantityMicrounits" > 0 AND "equivalencyMicrounits" > 0 AND "unitPriceCents" >= 0
    AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0);

ALTER TABLE "Tender"
  ADD CONSTRAINT "Tender_amounts_check" CHECK (
    "amountCents" >= 0 AND ("changeCents" IS NULL OR "changeCents" >= 0)
    AND ("tenderedCents" IS NULL OR "tenderedCents" >= "amountCents"));

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_amount_check" CHECK ("amountCents" > 0);

ALTER TABLE "RegisterShift"
  ADD CONSTRAINT "RegisterShift_cash_check" CHECK (
    "openingFloatCents" >= 0 AND ("expectedCashCents" IS NULL OR "expectedCashCents" >= 0)
    AND ("actualCashCents" IS NULL OR "actualCashCents" >= 0)
    AND ("varianceCents" IS NULL OR "varianceCents" = "actualCashCents" - "expectedCashCents"));

ALTER TABLE "StaffCredential"
  ADD CONSTRAINT "StaffCredential_window_check" CHECK ("expiresAt" > "effectiveAt" AND ("approvalLimitCents" IS NULL OR "approvalLimitCents" >= 0));

ALTER TABLE "EligibilityEvidence"
  ADD CONSTRAINT "EligibilityEvidence_allotment_check" CHECK ("allotmentRemainingMicrounits" IS NULL OR "allotmentRemainingMicrounits" >= 0);

-- Time: every effective interval runs forwards.
ALTER TABLE "JurisdictionRulePack"
  ADD CONSTRAINT "JurisdictionRulePack_policy_check" CHECK (
    "expiresAt" > "effectiveAt"
    AND "adultMinimumAge" BETWEEN 0 AND 120 AND "medicalMinimumAge" BETWEEN 0 AND 120
    AND "operatingStartMinute" BETWEEN 0 AND 1439 AND "operatingEndMinute" BETWEEN 0 AND 1439);
ALTER TABLE "CannabisLicense" ADD CONSTRAINT "CannabisLicense_window_check" CHECK ("expiresAt" > "effectiveAt");
ALTER TABLE "TenderConfiguration" ADD CONSTRAINT "TenderConfiguration_window_check" CHECK ("expiresAt" > "effectiveAt");
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_release_check" CHECK ("releasedAt" IS NULL OR "releasedAt" >= "placedAt");

-- Uniqueness: one effective rule pack per premises, one unresolved shift per register, one sale per cart.
CREATE UNIQUE INDEX "JurisdictionRulePack_one_effective_per_premises_key"
  ON "JurisdictionRulePack" ("premises") WHERE "status" = 'effective';
CREATE UNIQUE INDEX "RegisterShift_one_unresolved_per_register_key"
  ON "RegisterShift" ("register") WHERE "status" IN ('open', 'count_pending', 'counted', 'variance_review');
CREATE UNIQUE INDEX "Sale_one_per_cart_key" ON "Sale" ("cart") WHERE "cart" IS NOT NULL;
