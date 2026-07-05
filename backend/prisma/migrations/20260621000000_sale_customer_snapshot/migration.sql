-- Snapshot of the buyer on the sale: walk-in name/email (no Customer row), or a
-- stable copy of a linked customer's name/email at sale time.
ALTER TABLE "sales" ADD COLUMN "customer_name" TEXT;
ALTER TABLE "sales" ADD COLUMN "customer_email" TEXT;
