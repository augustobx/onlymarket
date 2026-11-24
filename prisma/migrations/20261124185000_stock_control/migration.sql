CREATE TABLE "StockControl" (
 "id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"sourceLotId" TEXT NOT NULL,"destinationLotId" TEXT,
 "actorId" TEXT NOT NULL,"requestKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"kind" TEXT NOT NULL,
 "beforeMilli" BIGINT NOT NULL,"afterMilli" BIGINT NOT NULL,"quantityMilli" BIGINT NOT NULL,"costCents" BIGINT NOT NULL,
 "reason" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StockControl_pkey" PRIMARY KEY ("tenantId","id"),
 CONSTRAINT "stock_control_valid" CHECK ("beforeMilli">=0 AND "afterMilli">=0 AND "quantityMilli"=ABS("afterMilli"-"beforeMilli") AND "costCents">=0 AND (("kind"='COUNT' AND "destinationLotId" IS NULL) OR ("kind"='TRANSFER' AND "destinationLotId" IS NOT NULL AND "afterMilli"<"beforeMilli")))
);
CREATE UNIQUE INDEX "StockControl_tenantId_requestKey_key" ON "StockControl"("tenantId","requestKey");
CREATE INDEX "StockControl_tenantId_sourceLotId_createdAt_idx" ON "StockControl"("tenantId","sourceLotId","createdAt");
CREATE INDEX "StockControl_tenantId_destinationLotId_idx" ON "StockControl"("tenantId","destinationLotId");
ALTER TABLE "StockControl" ADD CONSTRAINT "StockControl_tenantId_sourceLotId_fkey" FOREIGN KEY ("tenantId","sourceLotId") REFERENCES "Lot"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockControl" ADD CONSTRAINT "StockControl_tenantId_destinationLotId_fkey" FOREIGN KEY ("tenantId","destinationLotId") REFERENCES "Lot"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "StockTarget" (
 "tenantId" TEXT NOT NULL,"branchId" TEXT NOT NULL,"productId" TEXT NOT NULL,"minimumMilli" BIGINT NOT NULL,"targetMilli" BIGINT NOT NULL,
 CONSTRAINT "StockTarget_pkey" PRIMARY KEY ("tenantId","branchId","productId"),
 CONSTRAINT "stock_target_valid" CHECK ("minimumMilli">=0 AND "targetMilli">="minimumMilli")
);
ALTER TABLE "StockTarget" ADD CONSTRAINT "StockTarget_tenantId_branchId_fkey" FOREIGN KEY ("tenantId","branchId") REFERENCES "Branch"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTarget" ADD CONSTRAINT "StockTarget_tenantId_productId_fkey" FOREIGN KEY ("tenantId","productId") REFERENCES "Product"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
