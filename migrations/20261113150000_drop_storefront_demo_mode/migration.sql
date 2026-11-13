-- AlterEnum
BEGIN;
CREATE TYPE "StorefrontSettingsStorefrontModeType_new" AS ENUM ('configured');
ALTER TABLE "StorefrontSettings" ALTER COLUMN "storefrontMode" DROP DEFAULT;
ALTER TABLE "StorefrontSettings" ALTER COLUMN "storefrontMode" TYPE "StorefrontSettingsStorefrontModeType_new" USING ("storefrontMode"::text::"StorefrontSettingsStorefrontModeType_new");
ALTER TYPE "StorefrontSettingsStorefrontModeType" RENAME TO "StorefrontSettingsStorefrontModeType_old";
ALTER TYPE "StorefrontSettingsStorefrontModeType_new" RENAME TO "StorefrontSettingsStorefrontModeType";
DROP TYPE "StorefrontSettingsStorefrontModeType_old";
ALTER TABLE "StorefrontSettings" ALTER COLUMN "storefrontMode" SET DEFAULT 'configured';
COMMIT;

-- AlterTable
ALTER TABLE "StorefrontSettings" DROP COLUMN "demoCatalog";

