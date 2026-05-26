
-- Table to track engagement emails sent to avoid duplicates
CREATE TABLE public.engagement_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  trigger_type text NOT NULL, -- 'abandono_pos_onboarding', 'os_nao_finalizada', 'trial_expirando_com_uso', 'trial_expirou_com_uso'
  context_data jsonb DEFAULT '{}',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_engagement_emails_oficina ON public.engagement_emails(oficina_id, trigger_type);
CREATE INDEX idx_engagement_emails_user ON public.engagement_emails(user_id, trigger_type);

-- Enable RLS
ALTER TABLE public.engagement_emails ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge functions)
CREATE POLICY "Service role only" ON public.engagement_emails FOR ALL USING (false);
