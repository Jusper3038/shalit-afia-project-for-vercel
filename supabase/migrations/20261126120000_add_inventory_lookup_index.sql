CREATE INDEX IF NOT EXISTS drugs_user_created_at_idx
  ON public.drugs (user_id, created_at DESC);
