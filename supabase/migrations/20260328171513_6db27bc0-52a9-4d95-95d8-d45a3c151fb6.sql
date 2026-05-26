
CREATE TABLE IF NOT EXISTS public.campaign_reactivation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome text,
  telefone text,
  segmento text NOT NULL, -- 'frio', 'morno', 'quente'
  dias_desde_cadastro integer,
  dia_sequencia integer NOT NULL DEFAULT 0, -- 0=pendente, 1=whatsapp enviado, 2=email enviado, 3=whatsapp final
  whatsapp_d1_enviado boolean DEFAULT false,
  email_d2_enviado boolean DEFAULT false,
  whatsapp_d3_enviado boolean DEFAULT false,
  trial_estendido boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.campaign_reactivation ENABLE ROW LEVEL SECURITY;
