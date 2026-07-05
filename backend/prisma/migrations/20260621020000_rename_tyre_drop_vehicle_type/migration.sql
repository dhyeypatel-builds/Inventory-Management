-- Rename the over-specific "Car Tyre" product type to the generic "Tyre" so it
-- reads sensibly alongside the vehicle-segment categories (Bike, Truck, Bus…).
UPDATE "product_types" SET "name" = 'Tyre' WHERE "name" = 'Car Tyre';

-- Drop the redundant "Vehicle Type" attribute: vehicle segment is already
-- captured by Category, so staff aren't asked for it twice. Remove dependent
-- variant values first (no cascade on that FK); attribute_options cascade with
-- the attribute itself.
DELETE FROM "variant_attribute_values"
  WHERE "attribute_id" IN (SELECT "id" FROM "attributes" WHERE "code" = 'vehicle_type');
DELETE FROM "attributes" WHERE "code" = 'vehicle_type';
