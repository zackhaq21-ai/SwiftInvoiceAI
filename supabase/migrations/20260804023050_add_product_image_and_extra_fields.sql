/*
# Add image and extra fields to products

Adds the following optional columns to the products table:
- image_url: URL to a product photo stored in Supabase storage
- cost_price: Purchase/cost price for profit-margin tracking
- stock_quantity: Current inventory count
- brand: Brand or manufacturer name
- barcode: Barcode / UPC / QR code value
- notes: Internal notes (not shown on invoices)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
    ALTER TABLE products ADD COLUMN image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
    ALTER TABLE products ADD COLUMN cost_price numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock_quantity') THEN
    ALTER TABLE products ADD COLUMN stock_quantity integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
    ALTER TABLE products ADD COLUMN brand text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN
    ALTER TABLE products ADD COLUMN barcode text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='notes') THEN
    ALTER TABLE products ADD COLUMN notes text;
  END IF;
END $$;
