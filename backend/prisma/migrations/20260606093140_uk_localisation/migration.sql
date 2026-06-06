-- Rename gstin → vat_number on customers (preserves existing data)
ALTER TABLE "customers" RENAME COLUMN "gstin" TO "vat_number";

-- Rename the company.gstin settings key → company.vat_number
UPDATE "settings" SET key = 'company.vat_number' WHERE key = 'company.gstin';
