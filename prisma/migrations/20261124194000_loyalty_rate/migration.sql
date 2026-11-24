ALTER TABLE "Tenant" ADD COLUMN "memberDiscountBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD CONSTRAINT "member_discount_valid" CHECK ("memberDiscountBps" BETWEEN 0 AND 9999);
ALTER TABLE "Sale" ADD COLUMN "pointsRateCents" BIGINT;
ALTER TABLE "Sale" ADD CONSTRAINT "points_rate_valid" CHECK ("pointsRateCents" IS NULL OR "pointsRateCents">0);
