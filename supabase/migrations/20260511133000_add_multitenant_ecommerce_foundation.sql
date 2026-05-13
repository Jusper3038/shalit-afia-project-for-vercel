CREATE TABLE IF NOT EXISTS public.ecommerce_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#0476a8',
  contact_phone TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ecommerce_stores_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS ecommerce_stores_owner_user_id_idx
ON public.ecommerce_stores(owner_user_id);

CREATE INDEX IF NOT EXISTS ecommerce_stores_status_idx
ON public.ecommerce_stores(status);

CREATE TABLE IF NOT EXISTS public.ecommerce_store_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.ecommerce_stores(id) ON DELETE CASCADE NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  domain_type TEXT NOT NULL DEFAULT 'custom' CHECK (domain_type IN ('subdomain', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disabled')),
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ecommerce_store_domains_hostname_lowercase CHECK (hostname = lower(hostname))
);

CREATE INDEX IF NOT EXISTS ecommerce_store_domains_store_id_idx
ON public.ecommerce_store_domains(store_id);

CREATE TABLE IF NOT EXISTS public.ecommerce_product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.ecommerce_stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug),
  CONSTRAINT ecommerce_product_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS ecommerce_product_categories_store_id_idx
ON public.ecommerce_product_categories(store_id);

CREATE TABLE IF NOT EXISTS public.ecommerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.ecommerce_stores(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.ecommerce_product_categories(id) ON DELETE SET NULL,
  inventory_drug_id UUID REFERENCES public.drugs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at_price NUMERIC(12,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug),
  CONSTRAINT ecommerce_products_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS ecommerce_products_store_id_idx
ON public.ecommerce_products(store_id);

CREATE INDEX IF NOT EXISTS ecommerce_products_category_id_idx
ON public.ecommerce_products(category_id);

CREATE INDEX IF NOT EXISTS ecommerce_products_inventory_drug_id_idx
ON public.ecommerce_products(inventory_drug_id);

CREATE TABLE IF NOT EXISTS public.ecommerce_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.ecommerce_stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecommerce_customers_store_id_idx
ON public.ecommerce_customers(store_id);

CREATE INDEX IF NOT EXISTS ecommerce_customers_phone_idx
ON public.ecommerce_customers(store_id, phone);

CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.ecommerce_stores(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.ecommerce_customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
  delivery_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa', 'card', 'manual')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, order_number)
);

CREATE INDEX IF NOT EXISTS ecommerce_orders_store_id_idx
ON public.ecommerce_orders(store_id);

CREATE INDEX IF NOT EXISTS ecommerce_orders_status_idx
ON public.ecommerce_orders(store_id, status);

CREATE INDEX IF NOT EXISTS ecommerce_orders_created_at_idx
ON public.ecommerce_orders(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ecommerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.ecommerce_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecommerce_order_items_order_id_idx
ON public.ecommerce_order_items(order_id);

CREATE INDEX IF NOT EXISTS ecommerce_order_items_product_id_idx
ON public.ecommerce_order_items(product_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_ecommerce_stores_updated_at ON public.ecommerce_stores;
CREATE TRIGGER touch_ecommerce_stores_updated_at
BEFORE UPDATE ON public.ecommerce_stores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ecommerce_product_categories_updated_at ON public.ecommerce_product_categories;
CREATE TRIGGER touch_ecommerce_product_categories_updated_at
BEFORE UPDATE ON public.ecommerce_product_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ecommerce_products_updated_at ON public.ecommerce_products;
CREATE TRIGGER touch_ecommerce_products_updated_at
BEFORE UPDATE ON public.ecommerce_products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ecommerce_customers_updated_at ON public.ecommerce_customers;
CREATE TRIGGER touch_ecommerce_customers_updated_at
BEFORE UPDATE ON public.ecommerce_customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ecommerce_orders_updated_at ON public.ecommerce_orders;
CREATE TRIGGER touch_ecommerce_orders_updated_at
BEFORE UPDATE ON public.ecommerce_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_ecommerce_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.ecommerce_stores store
      WHERE store.id = p_store_id
        AND store.owner_user_id = public.current_clinic_owner_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.resolve_ecommerce_store_by_slug(p_slug TEXT)
RETURNS SETOF public.ecommerce_stores
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.ecommerce_stores
  WHERE slug = lower(trim(p_slug))
    AND status = 'published'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.resolve_ecommerce_store_by_hostname(p_hostname TEXT)
RETURNS SETOF public.ecommerce_stores
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store.*
  FROM public.ecommerce_stores store
  JOIN public.ecommerce_store_domains domain ON domain.store_id = store.id
  WHERE domain.hostname = lower(trim(p_hostname))
    AND domain.status = 'verified'
    AND store.status = 'published'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_published_ecommerce_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ecommerce_orders orders
    JOIN public.ecommerce_stores store ON store.id = orders.store_id
    WHERE orders.id = p_order_id
      AND store.status = 'published'
  )
$$;

ALTER TABLE public.ecommerce_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_store_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published ecommerce stores are public" ON public.ecommerce_stores;
CREATE POLICY "Published ecommerce stores are public"
ON public.ecommerce_stores
FOR SELECT
USING (status = 'published' OR owner_user_id = public.current_clinic_owner_id());

DROP POLICY IF EXISTS "Clinic owners can create ecommerce stores" ON public.ecommerce_stores;
CREATE POLICY "Clinic owners can create ecommerce stores"
ON public.ecommerce_stores
FOR INSERT
WITH CHECK (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clinic owners can update own ecommerce stores" ON public.ecommerce_stores;
CREATE POLICY "Clinic owners can update own ecommerce stores"
ON public.ecommerce_stores
FOR UPDATE
USING (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clinic owners can delete own ecommerce stores" ON public.ecommerce_stores;
CREATE POLICY "Clinic owners can delete own ecommerce stores"
ON public.ecommerce_stores
FOR DELETE
USING (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public can view verified ecommerce domains" ON public.ecommerce_store_domains;
CREATE POLICY "Public can view verified ecommerce domains"
ON public.ecommerce_store_domains
FOR SELECT
USING (
  status = 'verified'
  OR EXISTS (
    SELECT 1 FROM public.ecommerce_stores store
    WHERE store.id = ecommerce_store_domains.store_id
      AND store.owner_user_id = public.current_clinic_owner_id()
  )
);

DROP POLICY IF EXISTS "Clinic owners can manage ecommerce domains" ON public.ecommerce_store_domains;
CREATE POLICY "Clinic owners can manage ecommerce domains"
ON public.ecommerce_store_domains
FOR ALL
USING (public.can_manage_ecommerce_store(store_id))
WITH CHECK (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Public can view active published ecommerce categories" ON public.ecommerce_product_categories;
CREATE POLICY "Public can view active published ecommerce categories"
ON public.ecommerce_product_categories
FOR SELECT
USING (
  is_active
  AND EXISTS (
    SELECT 1 FROM public.ecommerce_stores store
    WHERE store.id = ecommerce_product_categories.store_id
      AND store.status = 'published'
  )
  OR public.can_manage_ecommerce_store(store_id)
);

DROP POLICY IF EXISTS "Clinic owners can manage ecommerce categories" ON public.ecommerce_product_categories;
CREATE POLICY "Clinic owners can manage ecommerce categories"
ON public.ecommerce_product_categories
FOR ALL
USING (public.can_manage_ecommerce_store(store_id))
WITH CHECK (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Public can view active published ecommerce products" ON public.ecommerce_products;
CREATE POLICY "Public can view active published ecommerce products"
ON public.ecommerce_products
FOR SELECT
USING (
  is_active
  AND EXISTS (
    SELECT 1 FROM public.ecommerce_stores store
    WHERE store.id = ecommerce_products.store_id
      AND store.status = 'published'
  )
  OR public.can_manage_ecommerce_store(store_id)
);

DROP POLICY IF EXISTS "Clinic owners can manage ecommerce products" ON public.ecommerce_products;
CREATE POLICY "Clinic owners can manage ecommerce products"
ON public.ecommerce_products
FOR ALL
USING (public.can_manage_ecommerce_store(store_id))
WITH CHECK (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Clinic owners can view ecommerce customers" ON public.ecommerce_customers;
CREATE POLICY "Clinic owners can view ecommerce customers"
ON public.ecommerce_customers
FOR SELECT
USING (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Public can create ecommerce customers" ON public.ecommerce_customers;
CREATE POLICY "Public can create ecommerce customers"
ON public.ecommerce_customers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ecommerce_stores store
    WHERE store.id = ecommerce_customers.store_id
      AND store.status = 'published'
  )
);

DROP POLICY IF EXISTS "Clinic owners can update ecommerce customers" ON public.ecommerce_customers;
CREATE POLICY "Clinic owners can update ecommerce customers"
ON public.ecommerce_customers
FOR UPDATE
USING (public.can_manage_ecommerce_store(store_id))
WITH CHECK (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Clinic owners can view ecommerce orders" ON public.ecommerce_orders;
CREATE POLICY "Clinic owners can view ecommerce orders"
ON public.ecommerce_orders
FOR SELECT
USING (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Public can create ecommerce orders" ON public.ecommerce_orders;
CREATE POLICY "Public can create ecommerce orders"
ON public.ecommerce_orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ecommerce_stores store
    WHERE store.id = ecommerce_orders.store_id
      AND store.status = 'published'
  )
);

DROP POLICY IF EXISTS "Clinic owners can update ecommerce orders" ON public.ecommerce_orders;
CREATE POLICY "Clinic owners can update ecommerce orders"
ON public.ecommerce_orders
FOR UPDATE
USING (public.can_manage_ecommerce_store(store_id))
WITH CHECK (public.can_manage_ecommerce_store(store_id));

DROP POLICY IF EXISTS "Clinic owners can view ecommerce order items" ON public.ecommerce_order_items;
CREATE POLICY "Clinic owners can view ecommerce order items"
ON public.ecommerce_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.ecommerce_orders orders
    WHERE orders.id = ecommerce_order_items.order_id
      AND public.can_manage_ecommerce_store(orders.store_id)
  )
);

DROP POLICY IF EXISTS "Public can create ecommerce order items" ON public.ecommerce_order_items;
CREATE POLICY "Public can create ecommerce order items"
ON public.ecommerce_order_items
FOR INSERT
WITH CHECK (public.is_published_ecommerce_order(order_id));
