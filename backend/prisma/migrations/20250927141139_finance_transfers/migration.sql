-- CreateEnum
CREATE TYPE "public"."TransactionGroupType" AS ENUM ('TRANSFER', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "public"."TransferDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "public"."FinanceTransaction" ADD COLUMN     "groupId" UUID,
ADD COLUMN     "groupType" "public"."TransactionGroupType",
ADD COLUMN     "transferAccountId" INTEGER,
ADD COLUMN     "transferDirection" "public"."TransferDirection";

-- CreateIndex
CREATE INDEX "FinanceTransaction_groupId_idx" ON "public"."FinanceTransaction"("groupId");

-- AddForeignKey
ALTER TABLE "public"."FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "public"."FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
