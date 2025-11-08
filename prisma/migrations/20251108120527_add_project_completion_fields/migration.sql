-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "completionNotificationCc" TEXT,
ADD COLUMN     "completionNotificationEmail" TEXT,
ADD COLUMN     "completionNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "completionNotifiedById" TEXT,
ADD COLUMN     "completionSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "completionSubmittedById" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_completionSubmittedById_fkey" FOREIGN KEY ("completionSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_completionNotifiedById_fkey" FOREIGN KEY ("completionNotifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
