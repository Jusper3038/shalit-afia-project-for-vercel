CREATE OR REPLACE FUNCTION public.set_owner_security_pin(
  p_pin TEXT,
  p_current_pin TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing_hash TEXT;
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

  SELECT pin_hash
  INTO v_existing_hash
  FROM public.owner_security_pins
  WHERE user_id = auth.uid();

  IF v_existing_hash IS NOT NULL THEN
    IF p_current_pin IS NULL OR extensions.crypt(p_current_pin, v_existing_hash) <> v_existing_hash THEN
      RAISE EXCEPTION 'Current Security PIN is incorrect';
    END IF;
  END IF;

  INSERT INTO public.owner_security_pins (user_id, pin_hash)
  VALUES (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  ON CONFLICT (user_id)
  DO UPDATE SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'));
END;
$$;
