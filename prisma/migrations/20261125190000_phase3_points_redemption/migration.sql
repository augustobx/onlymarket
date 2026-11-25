ALTER TABLE "Tenant" ADD COLUMN "pointValueCents" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "PointRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "points" BIGINT NOT NULL,
    "valueCents" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointRedemption_pkey" PRIMARY KEY ("tenantId","id")
);

CREATE UNIQUE INDEX "PointRedemption_tenantId_requestKey_key" ON "PointRedemption"("tenantId", "requestKey");

CREATE INDEX "PointRedemption_tenantId_customerId_createdAt_idx" ON "PointRedemption"("tenantId", "customerId", "createdAt");

ALTER TABLE "PointRedemption" ADD CONSTRAINT "PointRedemption_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
