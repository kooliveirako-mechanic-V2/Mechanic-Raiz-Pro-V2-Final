-- Tabela para armazenar chaves de idempotência
-- Protege contra requisições duplicadas em ações críticas

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Chave única por oficina
  UNIQUE(key, oficina_id)
);

-- Índice para busca rápida
CREATE INDEX idx_idempotency_keys_lookup ON public.idempotency_keys(key, oficina_id);
CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys(expires_at);

-- RLS: Apenas service role pode acessar (edge functions)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Função para limpar chaves expiradas (executar via cron job futuro)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
END;
$$;

COMMENT ON TABLE public.idempotency_keys IS 'Armazena chaves de idempotência para proteger contra requisições duplicadas em ações críticas';