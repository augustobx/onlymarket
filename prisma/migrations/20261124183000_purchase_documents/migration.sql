CREATE TABLE "Purchase" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
 "actorId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "invoiceRef" TEXT NOT NULL,
 "totalCostCents" BIGINT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Purchase_pkey" PRIMARY KEY ("tenantId","id"),
 CONSTRAINT "purchase_nonnegative" CHECK ("totalCostCents">=0)
);
CREATE UNIQUE INDEX "Purchase_tenantId_requestKey_key" ON "Purchase"("tenantId","requestKey");
CREATE UNIQUE INDEX "Purchase_tenantId_supplierId_invoiceRef_key" ON "Purchase"("tenantId","supplierId","invoiceRef");
CREATE INDEX "Purchase_tenantId_createdAt_idx" ON "Purchase"("tenantId","createdAt");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_branchId_fkey" FOREIGN KEY ("tenantId","branchId") REFERENCES "Branch"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId","supplierId") REFERENCES "Supplier"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD COLUMN "purchaseId" TEXT;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_purchaseId_fkey" FOREIGN KEY ("tenantId","purchaseId") REFERENCES "Purchase"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
