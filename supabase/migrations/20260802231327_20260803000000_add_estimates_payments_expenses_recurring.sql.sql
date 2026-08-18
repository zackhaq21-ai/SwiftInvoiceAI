/*
# Add estimates, partial payments, expenses, deposits/shipping, recurring invoices

## Purpose
Extends the invoicing platform with five major capabilities:
1. Estimates/quotes that can be converted into invoices
2. A partial-payments ledger so invoices can be paid in installments
3. Expense tracking with categories and receipt links
4. Dedicated deposit and shipping fields on invoices
5. Recurring invoice scheduling

## New Tables

### invoice_payments
Records each individual payment made against an invoice (partial or full).
- id (uuid PK)
- invoice_id (uuid FK -> invoices, CASCADE)
- user_id (uuid, owner, DEFAULT auth.uid())
- amount (numeric, the payment amount)
- method (text: 'cash' | 'card' | 'bank' | 'stripe' | 'other')
- reference (text, optional transaction/cheque number)
- paid_at (timestamptz, when the payment was received)
- notes (text, optional)
- created_at, updated_at

### expenses
Tracks business expenses with category, vendor, date, and optional receipt URL.
- id (uuid PK)
- user_id (uuid, owner, DEFAULT auth.uid())
- description (text, what the expense was)
- category (text: e.g. 'materials', 'fuel', 'tools', 'software', 'labor', 'other')
- vendor (text, who you paid)
- amount (numeric, cost)
- expense_date (date, when incurred)
- receipt_url (text, optional link to receipt image/file in storage)
- is_billable (boolean, can this be passed to a client/invoice)
- notes (text, optional)
- created_at, updated_at

## Modified Tables

### invoices — new columns
- document_type (text, DEFAULT 'invoice') — 'invoice' or 'estimate'
- parent_invoice_id (uuid, nullable) — set when an estimate is converted to invoice, links the original estimate
- estimate_number (text, nullable) — separate numbering for estimates (e.g. EST-001)
- deposit_amount (numeric, DEFAULT 0) — required deposit
- shipping_amount (numeric, DEFAULT 0) — shipping/handling charge
- recurring_enabled (boolean, DEFAULT false) — is this a recurring template
- recurring_interval (text, nullable) — 'weekly' | 'monthly' | 'quarterly' | 'yearly'
- recurring_next_date (date, nullable) — next generation date
- converted_at (timestamptz, nullable) — when estimate was converted to invoice

## Security
- RLS enabled on both new tables (invoice_payments, expenses)
- 4 owner-scoped CRUD policies each (select/insert/update/delete), TO authenticated
- All policies use auth.uid() = user_id ownership checks
- Existing invoice policies unchanged (new columns are covered by existing policies since they're on the same table)

## Important Notes
1. All new columns use ADD COLUMN with IF NOT EXISTS for idempotency
2. user_id columns default to auth.uid() so inserts omitting user_id still satisfy RLS
3. No data is lost — all additions are additive
4. Policies are dropped-then-created for idempotent re-runs
*/

-- ============================================================
-- 1. New columns on invoices table
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS estimate_number text,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurring_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_interval text,
  ADD COLUMN IF NOT EXISTS recurring_next_date date,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- ============================================================
-- 2. invoice_payments table (partial payments ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'other',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON invoice_payments;
CREATE POLICY "select_own_payments" ON invoice_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payments" ON invoice_payments;
CREATE POLICY "insert_own_payments" ON invoice_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payments" ON invoice_payments;
CREATE POLICY "update_own_payments" ON invoice_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payments" ON invoice_payments;
CREATE POLICY "delete_own_payments" ON invoice_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id ON invoice_payments(user_id);

-- ============================================================
-- 3. expenses table
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  vendor text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  is_billable boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_expenses" ON expenses;
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_expenses" ON expenses;
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_expenses" ON expenses;
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_expenses" ON expenses;
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
