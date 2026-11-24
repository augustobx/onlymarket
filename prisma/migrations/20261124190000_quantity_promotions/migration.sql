ALTER TABLE "Promotion" ADD COLUMN "minimumMilli" BIGINT, ADD COLUMN "buyUnits" INTEGER, ADD COLUMN "payUnits" INTEGER;
ALTER TABLE "Promotion" DROP CONSTRAINT "promotion_valid";
ALTER TABLE "Promotion" ADD CONSTRAINT "promotion_valid" CHECK (
 "startsOn" <= "endsOn" AND ("expiryWithinDays" IS NULL OR "expiryWithinDays" BETWEEN 1 AND 365)
 AND (("buyUnits" IS NULL AND "payUnits" IS NULL AND "discountBps" BETWEEN 1 AND 9999 AND ("minimumMilli" IS NULL OR "minimumMilli">0))
 OR ("buyUnits" IS NOT NULL AND "payUnits" IS NOT NULL AND "buyUnits" BETWEEN 2 AND 100 AND "payUnits" BETWEEN 1 AND "buyUnits"-1 AND "minimumMilli" IS NULL AND "discountBps"=0))
);
ALTER TABLE "SaleLine" ADD COLUMN "promotionLabel" TEXT;
