CREATE OR REPLACE FUNCTION public.get_system_users()
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  name TEXT,
  email TEXT,
  clinic_name TEXT,
  role public.app_role,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view system users';
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
    p.created_at,
    p.updated_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account from this screen';
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
