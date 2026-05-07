CREATE OR REPLACE FUNCTION public.can_claim_platform_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_profile_created_at TIMESTAMPTZ;
  v_first_profile_created_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_platform_owner(auth.uid()) THEN
    RETURN FALSE;
  END IF;

  SELECT created_at
  INTO v_current_profile_created_at
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_current_profile_created_at IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT created_at
  INTO v_first_profile_created_at
  FROM public.profiles
  ORDER BY created_at ASC, user_id ASC
  LIMIT 1;

  RETURN v_current_profile_created_at = v_first_profile_created_at
    AND NOT EXISTS (SELECT 1 FROM public.platform_owners);
END;
$$;
