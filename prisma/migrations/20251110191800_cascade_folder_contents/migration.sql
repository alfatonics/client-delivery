-- Ensure folder-linked assets and deliveries cascade on delete
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_folderId_fkey";
ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Delivery" DROP CONSTRAINT IF EXISTS "Delivery_folderId_fkey";
ALTER TABLE "Delivery"
ADD CONSTRAINT "Delivery_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

