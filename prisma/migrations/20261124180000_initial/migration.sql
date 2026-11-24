-- Initial schema and stock invariants. Verified by CI migration/drift check.
CREATE TYPE "Unit" AS ENUM ('KG', 'UNIT');

CREATE TYPE "Sector" AS ENUM ('BUTCHERY', 'DELI', 'PRODUCE', 'GROCERY', 'OTHER');

CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'REVIEW', 'BLOCKED', 'EXHAUSTED');

CREATE TYPE "MovementKind" AS ENUM ('RECEIPT', 'TRANSFORM_IN', 'TRANSFORM_OUT', 'SALE', 'RETURN', 'WASTE', 'GIFT', 'ADJUSTMENT');

CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'INVENTORY', 'CASHIER');

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT', 'CREDIT', 'TRANSFER');

CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("tenantId", "userId")
);

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "barcode" TEXT,
  "unit" "Unit" NOT NULL,
  "sector" "Sector" NOT NULL,
  "salePriceCents" BIGINT NOT NULL DEFAULT 0,
  "alertDays" INTEGER NOT NULL DEFAULT 3,
  "freshnessDays" INTEGER,
  "openedLifeDays" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Lot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT,
  "code" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresOn" DATE,
  "printedExpiresOn" DATE,
  "openedAt" TIMESTAMP(3),
  "reviewAt" TIMESTAMP(3),
  "quantityMilli" BIGINT NOT NULL,
  "remainingCostCents" BIGINT NOT NULL,
  "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "producedById" TEXT,
  CONSTRAINT "Lot_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Transformation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "sourceLotId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "inputMilli" BIGINT NOT NULL,
  "inputCostCents" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transformation_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "transformationId" TEXT,
  "saleId" TEXT,
  "actorId" TEXT NOT NULL,
  "kind" "MovementKind" NOT NULL,
  "deltaMilli" BIGINT NOT NULL,
  "deltaCostCents" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "LoginLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginLimit_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "invoiceRef" TEXT,
  "quantityMilli" BIGINT NOT NULL,
  "totalCostCents" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "CashShift" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "activeKey" TEXT,
  "openingCents" BIGINT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "countedCents" BIGINT,
  "expectedCents" BIGINT,
  CONSTRAINT "CashShift_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Sale" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "payment" "PaymentMethod" NOT NULL,
  "subtotalCents" BIGINT NOT NULL,
  "totalCents" BIGINT NOT NULL,
  "costCents" BIGINT NOT NULL,
  "tenderedCents" BIGINT,
  "changeCents" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "SaleLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantityMilli" BIGINT NOT NULL,
  "unitPriceCents" BIGINT NOT NULL,
  "subtotalCents" BIGINT NOT NULL,
  "totalCents" BIGINT NOT NULL,
  "costCents" BIGINT NOT NULL,
  "discountBps" INTEGER NOT NULL,
  "promotionId" TEXT,
  CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "lotId" TEXT,
  "name" TEXT NOT NULL,
  "discountBps" INTEGER NOT NULL,
  "expiryWithinDays" INTEGER,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "LotOperation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "quantityMilli" BIGINT NOT NULL DEFAULT 0,
  "costCents" BIGINT NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotOperation_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "occurredOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "SupplierPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "occurredOn" DATE NOT NULL,
  "payment" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("tenantId", "id")
);

CREATE TABLE "CatalogChange" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "previous" TEXT NOT NULL,
  "next" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "Product"("tenantId", "barcode");

CREATE UNIQUE INDEX "Lot_tenantId_branchId_productId_code_key" ON "Lot"("tenantId", "branchId", "productId", "code");

CREATE INDEX "Lot_tenantId_branchId_status_expiresOn_idx" ON "Lot"("tenantId", "branchId", "status", "expiresOn");

CREATE UNIQUE INDEX "Transformation_tenantId_requestKey_key" ON "Transformation"("tenantId", "requestKey");

CREATE INDEX "StockMovement_tenantId_lotId_createdAt_idx" ON "StockMovement"("tenantId", "lotId", "createdAt");

CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE UNIQUE INDEX "Receipt_tenantId_requestKey_key" ON "Receipt"("tenantId", "requestKey");

CREATE UNIQUE INDEX "Receipt_tenantId_lotId_key" ON "Receipt"("tenantId", "lotId");

