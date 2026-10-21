/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canEditOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canSeeOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatusType" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "OrganizationStatusType" AS ENUM ('pending_authority', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "PremisesStatusType" AS ENUM ('pending_authority', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "CannabisLicenseStatusType" AS ENUM ('draft', 'active', 'conditioned', 'suspended', 'expired', 'revoked', 'surrendered');

-- CreateEnum
CREATE TYPE "StaffCredentialStatusType" AS ENUM ('pending', 'active', 'suspended', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "CustomerCapacityType" AS ENUM ('adult_use', 'patient', 'caregiver');

-- CreateEnum
CREATE TYPE "CustomerStatusType" AS ENUM ('pending_verification', 'eligible', 'ineligible', 'suspended');

-- CreateEnum
CREATE TYPE "EligibilityEvidenceCapacityType" AS ENUM ('adult_use', 'patient', 'caregiver');

-- CreateEnum
CREATE TYPE "EligibilityEvidenceResultType" AS ENUM ('pending', 'eligible', 'ineligible', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "JurisdictionRulePackStatusType" AS ENUM ('draft', 'approved', 'effective', 'superseded', 'revoked');

-- CreateEnum
CREATE TYPE "ProductStatusType" AS ENUM ('draft', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "InventoryPackageStatusType" AS ENUM ('expected_inbound', 'receiving_hold', 'quarantined', 'saleable', 'reserved', 'staged', 'transfer_allocated', 'in_transit', 'waste_pending', 'recalled', 'depleted', 'destroyed');

-- CreateEnum
CREATE TYPE "InventoryPackageTestStatusType" AS ENUM ('unknown', 'pending', 'passed', 'failed', 'retest');

-- CreateEnum
CREATE TYPE "PackageHoldTypeType" AS ENUM ('quarantine', 'test_hold', 'recall', 'discrepancy', 'authority', 'expiry');

-- CreateEnum
CREATE TYPE "PackageHoldStatusType" AS ENUM ('active', 'released', 'disposed');

-- CreateEnum
CREATE TYPE "RegulatedManifestTypeType" AS ENUM ('receiving', 'transfer_out', 'transfer_in', 'count', 'adjustment', 'waste', 'destruction', 'recall');

-- CreateEnum
CREATE TYPE "RegulatedManifestStatusType" AS ENUM ('proposed', 'manifested', 'receiving_hold', 'accepted', 'partially_accepted', 'rejected', 'dispatched', 'in_transit', 'completed', 'reconciled');

-- CreateEnum
CREATE TYPE "InventoryEventEventTypeType" AS ENUM ('receive', 'release', 'reserve', 'release_reservation', 'sale', 'return_quarantine', 'transfer_out', 'transfer_in', 'count', 'adjustment', 'waste', 'destruction', 'recall_hold', 'recall_release');

-- CreateEnum
CREATE TYPE "InventoryEventStateReportStatusType" AS ENUM ('local_recorded', 'queued', 'accepted', 'rejected', 'reconciled');

-- CreateEnum
CREATE TYPE "RecallCaseStatusType" AS ENUM ('suspected', 'hold', 'scope_confirmed', 'active', 'monitoring', 'disposition', 'regulator_closed');

-- CreateEnum
CREATE TYPE "RegisterStatusType" AS ENUM ('active', 'inactive', 'maintenance');

-- CreateEnum
CREATE TYPE "RegisterShiftStatusType" AS ENUM ('scheduled', 'open', 'count_pending', 'counted', 'variance_review', 'closed', 'deposited');

-- CreateEnum
CREATE TYPE "CashEventTypeType" AS ENUM ('opening_float', 'sale', 'refund', 'paid_in', 'paid_out', 'safe_drop', 'count', 'deposit');

-- CreateEnum
CREATE TYPE "TenderConfigurationTypeType" AS ENUM ('cash', 'debit', 'ach', 'wallet', 'other');

-- CreateEnum
CREATE TYPE "CartSourceType" AS ENUM ('pos', 'pickup', 'customer_intake');

-- CreateEnum
CREATE TYPE "CartStatusType" AS ENUM ('draft', 'preliminarily_eligible', 'reserved', 'picking', 'staged', 'final_verification', 'completed', 'expired', 'cancelled', 'rejected');

-- CreateEnum
CREATE TYPE "SaleStatusType" AS ENUM ('finalized', 'state_queued', 'state_accepted', 'state_rejected', 'reconciled', 'reversal_pending', 'reversed', 'partially_refunded', 'refunded');

-- CreateEnum
CREATE TYPE "TenderStatusType" AS ENUM ('received', 'authorized', 'captured', 'reversed', 'failed');

-- CreateEnum
CREATE TYPE "RefundInventoryDispositionType" AS ENUM ('none', 'quarantine', 'waste', 'returned_to_authority');

-- CreateEnum
CREATE TYPE "RefundStatusType" AS ENUM ('pending', 'completed', 'failed', 'reconciled');

-- CreateEnum
CREATE TYPE "IdempotencyKeyStatusType" AS ENUM ('processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "OutboxEventStatusType" AS ENUM ('queued', 'sending', 'accepted', 'rejected', 'retryable', 'dead_letter', 'reconciled');

-- CreateEnum
CREATE TYPE "StateEventInboxStatusType" AS ENUM ('received', 'verified', 'processed', 'rejected', 'needs_review');

-- CreateEnum
CREATE TYPE "IntegrationInstallationProviderTypeType" AS ENUM ('traceability', 'patient_registry', 'identity', 'laboratory', 'payment', 'tax');

-- CreateEnum
CREATE TYPE "IntegrationInstallationStatusType" AS ENUM ('unconfigured', 'pending_validation', 'active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "ReconciliationRunTypeType" AS ENUM ('inventory_state_physical', 'sale_package', 'tender_settlement', 'tax', 'cash', 'outbox');

-- CreateEnum
CREATE TYPE "ReconciliationRunStatusType" AS ENUM ('pending', 'running', 'exceptions', 'balanced', 'approved', 'failed');

-- CreateEnum
CREATE TYPE "ComplianceIncidentTypeType" AS ENUM ('refusal_of_sale', 'identity', 'patient_registry_outage', 'traceability_outage', 'payment_ambiguity', 'inventory_discrepancy', 'theft', 'loss', 'diversion', 'recall', 'privacy', 'security', 'system_outage', 'offline_attempt');

-- CreateEnum
CREATE TYPE "ComplianceIncidentSeverityType" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ComplianceIncidentStatusType" AS ENUM ('open', 'contained', 'investigating', 'reported', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplianceIncidentOutageModeType" AS ENUM ('none', 'fail_closed', 'approved_degraded');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canEditOtherPeople",
DROP COLUMN "canManageAllTodos",
DROP COLUMN "canSeeOtherPeople",
ADD COLUMN     "canManageAuthority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCompliance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageFinance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSales" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mfaMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "premises" TEXT,
ADD COLUMN     "status" "UserStatusType" NOT NULL DEFAULT 'active',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "status" "OrganizationStatusType" NOT NULL DEFAULT 'pending_authority',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Premises" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "premisesCode" TEXT NOT NULL DEFAULT '',
    "addressSnapshot" JSONB DEFAULT '{}',
    "timezone" TEXT NOT NULL DEFAULT '',
    "status" "PremisesStatusType" NOT NULL DEFAULT 'pending_authority',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Premises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannabisLicense" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "licenseNumber" TEXT NOT NULL DEFAULT '',
    "licenseType" TEXT NOT NULL DEFAULT '',
    "regulatorName" TEXT NOT NULL DEFAULT '',
    "authorizedActivities" JSONB DEFAULT '[]',
    "status" "CannabisLicenseStatusType" NOT NULL DEFAULT 'draft',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CannabisLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCredential" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "user" TEXT,
    "credentialType" TEXT NOT NULL DEFAULT '',
    "credentialReference" TEXT NOT NULL DEFAULT '',
    "allowedActivities" JSONB DEFAULT '[]',
    "approvalLimitCents" INTEGER DEFAULT 0,
    "status" "StaffCredentialStatusType" NOT NULL DEFAULT 'pending',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "trainingVerifiedAt" TIMESTAMP(3),
    "authorityVerifiedAt" TIMESTAMP(3),
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "user" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "capacity" "CustomerCapacityType" NOT NULL,
    "status" "CustomerStatusType" NOT NULL DEFAULT 'pending_verification',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "intakeProofHash" TEXT NOT NULL DEFAULT '',
    "contact" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityEvidence" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "customer" TEXT,
    "capacity" "EligibilityEvidenceCapacityType" NOT NULL,
    "identityMethod" TEXT NOT NULL DEFAULT '',
    "identityReferenceHash" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "identityExpiresAt" TIMESTAMP(3) NOT NULL,
    "registryName" TEXT NOT NULL DEFAULT '',
    "registryReferenceHash" TEXT NOT NULL DEFAULT '',
    "registryVerifiedAt" TIMESTAMP(3),
    "registryExpiresAt" TIMESTAMP(3),
    "representedPatientReferenceHash" TEXT NOT NULL DEFAULT '',
    "allotmentRemainingMicrounits" INTEGER,
    "result" "EligibilityEvidenceResultType" NOT NULL DEFAULT 'pending',
    "reasonCodes" JSONB DEFAULT '[]',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisdictionRulePack" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "version" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "authorityCitations" JSONB DEFAULT '[]',
    "policyHash" TEXT NOT NULL DEFAULT '',
    "status" "JurisdictionRulePackStatusType" NOT NULL DEFAULT 'draft',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "adultMinimumAge" INTEGER NOT NULL,
    "medicalMinimumAge" INTEGER NOT NULL,
    "operatingStartMinute" INTEGER NOT NULL,
    "operatingEndMinute" INTEGER NOT NULL,
    "purchaseLimits" JSONB DEFAULT '[]',
    "taxRules" JSONB DEFAULT '[]',
    "discountRules" JSONB DEFAULT '[]',
    "allowedTenderTypes" JSONB DEFAULT '[]',
    "labelRequirements" JSONB DEFAULT '[]',
    "returnRules" JSONB DEFAULT '{}',
    "outagePolicy" JSONB DEFAULT '{}',
    "privacyRules" JSONB DEFAULT '{}',
    "retentionRules" JSONB DEFAULT '{}',
    "medicalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offlineSalesAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisdictionRulePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "sku" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "form" TEXT NOT NULL DEFAULT '',
    "categoryCode" TEXT NOT NULL DEFAULT '',
    "unitOfMeasure" TEXT NOT NULL DEFAULT '',
    "unitQuantityMicrounits" INTEGER NOT NULL,
    "equivalencyMicrounits" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "taxCategoryCode" TEXT NOT NULL DEFAULT '',
    "adultUseEligible" BOOLEAN NOT NULL DEFAULT false,
    "medicalEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatusType" NOT NULL DEFAULT 'draft',
    "publicDescription" TEXT NOT NULL DEFAULT '',
    "publicImageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPackage" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "product" TEXT,
    "packageUid" TEXT NOT NULL DEFAULT '',
    "sourcePackageUid" TEXT NOT NULL DEFAULT '',
    "productionBatchNumber" TEXT NOT NULL DEFAULT '',
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "quantityReceivedMicrounits" INTEGER NOT NULL,
    "quantityOnHandMicrounits" INTEGER NOT NULL,
    "reservedMicrounits" INTEGER DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL DEFAULT '',
    "status" "InventoryPackageStatusType" NOT NULL DEFAULT 'expected_inbound',
    "testStatus" "InventoryPackageTestStatusType" NOT NULL DEFAULT 'unknown',
    "labName" TEXT NOT NULL DEFAULT '',
    "labResultReference" TEXT NOT NULL DEFAULT '',
    "coaReference" TEXT NOT NULL DEFAULT '',
    "labVerifiedAt" TIMESTAMP(3),
    "manufacturedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "labelVersion" TEXT NOT NULL DEFAULT '',
    "potencySnapshot" JSONB DEFAULT '{}',
    "lineage" JSONB DEFAULT '[]',
    "version" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageHold" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "package" TEXT,
    "type" "PackageHoldTypeType" NOT NULL,
    "status" "PackageHoldStatusType" NOT NULL DEFAULT 'active',
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "placedBy" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseAuthorityReference" TEXT NOT NULL DEFAULT '',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatedManifest" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "manifestNumber" TEXT NOT NULL DEFAULT '',
    "type" "RegulatedManifestTypeType" NOT NULL,
    "status" "RegulatedManifestStatusType" NOT NULL DEFAULT 'proposed',
    "sourceLicenseNumber" TEXT NOT NULL DEFAULT '',
    "destinationLicenseNumber" TEXT NOT NULL DEFAULT '',
    "transporterReference" TEXT NOT NULL DEFAULT '',
    "regulatorManifestId" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatedManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "package" TEXT,
    "manifest" TEXT,
    "eventType" "InventoryEventEventTypeType" NOT NULL,
    "quantityDeltaMicrounits" INTEGER NOT NULL,
    "beforeQuantityMicrounits" INTEGER NOT NULL,
    "afterQuantityMicrounits" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "approvedBy" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "stateReportStatus" "InventoryEventStateReportStatusType" NOT NULL DEFAULT 'local_recorded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallCase" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" "RecallCaseStatusType" NOT NULL DEFAULT 'suspected',
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "packageUids" JSONB DEFAULT '[]',
    "batchNumbers" JSONB DEFAULT '[]',
    "reason" TEXT NOT NULL DEFAULT '',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecallCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Register" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "status" "RegisterStatusType" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterShift" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "register" TEXT,
    "operator" TEXT,
    "status" "RegisterShiftStatusType" NOT NULL DEFAULT 'scheduled',
    "openingFloatCents" INTEGER NOT NULL,
    "expectedCashCents" INTEGER,
    "actualCashCents" INTEGER,
    "varianceCents" INTEGER,
    "openedAt" TIMESTAMP(3),
    "countedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashEvent" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "shift" TEXT,
    "type" "CashEventTypeType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "approvedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderConfiguration" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "type" "TenderConfigurationTypeType" NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "providerCode" TEXT NOT NULL DEFAULT '',
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "customer" TEXT,
    "shift" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "source" "CartSourceType" NOT NULL,
    "status" "CartStatusType" NOT NULL DEFAULT 'draft',
    "guestProofHash" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rulePack" TEXT,
    "eligibilityEvidence" TEXT,
    "subtotalCents" INTEGER DEFAULT 0,
    "discountCents" INTEGER DEFAULT 0,
    "taxCents" INTEGER DEFAULT 0,
    "totalCents" INTEGER DEFAULT 0,
    "version" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "cart" TEXT,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "package" TEXT,
    "product" TEXT,
    "quantityMicrounits" INTEGER NOT NULL,
    "equivalencyMicrounits" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "categoryCodeSnapshot" TEXT NOT NULL DEFAULT '',
    "packageUidSnapshot" TEXT NOT NULL DEFAULT '',
    "batchSnapshot" TEXT NOT NULL DEFAULT '',
    "potencySnapshot" JSONB DEFAULT '{}',
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER DEFAULT 0,
    "discountSnapshot" JSONB DEFAULT '{}',
    "taxBasisPoints" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "shift" TEXT,
    "customer" TEXT,
    "cart" TEXT,
    "receiptNumber" TEXT NOT NULL DEFAULT '',
    "status" "SaleStatusType" NOT NULL,
    "customerCapacitySnapshot" TEXT NOT NULL DEFAULT '',
    "rulePackVersion" TEXT NOT NULL DEFAULT '',
    "eligibilityEvidenceHash" TEXT NOT NULL DEFAULT '',
    "purchaseLimitEvaluation" JSONB DEFAULT '{}',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "refundedCents" INTEGER DEFAULT 0,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "receiptSnapshot" JSONB DEFAULT '{}',
    "receiptHash" TEXT NOT NULL DEFAULT '',
    "labelSnapshot" JSONB DEFAULT '{}',
    "labelHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "sale" TEXT,
    "package" TEXT,
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "categoryCodeSnapshot" TEXT NOT NULL DEFAULT '',
    "packageUidSnapshot" TEXT NOT NULL DEFAULT '',
    "batchSnapshot" TEXT NOT NULL DEFAULT '',
    "coaReferenceSnapshot" TEXT NOT NULL DEFAULT '',
    "potencySnapshot" JSONB DEFAULT '{}',
    "quantityMicrounits" INTEGER NOT NULL,
    "equivalencyMicrounits" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "discountSnapshot" JSONB DEFAULT '{}',
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "sale" TEXT,
    "configuration" TEXT,
    "typeSnapshot" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "tenderedCents" INTEGER,
    "changeCents" INTEGER DEFAULT 0,
    "status" "TenderStatusType" NOT NULL DEFAULT 'received',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "sale" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "inventoryDisposition" "RefundInventoryDispositionType" NOT NULL,
    "status" "RefundStatusType" NOT NULL DEFAULT 'pending',
    "actor" TEXT,
    "approvedBy" TEXT,
    "originalTenderReference" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "actor" TEXT,
    "action" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "correlationId" TEXT NOT NULL DEFAULT '',
    "reasonCode" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "scope" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "status" "IdempotencyKeyStatusType" NOT NULL DEFAULT 'processing',
    "responseSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB DEFAULT '{}',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" "OutboxEventStatusType" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "regulatorReference" TEXT NOT NULL DEFAULT '',
    "lastErrorCode" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateEventInbox" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "signatureEvidence" TEXT NOT NULL DEFAULT '',
    "status" "StateEventInboxStatusType" NOT NULL DEFAULT 'received',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "payload" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateEventInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationInstallation" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerType" "IntegrationInstallationProviderTypeType" NOT NULL,
    "status" "IntegrationInstallationStatusType" NOT NULL DEFAULT 'unconfigured',
    "credentialReference" TEXT NOT NULL DEFAULT '',
    "facilityReference" TEXT NOT NULL DEFAULT '',
    "capabilities" JSONB DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "type" "ReconciliationRunTypeType" NOT NULL,
    "status" "ReconciliationRunStatusType" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "localSnapshotHash" TEXT NOT NULL DEFAULT '',
    "externalSnapshotHash" TEXT NOT NULL DEFAULT '',
    "discrepancyCount" INTEGER DEFAULT 0,
    "discrepancies" JSONB DEFAULT '[]',
    "owner" TEXT,
    "approvedBy" TEXT,
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceIncident" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "premises" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "type" "ComplianceIncidentTypeType" NOT NULL,
    "severity" "ComplianceIncidentSeverityType" NOT NULL,
    "status" "ComplianceIncidentStatusType" NOT NULL DEFAULT 'open',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "notificationDueAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "affectedPackageUids" JSONB DEFAULT '[]',
    "customerReferenceHash" TEXT NOT NULL DEFAULT '',
    "outageMode" "ComplianceIncidentOutageModeType" NOT NULL DEFAULT 'none',
    "recoveryQueueReference" TEXT NOT NULL DEFAULT '',
    "authorityReference" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "owner" TEXT,
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_jurisdictionCode_idx" ON "Organization"("jurisdictionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Premises_premisesCode_key" ON "Premises"("premisesCode");

-- CreateIndex
CREATE INDEX "Premises_organization_idx" ON "Premises"("organization");

-- CreateIndex
CREATE UNIQUE INDEX "CannabisLicense_licenseNumber_key" ON "CannabisLicense"("licenseNumber");

-- CreateIndex
CREATE INDEX "CannabisLicense_organization_idx" ON "CannabisLicense"("organization");

-- CreateIndex
CREATE INDEX "CannabisLicense_premises_idx" ON "CannabisLicense"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCredential_user_key" ON "StaffCredential"("user");

-- CreateIndex
CREATE INDEX "StaffCredential_organization_idx" ON "StaffCredential"("organization");

-- CreateIndex
CREATE INDEX "StaffCredential_premises_idx" ON "StaffCredential"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_user_key" ON "Customer"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_reference_key" ON "Customer"("reference");

-- CreateIndex
CREATE INDEX "Customer_organization_idx" ON "Customer"("organization");

-- CreateIndex
CREATE INDEX "Customer_premises_idx" ON "Customer"("premises");

-- CreateIndex
CREATE INDEX "EligibilityEvidence_organization_idx" ON "EligibilityEvidence"("organization");

-- CreateIndex
CREATE INDEX "EligibilityEvidence_premises_idx" ON "EligibilityEvidence"("premises");

-- CreateIndex
CREATE INDEX "EligibilityEvidence_customer_idx" ON "EligibilityEvidence"("customer");

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionRulePack_policyHash_key" ON "JurisdictionRulePack"("policyHash");

-- CreateIndex
CREATE INDEX "JurisdictionRulePack_organization_idx" ON "JurisdictionRulePack"("organization");

-- CreateIndex
CREATE INDEX "JurisdictionRulePack_premises_idx" ON "JurisdictionRulePack"("premises");

-- CreateIndex
CREATE INDEX "JurisdictionRulePack_approvedBy_idx" ON "JurisdictionRulePack"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_organization_idx" ON "Product"("organization");

-- CreateIndex
CREATE INDEX "Product_premises_idx" ON "Product"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPackage_packageUid_key" ON "InventoryPackage"("packageUid");

-- CreateIndex
CREATE INDEX "InventoryPackage_organization_idx" ON "InventoryPackage"("organization");

-- CreateIndex
CREATE INDEX "InventoryPackage_premises_idx" ON "InventoryPackage"("premises");

-- CreateIndex
CREATE INDEX "InventoryPackage_product_idx" ON "InventoryPackage"("product");

-- CreateIndex
CREATE INDEX "PackageHold_organization_idx" ON "PackageHold"("organization");

-- CreateIndex
CREATE INDEX "PackageHold_premises_idx" ON "PackageHold"("premises");

-- CreateIndex
CREATE INDEX "PackageHold_package_idx" ON "PackageHold"("package");

-- CreateIndex
CREATE INDEX "PackageHold_placedBy_idx" ON "PackageHold"("placedBy");

-- CreateIndex
CREATE INDEX "PackageHold_releasedBy_idx" ON "PackageHold"("releasedBy");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatedManifest_manifestNumber_key" ON "RegulatedManifest"("manifestNumber");

-- CreateIndex
CREATE INDEX "RegulatedManifest_organization_idx" ON "RegulatedManifest"("organization");

-- CreateIndex
CREATE INDEX "RegulatedManifest_premises_idx" ON "RegulatedManifest"("premises");

-- CreateIndex
CREATE INDEX "RegulatedManifest_actor_idx" ON "RegulatedManifest"("actor");

-- CreateIndex
CREATE INDEX "RegulatedManifest_approvedBy_idx" ON "RegulatedManifest"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEvent_idempotencyKey_key" ON "InventoryEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryEvent_organization_idx" ON "InventoryEvent"("organization");

-- CreateIndex
CREATE INDEX "InventoryEvent_premises_idx" ON "InventoryEvent"("premises");

-- CreateIndex
CREATE INDEX "InventoryEvent_package_idx" ON "InventoryEvent"("package");

-- CreateIndex
CREATE INDEX "InventoryEvent_manifest_idx" ON "InventoryEvent"("manifest");

-- CreateIndex
CREATE INDEX "InventoryEvent_actor_idx" ON "InventoryEvent"("actor");

-- CreateIndex
CREATE INDEX "InventoryEvent_approvedBy_idx" ON "InventoryEvent"("approvedBy");

-- CreateIndex
CREATE INDEX "InventoryEvent_sourceId_idx" ON "InventoryEvent"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "RecallCase_reference_key" ON "RecallCase"("reference");

-- CreateIndex
CREATE INDEX "RecallCase_organization_idx" ON "RecallCase"("organization");

-- CreateIndex
CREATE INDEX "RecallCase_premises_idx" ON "RecallCase"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "Register_code_key" ON "Register"("code");

-- CreateIndex
CREATE INDEX "Register_organization_idx" ON "Register"("organization");

-- CreateIndex
CREATE INDEX "Register_premises_idx" ON "Register"("premises");

-- CreateIndex
CREATE INDEX "RegisterShift_organization_idx" ON "RegisterShift"("organization");

-- CreateIndex
CREATE INDEX "RegisterShift_premises_idx" ON "RegisterShift"("premises");

-- CreateIndex
CREATE INDEX "RegisterShift_register_idx" ON "RegisterShift"("register");

-- CreateIndex
CREATE INDEX "RegisterShift_operator_idx" ON "RegisterShift"("operator");

-- CreateIndex
CREATE INDEX "RegisterShift_approvedBy_idx" ON "RegisterShift"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CashEvent_idempotencyKey_key" ON "CashEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CashEvent_organization_idx" ON "CashEvent"("organization");

-- CreateIndex
CREATE INDEX "CashEvent_premises_idx" ON "CashEvent"("premises");

-- CreateIndex
CREATE INDEX "CashEvent_shift_idx" ON "CashEvent"("shift");

-- CreateIndex
CREATE INDEX "CashEvent_actor_idx" ON "CashEvent"("actor");

-- CreateIndex
CREATE INDEX "CashEvent_approvedBy_idx" ON "CashEvent"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "TenderConfiguration_code_key" ON "TenderConfiguration"("code");

-- CreateIndex
CREATE INDEX "TenderConfiguration_organization_idx" ON "TenderConfiguration"("organization");

-- CreateIndex
CREATE INDEX "TenderConfiguration_premises_idx" ON "TenderConfiguration"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_reference_key" ON "Cart"("reference");

-- CreateIndex
CREATE INDEX "Cart_organization_idx" ON "Cart"("organization");

-- CreateIndex
CREATE INDEX "Cart_premises_idx" ON "Cart"("premises");

-- CreateIndex
CREATE INDEX "Cart_customer_idx" ON "Cart"("customer");

-- CreateIndex
CREATE INDEX "Cart_shift_idx" ON "Cart"("shift");

-- CreateIndex
CREATE INDEX "Cart_rulePack_idx" ON "Cart"("rulePack");

-- CreateIndex
CREATE INDEX "Cart_eligibilityEvidence_idx" ON "Cart"("eligibilityEvidence");

-- CreateIndex
CREATE UNIQUE INDEX "CartLine_idempotencyKey_key" ON "CartLine"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CartLine_organization_idx" ON "CartLine"("organization");

-- CreateIndex
CREATE INDEX "CartLine_premises_idx" ON "CartLine"("premises");

-- CreateIndex
CREATE INDEX "CartLine_cart_idx" ON "CartLine"("cart");

-- CreateIndex
CREATE INDEX "CartLine_package_idx" ON "CartLine"("package");

-- CreateIndex
CREATE INDEX "CartLine_product_idx" ON "CartLine"("product");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNumber_key" ON "Sale"("receiptNumber");

-- CreateIndex
CREATE INDEX "Sale_organization_idx" ON "Sale"("organization");

-- CreateIndex
CREATE INDEX "Sale_premises_idx" ON "Sale"("premises");

-- CreateIndex
CREATE INDEX "Sale_shift_idx" ON "Sale"("shift");

-- CreateIndex
CREATE INDEX "Sale_customer_idx" ON "Sale"("customer");

-- CreateIndex
CREATE INDEX "Sale_cart_idx" ON "Sale"("cart");

-- CreateIndex
CREATE INDEX "SaleLine_organization_idx" ON "SaleLine"("organization");

-- CreateIndex
CREATE INDEX "SaleLine_premises_idx" ON "SaleLine"("premises");

-- CreateIndex
CREATE INDEX "SaleLine_sale_idx" ON "SaleLine"("sale");

-- CreateIndex
CREATE INDEX "SaleLine_package_idx" ON "SaleLine"("package");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_idempotencyKey_key" ON "Tender"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Tender_organization_idx" ON "Tender"("organization");

-- CreateIndex
CREATE INDEX "Tender_premises_idx" ON "Tender"("premises");

-- CreateIndex
CREATE INDEX "Tender_sale_idx" ON "Tender"("sale");

-- CreateIndex
CREATE INDEX "Tender_configuration_idx" ON "Tender"("configuration");

-- CreateIndex
CREATE INDEX "Refund_organization_idx" ON "Refund"("organization");

-- CreateIndex
CREATE INDEX "Refund_premises_idx" ON "Refund"("premises");

-- CreateIndex
CREATE INDEX "Refund_sale_idx" ON "Refund"("sale");

-- CreateIndex
CREATE INDEX "Refund_actor_idx" ON "Refund"("actor");

-- CreateIndex
CREATE INDEX "Refund_approvedBy_idx" ON "Refund"("approvedBy");

-- CreateIndex
CREATE INDEX "AuditEvent_organization_idx" ON "AuditEvent"("organization");

-- CreateIndex
CREATE INDEX "AuditEvent_premises_idx" ON "AuditEvent"("premises");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_idx" ON "AuditEvent"("actor");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_lookupKey_key" ON "IdempotencyKey"("lookupKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_organization_idx" ON "IdempotencyKey"("organization");

-- CreateIndex
CREATE INDEX "IdempotencyKey_premises_idx" ON "IdempotencyKey"("premises");

-- CreateIndex
CREATE INDEX "IdempotencyKey_actor_idx" ON "IdempotencyKey"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventKey_key" ON "OutboxEvent"("eventKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_organization_idx" ON "OutboxEvent"("organization");

-- CreateIndex
CREATE INDEX "OutboxEvent_premises_idx" ON "OutboxEvent"("premises");

-- CreateIndex
CREATE UNIQUE INDEX "StateEventInbox_providerEventId_key" ON "StateEventInbox"("providerEventId");

-- CreateIndex
CREATE INDEX "StateEventInbox_organization_idx" ON "StateEventInbox"("organization");

-- CreateIndex
CREATE INDEX "StateEventInbox_premises_idx" ON "StateEventInbox"("premises");

-- CreateIndex
CREATE INDEX "IntegrationInstallation_organization_idx" ON "IntegrationInstallation"("organization");

-- CreateIndex
CREATE INDEX "IntegrationInstallation_premises_idx" ON "IntegrationInstallation"("premises");

-- CreateIndex
CREATE INDEX "ReconciliationRun_organization_idx" ON "ReconciliationRun"("organization");

-- CreateIndex
CREATE INDEX "ReconciliationRun_premises_idx" ON "ReconciliationRun"("premises");

-- CreateIndex
CREATE INDEX "ReconciliationRun_owner_idx" ON "ReconciliationRun"("owner");

-- CreateIndex
CREATE INDEX "ReconciliationRun_approvedBy_idx" ON "ReconciliationRun"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceIncident_reference_key" ON "ComplianceIncident"("reference");

-- CreateIndex
CREATE INDEX "ComplianceIncident_organization_idx" ON "ComplianceIncident"("organization");

-- CreateIndex
CREATE INDEX "ComplianceIncident_premises_idx" ON "ComplianceIncident"("premises");

-- CreateIndex
CREATE INDEX "ComplianceIncident_actor_idx" ON "ComplianceIncident"("actor");

-- CreateIndex
CREATE INDEX "ComplianceIncident_owner_idx" ON "ComplianceIncident"("owner");

-- CreateIndex
CREATE INDEX "Role_organization_idx" ON "Role"("organization");

-- CreateIndex
CREATE INDEX "User_organization_idx" ON "User"("organization");

-- CreateIndex
CREATE INDEX "User_premises_idx" ON "User"("premises");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premises" ADD CONSTRAINT "Premises_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannabisLicense" ADD CONSTRAINT "CannabisLicense_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannabisLicense" ADD CONSTRAINT "CannabisLicense_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvidence" ADD CONSTRAINT "EligibilityEvidence_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvidence" ADD CONSTRAINT "EligibilityEvidence_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvidence" ADD CONSTRAINT "EligibilityEvidence_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionRulePack" ADD CONSTRAINT "JurisdictionRulePack_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionRulePack" ADD CONSTRAINT "JurisdictionRulePack_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionRulePack" ADD CONSTRAINT "JurisdictionRulePack_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPackage" ADD CONSTRAINT "InventoryPackage_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPackage" ADD CONSTRAINT "InventoryPackage_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPackage" ADD CONSTRAINT "InventoryPackage_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_package_fkey" FOREIGN KEY ("package") REFERENCES "InventoryPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_placedBy_fkey" FOREIGN KEY ("placedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHold" ADD CONSTRAINT "PackageHold_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatedManifest" ADD CONSTRAINT "RegulatedManifest_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatedManifest" ADD CONSTRAINT "RegulatedManifest_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatedManifest" ADD CONSTRAINT "RegulatedManifest_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatedManifest" ADD CONSTRAINT "RegulatedManifest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_package_fkey" FOREIGN KEY ("package") REFERENCES "InventoryPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_manifest_fkey" FOREIGN KEY ("manifest") REFERENCES "RegulatedManifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCase" ADD CONSTRAINT "RecallCase_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_register_fkey" FOREIGN KEY ("register") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_operator_fkey" FOREIGN KEY ("operator") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEvent" ADD CONSTRAINT "CashEvent_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEvent" ADD CONSTRAINT "CashEvent_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEvent" ADD CONSTRAINT "CashEvent_shift_fkey" FOREIGN KEY ("shift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEvent" ADD CONSTRAINT "CashEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEvent" ADD CONSTRAINT "CashEvent_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderConfiguration" ADD CONSTRAINT "TenderConfiguration_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderConfiguration" ADD CONSTRAINT "TenderConfiguration_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_shift_fkey" FOREIGN KEY ("shift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_rulePack_fkey" FOREIGN KEY ("rulePack") REFERENCES "JurisdictionRulePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_eligibilityEvidence_fkey" FOREIGN KEY ("eligibilityEvidence") REFERENCES "EligibilityEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cart_fkey" FOREIGN KEY ("cart") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_package_fkey" FOREIGN KEY ("package") REFERENCES "InventoryPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shift_fkey" FOREIGN KEY ("shift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cart_fkey" FOREIGN KEY ("cart") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_package_fkey" FOREIGN KEY ("package") REFERENCES "InventoryPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_configuration_fkey" FOREIGN KEY ("configuration") REFERENCES "TenderConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateEventInbox" ADD CONSTRAINT "StateEventInbox_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateEventInbox" ADD CONSTRAINT "StateEventInbox_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstallation" ADD CONSTRAINT "IntegrationInstallation_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstallation" ADD CONSTRAINT "IntegrationInstallation_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_organization_fkey" FOREIGN KEY ("organization") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_premises_fkey" FOREIGN KEY ("premises") REFERENCES "Premises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
