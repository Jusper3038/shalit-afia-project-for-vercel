CREATE TABLE IF NOT EXISTS public.platform_app_releases (
  app_key TEXT PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_app_releases ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_app_releases (app_key, is_enabled)
VALUES
  ('pharmacy', true),
  ('payments', true),
  ('ecommerce', true),
  ('storefront', true),
  ('audit_logs', true),
  ('settings', true)
ON CONFLICT (app_key) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view released platform apps" ON public.platform_app_releases;
CREATE POLICY "Anyone can view released platform apps"
ON public.platform_app_releases
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Platform owner can manage released platform apps" ON public.platform_app_releases;
CREATE POLICY "Platform owner can manage released platform apps"
ON public.platform_app_releases
FOR ALL
USING (public.is_platform_owner(auth.uid()))
WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_platform_app_releases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_platform_app_releases_updated_at ON public.platform_app_releases;
CREATE TRIGGER touch_platform_app_releases_updated_at
BEFORE UPDATE ON public.platform_app_releases
FOR EACH ROW
EXECUTE FUNCTION public.touch_platform_app_releases_updated_at();
