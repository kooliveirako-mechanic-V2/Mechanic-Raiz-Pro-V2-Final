
CREATE TABLE public.trial_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oficina_id, email_type)
);

ALTER TABLE public.trial_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on trial_email_logs"
  ON public.trial_email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
