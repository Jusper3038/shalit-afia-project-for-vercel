CREATE TABLE IF NOT EXISTS public.owner_security_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_security_pins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_owner_security_pin_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_owner_security_pin_updated_at ON public.owner_security_pins;
CREATE TRIGGER update_owner_security_pin_updated_at
BEFORE UPDATE ON public.owner_security_pins
FOR EACH ROW
EXECUTE FUNCTION public.touch_owner_security_pin_updated_at();

CREATE OR REPLACE FUNCTION public.has_owner_security_pin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_security_pins
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.set_owner_security_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (auth.uid(), crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (user_id)
  DO UPDATE SET pin_hash = crypt(p_pin, gen_salt('bf'));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_owner_security_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

  RETURN crypt(p_pin, v_pin_hash) = v_pin_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_owner_security_pin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the clinic owner can clear the security PIN';
  END IF;

  DELETE FROM public.owner_security_pins
  WHERE user_id = auth.uid();
END;
$$;
