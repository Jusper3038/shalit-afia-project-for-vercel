CREATE OR REPLACE FUNCTION public.get_clinic_invite_preview(p_invite_code TEXT)
RETURNS TABLE (
  invite_code TEXT,
  invited_email TEXT,
  invited_phone TEXT,
  clinic_name TEXT,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.invite_code,
    i.invited_email,
    i.invited_phone,
    COALESCE(p.clinic_name, '') AS clinic_name,
    i.status
  FROM public.clinic_user_invites i
  LEFT JOIN public.profiles p
    ON p.user_id = i.owner_user_id
  WHERE i.invite_code = upper(trim(p_invite_code))
  LIMIT 1
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

    IF lower(COALESCE(NEW.email, '')) <> lower(v_invite.invited_email) THEN
      RAISE EXCEPTION 'This invite is for %, but you registered with %', v_invite.invited_email, NEW.email;
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

GRANT EXECUTE ON FUNCTION public.get_clinic_invite_preview(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
