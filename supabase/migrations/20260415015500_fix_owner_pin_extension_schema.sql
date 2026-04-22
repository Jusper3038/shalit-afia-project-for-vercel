CREATE OR REPLACE FUNCTION public.set_owner_security_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the clinic owner can manage the security PIN';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'Security PIN must be 4 to 6 digits';
  END IF;

  INSERT INTO public.owner_security_pins (user_id, pin_hash)
  VALUES (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  ON CONFLICT (user_id)
  DO UPDATE SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_owner_security_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pin_hash TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT pin_hash
  INTO v_pin_hash
  FROM public.owner_security_pins
  WHERE user_id = auth.uid();

  IF v_pin_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN extensions.crypt(p_pin, v_pin_hash) = v_pin_hash;
END;
$$;
