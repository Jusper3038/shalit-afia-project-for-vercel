ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_apps TEXT[] NOT NULL DEFAULT ARRAY[
  'dashboard',
  'inventory',
  'patients',
  'billing',
  'payments',
  'audit_logs',
  'settings'
]::TEXT[];

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '';

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '';

UPDATE public.profiles
SET owner_user_id = user_id
WHERE owner_user_id IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN owner_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_owner_user_id_idx
ON public.profiles(owner_user_id);

CREATE TABLE IF NOT EXISTS public.clinic_user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT NOT NULL,
  invited_phone TEXT NOT NULL DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE,
  allowed_apps TEXT[] NOT NULL DEFAULT ARRAY['billing']::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days')
);

ALTER TABLE public.clinic_user_invites
ADD COLUMN IF NOT EXISTS invited_phone TEXT NOT NULL DEFAULT '';

ALTER TABLE public.clinic_user_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_clinic_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_user_id FROM public.profiles WHERE user_id = auth.uid()),
    auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_clinic_user(_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_clinic_owner_id() = _owner_user_id
$$;

CREATE POLICY "Clinic members can view clinic invites"
ON public.clinic_user_invites
FOR SELECT
USING (public.can_access_clinic_user(owner_user_id));

CREATE POLICY "Clinic owners can create clinic invites"
ON public.clinic_user_invites
FOR INSERT
WITH CHECK (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinic owners can update clinic invites"
ON public.clinic_user_invites
FOR UPDATE
USING (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinic members can view clinic profiles"
ON public.profiles
FOR SELECT
USING (public.can_access_clinic_user(owner_user_id));

CREATE POLICY "Clinic owners can update own clinic profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinic members can view clinic drugs"
ON public.drugs
FOR SELECT
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can insert clinic drugs"
ON public.drugs
FOR INSERT
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can update clinic drugs"
ON public.drugs
FOR UPDATE
USING (public.can_access_clinic_user(user_id))
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can delete clinic drugs"
ON public.drugs
FOR DELETE
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can view clinic patients"
ON public.patients
FOR SELECT
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can insert clinic patients"
ON public.patients
FOR INSERT
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can update clinic patients"
ON public.patients
FOR UPDATE
USING (public.can_access_clinic_user(user_id))
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can delete clinic patients"
ON public.patients
FOR DELETE
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can view clinic transactions"
ON public.transactions
FOR SELECT
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can insert clinic transactions"
ON public.transactions
FOR INSERT
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can view clinic payments"
ON public.payments
FOR SELECT
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can insert clinic payments"
ON public.payments
FOR INSERT
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can view clinic audit logs"
ON public.audit_logs
FOR SELECT
USING (public.can_access_clinic_user(user_id));

CREATE POLICY "Clinic members can insert clinic audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (public.can_access_clinic_user(user_id));

CREATE OR REPLACE FUNCTION public.create_clinic_user_invite(
  p_invited_email TEXT,
  p_allowed_apps TEXT[] DEFAULT ARRAY['billing']::TEXT[],
  p_invited_phone TEXT DEFAULT ''
)
RETURNS public.clinic_user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_user_invites%ROWTYPE;
  v_active_invites INTEGER;
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only clinic owners can add users';
  END IF;

  SELECT COUNT(*)
  INTO v_active_invites
  FROM public.clinic_user_invites
  WHERE owner_user_id = auth.uid()
    AND status IN ('pending', 'accepted');

  IF v_active_invites >= 2 THEN
    RAISE EXCEPTION 'Each registered account can add up to 2 users';
  END IF;

  v_code := upper(encode(gen_random_bytes(4), 'hex'));

  INSERT INTO public.clinic_user_invites (owner_user_id, invited_email, invited_phone, invite_code, allowed_apps)
  VALUES (auth.uid(), lower(trim(p_invited_email)), COALESCE(trim(p_invited_phone), ''), v_code, COALESCE(p_allowed_apps, ARRAY['billing']::TEXT[]))
  RETURNING *
  INTO v_invite;

  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clinic_user_apps(
  p_target_user_id UUID,
  p_allowed_apps TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only clinic owners can update user access';
  END IF;

  UPDATE public.profiles
  SET allowed_apps = COALESCE(p_allowed_apps, ARRAY[]::TEXT[])
  WHERE user_id = p_target_user_id
    AND owner_user_id = auth.uid()
    AND user_id <> auth.uid();

  UPDATE public.clinic_user_invites
  SET allowed_apps = COALESCE(p_allowed_apps, ARRAY[]::TEXT[])
  WHERE accepted_by = p_target_user_id
    AND owner_user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clinic_invite_apps(
  p_invite_id UUID,
  p_allowed_apps TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only clinic owners can update invite access';
  END IF;

  UPDATE public.clinic_user_invites
  SET allowed_apps = COALESCE(p_allowed_apps, ARRAY[]::TEXT[])
  WHERE id = p_invite_id
    AND owner_user_id = auth.uid()
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_clinic_user_invites()
RETURNS SETOF public.clinic_user_invites
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.clinic_user_invites
  WHERE owner_user_id = public.current_clinic_owner_id()
  ORDER BY created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.revoke_clinic_user_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only clinic owners can revoke invites';
  END IF;

  UPDATE public.clinic_user_invites
  SET status = 'revoked'
  WHERE id = p_invite_id
    AND owner_user_id = auth.uid()
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invite public.clinic_user_invites%ROWTYPE;
  v_owner_profile public.profiles%ROWTYPE;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'invite_code', '') <> '' THEN
    SELECT *
    INTO v_invite
    FROM public.clinic_user_invites
    WHERE invite_code = upper(trim(NEW.raw_user_meta_data->>'invite_code'))
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired clinic invite code';
    END IF;

    SELECT *
    INTO v_owner_profile
    FROM public.profiles
    WHERE user_id = v_invite.owner_user_id;

    INSERT INTO public.profiles (user_id, owner_user_id, name, email, phone_number, clinic_name, allowed_apps)
    VALUES (
      NEW.id,
      v_invite.owner_user_id,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'phone_number', v_invite.invited_phone, ''),
      COALESCE(v_owner_profile.clinic_name, NEW.raw_user_meta_data->>'clinic_name', ''),
      v_invite.allowed_apps
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');

    UPDATE public.clinic_user_invites
    SET status = 'accepted',
        accepted_by = NEW.id,
        accepted_at = now()
    WHERE id = v_invite.id;

    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, owner_user_id, name, email, phone_number, clinic_name)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'clinic_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_sale(
  p_patient_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_recorded_at TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF public.transactions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_drug public.drugs%ROWTYPE;
  v_quantity INTEGER;
  v_sale_timestamp TIMESTAMPTZ := COALESCE(p_recorded_at, now());
  v_sale_day DATE := timezone('Africa/Nairobi', COALESCE(p_recorded_at, now()))::date;
  v_sale_week_start DATE := (
    timezone('Africa/Nairobi', COALESCE(p_recorded_at, now()))::date
    - (
      EXTRACT(ISODOW FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer - 1
    )
  )::date;
  v_sale_month INTEGER := EXTRACT(MONTH FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer;
  v_sale_year INTEGER := EXTRACT(YEAR FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer;
  v_transaction public.transactions%ROWTYPE;
  v_clinic_owner_id UUID;
  v_maximum_discount_percentage NUMERIC(5,2) := 0;
  v_requested_unit_selling_price NUMERIC(10,2);
  v_protected_unit_selling_price NUMERIC(10,2);
  v_discount_amount NUMERIC(10,2);
  v_discount_percentage NUMERIC(5,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_clinic_owner_id := public.current_clinic_owner_id();

  SELECT minimum_profit_retention_percentage
  INTO v_maximum_discount_percentage
  FROM public.profiles
  WHERE user_id = v_clinic_owner_id;

  v_maximum_discount_percentage := COALESCE(v_maximum_discount_percentage, 0);

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
      AND user_id = v_clinic_owner_id
  ) THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS value
  LOOP
    v_quantity := NULLIF(v_item->>'quantity', '')::integer;

    IF COALESCE(v_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Each sale item must have a positive quantity';
    END IF;

    SELECT *
    INTO v_drug
    FROM public.drugs
    WHERE id = (v_item->>'drug_id')::uuid
      AND user_id = v_clinic_owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found';
    END IF;

    IF v_drug.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_drug.name;
    END IF;

    v_requested_unit_selling_price := COALESCE(
      NULLIF(v_item->>'unit_selling_price', '')::numeric,
      v_drug.selling_price
    );
    v_requested_unit_selling_price := LEAST(v_requested_unit_selling_price, v_drug.selling_price);

    v_protected_unit_selling_price := ROUND(
      GREATEST(
        v_drug.buying_price,
        v_drug.selling_price * (1 - (LEAST(GREATEST(v_maximum_discount_percentage, 0), 100) / 100.0))
      )::numeric,
      2
    );

    IF v_requested_unit_selling_price < v_protected_unit_selling_price THEN
      RAISE EXCEPTION
        'Discount too high for %. Minimum allowed selling price is KSh %.',
        v_drug.name,
        v_protected_unit_selling_price;
    END IF;

    v_discount_amount := ROUND(GREATEST(v_drug.selling_price - v_requested_unit_selling_price, 0)::numeric, 2);
    v_discount_percentage := CASE
      WHEN v_drug.selling_price > 0 THEN
        ROUND(((v_discount_amount / v_drug.selling_price) * 100)::numeric, 2)
      ELSE 0
    END;

    UPDATE public.drugs
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_drug.id
      AND user_id = v_clinic_owner_id;

    INSERT INTO public.transactions (
      user_id,
      patient_id,
      drug_id,
      quantity,
      total_cost,
      date,
      sale_day,
      sale_week_start,
      sale_month,
      sale_year,
      unit_buying_price,
      unit_selling_price,
      unit_list_price,
      discount_percentage,
      discount_amount
    )
    VALUES (
      v_clinic_owner_id,
      p_patient_id,
      v_drug.id,
      v_quantity,
      v_requested_unit_selling_price * v_quantity,
      v_sale_timestamp,
      v_sale_day,
      v_sale_week_start,
      v_sale_month,
      v_sale_year,
      v_drug.buying_price,
      v_requested_unit_selling_price,
      v_drug.selling_price,
      v_discount_percentage,
      v_discount_amount
    )
    RETURNING *
    INTO v_transaction;

    RETURN NEXT v_transaction;
  END LOOP;

  RETURN;
END;
$$;
