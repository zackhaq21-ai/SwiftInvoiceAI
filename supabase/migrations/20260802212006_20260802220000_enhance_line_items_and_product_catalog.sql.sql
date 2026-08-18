/*
# Enhanced line items, product catalog, and business type

## What this does
Upgrades the invoice data model to support any business type — retail, wholesale,
services, trades, boutiques. Makes line items fully flexible with item types,
units of measure, per-item discounts, and per-item tax rates. Adds a reusable
product/service catalog so businesses can quickly add commonly-sold items to
invoices. Adds business type classification to the business profile and tax ID
to clients for B2B invoicing.

## Changes

### invoice_items table (new columns)
- `item_type` (text, not null, default 'service') — 'product', 'service', 'labor', or 'other'.
- `unit` (text, not null, default 'ea') — unit of measure: ea, hr, day, sq ft, ft, lb, box, lot, etc.
- `tax_rate` (numeric(5,2), nullable) — per-item tax rate that overrides the invoice-level rate when set.
- `discount_amount` (numeric(12,2), not null, default 0) — per-line discount in currency units.
- `notes` (text, nullable) — per-line notes (e.g., "color: white", "warranty: 1 year").

### business_profile table (new column)
- `business_type` (text, not null, default 'services') — 'retail', 'wholesale', 'services', 'trades', 'boutique', 'other'.

### clients table (new column)
- `tax_id` (text, nullable) — client tax ID / VAT number for B2B invoicing.

### New table: products
A reusable catalog of products and services that a business sells frequently.
- `id`, `user_id`, `name`, `description`, `item_type`, `category`, `sku`, `unit`, `unit_price`, `tax_rate`, `is_active`, `created_at`, `updated_at`.

## Security
- Enable RLS on `products` with owner-scoped CRUD policies.
- All new columns on existing tables inherit their table's existing RLS policies.

## Important notes
1. All changes are additive — no data is lost.
2. Existing invoices are unaffected: new columns have defaults.
3. The products catalog is per-user — each business has its own private catalog.
4. Per-item tax_rate is nullable: when null, the invoice-level tax_rate applies.
*/

-- invoice_items: enhanced flexibility
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'service';
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'ea';
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS notes text;

-- business_profile: business type classification
ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'services';

-- clients: tax ID for B2B invoicing
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS tax_id text;

-- products catalog
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'service',
  category text,
  sku text,
  unit text NOT NULL DEFAULT 'ea',
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);