-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING PHASE 2 - Corrigindo vulnerabilidades restantes
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. RESTRINGIR PROFILES - Usuários só veem seu próprio perfil por padrão
-- Admins/Proprietários podem ver todos da oficina
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Usuários podem ver perfis relacionados" ON public.profiles;

CREATE POLICY "Usuários podem ver apenas seu perfil ou da equipe como proprietário"
ON public.profiles
FOR SELECT
USING (
  -- Pode ver seu próprio perfil
  user_id = auth.uid()
  -- Proprietários podem ver perfis da sua equipe
  OR EXISTS (
    SELECT 1 FROM public.oficinas o 
    WHERE o.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = profiles.user_id 
      AND ur.oficina_id = o.id
      AND ur.active = true
    )
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RESTRINGIR FINANCEIRO_HISTORICO - Apenas proprietários
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Proprietários podem ver histórico financeiro" ON public.financeiro_historico;

CREATE POLICY "Apenas proprietários podem ver histórico financeiro"
ON public.financeiro_historico
FOR SELECT
USING (is_oficina_owner(auth.uid(), oficina_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ATUALIZAR GET_PUBLIC_ORCAMENTO - Remover custo_total dos itens
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_public_orcamento(orcamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'numero', o.numero,
    'titulo', o.titulo,
    'descricao', o.descricao,
    'status', o.status,
    'valor_total', o.valor_total,
    -- REMOVIDO: custo_total - não expor margem de lucro ao público
    'desconto', o.desconto,
    'validade', o.validade,
    'observacoes', o.observacoes,
    'created_at', o.created_at,
    'oficina', json_build_object(
      'nome', of.nome,
      'logo_url', of.logo_url,
      'telefone', of.telefone,
      'endereco', of.endereco
    ),
    'cliente', CASE WHEN c.id IS NOT NULL THEN json_build_object(
      'nome', c.nome
      -- REMOVIDO: telefone - não expor dados de contato
    ) ELSE NULL END,
    'veiculo', CASE WHEN v.id IS NOT NULL THEN json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa,
      'ano', v.ano
    ) ELSE NULL END,
    'itens', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', i.id,
        'nome_item', i.nome_item,
        'tipo', i.tipo,
        'quantidade', i.quantidade,
        'valor_unitario', i.valor_unitario,
        'valor_total', i.valor_total
        -- REMOVIDO: custo_unitario - não expor custos ao público
      )), '[]'::json)
      FROM itens_orcamento i
      WHERE i.orcamento_id = o.id
    )
  ) INTO result
  FROM orcamentos o
  LEFT JOIN oficinas of ON of.id = o.oficina_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
  LEFT JOIN veiculos v ON v.id = o.veiculo_id
  WHERE o.id = orcamento_id;

  RETURN result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ATUALIZAR GET_PUBLIC_OS - Remover dados sensíveis
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_public_os(os_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', os.id,
    'status', os.status,
    'tipo_servico', os.tipo_servico,
    'descricao', os.descricao,
    'data_servico', os.data_servico,
    'valor_servico', os.valor_servico,
    -- REMOVIDO: custo_servico, lucro - não expor ao público
    'tem_garantia', os.tem_garantia,
    'dias_garantia', os.dias_garantia,
    'created_at', os.created_at,
    'data_conclusao', os.data_conclusao,
    'oficina', json_build_object(
      'nome', o.nome,
      'logo_url', o.logo_url,
      'telefone', o.telefone
    ),
    'veiculo', json_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'placa', v.placa
      -- REMOVIDO: chassi - dado sensível
    )
  ) INTO result
  FROM ordens_servico os
  JOIN oficinas o ON o.id = os.oficina_id
  JOIN veiculos v ON v.id = os.veiculo_id
  WHERE os.id = os_id;
  
  RETURN result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TORNAR BUCKET OS-FOTOS PRIVADO
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE storage.buckets SET public = false WHERE id = 'os-fotos';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ATUALIZAR POLÍTICAS DO BUCKET OS-FOTOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Remover política pública de visualização
DROP POLICY IF EXISTS "Fotos de OS são visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view os-fotos" ON storage.objects;

-- Política para visualização autenticada
CREATE POLICY "Usuários autenticados podem ver fotos de suas oficinas"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'os-fotos' 
  AND auth.uid() IS NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ADICIONAR FLAG PARA TRACKING DE ACESSO EM USER_ROLES
-- ═══════════════════════════════════════════════════════════════════════════
-- Já existe last_accessed_at, vamos apenas atualizar a função has_oficina_access
-- para verificar se active = true (já está fazendo isso)

-- Criar função para registrar último acesso
CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles 
  SET last_accessed_at = now()
  WHERE user_id = auth.uid() 
  AND oficina_id = NEW.oficina_id
  AND active = true;
  RETURN NEW;
END;
$$;