CREATE INDEX "Receipt_tenantId_supplierId_createdAt_idx" ON "Receipt"("tenantId", "supplierId", "createdAt");

CREATE UNIQUE INDEX "CashShift_tenantId_activeKey_key" ON "CashShift"("tenantId", "activeKey");

CREATE INDEX "CashShift_tenantId_branchId_openedAt_idx" ON "CashShift"("tenantId", "branchId", "openedAt");

CREATE UNIQUE INDEX "Sale_tenantId_requestKey_key" ON "Sale"("tenantId", "requestKey");

CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");

CREATE INDEX "SaleLine_tenantId_saleId_idx" ON "SaleLine"("tenantId", "saleId");

CREATE INDEX "Promotion_tenantId_productId_active_idx" ON "Promotion"("tenantId", "productId", "active");

CREATE UNIQUE INDEX "LotOperation_tenantId_requestKey_key" ON "LotOperation"("tenantId", "requestKey");

CREATE INDEX "LotOperation_tenantId_lotId_createdAt_idx" ON "LotOperation"("tenantId", "lotId", "createdAt");

CREATE UNIQUE INDEX "Expense_tenantId_requestKey_key" ON "Expense"("tenantId", "requestKey");

CREATE INDEX "Expense_tenantId_occurredOn_idx" ON "Expense"("tenantId", "occurredOn");

CREATE UNIQUE INDEX "SupplierPayment_tenantId_requestKey_key" ON "SupplierPayment"("tenantId", "requestKey");

CREATE INDEX "SupplierPayment_tenantId_supplierId_occurredOn_idx" ON "SupplierPayment"("tenantId", "supplierId", "occurredOn");

CREATE INDEX "CatalogChange_tenantId_productId_createdAt_idx" ON "CatalogChange"("tenantId", "productId", "createdAt");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_producedById_fkey" FOREIGN KEY ("tenantId", "producedById") REFERENCES "Transformation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transformation" ADD CONSTRAINT "Transformation_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transformation" ADD CONSTRAINT "Transformation_tenantId_sourceLotId_fkey" FOREIGN KEY ("tenantId", "sourceLotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_transformationId_fkey" FOREIGN KEY ("tenantId", "transformationId") REFERENCES "Transformation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_shiftId_fkey" FOREIGN KEY ("tenantId", "shiftId") REFERENCES "CashShift"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LotOperation" ADD CONSTRAINT "LotOperation_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD CONSTRAINT "lot_nonnegative" CHECK ("quantityMilli" >= 0 AND "remainingCostCents" >= 0 AND ("quantityMilli" <> 0 OR "remainingCostCents" = 0));

ALTER TABLE "Product" ADD CONSTRAINT "product_valid" CHECK ("salePriceCents" >= 0 AND "alertDays" BETWEEN 0 AND 365 AND ("freshnessDays" IS NULL OR "freshnessDays" BETWEEN 1 AND 365) AND ("openedLifeDays" IS NULL OR "openedLifeDays" BETWEEN 1 AND 365));

ALTER TABLE "Promotion" ADD CONSTRAINT "promotion_valid" CHECK ("discountBps" BETWEEN 1 AND 9999 AND "startsOn" <= "endsOn" AND ("expiryWithinDays" IS NULL OR "expiryWithinDays" BETWEEN 1 AND 365));

ALTER TABLE "Receipt" ADD CONSTRAINT "receipt_valid" CHECK ("quantityMilli" > 0 AND "totalCostCents" >= 0);

ALTER TABLE "Sale" ADD CONSTRAINT "sale_valid" CHECK ("totalCents" >= 0 AND "subtotalCents" >= "totalCents" AND "costCents" >= 0);

ALTER TABLE "CashShift" ADD CONSTRAINT "shift_valid" CHECK ("openingCents" >= 0 AND ("countedCents" IS NULL OR "countedCents" >= 0) AND (("closedAt" IS NULL AND "activeKey" IS NOT NULL) OR ("closedAt" IS NOT NULL AND "activeKey" IS NULL)));

ALTER TABLE "Expense" ADD CONSTRAINT "expense_positive" CHECK ("amountCents" > 0);

ALTER TABLE "SupplierPayment" ADD CONSTRAINT "payment_positive" CHECK ("amountCents" > 0);
