-- Stores set up before the wording fix carry "Sample " at the start of the state-system account reference.
UPDATE "IntegrationInstallation" SET "authorityReference" = substr("authorityReference", 8) WHERE "authorityReference" LIKE 'Sample %';
