-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentReference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pickupName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pickupPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pickupWindowEnd" TIMESTAMP(3),
ADD COLUMN     "pickupWindowStart" TIMESTAMP(3);
