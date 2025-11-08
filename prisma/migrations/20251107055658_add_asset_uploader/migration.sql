-- Step 1: Add column as nullable first
ALTER TABLE "Asset" ADD COLUMN "uploadedById" TEXT;

-- Step 2: Set uploadedById to project's clientId for existing assets
UPDATE "Asset" 
SET "uploadedById" = (
  SELECT "clientId" 
  FROM "Project" 
  WHERE "Project"."id" = "Asset"."projectId"
)
WHERE "uploadedById" IS NULL;

-- Step 3: Make column NOT NULL (now that all rows have values)
ALTER TABLE "Asset" ALTER COLUMN "uploadedById" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
