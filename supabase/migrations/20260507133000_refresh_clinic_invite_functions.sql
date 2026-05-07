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
  VALUES (
    auth.uid(),
    lower(trim(p_invited_email)),
    COALESCE(trim(p_invited_phone), ''),
    v_code,
    COALESCE(p_allowed_apps, ARRAY['billing']::TEXT[])
  )
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

GRANT EXECUTE ON FUNCTION public.create_clinic_user_invite(TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clinic_user_apps(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clinic_invite_apps(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_user_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_clinic_user_invite(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
