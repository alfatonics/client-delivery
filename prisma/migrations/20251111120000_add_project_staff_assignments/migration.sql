-- Drop existing single staff reference and create project staff assignment table

CREATE TABLE "ProjectStaffAssignment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProjectStaffAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectStaffAssignment_projectId_staffId_key"
  ON "ProjectStaffAssignment"("projectId", "staffId");

ALTER TABLE "ProjectStaffAssignment"
  ADD CONSTRAINT "ProjectStaffAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStaffAssignment"
  ADD CONSTRAINT "ProjectStaffAssignment_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStaffAssignment"
  ADD CONSTRAINT "ProjectStaffAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProjectStaffAssignment" ("id", "projectId", "staffId", "assignedAt")
SELECT
  'psa_' || substr(md5(random()::text || clock_timestamp()::text), 1, 21),
  "id",
  "staffId",
  NOW()
FROM "Project"
WHERE "staffId" IS NOT NULL;

ALTER TABLE "Project" DROP COLUMN "staffId";



