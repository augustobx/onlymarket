CREATE TABLE "PlatformAdmin" (
 "id" TEXT NOT NULL,"email" TEXT NOT NULL,"passwordHash" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");
CREATE TABLE "PlatformSession" (
 "tokenHash" TEXT NOT NULL,"adminId" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "PlatformSession_expiresAt_idx" ON "PlatformSession"("expiresAt");
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "PlatformAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "PlatformAudit" (
 "id" TEXT NOT NULL,"adminId" TEXT NOT NULL,"action" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"detail" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlatformAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformAudit_createdAt_idx" ON "PlatformAudit"("createdAt");
ALTER TABLE "PlatformAudit" ADD CONSTRAINT "PlatformAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
