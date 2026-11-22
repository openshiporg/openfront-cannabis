-- Stores set up before the wording fix carry "Sample " at the start of the counter payment agreement.
UPDATE "TenderConfiguration" SET "authorityReference" = substr("authorityReference", 8) WHERE "authorityReference" LIKE 'Sample %';
