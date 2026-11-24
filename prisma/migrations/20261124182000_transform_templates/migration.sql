CREATE TABLE "TransformTemplate" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "lines" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TransformTemplate_pkey" PRIMARY KEY ("tenantId","id")
);
CREATE UNIQUE INDEX "TransformTemplate_tenantId_name_key" ON "TransformTemplate"("tenantId","name");
ALTER TABLE "TransformTemplate" ADD CONSTRAINT "TransformTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
