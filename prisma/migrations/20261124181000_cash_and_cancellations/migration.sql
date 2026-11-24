CREATE TYPE "CashMovementKind" AS ENUM ('IN','OUT');
CREATE TABLE "CashMovement" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "shiftId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "kind" "CashMovementKind" NOT NULL,
 "amountCents" BIGINT NOT NULL, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("tenantId","id"),
 CONSTRAINT "cash_movement_positive" CHECK ("amountCents">0)
);
CREATE UNIQUE INDEX "CashMovement_tenantId_requestKey_key" ON "CashMovement"("tenantId","requestKey");
CREATE INDEX "CashMovement_tenantId_shiftId_createdAt_idx" ON "CashMovement"("tenantId","shiftId","createdAt");
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tenantId_shiftId_fkey" FOREIGN KEY ("tenantId","shiftId") REFERENCES "CashShift"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SaleCancellation" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "saleId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "reason" TEXT NOT NULL, "disposition" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SaleCancellation_pkey" PRIMARY KEY ("tenantId","id"),
 CONSTRAINT "sale_cancellation_disposition" CHECK ("disposition" IN ('REVIEW','WASTE'))
);
CREATE UNIQUE INDEX "SaleCancellation_tenantId_saleId_key" ON "SaleCancellation"("tenantId","saleId");
CREATE UNIQUE INDEX "SaleCancellation_tenantId_requestKey_key" ON "SaleCancellation"("tenantId","requestKey");
ALTER TABLE "SaleCancellation" ADD CONSTRAINT "SaleCancellation_tenantId_saleId_fkey" FOREIGN KEY ("tenantId","saleId") REFERENCES "Sale"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
