CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_id UUID REFERENCES public.drugs(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('opening_balance', 'delivery', 'correction', 'write_off', 'sale')
  ),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  unit_buying_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_buying_price >= 0),
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_after = quantity_before + quantity_change)
);

CREATE INDEX IF NOT EXISTS inventory_movements_user_created_at_idx
  ON public.inventory_movements (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_drug_created_at_idx
  ON public.inventory_movements (drug_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Clinic members can view inventory movements"
ON public.inventory_movements
FOR SELECT
USING (public.can_access_clinic_user(user_id));

REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_clinic_inventory()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = auth.uid()
          AND COALESCE(allowed_apps, ARRAY[]::TEXT[]) @> ARRAY['inventory']::TEXT[]
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_manage_clinic_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic_inventory() TO authenticated;

INSERT INTO public.inventory_movements (
  user_id,
  drug_id,
  product_name,
  batch_number,
  expiry_date,
  movement_type,
  quantity_change,
  quantity_before,
  quantity_after,
  unit_buying_price,
  reason
)
SELECT
  drugs.user_id,
  drugs.id,
  drugs.name,
  drugs.serial_number,
  drugs.expiry_date,
  'opening_balance',
  drugs.stock_quantity,
  0,
  drugs.stock_quantity,
  drugs.buying_price,
  'Opening stock when movement history was enabled'
FROM public.drugs
WHERE drugs.stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_movements movement
    WHERE movement.drug_id = drugs.id
      AND movement.movement_type = 'opening_balance'
  );

CREATE OR REPLACE FUNCTION public.capture_inventory_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity_before INTEGER;
  v_quantity_change INTEGER;
  v_movement_type TEXT;
  v_reason TEXT;
  v_actor_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_quantity_before := 0;
    v_quantity_change := NEW.stock_quantity;
    IF v_quantity_change <= 0 THEN
      RETURN NEW;
    END IF;
    v_movement_type := COALESCE(NULLIF(current_setting('shalit.movement.type', TRUE), ''), 'delivery');
    v_reason := COALESCE(NULLIF(current_setting('shalit.movement.reason', TRUE), ''), 'New batch received');
  ELSE
    v_quantity_before := OLD.stock_quantity;
    v_quantity_change := NEW.stock_quantity - OLD.stock_quantity;
    IF v_quantity_change = 0 THEN
      RETURN NEW;
    END IF;
    v_movement_type := COALESCE(NULLIF(current_setting('shalit.movement.type', TRUE), ''), 'correction');
    v_reason := COALESCE(NULLIF(current_setting('shalit.movement.reason', TRUE), ''), 'Stock count changed outside the movement form');
  END IF;

  IF v_movement_type NOT IN ('delivery', 'correction', 'write_off', 'sale') THEN
    v_movement_type := 'correction';
  END IF;

  SELECT NULLIF(trim(profile.name), '')
  INTO v_actor_name
  FROM public.profiles profile
  WHERE profile.user_id = auth.uid();

  INSERT INTO public.inventory_movements (
    user_id,
    drug_id,
    product_name,
    batch_number,
    expiry_date,
    movement_type,
    quantity_change,
    quantity_before,
    quantity_after,
    unit_buying_price,
    reason,
    created_by,
    created_by_name
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.name,
    NEW.serial_number,
    NEW.expiry_date,
    v_movement_type,
    v_quantity_change,
    v_quantity_before,
    NEW.stock_quantity,
    NEW.buying_price,
    v_reason,
    auth.uid(),
    v_actor_name
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_inventory_stock_movement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_inventory_stock_movement ON public.drugs;
CREATE TRIGGER capture_inventory_stock_movement
AFTER INSERT OR UPDATE OF stock_quantity ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.capture_inventory_stock_movement();

CREATE OR REPLACE FUNCTION public.prevent_deleting_stocked_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stock_quantity > 0 THEN
    RAISE EXCEPTION 'Write off or move the remaining stock before deleting this batch';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_deleting_stocked_batch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_deleting_stocked_batch ON public.drugs;
CREATE TRIGGER prevent_deleting_stocked_batch
BEFORE DELETE ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_deleting_stocked_batch();

CREATE OR REPLACE FUNCTION public.add_inventory_batch(
  p_name TEXT,
  p_serial_number TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_date_of_purchase DATE DEFAULT NULL,
  p_buying_price NUMERIC DEFAULT 0,
  p_selling_price NUMERIC DEFAULT 0,
  p_stock_quantity INTEGER DEFAULT 0,
  p_low_stock_threshold INTEGER DEFAULT 10,
  p_reason TEXT DEFAULT 'New batch received'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_drug_id UUID;
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Product name must be 120 characters or fewer';
  END IF;
  IF p_buying_price IS NULL OR p_buying_price < 0 OR p_selling_price IS NULL OR p_selling_price < p_buying_price THEN
    RAISE EXCEPTION 'Selling price must be at least the non-negative buying price';
  END IF;
  IF p_stock_quantity IS NULL OR p_stock_quantity < 0 OR p_low_stock_threshold IS NULL OR p_low_stock_threshold < 0 THEN
    RAISE EXCEPTION 'Stock and low-stock threshold must be non-negative whole numbers';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_date_of_purchase IS NOT NULL AND p_date_of_purchase > p_expiry_date THEN
    RAISE EXCEPTION 'Date of purchase cannot be after expiry date';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'Add a short delivery or opening-stock note';
  END IF;
  IF char_length(COALESCE(p_serial_number, '')) > 120 THEN
    RAISE EXCEPTION 'Batch number must be 120 characters or fewer';
  END IF;

  v_owner_id := public.current_clinic_owner_id();
  IF NOT public.can_access_clinic_user(v_owner_id) THEN
    RAISE EXCEPTION 'You cannot manage this clinic inventory';
  END IF;

  PERFORM set_config('shalit.movement.type', 'delivery', TRUE);
  PERFORM set_config('shalit.movement.reason', v_reason, TRUE);

  INSERT INTO public.drugs (
    user_id,
    name,
    serial_number,
    expiry_date,
    date_of_purchase,
    buying_price,
    selling_price,
    stock_quantity,
    low_stock_threshold
  )
  VALUES (
    v_owner_id,
    v_name,
    NULLIF(trim(COALESCE(p_serial_number, '')), ''),
    p_expiry_date,
    p_date_of_purchase,
    p_buying_price,
    p_selling_price,
    p_stock_quantity,
    p_low_stock_threshold
  )
  RETURNING id INTO v_drug_id;

  RETURN v_drug_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_stock_change(
  p_drug_id UUID,
  p_movement_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_drug public.drugs%ROWTYPE;
  v_delta INTEGER;
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;
  IF p_movement_type IS NULL OR p_movement_type NOT IN ('delivery', 'correction', 'write_off') THEN
    RAISE EXCEPTION 'Unsupported inventory movement type';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Movement quantity cannot be zero';
  END IF;
  IF p_movement_type IN ('delivery', 'write_off') AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Enter a positive quantity for deliveries and write-offs';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'A reason is required for every stock movement';
  END IF;

  v_owner_id := public.current_clinic_owner_id();
  IF NOT public.can_access_clinic_user(v_owner_id) THEN
    RAISE EXCEPTION 'You cannot manage this clinic inventory';
  END IF;

  SELECT * INTO v_drug
  FROM public.drugs
  WHERE id = p_drug_id AND user_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory batch not found';
  END IF;

  v_delta := CASE WHEN p_movement_type = 'write_off' THEN -p_quantity ELSE p_quantity END;
  IF v_drug.stock_quantity + v_delta < 0 THEN
    RAISE EXCEPTION 'The movement cannot reduce stock below zero';
  END IF;

  PERFORM set_config('shalit.movement.type', p_movement_type, TRUE);
  PERFORM set_config('shalit.movement.reason', v_reason, TRUE);

  UPDATE public.drugs
  SET stock_quantity = stock_quantity + v_delta
  WHERE id = v_drug.id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_inventory_batch(TEXT, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_inventory_stock_change(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_inventory_batch(TEXT, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_stock_change(UUID, TEXT, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.classify_inventory_sale_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.drug_id IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.inventory_movements
  SET movement_type = 'sale',
      reason = 'Stock sold and recorded as a transaction'
  WHERE id = (
    SELECT movement.id
    FROM public.inventory_movements movement
    WHERE movement.drug_id = NEW.drug_id
      AND movement.user_id = NEW.user_id
      AND movement.movement_type = 'correction'
      AND movement.quantity_change = -NEW.quantity
      AND movement.created_at = NEW.created_at
    ORDER BY movement.id DESC
    LIMIT 1
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.classify_inventory_sale_movement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS classify_inventory_sale_movement ON public.transactions;
CREATE TRIGGER classify_inventory_sale_movement
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.classify_inventory_sale_movement();

NOTIFY pgrst, 'reload schema';
