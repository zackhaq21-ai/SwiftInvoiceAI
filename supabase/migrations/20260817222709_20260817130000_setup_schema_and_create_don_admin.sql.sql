-- Combined schema setup + admin user creation for don@krushexclusive.com

-- ===== Migration 1: create_invoice_schema =====
CREATE TABLE IF NOT EXISTS business_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Business',
  email text,
  phone text,
  address text,
  logo_url text,
  tax_rate numeric(5,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  currency_symbol text DEFAULT '$',
  invoice_prefix text DEFAULT 'INV',
  next_invoice_number integer DEFAULT 1,
  notes text,
  accent_color text DEFAULT '#2563eb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_business_profile" ON business_profile FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_business_profile" ON business_profile FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_business_profile" ON business_profile FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_business_profile" ON business_profile FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  company text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text,
  client_email text,
  client_address text,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  notes text,
  terms text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(12,2) DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_invoice_items" ON invoice_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_invoice_items" ON invoice_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_invoice_items" ON invoice_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_invoice_items" ON invoice_items FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

INSERT INTO business_profile (name) SELECT 'My Business' WHERE NOT EXISTS (SELECT 1 FROM business_profile);

-- ===== Migration 2: multi_tenant_auth_and_subscriptions =====
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_business_profile_user_id ON business_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_user_id ON invoice_items(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_subscription" ON subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_subscription" ON subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_subscription" ON subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_business_profile" ON business_profile;
DROP POLICY IF EXISTS "anon_insert_business_profile" ON business_profile;
DROP POLICY IF EXISTS "anon_update_business_profile" ON business_profile;
DROP POLICY IF EXISTS "anon_delete_business_profile" ON business_profile;
CREATE POLICY "select_own_business_profile" ON business_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_business_profile" ON business_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_business_profile" ON business_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_business_profile" ON business_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_clients" ON clients;
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "select_own_clients" ON clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_clients" ON clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_clients" ON clients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_clients" ON clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "select_own_invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "anon_insert_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "anon_update_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "anon_delete_invoice_items" ON invoice_items;
CREATE POLICY "select_own_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_invoice_items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_invoice_items" ON invoice_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_invoice_items" ON invoice_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===== Migration 3: fix_handle_new_user_trigger (same as above, already set) =====

-- ===== Migration 4: add_invoice_extra_fields =====
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS work_order_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fees_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS warranty text;

-- ===== Migration 5: add_invoice_payments =====
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS hearth_status text,
  ADD COLUMN IF NOT EXISTS hearth_application_url text;
ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS payments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hearth_merchant_url text,
  ADD COLUMN IF NOT EXISTS hearth_enabled boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id ON invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id ON invoices(stripe_payment_intent_id);

-- ===== Migration 6: create_logo_storage_bucket =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos','logos',true,2097152,ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "logos_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');
CREATE POLICY "logos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===== Migration 7: enhance_line_items_and_product_catalog =====
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'service';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'ea';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'services';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id text;

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
CREATE POLICY "select_own_products" ON products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_products" ON products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_products" ON products FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_products" ON products FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ===== Migration 8: add_industry_template_metadata =====
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS industry_template text DEFAULT 'general';
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS industry_template text DEFAULT 'general';

-- ===== Migration 9: add_estimates_payments_expenses_recurring =====
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
CREATE POLICY "select_own_payments" ON invoice_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_payments" ON invoice_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_payments" ON invoice_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_payments" ON invoice_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id ON invoice_payments(user_id);

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
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ===== Migration 10: add_product_image_and_extra_fields =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes text;

-- ===== Migration 11: create_product_images_storage_bucket =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images','product-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "product_images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');
CREATE POLICY "product_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Migration 12: add_image_url_to_invoice_items =====
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS image_url text;

-- ===== Migration 13: tender_silence (stripe tables) =====
CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own customer data" ON stripe_customers FOR SELECT TO authenticated USING (user_id = auth.uid() AND deleted_at IS NULL);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_subscription_status') THEN
    CREATE TYPE stripe_subscription_status AS ENUM ('not_started','incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default null,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscription data" ON stripe_subscriptions FOR SELECT TO authenticated USING (customer_id IN (SELECT customer_id FROM stripe_customers WHERE user_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_order_status') THEN
    CREATE TYPE stripe_order_status AS ENUM ('pending','completed','canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_orders (
  id bigint primary key generated always as identity,
  checkout_session_id text not null,
  payment_intent_id text not null,
  customer_id text not null,
  amount_subtotal bigint not null,
  amount_total bigint not null,
  currency text not null,
  payment_status text not null,
  status stripe_order_status not null default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);
ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own order data" ON stripe_orders FOR SELECT TO authenticated USING (customer_id IN (SELECT customer_id FROM stripe_customers WHERE user_id = auth.uid() AND deleted_at IS NULL) AND deleted_at IS NULL);

CREATE OR REPLACE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT c.customer_id, s.subscription_id, s.status as subscription_status, s.price_id, s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.payment_method_brand, s.payment_method_last4
FROM stripe_customers c LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid() AND c.deleted_at IS NULL AND s.deleted_at IS NULL;
GRANT SELECT ON stripe_user_subscriptions TO authenticated;

CREATE OR REPLACE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT c.customer_id, o.id as order_id, o.checkout_session_id, o.payment_intent_id, o.amount_subtotal, o.amount_total, o.currency, o.payment_status, o.status as order_status, o.created_at as order_date
FROM stripe_customers c LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid() AND c.deleted_at IS NULL AND o.deleted_at IS NULL;
GRANT SELECT ON stripe_user_orders TO authenticated;

-- ===== Migration 14: fix_handle_new_user_security =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_admin" ON admin_users FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_tier()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN 'admin'
  ELSE COALESCE((SELECT tier FROM public.subscriptions WHERE user_id = auth.uid()), 'free') END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_tier() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_invoice_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_tier text; invoice_count integer; max_invoices integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    user_tier := public.get_user_tier();
    IF user_tier IN ('admin', 'business', 'enterprise') THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO invoice_count FROM public.invoices WHERE user_id = NEW.user_id AND document_type = 'invoice';
    IF user_tier = 'pro' THEN max_invoices := 50; ELSE max_invoices := 3; END IF;
    IF invoice_count >= max_invoices THEN
      RAISE EXCEPTION 'Invoice limit reached: your % plan allows % invoices. Please upgrade to create more.', user_tier, max_invoices;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_invoice_limit_trigger ON public.invoices;
CREATE TRIGGER enforce_invoice_limit_trigger BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_limit();

-- ===== Migrations 15-19: lockdown grants =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_limit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tier() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tier() TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON admin_users FROM anon, authenticated;
REVOKE ALL ON admin_users FROM anon;
GRANT SELECT ON admin_users TO authenticated;

-- ===== Create admin user don@krushexclusive.com =====
DO $$
DECLARE new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
  SELECT new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'don@krushexclusive.com', crypt('Krush101$#', gen_salt('bf')), now(), now(), now(), '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'don@krushexclusive.com');
  IF NOT FOUND THEN SELECT id INTO new_user_id FROM auth.users WHERE email = 'don@krushexclusive.com'; END IF;

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  SELECT new_user_id::text, new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', 'don@krushexclusive.com'), 'email', now(), now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = new_user_id);

  INSERT INTO public.admin_users (user_id, email) SELECT new_user_id, 'don@krushexclusive.com'
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = new_user_id);
END $$;
