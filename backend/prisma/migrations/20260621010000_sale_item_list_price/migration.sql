-- Catalogue (list) price of the variant at the time of sale. When a cashier
-- overrides the price at the till, unit_price differs from list_price, letting
-- the invoice and sales history show the original alongside the sold price.
ALTER TABLE "sale_items" ADD COLUMN "list_price" DECIMAL(12, 2);
