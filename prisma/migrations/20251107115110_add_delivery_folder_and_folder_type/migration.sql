-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('PROJECT', 'ASSETS');

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "type" "FolderType" NOT NULL DEFAULT 'PROJECT';

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
