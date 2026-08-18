/*
# Add extra invoice fields for AI paste-and-fill

1. Modified Tables
- `invoices` — add columns to support richer invoice data:
  - `client_phone` (text) — customer phone number
  - `work_order_number` (text) — job / work order / service order number
  - `technician_name` (text) — technician or service person name
  - `fees_amount` (numeric(12,2), default 0) — additional fees / shipping
  - `warranty` (text) — warranty or guarantee statement

2. Security
- No policy changes. Existing per-user RLS policies on `invoices` cover the new columns automatically.

3. Notes
- All new columns are nullable / have defaults so existing invoices are unaffected.
- The frontend AI parser will populate these columns from pasted invoice text.
*/

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS client_phone text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS work_order_number text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS technician_name text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS fees_amount numeric(12,2) DEFAULT 0;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS warranty text;
