/*
# Add image_url to invoice_items

Adds an optional image_url column to invoice_items so that when a product
with a photo is added to an invoice, its image is stored as a snapshot on
the line item and shown in the invoice preview/print.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='invoice_items' AND column_name='image_url'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN image_url text;
  END IF;
END $$;
