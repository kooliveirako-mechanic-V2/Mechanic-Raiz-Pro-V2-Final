-- Create table to store payment records
CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficina_id UUID REFERENCES public.oficinas(id) ON DELETE CASCADE,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  mp_payment_id TEXT UNIQUE NOT NULL,
  mp_preference_id TEXT,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  status_detail TEXT,
  valor NUMERIC(10,2) NOT NULL,
  metodo_pagamento TEXT,
  payer_email TEXT,
  payer_name TEXT,
  raw_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view payments from their oficina"
ON public.pagamentos FOR SELECT
USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "System can insert payments"
ON public.pagamentos FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update payments"
ON public.pagamentos FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_pagamentos_mp_payment_id ON public.pagamentos(mp_payment_id);
CREATE INDEX idx_pagamentos_external_reference ON public.pagamentos(external_reference);
CREATE INDEX idx_pagamentos_status ON public.pagamentos(status);

-- Update trigger
CREATE TRIGGER update_pagamentos_updated_at
BEFORE UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();