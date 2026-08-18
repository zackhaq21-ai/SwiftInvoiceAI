-- ============================================================
-- Fix 1: Lock down SECURITY DEFINER handle_new_user()
-- ============================================================
-- The function is a trigger function called by the database on
-- user signup, not by clients via the REST API. Revoke EXECUTE
-- from anon and authenticated so it cannot be called via RPC.
-- The trigger still works because triggers run with the owner's
-- privileges regardless of caller grants.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============================================================
-- Fix 2: Server-side admin authorization
-- ============================================================
-- Create an admin_users table so admin status is determined by
-- the database, not by hardcoded emails in frontend code.
-- RLS is enabled so only the admin user can see their own admin
-- record; nobody can insert/update/delete admin rows via the API
-- (no policies are granted to anon or authenticated).

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own admin row (to know they're admin)
DROP POLICY IF EXISTS "select_own_admin" ON admin_users;
CREATE POLICY "select_own_admin" ON admin_users FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — admin rows can only be
-- managed via the service role key or direct SQL, never via the API.

-- Create a SECURITY DEFINER function that safely checks if the
-- current user is an admin. This runs with elevated privileges
-- but only returns a boolean — no data exposure.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- Allow authenticated users to call the checker function
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- ============================================================
-- Fix 3: Server-side plan limit enforcement on invoice creation
-- ============================================================
-- Create a function that returns the user's effective tier by
-- checking admin_users first, then subscriptions.
CREATE OR REPLACE FUNCTION public.get_user_tier()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
        THEN 'admin'
      ELSE COALESCE(
        (SELECT tier FROM public.subscriptions WHERE user_id = auth.uid()),
        'free'
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tier() TO authenticated;

-- Create a trigger function that enforces invoice limits on INSERT.
-- Checks the user's tier and counts existing invoices. Admin and
-- unlimited tiers (business, enterprise) bypass the check.
-- Updates to existing invoices are not blocked.
CREATE OR REPLACE FUNCTION public.enforce_invoice_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  invoice_count integer;
  max_invoices integer;
BEGIN
  -- Only check on INSERT (new invoice creation), not UPDATE
  IF TG_OP = 'INSERT' THEN
    -- Determine the user's tier
    user_tier := public.get_user_tier();

    -- Admin, business, and enterprise have unlimited invoices
    IF user_tier IN ('admin', 'business', 'enterprise') THEN
      RETURN NEW;
    END IF;

    -- Count existing invoices for this user (only 'invoice' type, not estimates)
    SELECT COUNT(*) INTO invoice_count
    FROM public.invoices
    WHERE user_id = NEW.user_id
      AND document_type = 'invoice';

    -- Set max based on tier
    IF user_tier = 'pro' THEN
      max_invoices := 50;
    ELSE
      max_invoices := 3; -- free tier
    END IF;

    IF invoice_count >= max_invoices THEN
      RAISE EXCEPTION 'Invoice limit reached: your % plan allows % invoices. Please upgrade to create more.',
        user_tier, max_invoices;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger to the invoices table
DROP TRIGGER IF EXISTS enforce_invoice_limit_trigger ON public.invoices;
CREATE TRIGGER enforce_invoice_limit_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_limit();