CREATE INDEX IF NOT EXISTS audit_logs_user_id_created_at_desc_idx
ON public.audit_logs (user_id, created_at DESC);
