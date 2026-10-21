-- Persist one operator-configured public storefront identity per organization/premises authority scope.
CREATE TYPE "StorefrontSettingsPublicationStatusType" AS ENUM ('draft', 'published');
CREATE TYPE "StorefrontSettingsStorefrontModeType" AS ENUM ('demo', 'configured');

CREATE TABLE "StorefrontSettings" (
    "id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "premises" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "brandHue" INTEGER NOT NULL DEFAULT 215,
    "publicationStatus" "StorefrontSettingsPublicationStatusType" NOT NULL DEFAULT 'draft',
    "storefrontMode" "StorefrontSettingsStorefrontModeType" NOT NULL DEFAULT 'configured',
    "demoCatalog" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontSettings_organization_idx" ON "StorefrontSettings"("organization");
CREATE INDEX "StorefrontSettings_premises_idx" ON "StorefrontSettings"("premises");
CREATE UNIQUE INDEX "StorefrontSettings_authority_scope_key" ON "StorefrontSettings"("organization", "premises");

ALTER TABLE "StorefrontSettings" ADD CONSTRAINT "StorefrontSettings_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontSettings" ADD CONSTRAINT "StorefrontSettings_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
