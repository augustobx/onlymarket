CREATE UNIQUE INDEX "SaleLine_tenantId_id_key" ON "SaleLine"("tenantId","id");
CREATE TABLE "SaleReturn" (
 "id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"saleId" TEXT NOT NULL,"saleLineId" TEXT NOT NULL,"shiftId" TEXT NOT NULL,"returnedLotId" TEXT,
 "actorId" TEXT NOT NULL,"requestKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"quantityMilli" BIGINT NOT NULL,
 "refundCents" BIGINT NOT NULL,"costCents" BIGINT NOT NULL,"cashCents" BIGINT NOT NULL,"debitCents" BIGINT NOT NULL,"creditCents" BIGINT NOT NULL,"transferCents" BIGINT NOT NULL,
 "disposition" TEXT NOT NULL,"reason" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("tenantId","id"),
 CONSTRAINT "return_valid" CHECK ("quantityMilli">0 AND "refundCents">=0 AND "costCents">=0 AND "cashCents">=0 AND "debitCents">=0 AND "creditCents">=0 AND "transferCents">=0 AND "cashCents"+"debitCents"+"creditCents"+"transferCents"="refundCents" AND (("disposition"='REVIEW' AND "returnedLotId" IS NOT NULL) OR ("disposition"='WASTE' AND "returnedLotId" IS NULL)))
);
CREATE UNIQUE INDEX "SaleReturn_tenantId_requestKey_key" ON "SaleReturn"("tenantId","requestKey");
CREATE INDEX "SaleReturn_tenantId_saleId_idx" ON "SaleReturn"("tenantId","saleId");
CREATE INDEX "SaleReturn_tenantId_saleLineId_idx" ON "SaleReturn"("tenantId","saleLineId");
CREATE INDEX "SaleReturn_tenantId_shiftId_idx" ON "SaleReturn"("tenantId","shiftId");
CREATE INDEX "SaleReturn_tenantId_createdAt_idx" ON "SaleReturn"("tenantId","createdAt");
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_tenantId_saleId_fkey" FOREIGN KEY ("tenantId","saleId") REFERENCES "Sale"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_tenantId_saleLineId_fkey" FOREIGN KEY ("tenantId","saleLineId") REFERENCES "SaleLine"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_tenantId_shiftId_fkey" FOREIGN KEY ("tenantId","shiftId") REFERENCES "CashShift"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_tenantId_returnedLotId_fkey" FOREIGN KEY ("tenantId","returnedLotId") REFERENCES "Lot"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
