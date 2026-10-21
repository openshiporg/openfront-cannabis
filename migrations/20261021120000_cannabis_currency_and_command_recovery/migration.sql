-- AlterTable
ALTER TABLE "Premises" ADD COLUMN     "currencyCode" TEXT;

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "requestSnapshot" JSONB;
