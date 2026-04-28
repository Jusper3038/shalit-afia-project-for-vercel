ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

UPDATE public.profiles
SET
  is_active = COALESCE(is_active, TRUE),
  deactivated_at = CASE WHEN COALESCE(is_active, TRUE) THEN NULL ELSE COALESCE(deactivated_at, now()) END
WHERE TRUE;

CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform owners can view own record" ON public.platform_owners;
CREATE POLICY "Platform owners can view own record"
ON public.platform_owners
FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_owners
    WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_platform_owner_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.platform_owners;

  IF v_existing_count > 0 THEN
    RETURN public.is_platform_owner(auth.uid());
  END IF;

  INSERT INTO public.platform_owners (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_accounts()
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  name TEXT,
  email TEXT,
  clinic_name TEXT,
  role public.app_role,
  is_active BOOLEAN,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the platform owner can view all accounts';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.id AS profile_id,
    p.name,
    p.email,
    p.clinic_name,
    COALESCE(
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
        ORDER BY CASE WHEN ur.role = 'admin' THEN 0 ELSE 1 END
        LIMIT 1
      ),
      'staff'::public.app_role
    ) AS role,
    p.is_active,
    p.deactivated_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_account_status(
  p_user_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the platform owner can manage account status';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own platform owner account status';
  END IF;

  UPDATE public.profiles
  SET
    is_active = p_is_active,
    deactivated_at = CASE WHEN p_is_active THEN NULL ELSE now() END,
    deactivation_reason = CASE WHEN p_is_active THEN NULL ELSE NULLIF(trim(COALESCE(p_reason, '')), '') END,
    updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_delete_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the platform owner can delete accounts';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own platform owner account';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
  )
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM auth.users
  WHERE id = p_user_id;
END;
$$;
