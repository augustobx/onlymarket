CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH','DEBIT','CREDIT','TRANSFER','MIXED');
ALTER TABLE "Sale" ALTER COLUMN "payment" TYPE "SalePaymentMethod" USING ("payment"::text::"SalePaymentMethod");
ALTER TABLE "Sale" ADD COLUMN "cashCents" BIGINT NOT NULL DEFAULT 0, ADD COLUMN "debitCents" BIGINT NOT NULL DEFAULT 0, ADD COLUMN "creditCents" BIGINT NOT NULL DEFAULT 0, ADD COLUMN "transferCents" BIGINT NOT NULL DEFAULT 0;
UPDATE "Sale" SET "cashCents"=CASE WHEN payment='CASH' THEN "totalCents" ELSE 0 END, "debitCents"=CASE WHEN payment='DEBIT' THEN "totalCents" ELSE 0 END, "creditCents"=CASE WHEN payment='CREDIT' THEN "totalCents" ELSE 0 END, "transferCents"=CASE WHEN payment='TRANSFER' THEN "totalCents" ELSE 0 END;
ALTER TABLE "Sale" ADD CONSTRAINT "sale_payment_split_valid" CHECK (
 "cashCents">=0 AND "debitCents">=0 AND "creditCents">=0 AND "transferCents">=0
 AND "cashCents"+"debitCents"+"creditCents"+"transferCents"="totalCents"
 AND ((payment='CASH' AND "cashCents"="totalCents") OR (payment='DEBIT' AND "debitCents"="totalCents") OR (payment='CREDIT' AND "creditCents"="totalCents") OR (payment='TRANSFER' AND "transferCents"="totalCents")
 OR (payment='MIXED' AND (("cashCents">0)::int+("debitCents">0)::int+("creditCents">0)::int+("transferCents">0)::int)>=2))
 AND ((payment='CASH' OR "cashCents">0) AND "tenderedCents" IS NOT NULL AND "changeCents" IS NOT NULL AND "tenderedCents">="cashCents" AND "changeCents"="tenderedCents"-"cashCents" OR (payment<>'CASH' AND "cashCents"=0 AND "tenderedCents" IS NULL AND "changeCents" IS NULL))
);
