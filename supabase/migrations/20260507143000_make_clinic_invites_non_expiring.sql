CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.clinic_user_invites
ALTER COLUMN expires_at DROP NOT NULL,
ALTER COLUMN expires_at SET DEFAULT NULL;

UPDATE public.clinic_user_invites
SET expires_at = NULL
WHERE status = 'pending';

DROP FUNCTION IF EXISTS public.create_clinic_user_invite(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_clinic_user_invite(TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.create_clinic_user_invite(
  p_invited_email TEXT,
  p_allowed_apps TEXT[],
  p_invited_phone TEXT
)
RETURNS public.clinic_user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  v_code := upper(encode(extensions.gen_random_bytes(4), 'hex'));

  INSERT INTO public.clinic_user_invites (
    owner_user_id,
    invited_email,
    invited_phone,
    invite_code,
    allowed_apps,
    expires_at
  )
  VALUES (
    auth.uid(),
    lower(trim(p_invited_email)),
    COALESCE(trim(p_invited_phone), ''),
    v_code,
    COALESCE(p_allowed_apps, ARRAY['billing']::TEXT[]),
    NULL
  )
  RETURNING *
  INTO v_invite;

  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_clinic_user_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_user_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only clinic owners can remove user access';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.clinic_user_invites
  WHERE id = p_invite_id
    AND owner_user_id = auth.uid()
    AND status IN ('pending', 'accepted');

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.clinic_user_invites
  SET status = 'revoked'
  WHERE id = v_invite.id;

  IF v_invite.accepted_by IS NOT NULL THEN
    UPDATE public.profiles
    SET
      is_active = FALSE,
      allowed_apps = ARRAY[]::TEXT[],
      deactivated_at = now(),
      deactivation_reason = 'Access removed by clinic owner'
    WHERE user_id = v_invite.accepted_by
      AND owner_user_id = auth.uid()
      AND user_id <> auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or revoked clinic invite code';
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
$$;

GRANT EXECUTE ON FUNCTION public.create_clinic_user_invite(TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_clinic_user_invite(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
