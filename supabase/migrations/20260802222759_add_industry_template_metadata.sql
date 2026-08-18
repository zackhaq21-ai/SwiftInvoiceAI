/*
# Add industry template and metadata support

1. New Columns
- `invoices.metadata` (jsonb, default '{}') — stores industry-specific custom field values
  (e.g. model_number, serial_number, refrigerant_type for HVAC; pipe_material, water_heater_details
  for plumbing; vin, mileage, vehicle_make for automotive). The keys are defined dynamically by
  the industry template selected for the invoice.
- `invoices.industry_template` (text, default 'general') — stores the industry template ID
  (e.g. 'hvac', 'plumbing', 'electrical', 'general') so the preview and editor know which
  custom fields to display.
- `business_profile.industry_template` (text, default 'general') — the user's default industry
  template, applied to new invoices automatically.

2. Modified Tables
- `invoices`: adds metadata + industry_template columns
- `business_profile`: adds industry_template column

3. Security
- No RLS changes needed — existing policies already cover all columns on these tables.

4. Notes
- All columns are nullable/defaulted so existing invoices and profiles continue to work.
- metadata uses jsonb for flexible key-value storage of industry-specific fields.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'metadata') THEN
    ALTER TABLE invoices ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'industry_template') THEN
    ALTER TABLE invoices ADD COLUMN industry_template text DEFAULT 'general';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_profile' AND column_name = 'industry_template') THEN
    ALTER TABLE business_profile ADD COLUMN industry_template text DEFAULT 'general';
  END IF;
END $$;
