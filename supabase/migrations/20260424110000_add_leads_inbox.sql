CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'homepage_popup',
  page_path TEXT NOT NULL DEFAULT '/',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Platform owner can view leads" ON public.leads;
CREATE POLICY "Platform owner can view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "Platform owner can update leads" ON public.leads;
CREATE POLICY "Platform owner can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.is_platform_owner(auth.uid()))
WITH CHECK (public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "Platform owner can delete leads" ON public.leads;
CREATE POLICY "Platform owner can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.is_platform_owner(auth.uid()));
