-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "parentId" INTEGER;

-- CreateIndex
CREATE INDEX "Task_userId_priority_idx" ON "public"."Task"("userId", "priority");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "public"."Task"("parentId");

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
