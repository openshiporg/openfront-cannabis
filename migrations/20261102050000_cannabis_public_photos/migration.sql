-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "photo_extension" TEXT,
ADD COLUMN     "photo_filesize" INTEGER,
ADD COLUMN     "photo_height" INTEGER,
ADD COLUMN     "photo_id" TEXT,
ADD COLUMN     "photo_width" INTEGER;

-- AlterTable
ALTER TABLE "StorefrontSettings" ADD COLUMN     "heroImage_extension" TEXT,
ADD COLUMN     "heroImage_filesize" INTEGER,
ADD COLUMN     "heroImage_height" INTEGER,
ADD COLUMN     "heroImage_id" TEXT,
ADD COLUMN     "heroImage_width" INTEGER;
